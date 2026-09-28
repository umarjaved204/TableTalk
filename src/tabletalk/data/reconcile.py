"""Combining a results source with the published fixture list.

Two sources, two jobs:

* the **results** source (football-data.co.uk) is authoritative for scores;
* the **fixtures** source (openfootball) is authoritative for the schedule -
  which matches exist and when they are played.

They overlap: the fixture list also contains the matches already played. So a
naive concatenation would double-count the season. Reconciling means: keep every
played result as it stands, and keep the fixture-list entries that have *not*
happened yet.

Matching rule: ``(season, home team, away team)``, not the date. Dates disagree
between sources all the time (postponements, TV rescheduling), whereas the
pairing and the venue do not. Where a pair meets twice at the same ground (a
four-meeting league), the fixture entries for that pair are consumed in date
order, earliest first.

Any mismatch is reported loudly rather than patched over: a played result with no
entry in the fixture list almost always means a team name that did not normalise,
which would otherwise become a phantom extra team in the simulation.

Scores from more than one source
--------------------------------
A season can have several sources with a score for the same match: two results
sources (football-data.co.uk and football-data.org), and a fixture list that
carries scores of its own (openfootball). The rule is simple: **wherever two
sources both have a result for the same match, the scores must agree, or the
run stops** (:class:`SourceMismatchError`). A source that has no result yet
(it lags) is not a disagreement. There is no "trust source X" tie-break: a
disagreement means one of them is wrong, and a person should look.
"""

from __future__ import annotations

import logging
from collections import Counter

import pandas as pd

from ..config import CompetitionConfig
from .schema import validate_matches

logger = logging.getLogger(__name__)


class ReconciliationError(ValueError):
    """Raised when results and the fixture list cannot be matched up."""


class SourceMismatchError(ReconciliationError):
    """Raised when two sources report different scores for the same match."""


def _pair_key(frame: pd.DataFrame) -> pd.Series:
    return (
        frame["season"].astype("string")
        + "|"
        + frame["home_team"].astype("string")
        + "|"
        + frame["away_team"].astype("string")
    )


def meeting_key(frame: pd.DataFrame) -> pd.Series:
    """``season|home|away|n``: one key per meeting, ``n`` counting repeat meetings
    at the same ground in date order (always 0 in a two-meeting league)."""
    ordered = frame.sort_values("date", kind="stable")
    pair = _pair_key(ordered)
    nth = ordered.groupby(pair, sort=False).cumcount().astype("string")
    return (pair + "|" + nth).reindex(frame.index)


def _played(frame: pd.DataFrame) -> pd.DataFrame:
    return frame.loc[frame["played"].fillna(False).astype(bool)]


def check_scores_agree(sources: list[tuple[str, pd.DataFrame]], *, label: str) -> None:
    """Raise SourceMismatchError if any two sources disagree about a played match.

    ``sources`` is ``(source name, match frame)`` pairs; only played rows count.
    Every disagreement is listed at once, so one run shows the whole problem.
    """
    scores: dict[str, list[tuple[str, int, int]]] = {}
    for name, frame in sources:
        played = _played(frame)
        for key, home, away in zip(meeting_key(played), played["home_goals"], played["away_goals"]):
            scores.setdefault(key, []).append((name, int(home), int(away)))

    mismatches = [
        (key, entries)
        for key, entries in sorted(scores.items())
        if len({(home, away) for _, home, away in entries}) > 1
    ]
    if mismatches:
        lines = []
        for key, entries in mismatches[:20]:
            season, home_team, away_team, _ = key.split("|")
            reported = ", ".join(f"{name} {home}-{away}" for name, home, away in entries)
            lines.append(f"  - {season} {home_team} v {away_team}: {reported}")
        more = f"\n  ... and {len(mismatches) - 20} more" if len(mismatches) > 20 else ""
        raise SourceMismatchError(
            f"{label}: {len(mismatches)} match(es) have different scores in different "
            "sources. The run stops here: one source is wrong, and a person should "
            "check the real result before anything is published.\n"
            + "\n".join(lines)
            + more
        )


def merge_results_sources(
    sources: list[tuple[str, pd.DataFrame]], *, label: str
) -> pd.DataFrame:
    """Combine several results sources into one set of played matches.

    Scores must agree wherever sources overlap (see :func:`check_scores_agree`).
    Each match is then taken from the first source in config order that has it,
    so a source that is quicker than the others fills in the latest results.
    A single source is returned unchanged.
    """
    if len(sources) == 1:
        return sources[0][1]
    check_scores_agree(sources, label=label)

    frames, seen = [], set()
    for _name, frame in sources:
        played = _played(frame)
        keys = meeting_key(played)
        frames.append(played.loc[~keys.isin(seen)])
        seen.update(keys)
    columns = list(dict.fromkeys(column for frame in frames for column in frame.columns))
    dtypes = {column: frame[column].dtype for frame in frames for column in frame.columns}
    return pd.concat(
        [_with_columns(frame, columns, dtypes) for frame in frames], ignore_index=True
    )


def combine_results_and_fixtures(
    results: pd.DataFrame,
    fixtures: pd.DataFrame,
    config: CompetitionConfig,
) -> pd.DataFrame:
    """Merge played results with the remaining published fixtures.

    Seasons the fixture source does not cover are passed through unchanged: a
    completed past season needs no schedule.
    """
    if fixtures.empty:
        return results

    played = results.loc[results["played"].fillna(False).astype(bool)].copy()
    covered_seasons = set(fixtures["season"].astype("string").unique())

    # A fixture list that carries its own scores must agree with the results.
    # After that check its scores are dropped: the schedule is all it is used
    # for, so every score in the dataset comes from a results source.
    fixture_sources = (
        [(str(name), group) for name, group in fixtures.groupby("source", sort=False)]
        if "source" in fixtures.columns and fixtures["source"].notna().all()
        else [("fixtures", fixtures)]
    )
    check_scores_agree([("results", played), *fixture_sources], label=config.id)

    # Dtypes are set explicitly: an all-null object column would change dtypes on concat.
    schedule = fixtures.copy()
    schedule["played"] = pd.Series(False, index=schedule.index, dtype="boolean")
    for column in ("home_goals", "away_goals"):
        schedule[column] = pd.Series(pd.NA, index=schedule.index, dtype="Int64")

    played_in_covered = played.loc[played["season"].astype("string").isin(covered_seasons)]
    played_counts = Counter(_pair_key(played_in_covered))
    schedule_counts = Counter(_pair_key(schedule))

    # 1. Every played result must exist in the fixture list.
    orphans = [key for key, count in played_counts.items() if count > schedule_counts.get(key, 0)]
    if orphans:
        examples = "\n".join(f"  - {key.replace('|', ' | ')}" for key in sorted(orphans)[:10])
        raise ReconciliationError(
            f"{config.id}: {len(orphans)} played match(es) are not in the fixture list.\n"
            "That usually means a team name did not normalise to the same canonical "
            "name in both sources, or the fixture source is for a different season.\n"
            f"{examples}"
        )

    # 2. Drop the fixture entries that have already been played, earliest first.
    schedule = schedule.sort_values(["date"], kind="stable", na_position="last")
    keep_mask = []
    remaining_to_drop = dict(played_counts)
    for key in _pair_key(schedule):
        outstanding = remaining_to_drop.get(key, 0)
        if outstanding:
            remaining_to_drop[key] = outstanding - 1
            keep_mask.append(False)
        else:
            keep_mask.append(True)
    upcoming = schedule.loc[pd.Series(keep_mask, index=schedule.index)]

    # Align columns before concatenating, so a column only one source provides
    # (e.g. `matchday`) keeps its dtype instead of becoming an object column.
    columns = list(dict.fromkeys([*played.columns, *upcoming.columns]))
    dtypes = {**dict(upcoming.dtypes), **dict(played.dtypes)}
    combined = pd.concat(
        [_with_columns(played, columns, dtypes), _with_columns(upcoming, columns, dtypes)],
        ignore_index=True,
    )
    combined = _fill_matchday_from_schedule(combined, schedule)
    matches = validate_matches(combined, source=f"{config.id} reconciled dataset")

    for season in sorted(covered_seasons):
        _log_season_reconciliation(matches, config, season)
    return matches


def _fill_matchday_from_schedule(
    combined: pd.DataFrame, schedule: pd.DataFrame
) -> pd.DataFrame:
    """Give played results the matchday the fixture list assigns them.

    The results source has no concept of rounds. Carrying the fixture list's
    matchday across makes round-aware reporting possible later ("probabilities
    after matchday 12") without a second lookup.
    """
    if "matchday" not in schedule.columns or "matchday" not in combined.columns:
        return combined
    lookup = (
        schedule.loc[schedule["matchday"].notna()]
        .assign(_key=_pair_key(schedule.loc[schedule["matchday"].notna()]))
        .drop_duplicates(subset="_key", keep="first")
        .set_index("_key")["matchday"]
    )
    out = combined.copy()
    missing = out["matchday"].isna()
    if int(missing.sum()):
        out.loc[missing, "matchday"] = _pair_key(out.loc[missing]).map(lookup)
    return out


def _with_columns(
    frame: pd.DataFrame, columns: list[str], dtypes: dict | None = None
) -> pd.DataFrame:
    """Reindex to ``columns``. A column the frame lacks is added empty, with the
    dtype the other frame has for it (so a UTC kick-off time stays a timestamp),
    or a string dtype if that is unknown."""
    out = frame.copy()
    for column in columns:
        if column not in out.columns:
            dtype = (dtypes or {}).get(column, "string")
            out[column] = pd.Series(None, index=out.index, dtype="object").astype(dtype)
    return out.loc[:, columns]


def _log_season_reconciliation(
    matches: pd.DataFrame, config: CompetitionConfig, season: str
) -> None:
    rows = matches.loc[matches["season"].astype("string") == season]
    played = int(rows["played"].fillna(False).astype(bool).sum())
    logger.info(
        "%s %s: %d played + %d upcoming = %d scheduled matches",
        config.id,
        season,
        played,
        len(rows) - played,
        len(rows),
    )

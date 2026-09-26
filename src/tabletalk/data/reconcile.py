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


def _pair_key(frame: pd.DataFrame) -> pd.Series:
    return (
        frame["season"].astype("string")
        + "|"
        + frame["home_team"].astype("string")
        + "|"
        + frame["away_team"].astype("string")
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

    # Fixture-list rows are used for the schedule only; their own scores are
    # ignored, so results stay attributable to a single source. Dtypes are set
    # explicitly: an all-null object column would change dtypes on concat.
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
    combined = pd.concat(
        [_with_columns(played, columns), _with_columns(upcoming, columns)], ignore_index=True
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


def _with_columns(frame: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    """Reindex to ``columns``, giving any column the frame lacks a string dtype."""
    out = frame.copy()
    for column in columns:
        if column not in out.columns:
            out[column] = pd.Series(pd.NA, index=out.index, dtype="string")
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

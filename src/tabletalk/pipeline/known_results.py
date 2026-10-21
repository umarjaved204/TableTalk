"""Results never disappear once a source has given them.

football-data.org has been seen to list finished matches as TIMED again, with
no score, for hours or days (11 Oct 2026 matches on 16-17 Oct; Serie A on
20 Oct). Until football-data.co.uk has the score too (it lags 1-4 days), that
match then looked unplayed: the table lost the result, the simulation played it
again, and the track record stopped scoring its locked prediction.

So every final score is remembered (``state/known_results.json``, see
``pipeline.state``), and :func:`restore` puts it back when no source has it:

* a source that has the score always wins; a different score there replaces
  the remembered one, and the run warns (a corrected result is rare, and a
  person should know the published numbers changed);
* a match the fixture source now lists as postponed, suspended, cancelled or
  awarded is not restored: that is a real change, not a flip, so the run warns
  and the remembered score is dropped;
* only the current season, and only a match still in the fixture list.

What the run restored is listed in the snapshot's notices.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd

from .checks import NO_RESULT_EXPECTED

#: Fixture-source statuses that mean a remembered score no longer stands.
NOT_RESTORED = NO_RESULT_EXPECTED | {"AWARDED"}


@dataclass
class Restored:
    matches: pd.DataFrame  # the run's matches, with remembered results put back
    restored: list[dict] = field(default_factory=list)  # remembered entries put back
    changed: list[tuple[dict, tuple[int, int]]] = field(default_factory=list)  # (remembered, sources' score)
    withdrawn: list[tuple[dict, str]] = field(default_factory=list)  # (remembered, why it no longer stands)


def restore(matches: pd.DataFrame, fixtures: pd.DataFrame, known: dict[tuple[str, str], dict], season: str) -> Restored:
    """Put remembered results back where no source has a score.

    ``known``: this league's remembered results for ``season``, keyed (home,
    away) (``state.known_for``). ``fixtures``: the fixture source's rows, for
    their status.
    """
    out = Restored(matches=matches)
    if not known:
        return out
    current = matches["season"].astype(str) == season
    played = matches["played"].fillna(False).astype(bool)
    home, away = matches["home_team"].astype(str), matches["away_team"].astype(str)
    scores = {
        (row.home_team, row.away_team): (int(row.home_goals), int(row.away_goals))
        for row in matches.loc[current & played].itertuples(index=False)
    }
    status = _status_by_pair(fixtures)
    filled = matches.copy()
    for pair, entry in sorted(known.items()):
        remembered = (int(entry["home_goals"]), int(entry["away_goals"]))
        if pair in scores:
            if scores[pair] != remembered:
                out.changed.append((entry, scores[pair]))
            continue
        if status.get(pair) in NOT_RESTORED:
            out.withdrawn.append((entry, f"now listed as {status[pair]}"))
            continue
        rows = filled.index[current & ~played & (home == pair[0]) & (away == pair[1])]
        if len(rows) != 1:
            out.withdrawn.append((entry, "no longer in the fixture list"))
            continue
        filled.loc[rows, "home_goals"] = remembered[0]
        filled.loc[rows, "away_goals"] = remembered[1]
        filled.loc[rows, "played"] = True
        out.restored.append(entry)
    out.matches = filled
    return out


def live_results(matches: pd.DataFrame, fixtures: pd.DataFrame, season: str) -> list[dict]:
    """The season's final scores as the sources gave them in this run, to remember.

    Awarded matches are left out: their table result comes from
    ``configs/awarded_results.yaml``, not from a source's score.
    """
    rows = matches.loc[
        (matches["season"].astype(str) == season) & matches["played"].fillna(False).astype(bool)
    ]
    status = _status_by_pair(fixtures)
    ids, kickoffs = {}, {}
    if fixtures is not None and not fixtures.empty:
        for row in fixtures.itertuples(index=False):
            pair = (str(row.home_team), str(row.away_team))
            ids[pair] = None if pd.isna(row.source_id) else str(row.source_id)
            kickoffs[pair] = _iso(row.kickoff_utc)
    out = []
    for row in rows.itertuples(index=False):
        pair = (str(row.home_team), str(row.away_team))
        if status.get(pair) == "AWARDED":
            continue
        out.append({
            "home_team": pair[0], "away_team": pair[1],
            "home_goals": int(row.home_goals), "away_goals": int(row.away_goals),
            "match_id": ids.get(pair), "date": pd.Timestamp(row.date).strftime("%Y-%m-%d"),
            "kickoff_utc": kickoffs.get(pair),
        })
    return out


def describe(entry: dict) -> str:
    return (f"{entry['home_team']} {entry['home_goals']}-{entry['away_goals']} {entry['away_team']} "
            f"({pd.Timestamp(entry['date']):%d %b})")


def _status_by_pair(fixtures: pd.DataFrame | None) -> dict[tuple[str, str], str]:
    if fixtures is None or fixtures.empty or "status" not in fixtures.columns:
        return {}
    return {
        (str(row.home_team), str(row.away_team)): str(row.status) for row in fixtures.itertuples(index=False)
    }


def _iso(value) -> str | None:
    return None if pd.isna(value) else pd.Timestamp(value).tz_convert("UTC").strftime("%Y-%m-%dT%H:%M:%SZ")

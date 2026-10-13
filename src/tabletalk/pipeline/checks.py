"""Safety checks that must pass before a league's snapshot is written.

Each check returns a list of problems in plain English (empty = passed), so a
failed run reports everything wrong at once. If any check finds a problem, the
league's previous published files are left exactly as they were.

Checks done here (the data checks happen while loading, and raise):

- the fixture list matches the config (teams, number of matches, home/away);
- every match's home/draw/away probabilities sum to 1;
- the finishing-position probabilities are a proper distribution;
- zone probabilities do not contradict each other (title <= top four, ...);
- expected points are possible (between points now and the maximum still
  available);
- the current table matches the results it was built from, recounted here
  independently of the table code.

Loading already stops the run on an unmapped team name
(``UnknownTeamError``) and on two sources giving different scores
(``SourceMismatchError``).
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from ..config import CompetitionConfig
from ..data.awarded import apply_awarded_results
from ..data.fixtures import check_fixture_list

#: Tolerance for "sums to 1". Probabilities are computed in float64; anything
#: bigger than this is a bug, not rounding.
TOLERANCE = 1e-9


def check_match_predictions(predictions: pd.DataFrame) -> list[str]:
    """Home/draw/away probabilities: each in [0, 1], summing to 1."""
    problems = []
    if predictions.empty:
        return problems
    probabilities = predictions[["p_home", "p_draw", "p_away"]].to_numpy(dtype=float)
    totals = probabilities.sum(axis=1)
    bad = np.abs(totals - 1.0) > TOLERANCE
    if bad.any():
        rows = predictions.loc[bad, ["home_team", "away_team"]].head(3).to_numpy().tolist()
        problems.append(f"{int(bad.sum())} match(es) whose probabilities do not sum to 1, e.g. {rows}")
    if (probabilities < 0).any() or (probabilities > 1).any():
        problems.append("a match probability is outside 0-1")
    goals = predictions[["expected_home_goals", "expected_away_goals"]].to_numpy(dtype=float)
    if not np.isfinite(goals).all() or (goals <= 0).any():
        problems.append("an expected-goals figure is not a positive number")
    return problems


def check_simulation(
    positions: pd.DataFrame,
    zones: pd.DataFrame,
    config: CompetitionConfig,
    *,
    expected_points: pd.Series,
    points_now: pd.Series,
    matches_left: pd.Series,
) -> list[str]:
    """Position distribution, zone consistency and expected points.

    Args:
        positions: P(team finishes k-th); rows teams, columns 1..n.
        zones: P(team in zone); rows teams, one column per zone id.
        expected_points, points_now, matches_left: per team (index = team).
    """
    problems = []
    rows = positions.sum(axis=1)
    if (np.abs(rows - 1.0) > TOLERANCE).any():
        problems.append(f"finishing-position probabilities do not sum to 1 for {list(rows.index[np.abs(rows - 1) > TOLERANCE])}")
    columns = positions.sum(axis=0)
    if (np.abs(columns - 1.0) > TOLERANCE).any():
        problems.append("some finishing position is not filled by exactly one team per simulated season")

    season_zones = {zone.id: set(zone.positions) for zone in config.zones}
    for zone_id, members in season_zones.items():
        total = float(zones[zone_id].sum())
        if abs(total - len(members)) > 1e-6:
            problems.append(f"zone {zone_id}: probabilities add up to {total:.6f}, expected {len(members)}")
    # A zone inside another (title inside top four) can never be more likely.
    for inner, inner_members in season_zones.items():
        for outer, outer_members in season_zones.items():
            if inner != outer and inner_members < outer_members:
                excess = zones[inner] - zones[outer]
                if (excess > TOLERANCE).any():
                    teams = list(zones.index[excess > TOLERANCE])
                    problems.append(f"P({inner}) is higher than P({outer}) for {teams}")

    most = points_now + config.points.win * matches_left
    impossible = (expected_points < points_now - TOLERANCE) | (expected_points > most + TOLERANCE)
    if impossible.any():
        problems.append(f"expected points outside what is still possible for {list(expected_points.index[impossible])}")
    return problems


def check_table(table: pd.DataFrame, matches: pd.DataFrame, config: CompetitionConfig, season: str) -> list[str]:
    """Recount the table from the results, without using the table code.

    Counts each team's played/won/drawn/lost and goals directly from the
    season's played rows (awarded results applied, as in the table), then
    compares. Points must equal the points system applied to W/D/L plus the
    table's own deduction column, and the order must follow the points.
    """
    rules = config.for_season(season)
    rows = matches.loc[(matches["season"].astype(str) == season) & matches["played"].fillna(False).astype(bool)]
    rows = apply_awarded_results(rows, config.id)
    forced = rows["forced_outcome"] if "forced_outcome" in rows.columns else pd.Series(pd.NA, index=rows.index)

    count: dict[str, dict[str, int]] = {}
    for row, outcome in zip(rows.itertuples(index=False), forced):
        home_goals, away_goals = int(row.home_goals), int(row.away_goals)
        if pd.isna(outcome):
            outcome = 0 if home_goals > away_goals else (1 if home_goals == away_goals else 2)
        for team, scored, conceded, won, lost in (
            (row.home_team, home_goals, away_goals, outcome == 0, outcome == 2),
            (row.away_team, away_goals, home_goals, outcome == 2, outcome == 0),
        ):
            record = count.setdefault(team, {"played": 0, "won": 0, "drawn": 0, "lost": 0, "goals_for": 0, "goals_against": 0})
            record["played"] += 1
            record["won"] += int(won)
            record["lost"] += int(lost)
            record["drawn"] += int(not won and not lost)
            record["goals_for"] += scored
            record["goals_against"] += conceded

    problems = []
    if len(table) != rules.league.n_teams:
        problems.append(f"table has {len(table)} teams, the {season} rules say {rules.league.n_teams}")
    for row in table.itertuples(index=False):
        recount = count.get(row.team, dict.fromkeys(("played", "won", "drawn", "lost", "goals_for", "goals_against"), 0))
        for column, value in recount.items():
            if int(getattr(row, column)) != value:
                problems.append(f"{row.team}: table says {column} {int(getattr(row, column))}, the results say {value}")
        expected = (
            rules.points.win * recount["won"] + rules.points.draw * recount["drawn"]
            + rules.points.loss * recount["lost"] + int(row.points_deducted)
        )
        if int(row.points) != expected:
            problems.append(f"{row.team}: table says {int(row.points)} points, the results say {expected}")
    if int(table["goals_for"].sum()) != int(table["goals_against"].sum()):
        problems.append("goals scored and conceded across the table do not balance")
    if rules.ranking == "points":
        points = table["points"].to_numpy()
        if (np.diff(points) > 0).any():
            problems.append("the table is not in points order")
    return problems


def check_fixtures(matches: pd.DataFrame, config: CompetitionConfig, season: str) -> list[str]:
    """The season's schedule against the configured format."""
    return check_fixture_list(matches, config, season)


#: Statuses that explain a missing result: the match was not (fully) played.
NO_RESULT_EXPECTED = frozenset({"POSTPONED", "CANCELLED", "SUSPENDED"})
RESULT_STATUSES = frozenset({"FINISHED", "AWARDED"})


def check_staleness(fixtures: pd.DataFrame, now: pd.Timestamp, *, max_age: pd.Timedelta) -> list[str]:
    """Matches that should have a result by now but do not.

    Uses the fixture list, not "days since the last result": an international
    break has no matches, so no results are due, and nothing is flagged. A
    match is overdue when it kicked off more than ``max_age`` ago (by its
    listed kick-off, or the end of its listed day when it has no time) and the
    source neither has its result nor says it was called off.

    This is a warning, not a safety check: the numbers are still right for the
    results we have, just possibly out of date.
    """
    if fixtures is None or fixtures.empty or "status" not in fixtures.columns:
        return []
    end_of_day = (pd.to_datetime(fixtures["date"]) + pd.Timedelta(days=1)).dt.tz_localize("UTC")
    kickoff = pd.to_datetime(fixtures["kickoff_utc"], utc=True).fillna(end_of_day)
    status = fixtures["status"].astype(str)
    overdue = (
        (kickoff < now - max_age)
        & ~status.isin(RESULT_STATUSES)
        & ~status.isin(NO_RESULT_EXPECTED)
    )
    if not overdue.any():
        return []
    late = fixtures.loc[overdue].sort_values("kickoff_utc")
    examples = ", ".join(
        f"{row.home_team} v {row.away_team} ({pd.Timestamp(row.date):%d %b}, {row.status})"
        for row in late.head(5).itertuples(index=False)
    )
    days = max_age / pd.Timedelta(days=1)
    return [
        f"results may be late: {int(overdue.sum())} match(es) kicked off more than {days:g} days ago "
        f"and still have no result in the fixture source, e.g. {examples}"
    ]


#: A match is due a final result this long after kick-off: about two hours of
#: football (half-time and stoppage time included) plus an hour for a late
#: start. Before that it may simply still be on.
RESULT_DUE_AFTER = pd.Timedelta(hours=3)


def missing_results(
    fixtures: pd.DataFrame, played: pd.DataFrame, now: pd.Timestamp, *, due_after: pd.Timedelta = RESULT_DUE_AFTER
) -> pd.DataFrame:
    """Matches that should have finished by now but have no final score in this run's data.

    A match is due when its kick-off (or, with no time set, the end of its
    listed day) is at least ``due_after`` before ``now``. A due match is
    complete only if its final score is in ``played`` (the matches this run
    actually used, from any results source), or the fixture source says it was
    postponed, suspended or cancelled. A match the source calls FINISHED or
    AWARDED with no score in the run's data still counts as missing: what
    matters is what the predictions were made from.

    ``played`` needs ``home_team`` and ``away_team`` (one season, so each
    pairing is one match). Returns the missing rows of ``fixtures``, earliest first.
    """
    if fixtures is None or fixtures.empty or "status" not in fixtures.columns:
        return fixtures.iloc[0:0] if fixtures is not None else pd.DataFrame()
    end_of_day = (pd.to_datetime(fixtures["date"]) + pd.Timedelta(days=1)).dt.tz_localize("UTC")
    kickoff = pd.to_datetime(fixtures["kickoff_utc"], utc=True).fillna(end_of_day)
    have_score = set(zip(played["home_team"].astype(str), played["away_team"].astype(str)))
    pairs = pd.Series(list(zip(fixtures["home_team"].astype(str), fixtures["away_team"].astype(str))),
                      index=fixtures.index)
    missing = (
        (kickoff <= now - due_after)
        & ~fixtures["status"].astype(str).isin(NO_RESULT_EXPECTED)
        & ~pairs.isin(have_score)
    )
    return fixtures.loc[missing].assign(_due=kickoff[missing]).sort_values("_due", kind="stable").drop(columns="_due")


def called_off(fixtures: pd.DataFrame) -> pd.DataFrame:
    """Matches the fixture source currently lists as postponed, suspended or cancelled."""
    if fixtures is None or fixtures.empty or "status" not in fixtures.columns:
        return fixtures.iloc[0:0] if fixtures is not None else pd.DataFrame()
    rows = fixtures.loc[fixtures["status"].astype(str).isin(NO_RESULT_EXPECTED)]
    return rows.sort_values("date", kind="stable")

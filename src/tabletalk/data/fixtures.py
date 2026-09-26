"""Working with the remaining fixtures.

The remaining fixtures come from the competition's published fixture list (see
``tabletalk.data.loaders.openfootball``), reconciled against the results we
already have. This module does not invent fixtures; it selects the unplayed ones
and *checks* that the schedule is what the config says it should be.

That check matters: if the fixture list is short a match, has a team playing 37
times instead of 38, or contains a name that did not normalise, the simulation
would still run and produce confident, wrong numbers.
"""

from __future__ import annotations

from collections import Counter

import pandas as pd

from ..config import CompetitionConfig


class FixtureListError(ValueError):
    """Raised when the fixture list does not match the competition's format."""


def season_rows(matches: pd.DataFrame, season: str) -> pd.DataFrame:
    """Every scheduled match of one season, played or not."""
    return matches.loc[matches["season"].astype("string") == season]


def season_teams(matches: pd.DataFrame, season: str) -> list[str]:
    """Teams appearing in ``season``, sorted."""
    rows = season_rows(matches, season)
    names = pd.concat([rows["home_team"], rows["away_team"]]).dropna().astype(str)
    return sorted(set(names))


def remaining_fixtures(
    matches: pd.DataFrame, config: CompetitionConfig, season: str | None = None
) -> pd.DataFrame:
    """The unplayed fixtures of ``season``, in the standard match schema.

    This is what the simulator iterates over. Dates are real, from the published
    schedule, so later work can be round-aware.
    """
    season = season or config.current_season
    rows = season_rows(matches, season)
    upcoming = rows.loc[~rows["played"].fillna(False).astype(bool)]
    if upcoming.empty and not rows.empty:
        played = int(rows["played"].fillna(False).astype(bool).sum())
        expected = config.league.total_matches if config.league else None
        if expected and played < expected:
            raise FixtureListError(
                f"{config.id} {season}: {played} of {expected} matches are played but "
                "no upcoming fixtures are loaded. Add a data source with "
                "`role: fixtures` to the config, or run with --refresh."
            )
    return upcoming.reset_index(drop=True)


def season_progress(
    matches: pd.DataFrame, config: CompetitionConfig, season: str | None = None
) -> dict[str, int]:
    """How far through the season we are, counted from the schedule itself."""
    season = season or config.current_season
    rows = season_rows(matches, season)
    played = int(rows["played"].fillna(False).astype(bool).sum())
    scheduled = len(rows)
    # Without a fixture source we only know the played matches, so fall back to
    # the total the config implies.
    total = scheduled if scheduled > played else (config.league.total_matches if config.league else played)
    return {"played": played, "remaining": total - played, "total": total}


def check_fixture_list(
    matches: pd.DataFrame, config: CompetitionConfig, season: str | None = None
) -> list[str]:
    """Check one season's schedule against the configured format.

    Returns a list of human-readable problems (empty when all is well) rather
    than raising, so ``tabletalk data check`` can report everything at once.
    """
    season = season or config.current_season
    league = config.league
    rows = season_rows(matches, season)
    problems: list[str] = []

    if league is None:
        return problems
    if rows.empty:
        return [f"no matches loaded for {season}"]

    teams = season_teams(matches, season)
    if len(teams) != league.n_teams:
        problems.append(
            f"{len(teams)} teams in the {season} schedule, config says {league.n_teams}: {teams}"
        )

    if len(rows) != league.total_matches:
        problems.append(
            f"{len(rows)} matches scheduled in {season}, config implies {league.total_matches}"
        )

    per_team = Counter()
    per_team_home = Counter()
    for home, away in zip(rows["home_team"], rows["away_team"]):
        per_team[home] += 1
        per_team[away] += 1
        per_team_home[home] += 1

    wrong_total = {
        team: count for team, count in sorted(per_team.items()) if count != league.matches_per_team
    }
    if wrong_total:
        problems.append(
            f"teams not playing {league.matches_per_team} matches in {season}: {wrong_total}"
        )

    if league.is_round_robin and league.meetings_per_pair % 2 == 0:
        expected_home = league.matches_per_team // 2
        wrong_home = {
            team: count
            for team, count in sorted(per_team_home.items())
            if count != expected_home
        }
        if wrong_home:
            problems.append(
                f"teams not playing {expected_home} home matches in {season}: {wrong_home}"
            )

        expected_meetings = league.meetings_per_pair // 2
        pairs = Counter(zip(rows["home_team"], rows["away_team"]))
        wrong_pairs = {
            pair: count for pair, count in sorted(pairs.items()) if count != expected_meetings
        }
        if wrong_pairs:
            shown = list(wrong_pairs.items())[:5]
            problems.append(
                f"{len(wrong_pairs)} pairing(s) do not appear exactly {expected_meetings} "
                f"time(s) in {season}, e.g. {shown}"
            )

    duplicate_dates = rows.loc[rows["played"].fillna(False).astype(bool) & rows["date"].isna()]
    if len(duplicate_dates):
        problems.append(f"{len(duplicate_dates)} played match(es) in {season} have no date")

    return problems


def require_valid_fixture_list(
    matches: pd.DataFrame, config: CompetitionConfig, season: str | None = None
) -> None:
    """Raise FixtureListError if the schedule does not match the format."""
    problems = check_fixture_list(matches, config, season)
    if problems:
        joined = "\n".join(f"  - {problem}" for problem in problems)
        raise FixtureListError(
            f"{config.id} {season or config.current_season}: fixture list does not match "
            f"the configured format:\n{joined}"
        )

"""The fixture list: loading it, reconciling it with results, and checking it.

This is the part most likely to be subtly wrong - double-counting a played match,
losing one, or silently simulating a season that is missing a fixture - so it gets
the most tests.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

from conftest import make_matches
from tabletalk.data.fixtures import (
    FixtureListError,
    check_fixture_list,
    remaining_fixtures,
    season_progress,
)
from tabletalk.data.loaders.openfootball import OpenFootballLoader
from tabletalk.data.reconcile import ReconciliationError, combine_results_and_fixtures
from tabletalk.data.seasons import Season

# ---------------------------------------------------------------------------
# openfootball loader (offline: reads a JSON we write ourselves)
# ---------------------------------------------------------------------------

_SAMPLE_JSON = """
{"name": "English Premier League 2026/27",
 "matches": [
   {"round": "Matchday 1", "date": "2026-08-21", "time": "20:00",
    "team1": "Arsenal FC", "team2": "Coventry City FC",
    "score": {"ht": [2, 0], "ft": [3, 0]}},
   {"round": "Matchday 3", "date": "2026-09-05",
    "team1": "Nottingham Forest FC", "team2": "Tottenham Hotspur FC",
    "score": [0, 0]},
   {"round": "Matchday 6", "date": "2026-10-10", "time": "12:30",
    "team1": "Manchester United FC", "team2": "AFC Bournemouth"}]}
"""


@pytest.fixture
def fixture_loader(tmp_path: Path) -> OpenFootballLoader:
    cache = tmp_path / "raw"
    cache.mkdir()
    (cache / "en.1_2026-27.json").write_text(_SAMPLE_JSON, encoding="utf-8")
    return OpenFootballLoader(
        "premier_league", league_code="en.1", seasons=["2026-27"], cache_dir=str(cache)
    )


def test_fixture_loader_url_uses_season_and_ref(fixture_loader):
    assert fixture_loader.json_url(Season.parse("2026-27")).endswith("/master/2026-27/en.1.json")


def test_fixture_loader_keeps_played_and_unplayed(fixture_loader):
    matches = fixture_loader.load()
    assert len(matches) == 3
    assert list(matches["played"]) == [True, True, False]
    # Both score shapes openfootball uses are understood.
    assert (matches.loc[0, "home_goals"], matches.loc[0, "away_goals"]) == (3, 0)
    assert (matches.loc[1, "home_goals"], matches.loc[1, "away_goals"]) == (0, 0)
    assert pd.isna(matches.loc[2, "home_goals"])


def test_fixture_loader_normalises_full_club_names(fixture_loader):
    matches = fixture_loader.load()
    assert set(matches["home_team"]) | set(matches["away_team"]) == {
        "Arsenal",
        "Coventry City",
        "Nottingham Forest",
        "Tottenham Hotspur",
        "Manchester United",
        "Bournemouth",
    }


def test_fixture_loader_keeps_dates_and_matchdays(fixture_loader):
    matches = fixture_loader.load()
    assert matches.loc[2, "date"] == pd.Timestamp("2026-10-10")
    assert list(matches["matchday"]) == ["Matchday 1", "Matchday 3", "Matchday 6"]


# ---------------------------------------------------------------------------
# Reconciling results with the published fixture list
# ---------------------------------------------------------------------------

_TEAMS = ["A", "B", "C", "D"]


def _full_schedule(season: str = "2025-26") -> pd.DataFrame:
    """A complete 4-team double round robin as a fixture list: 12 unplayed rows."""
    schedule = make_matches(
        [(home, away, None, None) for home in _TEAMS for away in _TEAMS if home != away],
        season=season,
    )
    schedule["date"] = pd.date_range("2025-08-09", periods=len(schedule), freq="7D")
    schedule["matchday"] = "Matchday 1"
    return schedule


def test_reconcile_replaces_scheduled_rows_with_results(four_team_config):
    results = make_matches([("A", "B", 2, 1), ("C", "D", 0, 0)])
    combined = combine_results_and_fixtures(results, _full_schedule(), four_team_config)
    assert len(combined) == 12  # no double counting
    assert int(combined["played"].sum()) == 2

    upcoming = remaining_fixtures(combined, four_team_config, "2025-26")
    assert len(upcoming) == 10
    pairs = set(zip(upcoming["home_team"], upcoming["away_team"]))
    assert ("A", "B") not in pairs and ("C", "D") not in pairs
    assert ("B", "A") in pairs and ("D", "C") in pairs


def test_reconcile_keeps_the_results_source_score(four_team_config):
    """The fixture source's own scores are ignored, so scores have one owner."""
    results = make_matches([("A", "B", 2, 1)])
    schedule = _full_schedule()
    target = (schedule["home_team"] == "A") & (schedule["away_team"] == "B")
    schedule.loc[target, ["home_goals", "away_goals", "played"]] = [9, 9, True]

    combined = combine_results_and_fixtures(results, schedule, four_team_config)
    played = combined.loc[combined["played"].astype(bool)]
    assert len(played) == 1
    assert (played.iloc[0]["home_goals"], played.iloc[0]["away_goals"]) == (2, 1)


def test_reconcile_carries_matchday_onto_results(four_team_config):
    results = make_matches([("A", "B", 2, 1)])
    combined = combine_results_and_fixtures(results, _full_schedule(), four_team_config)
    played = combined.loc[combined["played"].astype(bool)]
    assert played.iloc[0]["matchday"] == "Matchday 1"


def test_reconcile_flags_a_result_missing_from_the_schedule(four_team_config):
    """The usual cause is a team name that did not normalise in one of the sources."""
    results = make_matches([("A", "E", 1, 0)])
    with pytest.raises(ReconciliationError, match="not in the fixture list"):
        combine_results_and_fixtures(results, _full_schedule(), four_team_config)


def test_reconcile_passes_through_seasons_with_no_schedule(four_team_config):
    """Completed past seasons need no fixture list."""
    results = pd.concat(
        [make_matches([("A", "B", 1, 0)], season="2024-25"),
         make_matches([("A", "B", 2, 2)], season="2025-26")],
        ignore_index=True,
    )
    combined = combine_results_and_fixtures(results, _full_schedule(), four_team_config)
    assert len(combined.loc[combined["season"] == "2024-25"]) == 1
    assert len(combined.loc[combined["season"] == "2025-26"]) == 12


def test_reconcile_consumes_repeat_pairings_in_date_order(four_team_config):
    """Where two meetings share a ground, the earlier fixture is the played one."""
    schedule = make_matches([("A", "B", None, None), ("A", "B", None, None)])
    schedule["date"] = [pd.Timestamp("2025-09-01"), pd.Timestamp("2026-02-01")]
    schedule["matchday"] = ["Matchday 1", "Matchday 20"]

    combined = combine_results_and_fixtures(
        make_matches([("A", "B", 1, 0)]), schedule, four_team_config
    )
    upcoming = combined.loc[~combined["played"].astype(bool)]
    assert len(upcoming) == 1
    assert upcoming.iloc[0]["date"] == pd.Timestamp("2026-02-01")


# ---------------------------------------------------------------------------
# Checking the fixture list against the configured format
# ---------------------------------------------------------------------------


def test_complete_schedule_has_no_problems(four_team_config):
    assert check_fixture_list(_full_schedule(), four_team_config, "2025-26") == []


def test_short_schedule_is_flagged(four_team_config):
    problems = check_fixture_list(_full_schedule().iloc[:-1], four_team_config, "2025-26")
    assert any("11 matches scheduled" in problem for problem in problems)
    assert any("not playing 6 matches" in problem for problem in problems)


def test_wrong_team_count_is_flagged(four_team_config):
    schedule = make_matches([("A", "B", None, None), ("B", "A", None, None)])
    problems = check_fixture_list(schedule, four_team_config, "2025-26")
    assert any("2 teams" in problem for problem in problems)


def test_unbalanced_home_and_away_is_flagged(four_team_config):
    """Four home matches and two away is a broken schedule, not a season."""
    schedule = _full_schedule()
    reversed_fixture = (schedule["home_team"] == "B") & (schedule["away_team"] == "A")
    schedule.loc[reversed_fixture, ["home_team", "away_team"]] = ["A", "B"]

    problems = check_fixture_list(schedule, four_team_config, "2025-26")
    assert any("home matches" in problem for problem in problems)
    assert any("pairing(s) do not appear" in problem for problem in problems)


def test_missing_schedule_mid_season_raises(four_team_config):
    """Results but no fixture list: refuse, rather than simulate an empty run-in."""
    results = make_matches([("A", "B", 1, 0), ("C", "D", 2, 2)])
    with pytest.raises(FixtureListError, match="no upcoming fixtures"):
        remaining_fixtures(results, four_team_config, "2025-26")


def test_progress_counts_from_the_schedule(four_team_config):
    combined = combine_results_and_fixtures(
        make_matches([("A", "B", 2, 1), ("C", "D", 0, 0)]), _full_schedule(), four_team_config
    )
    assert season_progress(combined, four_team_config, "2025-26") == {
        "played": 2,
        "remaining": 10,
        "total": 12,
    }


# ---------------------------------------------------------------------------
# Integration: the real Premier League data, when it is cached
# ---------------------------------------------------------------------------


def test_real_premier_league_schedule(premier_league):
    """Skipped when the raw files are not cached, so the suite stays offline."""
    from tabletalk.data import load_matches
    from tabletalk.data.loaders import build_loaders

    for loader in build_loaders(premier_league):
        missing = [s for s in loader.seasons if not loader.cache_path(s).exists()]
        if missing:
            pytest.skip(
                "raw data not cached; run `python -m tabletalk data fetch` first "
                f"(missing: {[s.label for s in missing]})"
            )

    matches = load_matches(premier_league, save=False)
    season = premier_league.current_season

    assert check_fixture_list(matches, premier_league, season) == []
    progress = season_progress(matches, premier_league, season)
    assert progress["played"] + progress["remaining"] == 380

    upcoming = remaining_fixtures(matches, premier_league, season)
    assert len(upcoming) == progress["remaining"]
    # Every remaining fixture is dated: the point of using the published list.
    assert upcoming["date"].notna().all()
    last_result = matches.loc[matches["played"].fillna(False).astype(bool), "date"].max()
    assert upcoming["date"].min() >= last_result

    # A completed season is complete: nothing left to play.
    assert check_fixture_list(matches, premier_league, "2025-26") == []
    assert len(remaining_fixtures(matches, premier_league, "2025-26")) == 0

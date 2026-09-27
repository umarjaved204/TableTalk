"""Rules that change by season, and the rule types added for Serie A and Ligue 1.

- ``rule_changes``: a season uses the rules in force that season;
- ``away_wins``: a tiebreaker (Ligue 1 from 2025-26);
- ``ranking: points_per_match``: a season stopped early (Ligue 1 2019-20);
- ``playoff_match``: a tie settled by a simulated match on a neutral ground;
- ``position_playoffs``: a match for one particular place (Serie A's title and
  17th v 18th), simulated in future seasons and taken from data in past ones.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import pytest

import tabletalk.data.playoffs as playoffs_module
from conftest import make_matches
from tabletalk.config import ConfigError, PointsSystem, load_competition
from tabletalk.simulation import league_table
from tabletalk.simulation.league import LeagueSimulator
from tabletalk.simulation.table import SeasonResults, Tiebreaker
from test_league_simulator import StubModel, _one_match_left

POINTS = PointsSystem(win=3, draw=1, loss=0)

_BASE = """
id: shrinking
name: Shrinking League
format: league
league: {n_teams: 4, meetings_per_pair: 2, matches_per_team: 6}
points: {win: 3, draw: 1, loss: 0}
tiebreakers: [goal_difference, alphabetical]
zones: [{id: title, positions: [1]}, {id: relegation, positions: [4]}]
data:
  current_season: "2025-26"
  sources: [{loader: football_data_uk, params: {division: XX, seasons: ["2022-23", "2023-24", "2024-25", "2025-26"]}}]
"""

_CHANGES = """
rule_changes:
  - from_season: "2024-25"
    reason: the league shrank to three clubs
    league: {n_teams: 3, meetings_per_pair: 2, matches_per_team: 4}
    zones: [{id: title, positions: [1]}, {id: relegation, positions: [3]}]
  - from_season: "2025-26"
    reason: new tiebreakers
    tiebreakers: [wins, away_wins, alphabetical]
  - seasons: ["2023-24"]
    reason: stopped early and decided on points per match
    ranking: points_per_match
    completed_early: true
"""


def _load(tmp_path: Path, body: str):
    directory = tmp_path / "competitions"
    directory.mkdir(exist_ok=True)
    (directory / "shrinking.yaml").write_text(body, encoding="utf-8")
    return load_competition("shrinking", config_dir=directory)


# ---------------------------------------------------------------------------
# rule_changes
# ---------------------------------------------------------------------------


def test_each_season_gets_the_rules_in_force(tmp_path):
    config = _load(tmp_path, _BASE + _CHANGES)
    assert config.for_season("2022-23").league.n_teams == 4
    assert config.for_season("2024-25").league.n_teams == 3
    assert config.for_season("2024-25").zone("relegation").positions == (3,)
    assert config.for_season("2024-25").tiebreakers == ("goal_difference", "alphabetical")
    # A later change keeps what it does not override.
    assert config.for_season("2025-26").league.n_teams == 3
    assert config.for_season("2025-26").tiebreakers == ("wins", "away_wins", "alphabetical")
    # A one-off applies to its season only.
    assert config.for_season("2023-24").ranking == "points_per_match"
    assert config.for_season("2023-24").completed_early
    assert config.for_season("2022-23").ranking == "points"


def test_a_config_without_changes_is_the_same_every_season(tmp_path):
    config = _load(tmp_path, _BASE)
    assert config.for_season("2023-24") is config


@pytest.mark.parametrize(
    "change, message",
    [
        ("  - {from_season: '2024-25', reason: x, model: {max_goals: 8}}", "not season rules"),
        ("  - {from_season: '2024-25', tiebreakers: [wins]}", "needs a `reason`"),
        ("  - {from_season: '2019-20', reason: x, tiebreakers: [wins]}", "not loaded"),
        ("  - {reason: x, tiebreakers: [wins]}", "exactly one of"),
        # A broken rule set fails at load time, not when a backtest reaches it:
        ("  - {from_season: '2024-25', reason: x, zones: [{id: title, positions: [9]}]}", "outside 1..4"),
    ],
)
def test_bad_rule_changes_are_rejected_at_load_time(tmp_path, change, message):
    with pytest.raises(ConfigError, match=message):
        _load(tmp_path, _BASE + "rule_changes:\n" + change + "\n")


# ---------------------------------------------------------------------------
# away_wins, points_per_match
# ---------------------------------------------------------------------------


def _order(rows, chain, **kwargs) -> list[str]:
    results = SeasonResults.from_matches(make_matches(rows))
    tiebreaker = Tiebreaker(chain, POINTS, rng=np.random.default_rng(0), random_tiebreaks=False, **kwargs)
    return [results.teams[i] for i in tiebreaker.rank(results)]


def test_away_wins_tiebreaker():
    """X and Y: one win each, same goals; Y's win was away."""
    rows = [("X", "Z", 1, 0), ("Z", "Y", 0, 1), ("Z", "X", 0, 0), ("Y", "Z", 0, 0)]
    assert _order(rows, ["goal_difference", "away_wins", "alphabetical"])[:2] == ["Y", "X"]


def test_a_season_stopped_early_is_ranked_on_points_per_match(tmp_path):
    """B has more points from more matches; A has more per match."""
    config = _load(tmp_path, _BASE + _CHANGES)
    matches = make_matches(
        [("A", "C", 1, 0), ("B", "C", 1, 0), ("B", "D", 1, 0), ("D", "B", 1, 0), ("C", "D", 0, 0)],
        season="2023-24", competition="shrinking",
    )
    table = league_table(matches, config, "2023-24")
    assert table["team"].tolist()[:2] == ["A", "B"]  # 3 from 1 v 6 from 3
    assert league_table(matches.assign(season="2022-23"), config, "2022-23")["team"].iloc[0] == "B"


# ---------------------------------------------------------------------------
# playoff_match
# ---------------------------------------------------------------------------


def test_playoff_match_is_played_between_two_clubs_level_on_everything():
    rows = [("X", "Y", 1, 1), ("Y", "X", 1, 1)]
    chain = ["goal_difference", "playoff_match"]
    played = []

    def always_the_away_side(home, away, neutral):
        played.append((home, away, neutral))
        return away

    assert _order(rows, chain)[:2] == ["X", "Y"]  # displaying a table: no match, alphabetical
    results = SeasonResults.from_matches(make_matches(rows))
    tiebreaker = Tiebreaker(chain, POINTS, rng=np.random.default_rng(0), play_match=always_the_away_side)
    order = [results.teams[i] for i in tiebreaker.rank(results)]
    assert played and played[0][2] is True  # on a neutral ground
    assert order[0] == played[0][1]          # the winner ranks first


# ---------------------------------------------------------------------------
# position_playoffs
# ---------------------------------------------------------------------------


class _Decisive(StubModel):
    """Every match is won by the home side (or, with ``home_wins=False``, the away side)."""

    def __init__(self, home_wins: bool):
        super().__init__(1.0, 0.0, 0.0) if home_wins else super().__init__(0.0, 0.0, 1.0)

    def outcome_probabilities(self, home, away, neutral=False):
        return self.p


def _level_at_the_top():
    """A finished season: A and B both on 13 points, A ahead on goal difference (+4 v +3)."""
    return make_matches([
        ("A", "B", 1, 0), ("B", "A", 1, 0),
        ("A", "C", 2, 0), ("C", "A", 0, 1), ("A", "D", 1, 0), ("D", "A", 0, 0),
        ("B", "C", 1, 0), ("C", "B", 0, 1), ("B", "D", 0, 0), ("D", "B", 0, 1),
        ("C", "D", 1, 0), ("D", "C", 0, 0),
    ])


def _title_playoff_config(four_team_config, venue="higher_ranked_home"):
    from dataclasses import replace
    from tabletalk.config import PositionPlayoff

    return replace(four_team_config, position_playoffs=(PositionPlayoff(position=1, venue=venue, label="title"),))


def test_a_title_playoff_is_played_when_the_top_two_are_level(four_team_config):
    """A and B finish on 13 points. A is ranked first on the tiebreakers, so
    hosts the play-off; the result decides the title."""
    finished = _level_at_the_top()
    config = _title_playoff_config(four_team_config)
    host_wins = LeagueSimulator(config, _Decisive(home_wins=True)).simulate(finished, season="2025-26", n_simulations=50, seed=1)
    visitor_wins = LeagueSimulator(config, _Decisive(home_wins=False)).simulate(finished, season="2025-26", n_simulations=50, seed=1)
    assert host_wins.zone_probabilities().loc["A", "title"] == 1.0
    assert visitor_wins.zone_probabilities().loc["B", "title"] == 1.0


def test_a_two_legged_playoff_goes_to_penalties_when_the_aggregate_is_level(four_team_config):
    """Home side always wins 1-0: 1-1 on aggregate, so each club wins about half the time."""
    config = _title_playoff_config(four_team_config, venue="two_legs")
    result = LeagueSimulator(config, _Decisive(home_wins=True)).simulate(
        _level_at_the_top(), season="2025-26", n_simulations=2_000, seed=1
    )
    assert result.zone_probabilities().loc["A", "title"] == pytest.approx(0.5, abs=0.05)
    assert result.zone_probabilities().loc["B", "title"] == pytest.approx(0.5, abs=0.05)


def test_no_playoff_when_the_top_two_are_not_level(four_team_config):
    finished = _one_match_left(last_result=(2, 0))  # B 15, A 13
    config = _title_playoff_config(four_team_config)
    result = LeagueSimulator(config, _Decisive(home_wins=False)).simulate(finished, season="2025-26", n_simulations=50, seed=1)
    assert result.zone_probabilities().loc["B", "title"] == 1.0


def test_a_past_playoff_is_taken_from_the_results_file(four_team_config, tmp_path, monkeypatch):
    finished = _level_at_the_top()
    config = _title_playoff_config(four_team_config)
    assert league_table(finished, config, "2025-26")["team"].iloc[0] == "A"  # no play-off recorded
    path = tmp_path / "playoff_results.yaml"
    path.write_text(
        "playoffs:\n  - {competition: toy_league, season: '2025-26', winner: B, loser: A, source: 'https://example.org'}\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(playoffs_module, "PLAYOFF_RESULTS_FILE", path)
    assert league_table(finished, config, "2025-26")["team"].iloc[0] == "B"


# ---------------------------------------------------------------------------
# head_to_head_needs_all_meetings, forfeits counted without goals
# ---------------------------------------------------------------------------


def test_head_to_head_waits_until_every_meeting_is_played():
    """X and Y level on points; Y won their only meeting, X has the better goal
    difference. France (head-to-head only once both meetings are played) ranks
    X first; without that rule Y's win decides."""
    rows = [("Y", "X", 1, 0), ("X", "Z", 5, 0), ("Z", "Y", 1, 0), ("Z", "X", 0, 0), ("Y", "Z", 0, 0)]
    chain = ["head_to_head_points", "goal_difference", "alphabetical"]
    # Z is top on 5 points; X and Y are level on 4 in 2nd and 3rd.
    assert _order(rows, chain, needs_all_meetings=2)[1:] == ["X", "Y"]
    assert _order(rows, chain)[1:] == ["Y", "X"]


def test_a_forfeit_counts_the_win_but_not_the_goals():
    """Played 2-0; awarded to the away side at 0-0 (France's rule)."""
    matches = make_matches([("H", "A", 2, 0)]).assign(forced_outcome=pd.array([2], dtype="Int64"))
    from tabletalk.simulation.table import season_totals

    results = SeasonResults.from_matches(matches)
    totals = season_totals(results, POINTS)
    h, a = results.teams.index("H"), results.teams.index("A")
    assert (totals["points"][a], totals["points"][h]) == (3, 0)
    assert (totals["wins"][a], totals["losses"][h]) == (1, 1)
    assert totals["goals_for"][h] == 2  # goals as given; the awarded entry sets them to 0-0


# ---------------------------------------------------------------------------
# The real configs: each season gets its own rules
# ---------------------------------------------------------------------------


def test_serie_a_play_offs_by_season():
    serie_a = load_competition("serie_a")
    assert serie_a.for_season("2021-22").position_playoffs == ()
    assert [(p.position, p.venue) for p in serie_a.for_season("2022-23").position_playoffs] == [(1, "neutral"), (17, "neutral")]
    assert [(p.position, p.venue) for p in serie_a.for_season("2025-26").position_playoffs] == [
        (1, "higher_ranked_home"), (17, "two_legs")]


def test_ligue_1_format_by_season():
    ligue_1 = load_competition("ligue_1")
    relegation = {season: ligue_1.for_season(season).zone("relegation").positions
                  for season in ("2015-16", "2016-17", "2019-20", "2022-23", "2023-24")}
    assert relegation == {"2015-16": (18, 19, 20), "2016-17": (19, 20), "2019-20": (19, 20),
                          "2022-23": (17, 18, 19, 20), "2023-24": (17, 18)}
    assert ligue_1.for_season("2023-24").league.n_teams == 18
    assert ligue_1.for_season("2016-17").zone("relegation_playoff").positions == (18,)
    assert ligue_1.for_season("2019-20").ranking == "points_per_match"
    assert "away_wins" in ligue_1.for_season("2025-26").tiebreakers
    assert "away_goals_scored" in ligue_1.for_season("2024-25").tiebreakers

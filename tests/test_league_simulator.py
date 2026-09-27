"""The LeagueSimulator.

A stub match model with known, fixed probabilities makes it possible to check
the simulator against answers worked out by hand. The fast-vs-exact test checks
that the bulk sort plus the exact tiebreaker engine rank thousands of random
seasons exactly as the exact engine alone would.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from conftest import make_matches
from tabletalk.config import load_competition
from tabletalk.simulation.league import LeagueSimulator
from tabletalk.simulation.table import SeasonResults, Tiebreaker, season_totals


class StubModel:
    """Every match: home win 1-0, draw 0-0 or away win 0-1, with fixed odds."""

    max_goals = 3
    as_of = pd.Timestamp("2026-01-01")

    def __init__(self, p_home=0.45, p_draw=0.30, p_away=0.25):
        self.p = (p_home, p_draw, p_away)

    def score_matrix(self, home, away, neutral=False):
        matrix = np.zeros((self.max_goals + 1, self.max_goals + 1))
        matrix[1, 0], matrix[0, 0], matrix[0, 1] = self.p
        return matrix


def _one_match_left(last_result=(None, None)):
    """A four-team league where only B v A remains (unless ``last_result`` is given).

    A has 13 points, B 12. If B wins, B is champion (15 v 13); a draw or an A
    win keeps A top. So P(B champion) = P(home win). C finishes last whatever
    happens (2 points; D has 3).
    """
    return make_matches(
        [
            ("A", "B", 1, 0), ("A", "C", 1, 0), ("C", "A", 0, 1), ("A", "D", 1, 0), ("D", "A", 0, 0),
            ("B", "C", 1, 0), ("C", "B", 0, 1), ("B", "D", 1, 0), ("D", "B", 0, 1),
            ("C", "D", 0, 0), ("D", "C", 0, 0),
            ("B", "A", *last_result),
        ]
    )


def test_title_probability_equals_the_deciding_match_probability(four_team_config):
    result = LeagueSimulator(four_team_config, StubModel(0.45, 0.30, 0.25)).simulate(
        _one_match_left(), season="2025-26", n_simulations=20_000, seed=1
    )
    zones = result.zone_probabilities()
    standard_error = result.standard_error(0.45)
    assert zones.loc["B", "title"] == pytest.approx(0.45, abs=4 * standard_error)
    assert zones.loc["A", "title"] == pytest.approx(0.55, abs=4 * standard_error)
    assert zones.loc["C", "relegation"] == 1.0
    assert zones.loc["D", "relegation"] == 0.0
    assert result.n_remaining == 1


def test_finished_season_is_certain(four_team_config):
    finished = _one_match_left(last_result=(2, 0))  # B wins: 15 points to A's 13
    result = LeagueSimulator(four_team_config, StubModel()).simulate(
        finished, season="2025-26", n_simulations=500, seed=1
    )
    assert result.n_remaining == 0
    positions = result.position_probabilities()
    assert set(np.unique(positions.to_numpy())) <= {0.0, 1.0}
    assert positions.loc["B", 1] == 1.0


def test_same_seed_same_answer_different_seed_different_draws(four_team_config):
    matches = make_matches(
        [(h, a, None, None) for h in "ABCD" for a in "ABCD" if h != a]
    )
    simulator = LeagueSimulator(four_team_config, StubModel())
    first = simulator.simulate(matches, season="2025-26", n_simulations=2_000, seed=5)
    again = simulator.simulate(matches, season="2025-26", n_simulations=2_000, seed=5)
    other = simulator.simulate(matches, season="2025-26", n_simulations=2_000, seed=6)
    assert np.array_equal(first.positions, again.positions)
    assert not np.array_equal(first.positions, other.positions)


def test_probabilities_are_consistent(four_team_config):
    matches = make_matches(
        [("A", "B", 3, 0), ("C", "D", 0, 1)]
        + [(h, a, None, None) for h in "ABCD" for a in "ABCD" if h != a and (h, a) not in {("A", "B"), ("C", "D")}]
    )
    result = LeagueSimulator(four_team_config, StubModel()).simulate(
        matches, season="2025-26", n_simulations=5_000, seed=2
    )
    positions = result.position_probabilities()
    assert np.allclose(positions.sum(axis=1), 1.0)  # every team finishes somewhere
    assert np.allclose(positions.sum(axis=0), 1.0)  # every position is filled
    summary = result.summary()
    assert (summary["expected_points"] >= summary["points_now"]).all()
    assert (summary["points_p10"] <= summary["points_p90"]).all()
    assert np.isclose(summary["title"].sum(), 1.0)


# ---------------------------------------------------------------------------
# Fast path == exact engine
# ---------------------------------------------------------------------------

_CHAINS = {
    "premier_league": "[goal_difference, goals_scored, head_to_head_points, head_to_head_away_goals, alphabetical]",
    "head_to_head_first": "[head_to_head_points, head_to_head_goal_difference, goal_difference, goals_scored, alphabetical]",
    # A season-wide criterion *after* the head-to-head block (total away goals).
    "bundesliga": "[goal_difference, goals_scored, head_to_head_goal_difference, head_to_head_away_goals, away_goals_scored, alphabetical]",
}


@pytest.mark.parametrize("chain_name", sorted(_CHAINS))
def test_bulk_ranking_matches_the_exact_engine(tmp_path, chain_name):
    """Rank 3,000 random low-scoring six-team seasons both ways; they must agree.

    Low scores make ties on points, goal difference and goals scored common,
    so the exact head-to-head path is exercised hundreds of times.
    """
    (tmp_path / "six.yaml").write_text(
        f"""
id: six
name: Six
format: league
league: {{n_teams: 6, meetings_per_pair: 2, matches_per_team: 10}}
points: {{win: 3, draw: 1, loss: 0}}
tiebreakers: {_CHAINS[chain_name]}
data:
  current_season: "2025-26"
  sources: [{{loader: football_data_uk, params: {{division: XX, seasons: ["2025-26"]}}}}]
""",
        encoding="utf-8",
    )
    config = load_competition("six", config_dir=tmp_path)
    teams = tuple("ABCDEF")
    pairs = [(h, a) for h in range(6) for a in range(6) if h != a]
    home_idx = np.array([h for h, _ in pairs])
    away_idx = np.array([a for _, a in pairs])
    n_runs = 3_000
    rng = np.random.default_rng(11)
    home_goals = rng.poisson(0.7, (len(pairs), n_runs)).astype(np.int16)
    away_goals = rng.poisson(0.5, (len(pairs), n_runs)).astype(np.int16)

    empty = SeasonResults(teams, np.array([], int), np.array([], int), np.array([], int), np.array([], int))
    simulator = LeagueSimulator(config, model=None)
    base = season_totals(empty, config.points)
    totals = simulator._final_totals(base, home_idx, away_idx, home_goals, away_goals, 6)
    tiebreaker = Tiebreaker.from_config(config, rng=np.random.default_rng(0))
    fast_order, exact_runs = simulator._rank(totals, tiebreaker, empty, home_idx, away_idx, home_goals, away_goals)
    assert exact_runs > 100  # the exact path really was exercised

    for run in range(n_runs):
        season = SeasonResults(teams, home_idx, away_idx, home_goals[:, run].astype(int), away_goals[:, run].astype(int))
        assert list(fast_order[run]) == tiebreaker.rank(season), f"run {run} differs"


# ---------------------------------------------------------------------------
# Integration: replaying a real season from a date, when the data is cached
# ---------------------------------------------------------------------------


def test_replay_a_past_season_from_a_date(premier_league):
    from tabletalk.data import load_context_matches, load_matches
    from tabletalk.data.loaders import build_loaders
    from tabletalk.simulation import league_table, simulate_league

    for loader in build_loaders(premier_league):
        if any(not loader.cache_path(s).exists() for s in loader.seasons):
            pytest.skip("raw data not cached; run `python -m tabletalk data fetch` first")

    matches = load_matches(premier_league, save=False)
    context = load_context_matches(premier_league)
    as_of = pd.Timestamp("2026-01-01")
    result = simulate_league(
        premier_league, matches, context, season="2025-26", as_of=as_of, n_simulations=500, seed=3
    )
    season = matches.loc[matches["season"] == "2025-26"]
    assert result.n_remaining == int((season["date"] >= as_of).sum())
    # The starting table is the real table on 1 January, nothing later.
    before = season.loc[season["date"] < as_of]
    expected = league_table(before, premier_league, "2025-26").set_index("team")["points"]
    assert result.current_table.set_index("team")["points"].equals(expected.loc[result.current_table["team"]])

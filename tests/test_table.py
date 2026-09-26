"""League tables and tiebreakers.

Each test builds a tiny set of results by hand where the correct order is
known in advance, then checks the tiebreaker engine agrees. The most important
one is the last: the same results give a different table under a Premier
League chain and a La Liga-style chain, which is the whole reason tiebreakers
live in the config.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from conftest import make_matches
from tabletalk.config import KNOWN_TIEBREAKERS, PointsSystem
from tabletalk.simulation.table import (
    HEAD_TO_HEAD_CRITERIA,
    ORDERING_CRITERIA,
    SEASON_CRITERIA,
    SeasonResults,
    Tiebreaker,
    league_table,
    season_totals,
)

POINTS = PointsSystem(win=3, draw=1, loss=0)
PREMIER_LEAGUE = ["goal_difference", "goals_scored", "head_to_head_points", "head_to_head_away_goals", "coin_flip"]


def _results(rows, teams=None) -> SeasonResults:
    return SeasonResults.from_matches(make_matches(rows), teams)


def _rank(rows, chain, *, teams=None, reapply=False, seed=0, random_tiebreaks=True) -> list[str]:
    results = _results(rows, teams)
    tiebreaker = Tiebreaker(
        chain, POINTS, reapply_head_to_head=reapply,
        rng=np.random.default_rng(seed), random_tiebreaks=random_tiebreaks,
    )
    return [results.teams[i] for i in tiebreaker.rank(results)]


def test_every_configurable_tiebreaker_is_implemented():
    assert SEASON_CRITERIA | HEAD_TO_HEAD_CRITERIA | ORDERING_CRITERIA == KNOWN_TIEBREAKERS


# ---------------------------------------------------------------------------
# Totals
# ---------------------------------------------------------------------------


def test_season_totals():
    results = _results([("A", "B", 2, 0), ("B", "C", 1, 1), ("C", "A", 3, 1)])
    totals = season_totals(results, POINTS)
    i = {team: k for k, team in enumerate(results.teams)}
    a, b, c = i["A"], i["B"], i["C"]
    assert totals["points"][[a, b, c]].tolist() == [3, 1, 4]
    assert totals["played"][[a, b, c]].tolist() == [2, 2, 2]
    assert totals["wins"][[a, b, c]].tolist() == [1, 0, 1]
    assert totals["draws"][[a, b, c]].tolist() == [0, 1, 1]
    assert totals["losses"][[a, b, c]].tolist() == [1, 1, 0]
    assert totals["goals_for"][[a, b, c]].tolist() == [3, 1, 4]
    assert totals["goals_against"][[a, b, c]].tolist() == [3, 3, 2]
    assert totals["goal_difference"][[a, b, c]].tolist() == [0, -2, 2]
    # away goals: A scored 1 at C, B scored 0 at A, C scored 1 at B
    assert totals["away_goals"][[a, b, c]].tolist() == [1, 0, 1]


def test_points_system_comes_from_config():
    results = _results([("A", "B", 1, 0), ("C", "D", 0, 0)])
    two_for_a_win = season_totals(results, PointsSystem(win=2, draw=1, loss=0))
    assert two_for_a_win["points"][results.teams.index("A")] == 2


# ---------------------------------------------------------------------------
# The Premier League chain, one criterion at a time
# ---------------------------------------------------------------------------


def test_points_come_before_everything():
    """A: 3 points with goal difference -4. B: 2 points with goal difference 0."""
    rows = [("A", "C", 1, 0), ("D", "A", 5, 0), ("B", "D", 0, 0), ("B", "C", 0, 0)]
    order = _rank(rows, PREMIER_LEAGUE)
    assert order.index("A") < order.index("B")


def test_goal_difference_separates_teams_level_on_points():
    rows = [("A", "C", 3, 0), ("B", "D", 1, 0)]
    assert _rank(rows, PREMIER_LEAGUE)[:2] == ["A", "B"]


def test_goals_scored_separates_teams_level_on_goal_difference():
    rows = [("A", "C", 3, 2), ("B", "D", 1, 0)]  # both +1; A scored more
    assert _rank(rows, PREMIER_LEAGUE)[:2] == ["A", "B"]


def test_head_to_head_points_separate_teams_level_on_goals():
    """A and B: 3 points, goal difference 0, 1 goal scored each. A beat B.

    A: beat B 1-0, lost 0-1 at C.   B: lost 0-1 at A, beat D 1-0.
    C (3 pts, +1) is top; then A above B on head-to-head points.
    """
    rows = [("A", "B", 1, 0), ("C", "A", 1, 0), ("B", "D", 1, 0)]
    assert _rank(rows, PREMIER_LEAGUE) == ["C", "A", "B", "D"]


def test_head_to_head_away_goals():
    """A and B each won away to the other: level on points (3), goal
    difference (0), goals scored (2) and head-to-head points (3). B scored 2
    away goals in the head-to-head, A only 1, so B is ahead.
    """
    rows = [("A", "B", 1, 2), ("B", "A", 0, 1)]
    assert _rank(rows, PREMIER_LEAGUE) == ["B", "A"]


def test_coin_flip_when_level_on_everything():
    rows = [("A", "C", 1, 0), ("B", "D", 1, 0), ("A", "B", 0, 0), ("B", "A", 0, 0)]
    # A and B level on points, GD, GF, h2h points and h2h away goals.
    orders = {tuple(_rank(rows, PREMIER_LEAGUE, seed=seed)[:2]) for seed in range(40)}
    assert orders == {("A", "B"), ("B", "A")}  # both outcomes happen
    # The same seed always gives the same answer.
    assert _rank(rows, PREMIER_LEAGUE, seed=7) == _rank(rows, PREMIER_LEAGUE, seed=7)


def test_current_table_lists_fully_level_teams_alphabetically():
    rows = [("Zeta", "C", 1, 0), ("Alpha", "D", 1, 0)]
    for seed in range(10):
        order = _rank(rows, PREMIER_LEAGUE, seed=seed, random_tiebreaks=False)
        assert order[:2] == ["Alpha", "Zeta"]


def test_goals_conceded_ranks_fewer_higher():
    rows = [("A", "C", 1, 0), ("B", "D", 2, 1)]  # both +1; A conceded fewer
    assert _rank(rows, ["goals_conceded", "alphabetical"])[:2] == ["A", "B"]


# ---------------------------------------------------------------------------
# Head-to-head with more than two teams
# ---------------------------------------------------------------------------


def test_three_way_head_to_head_uses_only_matches_among_the_three():
    """A, B and C finish on 6 points.

    Among the three: A beat B and C, B beat C -> h2h order A, B, C.
    Over the season, C thrashed D and E 5-0 -> goal difference order C, A, B.
    """
    rows = [
        ("A", "B", 1, 0), ("A", "C", 1, 0), ("B", "C", 1, 0),  # h2h: A 6, B 3, C 0
        ("B", "D", 1, 0), ("C", "D", 5, 0), ("C", "E", 5, 0),  # B +3 pts, C +6 pts
    ]
    head_to_head_first = ["head_to_head_points", "goal_difference", "alphabetical"]
    goal_difference_first = ["goal_difference", "head_to_head_points", "alphabetical"]
    assert _rank(rows, head_to_head_first)[:3] == ["A", "B", "C"]
    assert _rank(rows, goal_difference_first)[:3] == ["C", "A", "B"]


def _four_way_tie():
    """A, B, C and D level on 9 points; E and F on none.

    Among the four: A beats everyone (9 h2h points). B, C and D get 3 each;
    D has the best h2h goal difference, B and C are level on h2h points and
    h2h goal difference, and B beat C. Over the whole season C scored far
    more goals than B.
    """
    return [
        ("A", "B", 1, 0), ("A", "C", 2, 0), ("A", "D", 1, 0),
        ("B", "C", 1, 0),                      # B beat C
        ("D", "B", 2, 0),                      # D beat B
        ("C", "D", 1, 0),                      # C beat D
        ("B", "E", 1, 0), ("B", "F", 1, 0),
        ("C", "E", 5, 0), ("C", "F", 5, 0),
        ("D", "E", 1, 0), ("D", "F", 1, 0),
    ]


def test_four_way_tie_head_to_head_block_uses_all_four_teams():
    """h2h points leave B, C, D level; h2h goal difference among all FOUR separates D.

    B: vs A -1, vs C +1, vs D -2 -> -2.  C: -2, -1, +1 -> -2.  D: -1, +2, -1 -> 0.
    """
    chain = ["head_to_head_points", "head_to_head_goal_difference", "goals_scored", "alphabetical"]
    order = _rank(_four_way_tie(), chain)
    assert order[:2] == ["A", "D"]
    # B and C are still level after the block; goals scored decides: C 11, B 3.
    assert order[2:4] == ["C", "B"]


def test_head_to_head_reapply_recomputes_among_the_remaining_teams():
    """With re-apply, B and C are compared on the matches between just the two
    of them, which B won; without it, the season's goals decide for C."""
    chain = ["head_to_head_points", "head_to_head_goal_difference", "goals_scored", "alphabetical"]
    assert _rank(_four_way_tie(), chain, reapply=True)[:4] == ["A", "D", "B", "C"]
    assert _rank(_four_way_tie(), chain, reapply=False)[:4] == ["A", "D", "C", "B"]


def test_same_results_different_chain_different_table():
    """The reason tiebreakers are config, not code.

    A and B both finish on 6 points. A beat B head to head; B has the better
    goal difference (+4 against +1). The Premier League (goal difference
    first) puts B above A; a head-to-head-first league puts A above B.
    """
    rows = [
        ("A", "B", 1, 0),
        ("B", "C", 5, 0),
        ("C", "A", 1, 0),
        ("A", "D", 1, 0),
        ("D", "B", 1, 0),
        ("B", "D", 1, 0),
    ]
    premier_league = _rank(rows, PREMIER_LEAGUE)
    la_liga_style = _rank(rows, ["head_to_head_points", "head_to_head_goal_difference", "goal_difference", "coin_flip"])
    assert premier_league.index("B") < premier_league.index("A")
    assert la_liga_style.index("A") < la_liga_style.index("B")


# ---------------------------------------------------------------------------
# The table frame
# ---------------------------------------------------------------------------


def test_league_table_frame(four_team_config):
    matches = make_matches([("A", "B", 2, 0), ("C", "D", 1, 1), ("B", "C", 0, 1), ("D", "A", None, None)])
    table = league_table(matches, four_team_config, "2025-26")
    assert list(table["team"]) == ["C", "A", "D", "B"]
    assert list(table["position"]) == [1, 2, 3, 4]
    assert table.set_index("team").loc["C", "points"] == 4
    assert table.set_index("team").loc["A", "played"] == 1  # the unplayed fixture is not counted

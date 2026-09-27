"""La Liga, added by config only: head-to-head comes first in Spain.

Its full history of final tables is checked in test_official_tables.py; these
tests pin down the two things that make Spain different: head-to-head before
goal difference, and the mini-league for three or more clubs, re-applied to a
pair it leaves level (config assumption A3).
"""

from __future__ import annotations

import numpy as np
import pytest

from conftest import make_matches
from tabletalk.config import load_competition
from tabletalk.simulation.table import SeasonResults, Tiebreaker, season_totals

LA_LIGA = ["head_to_head_points", "head_to_head_goal_difference", "goal_difference", "goals_scored", "coin_flip"]
PREMIER_LEAGUE = ["goal_difference", "goals_scored", "head_to_head_points", "head_to_head_away_goals", "coin_flip"]


@pytest.fixture(scope="module")
def la_liga():
    return load_competition("la_liga")


def _order(rows, chain, points, *, reapply=False, force_level=None) -> list[str]:
    results = SeasonResults.from_matches(make_matches(rows))
    totals = season_totals(results, points)
    if force_level:
        # Put these clubs level on points, as if the rest of their season had
        # evened out; the head-to-head criteria still use the real meetings.
        totals = dict(totals)
        totals["points"] = totals["points"].copy()
        for team in force_level:
            totals["points"][results.teams.index(team)] = 50
    tiebreaker = Tiebreaker(chain, points, reapply_head_to_head=reapply,
                            rng=np.random.default_rng(0), random_tiebreaks=False)
    return [results.teams[i] for i in tiebreaker.rank(results, totals)]


def test_config_matches_the_verified_rules(la_liga):
    assert (la_liga.league.n_teams, la_liga.league.matches_per_team) == (20, 38)
    assert list(la_liga.tiebreakers) == LA_LIGA
    assert la_liga.head_to_head_reapply is True
    assert la_liga.zone("relegation").positions == (18, 19, 20)


def test_head_to_head_comes_before_goal_difference(la_liga):
    """X beat Y twice, narrowly; Y ran up a big score against Z. With X and Y
    level on points, X is first in Spain and Y first under the Premier League
    chain (goal difference +2 against +10)."""
    rows = [
        ("X", "Y", 1, 0), ("Y", "X", 0, 1),
        ("Y", "Z", 6, 0), ("Z", "Y", 0, 6),
        ("X", "Z", 0, 0), ("Z", "X", 0, 0),
    ]
    level = ["X", "Y"]
    assert _order(rows, LA_LIGA, la_liga.points, force_level=level)[:2] == ["X", "Y"]
    assert _order(rows, PREMIER_LEAGUE, la_liga.points, force_level=level)[:2] == ["Y", "X"]


def test_head_to_head_is_reapplied_to_a_pair_the_group_leaves_level(la_liga):
    """A, B, C level on points. In their mini-league A wins everything; B and C
    take 3 points each with the same mini-league goal difference (-4), and the
    same overall goal difference and goals. Only their own two meetings separate
    them (C won 3-0 and lost 0-1), so re-applying head-to-head to the pair puts
    C second; without it they fall to the last resort (alphabetical: B)."""
    rows = [
        ("A", "C", 3, 0), ("C", "A", 0, 3),
        ("A", "B", 2, 1), ("B", "A", 1, 2),
        ("C", "B", 3, 0), ("B", "C", 1, 0),
    ]
    level = ["A", "B", "C"]
    assert _order(rows, LA_LIGA, la_liga.points, reapply=True, force_level=level) == ["A", "C", "B"]
    assert _order(rows, LA_LIGA, la_liga.points, reapply=False, force_level=level) == ["A", "B", "C"]

"""The Bundesliga, added by config only: its rules, and a real final table.

The tiebreaker tests use hand-built three-team seasons where two clubs finish
level on points, goal difference and goals scored, so the Bundesliga-specific
criteria (aggregate head-to-head score, head-to-head away goals, all away goals)
decide, and the Premier League chain would decide differently.
"""

from __future__ import annotations

import numpy as np
import pytest

from conftest import make_matches
from tabletalk.config import load_competition
from tabletalk.simulation.table import SeasonResults, Tiebreaker

BUNDESLIGA = ["goal_difference", "goals_scored", "head_to_head_goal_difference",
              "head_to_head_away_goals", "away_goals_scored", "playoff_match"]
PREMIER_LEAGUE = ["goal_difference", "goals_scored", "head_to_head_points", "head_to_head_away_goals", "coin_flip"]


@pytest.fixture(scope="module")
def bundesliga():
    return load_competition("bundesliga")


def _order(rows, chain, points) -> list[str]:
    results = SeasonResults.from_matches(make_matches(rows))
    # no match is played when displaying a table: the last resort is alphabetical
    tiebreaker = Tiebreaker(chain, points, rng=np.random.default_rng(0), random_tiebreaks=False)
    return [results.teams[i] for i in tiebreaker.rank(results)]


def test_config_matches_the_verified_rules(bundesliga):
    assert (bundesliga.league.n_teams, bundesliga.league.matches_per_team) == (18, 34)
    assert list(bundesliga.tiebreakers) == BUNDESLIGA
    assert bundesliga.zone("relegation_playoff").positions == (16,)
    assert bundesliga.zone("relegation").positions == (17, 18)
    assert bundesliga.zone("top_half").positions == tuple(range(1, 10))


def test_aggregate_head_to_head_score_decides_not_head_to_head_points(bundesliga):
    """Y beat X 3-0 and lost 0-1: three points each, but Y wins the aggregate 3-1.
    Both finish on 6 points, +1, 5 goals. The Bundesliga puts Y first; the
    Premier League chain (head-to-head points, then away goals) finds them level
    and falls through to the last resort, which here lists X first."""
    rows = [
        ("Y", "X", 3, 0), ("X", "Y", 1, 0),
        ("Y", "Z", 2, 0), ("Z", "Y", 3, 0),
        ("X", "Z", 4, 0), ("Z", "X", 1, 0),
    ]
    assert _order(rows, BUNDESLIGA, bundesliga.points)[:2] == ["Y", "X"]
    assert _order(rows, PREMIER_LEAGUE, bundesliga.points)[:2] == ["X", "Y"]


def test_head_to_head_away_goals_decide_a_level_aggregate(bundesliga):
    """2-1 each way: aggregate 3-3, but Y scored twice away at X and X once at Y."""
    rows = [
        ("X", "Y", 1, 2), ("Y", "X", 0, 1),
        ("X", "Z", 1, 0), ("Z", "X", 0, 0),
        ("Y", "Z", 1, 0), ("Z", "Y", 0, 0),
    ]
    assert _order(rows, BUNDESLIGA, bundesliga.points)[:2] == ["Y", "X"]


def test_all_away_goals_decide_when_the_meetings_are_identical(bundesliga):
    """Both meetings 1-1. X won 2-0 at home to Z, Y won 2-0 away at Z: same
    points and goals, but Y has more away goals over the season. The Premier
    League chain has no such criterion and falls to the last resort (X)."""
    rows = [
        ("X", "Y", 1, 1), ("Y", "X", 1, 1),
        ("X", "Z", 2, 0), ("Z", "X", 0, 0),
        ("Y", "Z", 0, 0), ("Z", "Y", 0, 2),
    ]
    assert _order(rows, BUNDESLIGA, bundesliga.points)[:2] == ["Y", "X"]
    assert _order(rows, PREMIER_LEAGUE, bundesliga.points)[:2] == ["X", "Y"]


# ---------------------------------------------------------------------------
# The official final 2025-26 Bundesliga table
# ---------------------------------------------------------------------------

#: Source: Wikipedia, 2025-26 Bundesliga (checked 27 September 2026).
#: (team, won, drawn, lost, goals for, goals against, points). 17th and 18th are
#: level on points and goal difference and separated by goals scored.
OFFICIAL_2025_26 = [
    ("Bayern Munich", 28, 5, 1, 122, 36, 89),
    ("Borussia Dortmund", 22, 7, 5, 70, 34, 73),
    ("RB Leipzig", 20, 5, 9, 66, 47, 65),
    ("VfB Stuttgart", 18, 8, 8, 71, 49, 62),
    ("TSG Hoffenheim", 18, 7, 9, 65, 52, 61),
    ("Bayer Leverkusen", 17, 8, 9, 68, 47, 59),
    ("SC Freiburg", 13, 8, 13, 51, 57, 47),
    ("Eintracht Frankfurt", 11, 11, 12, 61, 65, 44),
    ("FC Augsburg", 12, 7, 15, 45, 61, 43),
    ("Mainz 05", 10, 10, 14, 44, 53, 40),
    ("Union Berlin", 10, 9, 15, 44, 58, 39),
    ("Borussia Mönchengladbach", 9, 11, 14, 42, 53, 38),
    ("Hamburger SV", 9, 11, 14, 40, 54, 38),
    ("1. FC Köln", 7, 11, 16, 49, 63, 32),
    ("Werder Bremen", 8, 8, 18, 37, 60, 32),
    ("VfL Wolfsburg", 7, 8, 19, 45, 69, 29),
    ("1. FC Heidenheim", 6, 8, 20, 41, 72, 26),
    ("FC St. Pauli", 6, 8, 20, 29, 60, 26),
]


def _require_cached(config) -> None:
    from tabletalk.data.loaders import build_loaders

    for loader in build_loaders(config, role="results"):
        if any(not loader.cache_path(s).exists() for s in loader.seasons):
            pytest.skip("raw data not cached; run `python -m tabletalk data fetch -c bundesliga` first")


def test_rebuilds_the_official_2025_26_bundesliga_table(bundesliga):
    from tabletalk.data import load_matches
    from tabletalk.simulation import league_table

    _require_cached(bundesliga)
    table = league_table(load_matches(bundesliga, save=False), bundesliga, "2025-26")
    columns = ["team", "won", "drawn", "lost", "goals_for", "goals_against", "points"]
    assert [tuple(row) for row in table[columns].itertuples(index=False, name=None)] == OFFICIAL_2025_26


def test_a_club_promoted_through_the_relegation_playoff_counts_as_promoted(bundesliga):
    """Paderborn won the 2025-26 play-off against Wolfsburg (16th)."""
    from tabletalk.data import load_matches
    from tabletalk.model.promoted import promoted_teams

    _require_cached(bundesliga)
    promoted = promoted_teams(load_matches(bundesliga, save=False), "bundesliga", "2026-27")
    assert "Paderborn 07" in promoted
    assert "VfL Wolfsburg" not in promoted

"""Points deductions: read from data, applied to totals only, respecting dates."""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

import tabletalk.data.deductions as deductions_module
from conftest import make_matches
from tabletalk.data.deductions import DeductionError, load_points_deductions, points_adjustments
from tabletalk.simulation import league_table
from tabletalk.simulation.league import LeagueSimulator
from test_league_simulator import StubModel, _one_match_left


def _deductions(rows) -> pd.DataFrame:
    """A deductions frame from (team, points, date) tuples, for toy_league 2025-26."""
    return pd.DataFrame(
        [
            {"competition": "toy_league", "season": "2025-26", "team": team, "points": points,
             "date_applied": pd.Timestamp(date), "source": "https://example.org", "reason": ""}
            for team, points, date in rows
        ]
    )


def _write_deductions(tmp_path: Path, body: str) -> Path:
    path = tmp_path / "points_deductions.yaml"
    path.write_text(body, encoding="utf-8")
    return path


# ---------------------------------------------------------------------------
# The data file
# ---------------------------------------------------------------------------


def test_shipped_file_loads_and_every_entry_has_a_source():
    table = load_points_deductions()
    assert len(table) >= 4
    assert table["source"].str.startswith("https://").all()
    everton = table.loc[(table["team"] == "Everton") & (table["season"] == "2023-24")]
    assert everton["points"].sum() == -8  # -10, +4 on appeal, -2


@pytest.mark.parametrize(
    "entry, message",
    [
        ("{competition: x, season: '2025-26', team: A, points: -3, date_applied: '2025-10-01'}", "missing"),
        ("{competition: x, season: '2025-26', team: A, points: 0, date_applied: '2025-10-01', source: 'https://a'}", "non-zero"),
        ("{competition: x, season: '2025-26', team: A, points: -3, date_applied: '2025-10-01', source: 'a book'}", "source link"),
    ],
)
def test_malformed_entries_are_rejected(tmp_path, entry, message):
    path = _write_deductions(tmp_path, f"deductions:\n  - {entry}\n")
    with pytest.raises(DeductionError, match=message):
        load_points_deductions(path)


def test_a_deduction_for_a_team_not_in_the_season_is_an_error():
    with pytest.raises(DeductionError, match="Evertn"):
        points_adjustments("toy_league", "2025-26", ["A", "B"], deductions=_deductions([("Evertn", -3, "2025-09-01")]))


# ---------------------------------------------------------------------------
# Applying them
# ---------------------------------------------------------------------------


def test_only_decisions_dated_before_as_of_count():
    table = _deductions([("A", -10, "2025-11-17"), ("A", 4, "2026-02-26")])
    teams = ["A", "B"]
    assert points_adjustments("toy_league", "2025-26", teams, deductions=table).tolist() == [-6, 0]
    assert points_adjustments("toy_league", "2025-26", teams, as_of="2025-11-17", deductions=table).tolist() == [0, 0]
    assert points_adjustments("toy_league", "2025-26", teams, as_of="2025-11-18", deductions=table).tolist() == [-10, 0]
    assert points_adjustments("toy_league", "2025-26", teams, as_of="2026-03-01", deductions=table).tolist() == [-6, 0]


def test_a_deduction_moves_a_team_down_the_table(four_team_config):
    finished = _one_match_left(last_result=(2, 0))  # B 15 points, A 13
    table = league_table(finished, four_team_config, "2025-26", deductions=_deductions([("B", -3, "2025-09-01")]))
    assert table["team"].tolist()[:2] == ["A", "B"]
    b = table.set_index("team").loc["B"]
    assert (b["points"], b["points_deducted"]) == (12, -3)


def test_a_deduction_does_not_change_head_to_head_points(four_team_config):
    """X earns 9 points and loses 3; Y earns 6. Level on 6, with Y far ahead on
    goal difference. X won both meetings, so a head-to-head-first chain must put
    X above Y: the deduction must not have leaked into the head-to-head count."""
    from dataclasses import replace

    matches = make_matches([("X", "Y", 1, 0), ("Y", "X", 0, 1), ("Y", "Z", 5, 0), ("Z", "Y", 0, 5), ("X", "Z", 1, 0), ("Z", "X", 1, 0)])
    config = replace(four_team_config, tiebreakers=("head_to_head_points", "goal_difference", "alphabetical"))
    deducted = pd.DataFrame(
        [{"competition": "toy_league", "season": "2025-26", "team": "X", "points": -3,
          "date_applied": pd.Timestamp("2025-09-01"), "source": "https://example.org", "reason": ""}]
    )
    table = league_table(matches, config, "2025-26", deductions=deducted).set_index("team")
    assert table.loc["X", "points"] == table.loc["Y", "points"] == 6
    assert table.loc["X", "position"] < table.loc["Y", "position"]  # 6 head-to-head points to 0


def test_the_simulator_applies_deductions_to_every_run(four_team_config, tmp_path, monkeypatch):
    """With one match left (B v A), B needs a win to overtake A. Deduct B three
    points before the season and B can no longer be champion."""
    path = _write_deductions(
        tmp_path,
        "deductions:\n  - {competition: toy_league, season: '2025-26', team: B, points: -3, "
        "date_applied: '2025-09-01', source: 'https://example.org'}\n",
    )
    monkeypatch.setattr(deductions_module, "DEDUCTIONS_FILE", path)
    result = LeagueSimulator(four_team_config, StubModel(0.45, 0.30, 0.25)).simulate(
        _one_match_left(), season="2025-26", n_simulations=2_000, seed=1
    )
    assert result.zone_probabilities().loc["B", "title"] == 0.0
    assert result.current_table.set_index("team").loc["B", "points_deducted"] == -3
    # Replayed from before the decision, it is not known yet.
    early = LeagueSimulator(four_team_config, StubModel(0.45, 0.30, 0.25)).simulate(
        _one_match_left(), season="2025-26", n_simulations=2_000, seed=1, as_of="2025-08-15"
    )
    assert early.zone_probabilities().loc["B", "title"] > 0.3


# ---------------------------------------------------------------------------
# The real thing: the official final 2023-24 Premier League table
# ---------------------------------------------------------------------------

#: Source: premierleague.com final table / 2023-24 end-of-season review
#: (https://www.premierleague.com/en/news/4039318), cross-checked with
#: Wikipedia's 2023-24 Premier League table, 27 September 2026.
#: (team, played, won, drawn, lost, goals for, goals against, points)
OFFICIAL_2023_24 = [
    ("Manchester City", 38, 28, 7, 3, 96, 34, 91),
    ("Arsenal", 38, 28, 5, 5, 91, 29, 89),
    ("Liverpool", 38, 24, 10, 4, 86, 41, 82),
    ("Aston Villa", 38, 20, 8, 10, 76, 61, 68),
    ("Tottenham Hotspur", 38, 20, 6, 12, 74, 61, 66),
    ("Chelsea", 38, 18, 9, 11, 77, 63, 63),
    ("Newcastle United", 38, 18, 6, 14, 85, 62, 60),
    ("Manchester United", 38, 18, 6, 14, 57, 58, 60),
    ("West Ham United", 38, 14, 10, 14, 60, 74, 52),
    ("Crystal Palace", 38, 13, 10, 15, 57, 58, 49),
    ("Brighton & Hove Albion", 38, 12, 12, 14, 55, 62, 48),
    ("Bournemouth", 38, 13, 9, 16, 54, 67, 48),
    ("Fulham", 38, 13, 8, 17, 55, 61, 47),
    ("Wolverhampton Wanderers", 38, 13, 7, 18, 50, 65, 46),
    ("Everton", 38, 13, 9, 16, 40, 51, 40),           # 8 points deducted
    ("Brentford", 38, 10, 9, 19, 56, 65, 39),
    ("Nottingham Forest", 38, 9, 9, 20, 49, 67, 32),  # 4 points deducted
    ("Luton Town", 38, 6, 8, 24, 52, 85, 26),
    ("Burnley", 38, 5, 9, 24, 41, 78, 24),
    ("Sheffield United", 38, 3, 7, 28, 35, 104, 16),
]


def test_rebuilds_the_official_2023_24_premier_league_table(premier_league):
    from tabletalk.data import load_matches
    from tabletalk.data.loaders import build_loaders

    for loader in build_loaders(premier_league, role="results"):
        if any(not loader.cache_path(s).exists() for s in loader.seasons):
            pytest.skip("raw data not cached; run `python -m tabletalk data fetch` first")

    matches = load_matches(premier_league, save=False)
    table = league_table(matches, premier_league, "2023-24")
    columns = ["team", "played", "won", "drawn", "lost", "goals_for", "goals_against", "points"]
    rebuilt = [tuple(row) for row in table[columns].itertuples(index=False, name=None)]
    assert rebuilt == OFFICIAL_2023_24

    # Without the deductions, Everton would have finished 12th, not 15th: the
    # test above would fail if the deductions file were ignored.
    ignored = league_table(matches, premier_league, "2023-24", deductions=load_points_deductions().iloc[0:0])
    assert ignored.set_index("team").loc["Everton", "points"] == 48

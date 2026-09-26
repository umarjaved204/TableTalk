"""Shared test fixtures.

The tests never touch the network: loaders are exercised against small CSVs
written into a tmp_path cache, so `pytest` runs offline and fast.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from tabletalk.config import load_competition  # noqa: E402
from tabletalk.data.schema import MATCH_COLUMNS  # noqa: E402


@pytest.fixture(scope="session")
def premier_league():
    """The real Premier League config: the tests double as config validation."""
    return load_competition("premier_league")


@pytest.fixture
def four_team_config(tmp_path: Path):
    """A tiny 4-team, double round-robin league used for exact-arithmetic tests."""
    config_dir = tmp_path / "competitions"
    config_dir.mkdir()
    (config_dir / "toy_league.yaml").write_text(
        """
id: toy_league
name: Toy League
country: Nowhere
format: league
league:
  n_teams: 4
  meetings_per_pair: 2
  matches_per_team: 6
points: {win: 3, draw: 1, loss: 0}
tiebreakers: [goal_difference, goals_scored, alphabetical]
zones:
  - {id: title, label: Champions, positions: [1]}
  - {id: relegation, label: Down, positions: [4]}
data:
  current_season: "2025-26"
  sources:
    - loader: football_data_uk
      params:
        division: XX
        seasons: ["2025-26"]
""",
        encoding="utf-8",
    )
    return load_competition("toy_league", config_dir=config_dir)


def make_matches(rows, season="2025-26", competition="toy_league") -> pd.DataFrame:
    """Build a standard-schema frame from ``(home, away, hg, ag)`` tuples.

    ``hg``/``ag`` of None means the fixture has not been played.
    """
    records = []
    for index, (home, away, home_goals, away_goals) in enumerate(rows):
        played = home_goals is not None and away_goals is not None
        records.append(
            {
                "date": pd.Timestamp("2025-08-01") + pd.Timedelta(days=index) if played else pd.NaT,
                "competition": competition,
                "season": season,
                "home_team": home,
                "away_team": away,
                "home_goals": home_goals,
                "away_goals": away_goals,
                "neutral": False,
                "played": played,
            }
        )
    return pd.DataFrame(records, columns=list(MATCH_COLUMNS))

"""The market benchmark: reading odds, removing the margin, lining up with forecasts."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from tabletalk.data.loaders.football_data_uk import FootballDataUKLoader
from tabletalk.evaluation.backtest import BASELINE
from tabletalk.evaluation.market import MARKET, add_market_forecasts, gap_closed, implied_probabilities

# Pinnacle closing (PSC*) priced the first two matches; the third only has the
# market average (AvgC*); the fourth has no closing odds at all; the fifth is
# unplayed. The blank line mimics the trailing rows these files often have.
_ODDS_CSV = """Div,Date,HomeTeam,AwayTeam,FTHG,FTAG,PSCH,PSCD,PSCA,AvgCH,AvgCD,AvgCA
E0,15/08/2025,Liverpool,Bournemouth,4,2,1.25,6.50,11.00,1.22,6.20,10.50
E0,16/08/2025,Aston Villa,Newcastle,0,0,2.40,3.40,3.00,2.30,3.30,2.90
E0,16/08/2025,Man United,Arsenal,0,1,,,,3.60,3.50,2.00
E0,17/08/2025,Nott'm Forest,Brentford,3,1,,,,,,
E0,23/08/2025,Wolves,Spurs,,,2.50,3.40,2.80,2.45,3.30,2.75
,,,,,,,,,,,
"""


@pytest.fixture
def odds_loader(tmp_path: Path) -> FootballDataUKLoader:
    cache = tmp_path / "raw"
    cache.mkdir()
    (cache / "E0_2526.csv").write_text(_ODDS_CSV, encoding="utf-8")
    return FootballDataUKLoader(
        "premier_league", division="E0", seasons=["2025-26"], cache_dir=str(cache),
        odds_preference=["PSC", "AvgC"],
    )


def test_margin_is_removed_proportionally():
    # 1/2 + 1/4 + 1/4 = 1.0 exactly: no margin, so nothing to remove.
    probs, overround = implied_probabilities(np.array([[2.0, 4.0, 4.0]]))
    assert probs[0] == pytest.approx([0.5, 0.25, 0.25])
    assert overround[0] == pytest.approx(1.0)
    # 1/2.1 + 1/3.4 + 1/3.8 = 1.0335: a 3.35% margin, shared in proportion.
    probs, overround = implied_probabilities(np.array([[2.1, 3.4, 3.8]]))
    assert overround[0] == pytest.approx(1 / 2.1 + 1 / 3.4 + 1 / 3.8)
    assert probs.sum() == pytest.approx(1.0)
    assert probs[0, 0] == pytest.approx((1 / 2.1) / overround[0])


def test_invalid_odds_are_rejected():
    with pytest.raises(ValueError):
        implied_probabilities(np.array([[1.0, 3.0, 3.0]]))
    with pytest.raises(ValueError):
        implied_probabilities(np.array([[np.nan, 3.0, 3.0]]))


def test_odds_follow_the_preference_order_and_skip_unpriced_matches(odds_loader):
    odds = odds_loader.load_odds().set_index("home_team")
    assert list(odds.index) == ["Liverpool", "Aston Villa", "Manchester United"]
    assert odds.loc["Liverpool", "odds_source"] == "PSC"
    assert odds.loc["Liverpool", "odds_home"] == pytest.approx(1.25)  # Pinnacle, not the average
    assert odds.loc["Manchester United", "odds_source"] == "AvgC"   # fallback
    assert odds.loc["Manchester United", "away_team"] == "Arsenal"  # names normalised


def test_no_odds_preference_means_no_odds(tmp_path):
    cache = tmp_path / "raw"
    cache.mkdir()
    (cache / "E0_2526.csv").write_text(_ODDS_CSV, encoding="utf-8")
    loader = FootballDataUKLoader("premier_league", division="E0", seasons=["2025-26"], cache_dir=str(cache))
    assert loader.load_odds() is None


def _predictions() -> pd.DataFrame:
    """A two-match backtest frame with a baseline and a model."""
    base = pd.DataFrame(
        {
            "season": ["2025-26", "2025-26"],
            "date": pd.to_datetime(["2025-08-15", "2025-08-16"]),
            "home_team": ["Liverpool", "Aston Villa"],
            "away_team": ["Bournemouth", "Newcastle United"],
            "outcome": [0, 1],
            "promoted_match": [False, False],
            "early_season": [True, True],
        }
    )
    baseline = base.assign(p_home=0.45, p_draw=0.27, p_away=0.28, model=BASELINE)
    model = base.assign(p_home=[0.7, 0.4], p_draw=[0.2, 0.3], p_away=[0.1, 0.3], model="prior")
    return pd.concat([baseline, model], ignore_index=True)


def test_market_rows_line_up_with_the_matches(odds_loader):
    predictions = add_market_forecasts(_predictions(), odds_loader.load_odds())
    market = predictions.loc[predictions["model"] == MARKET].set_index("home_team")
    assert len(market) == 2
    expected, _ = implied_probabilities(np.array([[1.25, 6.50, 11.00]]))
    assert market.loc["Liverpool", ["p_home", "p_draw", "p_away"]].to_numpy(dtype=float) == pytest.approx(expected[0])
    assert market.loc["Aston Villa", "outcome"] == 1  # carried over from the baseline row


def test_gap_closed_is_the_share_of_the_baseline_to_market_gap(odds_loader):
    predictions = add_market_forecasts(_predictions(), odds_loader.load_odds())
    row = gap_closed(predictions, "prior").iloc[0]
    expected = 100 * (row["baseline"] - row["prior"]) / (row["baseline"] - row["market"])
    assert row["gap_closed_pct"] == pytest.approx(expected)
    assert row["model_minus_market"] == pytest.approx(row["prior"] - row["market"])

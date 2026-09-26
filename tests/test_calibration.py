"""Calibration tables and the season-level backtest's scoring pieces."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from conftest import make_matches
from tabletalk.evaluation.calibration import (
    calibration_table,
    expected_calibration_error,
    match_calibration,
    wilson_interval,
)
from tabletalk.evaluation.season_backtest import (
    checkpoint_dates,
    persistence_order,
    ranked_probability_score_positions,
    summarise_zones,
)

# ---------------------------------------------------------------------------
# Calibration
# ---------------------------------------------------------------------------


def test_wilson_interval_known_value():
    low, high = wilson_interval(50, 100)
    assert float(low) == pytest.approx(0.4038, abs=1e-3)
    assert float(high) == pytest.approx(0.5962, abs=1e-3)


def test_wilson_interval_stays_inside_zero_and_one():
    low, high = wilson_interval(0, 10)
    assert float(low) == 0.0 and 0 < float(high) < 0.35
    low, high = wilson_interval(10, 10)
    assert float(high) == 1.0 and 0.65 < float(low) < 1


def test_a_calibrated_forecaster_sits_on_the_diagonal():
    rng = np.random.default_rng(0)
    p = rng.random(200_000)
    y = rng.random(200_000) < p  # the event happens with exactly the stated probability
    table = calibration_table(p, y)
    assert expected_calibration_error(table) < 0.01
    # every bin's interval covers its mean forecast
    assert ((table["ci_low"] <= table["mean_forecast"]) & (table["mean_forecast"] <= table["ci_high"])).mean() > 0.85


def test_an_overconfident_forecaster_is_caught():
    rng = np.random.default_rng(1)
    p = rng.random(100_000)
    y = rng.random(100_000) < p**2  # happens less often than claimed
    table = calibration_table(p, y)
    assert expected_calibration_error(table) > 0.1
    assert (table["gap"] < 0).all()


def test_certain_forecasts_land_in_the_end_bins():
    table = calibration_table([0.0, 1.0, 1.0], [False, True, True])
    assert table["n"].tolist() == [1, 2]
    assert table["observed"].tolist() == [0.0, 1.0]


def test_match_calibration_splits_by_outcome():
    predictions = pd.DataFrame(
        {"p_home": [0.6, 0.6], "p_draw": [0.25, 0.25], "p_away": [0.15, 0.15], "outcome": [0, 1]}
    )
    tables = match_calibration(predictions)
    assert set(tables) == {"home", "draw", "away"}
    assert tables["home"]["observed"].iloc[0] == 0.5
    assert tables["draw"]["observed"].iloc[0] == 0.5
    assert tables["away"]["observed"].iloc[0] == 0.0


# ---------------------------------------------------------------------------
# Season backtest pieces
# ---------------------------------------------------------------------------


def test_position_rps_rewards_being_close():
    near = np.zeros((1, 20)); near[0, 1] = 1.0   # all on 2nd
    far = np.zeros((1, 20)); far[0, 14] = 1.0    # all on 15th
    exact = np.zeros((1, 20)); exact[0, 0] = 1.0
    actual = np.array([1])
    assert ranked_probability_score_positions(exact, actual)[0] == 0.0
    assert ranked_probability_score_positions(near, actual)[0] < ranked_probability_score_positions(far, actual)[0]


def test_position_rps_known_value():
    """All on position 2 when the truth is 1: the cumulative gap is 1 at k=1 only."""
    forecast = np.zeros((1, 4)); forecast[0, 1] = 1.0
    assert ranked_probability_score_positions(forecast, np.array([1]))[0] == pytest.approx(1 / 3)


def test_checkpoint_dates_split_the_played_matches():
    matches = make_matches([("A", "B", 1, 0)] * 8)  # one match a day from 1 Aug
    dates = checkpoint_dates(matches, [("pre", 0.0), ("half", 0.5)])
    assert dates[0] == ("pre", pd.Timestamp("2025-08-01"))
    assert dates[1] == ("half", pd.Timestamp("2025-08-05"))


def test_persistence_pre_season_is_last_seasons_table_with_newcomers_last(four_team_config):
    last = make_matches([("B", "A", 3, 0), ("C", "A", 1, 0), ("B", "C", 1, 0)], season="2024-25")
    this = make_matches([("A", "B", None, None), ("A", "D", None, None), ("B", "D", None, None)], season="2025-26")
    matches = pd.concat([last, this], ignore_index=True)
    # 2024-25 finished B (6 pts), C (3), A (0). C is not in 2025-26 and D is
    # new, so the forecast is last season's order for B and A, then D.
    order = persistence_order(matches, four_team_config, "2025-26", pd.Timestamp("2025-07-01"))
    assert order == ["B", "A", "D"]


def test_zone_summary_scores_the_uniform_baseline_at_zero_skill():
    zones = pd.DataFrame(
        {
            "checkpoint": "pre-season",
            "zone": "title",
            "p_model": [0.25, 0.25, 0.25, 0.25],
            "p_uniform": [0.25] * 4,
            "p_persistence": [1.0, 0.0, 0.0, 0.0],
            "outcome": [False, True, False, False],
        }
    )
    summary = summarise_zones(zones, n_simulations=1000).iloc[0]
    assert summary["skill_vs_uniform_pct"] == pytest.approx(0.0)
    assert summary["brier_persistence"] == pytest.approx(0.5)  # two wrong certainties out of four

"""Scoring rules, the base-rate baseline and the backtest's no-look-ahead guarantee."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from tabletalk.evaluation.backtest import base_rates, match_backtest, paired_comparison, summarise_backtest
from tabletalk.evaluation.metrics import (
    AWAY,
    DRAW,
    HOME,
    brier_score,
    log_loss,
    outcomes_from_goals,
    ranked_probability_score,
    score_forecasts,
)
from test_promoted import _season


# These tests use tiny synthetic seasons (12 matches), far too few to pin down
# rho, so the optimiser legitimately reports it at its bound.
pytestmark = pytest.mark.filterwarnings("ignore:rho=.*search bound")

def test_outcome_encoding():
    assert list(outcomes_from_goals([2, 1, 0], [0, 1, 3])) == [HOME, DRAW, AWAY]


def test_log_loss_is_minus_log_of_the_realised_probability():
    probs = np.array([[0.5, 0.3, 0.2]])
    assert log_loss(probs, [HOME]) == pytest.approx(-np.log(0.5))
    assert log_loss(probs, [AWAY]) == pytest.approx(-np.log(0.2))


def test_brier_worked_example():
    """The example in the metrics docstring: (0.5, 0.3, 0.2) and a home win."""
    assert brier_score(np.array([[0.5, 0.3, 0.2]]), [HOME]) == pytest.approx(0.38)


def test_perfect_forecast_scores_zero():
    probs = np.array([[1.0, 0.0, 0.0], [0.0, 0.0, 1.0]])
    scores = score_forecasts(probs, [HOME, AWAY])
    assert scores["brier"] == pytest.approx(0.0)
    assert scores["rps"] == pytest.approx(0.0)
    assert scores["log_loss"] == pytest.approx(0.0, abs=1e-12)


def test_rps_respects_the_order_of_outcomes():
    """For a home win, forecasting a draw is 'less wrong' than an away win.

    Brier cannot tell these apart; RPS can, which is why it is used.
    """
    said_draw = np.array([[0.0, 1.0, 0.0]])
    said_away = np.array([[0.0, 0.0, 1.0]])
    assert ranked_probability_score(said_draw, [HOME]) < ranked_probability_score(said_away, [HOME])
    assert brier_score(said_draw, [HOME]) == pytest.approx(brier_score(said_away, [HOME]))


def test_invalid_forecasts_are_rejected():
    with pytest.raises(ValueError, match="sum to 1"):
        log_loss(np.array([[0.5, 0.5, 0.5]]), [HOME])
    with pytest.raises(ValueError, match="shape"):
        log_loss(np.array([0.5, 0.3, 0.2]), [HOME])


def test_base_rates_only_use_earlier_results():
    early = pd.DataFrame(
        {
            "date": pd.to_datetime(["2025-01-01", "2025-01-02"]),
            "competition": "toy_league",
            "home_goals": [2, 1],
            "away_goals": [0, 1],
            "played": True,
        }
    )
    late = early.assign(date=pd.to_datetime(["2025-06-01", "2025-06-02"]), home_goals=[0, 0], away_goals=[3, 3])
    matches = pd.concat([early, late], ignore_index=True)
    assert base_rates(matches, "toy_league", pd.Timestamp("2025-03-01")) == pytest.approx([0.5, 0.5, 0.0])


@pytest.fixture(scope="module")
def backtest_predictions(tmp_path_factory):
    from tabletalk.config import load_competition

    config_dir = tmp_path_factory.mktemp("configs")
    (config_dir / "toy_league.yaml").write_text(
        """
id: toy_league
name: Toy League
format: league
league: {n_teams: 4, meetings_per_pair: 2, matches_per_team: 6}
points: {win: 3, draw: 1, loss: 0}
tiebreakers: [goal_difference]
data:
  current_season: "2025-26"
  sources: [{loader: football_data_uk, params: {division: XX, seasons: ["2025-26"]}}]
""",
        encoding="utf-8",
    )
    config = load_competition("toy_league", config_dir=config_dir)
    history = pd.concat(
        [
            _season(list("ABCD"), "2023-24", seed=1),
            _season(list("ABCE"), "2024-25", seed=2),
            _season(list("ABCF"), "2025-26", seed=3),
        ],
        ignore_index=True,
    )
    return match_backtest(config, history, None, ["2025-26"], strategies=("none", "prior"))


def test_backtest_never_uses_the_future(backtest_predictions):
    """Every forecast was made from a fit dated on or before the match."""
    assert (backtest_predictions["fit_date"] <= backtest_predictions["date"]).all()


def test_backtest_covers_every_match_for_every_model(backtest_predictions):
    counts = backtest_predictions.groupby("model").size()
    assert set(counts.index) == {"none", "prior", "baseline"}
    assert counts.nunique() == 1 and counts.iloc[0] == 12


def test_backtest_summary_compares_against_the_baseline(backtest_predictions):
    summary = summarise_backtest(backtest_predictions)
    baseline = summary.loc[(summary["model"] == "baseline") & (summary["group"] == "all matches")]
    assert baseline["vs_baseline_pct"].iloc[0] == pytest.approx(0.0)
    assert {"log_loss", "brier", "rps", "n"} <= set(summary.columns)


def test_paired_comparison_of_a_model_with_itself_is_zero(backtest_predictions):
    paired = paired_comparison(backtest_predictions, "prior", "prior")
    assert (paired["diff"] == 0).all()


def test_paired_comparison_matches_the_difference_in_log_loss(backtest_predictions):
    paired = paired_comparison(backtest_predictions, "prior", "baseline")
    overall = paired.loc[paired["group"] == "all matches"].iloc[0]
    summary = summarise_backtest(backtest_predictions).set_index(["group", "model"])
    expected = summary.loc[("all matches", "prior"), "log_loss"] - summary.loc[("all matches", "baseline"), "log_loss"]
    assert overall["n"] == 12
    assert overall["diff"] == pytest.approx(expected)
    assert overall["ci95"] > 0

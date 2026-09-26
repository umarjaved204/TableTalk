"""Strength uncertainty: parameter covariance, drift, and the per-run score sampler."""

from __future__ import annotations

import numpy as np
import pytest

from test_dixon_coles import _simulate_league
from tabletalk.model.dixon_coles import DixonColesModel, TeamPrior, outcome_probabilities, score_matrix
from tabletalk.simulation.uncertainty import (
    FIXED,
    StrengthUncertainty,
    draw_parameters,
    implied_drift_variance_per_day,
    sample_dixon_coles,
    simulate_fixtures,
)

# ---------------------------------------------------------------------------
# The sampler must reproduce the Dixon-Coles distribution exactly
# ---------------------------------------------------------------------------


def test_rejection_sampler_matches_the_score_matrix():
    lam, mu, rho, n = 1.6, 1.1, -0.12, 400_000
    rng = np.random.default_rng(0)
    home, away = sample_dixon_coles(np.full(n, lam), np.full(n, mu), rho, rng)
    matrix = score_matrix(lam, mu, rho, max_goals=15)
    for x, y in [(0, 0), (1, 0), (0, 1), (1, 1), (2, 1), (3, 0)]:
        expected = matrix[x, y]
        observed = np.mean((home == x) & (away == y))
        standard_error = np.sqrt(expected * (1 - expected) / n)
        assert observed == pytest.approx(expected, abs=4 * standard_error), (x, y)
    p_home, p_draw, p_away = outcome_probabilities(matrix)
    assert np.mean(home > away) == pytest.approx(p_home, abs=0.005)
    assert np.mean(home == away) == pytest.approx(p_draw, abs=0.005)


def test_rejection_sampler_handles_a_different_rate_per_run():
    rng = np.random.default_rng(1)
    lam = np.where(np.arange(200_000) % 2 == 0, 0.5, 3.0)
    home, _ = sample_dixon_coles(lam, np.full_like(lam, 1.0), 0.0, rng)
    assert home[::2].mean() == pytest.approx(0.5, abs=0.02)
    assert home[1::2].mean() == pytest.approx(3.0, abs=0.03)


# ---------------------------------------------------------------------------
# Drift implied by the half-life
# ---------------------------------------------------------------------------


def test_implied_drift():
    assert implied_drift_variance_per_day(None) == 0.0
    # Shorter memory means the model believes strength moves faster.
    assert implied_drift_variance_per_day(90) > implied_drift_variance_per_day(180) > implied_drift_variance_per_day(365)
    # The worked example in the docstring: ~7e-5 per day, sd ~0.14 over 280 days.
    variance = implied_drift_variance_per_day(180, goals_per_team_match=1.4)
    assert variance == pytest.approx(7.4e-5, rel=0.05)
    assert np.sqrt(variance * 280) == pytest.approx(0.14, abs=0.01)


# ---------------------------------------------------------------------------
# Parameter covariance (Laplace approximation)
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def fit_with_covariance():
    matches = _simulate_league(n_rounds=6, seed=21)
    prior = TeamPrior(attack=-0.3, defence=-0.2, sd=0.2)
    return DixonColesModel(half_life_days=None).fit(
        matches, teams=["Newcomer"], priors={"Newcomer": prior}, compute_covariance=True
    )


def test_covariance_is_a_valid_covariance(fit_with_covariance):
    covariance = fit_with_covariance.covariance
    assert covariance.shape == (fit_with_covariance.parameter_vector().size,) * 2
    assert np.allclose(covariance, covariance.T)
    assert np.linalg.eigvalsh(covariance).min() > 0


def test_team_without_matches_is_as_uncertain_as_its_prior(fit_with_covariance):
    """No data about the newcomer, so the fit knows only what its prior says."""
    fit = fit_with_covariance
    n = len(fit.teams)
    i = fit.team_index("Newcomer")
    assert np.sqrt(fit.covariance[i, i]) == pytest.approx(0.2, rel=0.02)
    assert np.sqrt(fit.covariance[n + i, n + i]) == pytest.approx(0.2, rel=0.02)


def test_gaps_between_well_observed_teams_are_tight(fit_with_covariance):
    """336 matches pin the gap between two teams far more tightly than a prior would."""
    fit = fit_with_covariance
    w = np.zeros(fit.covariance.shape[0])
    w[fit.team_index("T0")], w[fit.team_index("T1")] = 1, -1
    assert np.sqrt(w @ fit.covariance @ w) < 0.15


def test_drawing_needs_a_covariance():
    fit = DixonColesModel(half_life_days=None).fit(_simulate_league(n_rounds=1, seed=2))
    with pytest.raises(ValueError, match="compute_covariance"):
        draw_parameters(fit, 10, np.random.default_rng(0))


# ---------------------------------------------------------------------------
# The whole point: wider spread, same average
# ---------------------------------------------------------------------------


def _wins_per_run(fit, uncertainty, seed):
    """T0 hosts T7 twenty times over ~190 days: how many does it win, per run?"""
    days = np.arange(20) * 10.0
    home, away = simulate_fixtures(
        fit, uncertainty, ["T0"] * 20, ["T7"] * 20, days, np.zeros(20, dtype=bool),
        n_simulations=20_000, rng=np.random.default_rng(seed),
    )
    return (home > away).sum(axis=0)


def test_uncertainty_widens_outcomes_without_moving_the_average(fit_with_covariance):
    fixed = _wins_per_run(fit_with_covariance, FIXED, seed=3)
    uncertain = _wins_per_run(
        fit_with_covariance,
        StrengthUncertainty(parameter_uncertainty=True, drift_variance_per_day=1e-4),
        seed=3,
    )
    # A run where T0 is drawn stronger wins more of *all* twenty matches: the
    # run-to-run spread grows well beyond pure match randomness...
    assert uncertain.var() > 1.3 * fixed.var()
    # ...while the expected number of wins barely moves.
    assert uncertain.mean() == pytest.approx(fixed.mean(), rel=0.05)


def test_fixed_strengths_match_the_model_expectation(fit_with_covariance):
    fit = fit_with_covariance
    home, _ = simulate_fixtures(
        fit, FIXED, ["T0"], ["T7"], np.array([0.0]), np.array([False]),
        n_simulations=100_000, rng=np.random.default_rng(4),
    )
    lam, _ = fit.expected_goals("T0", "T7")
    assert home.mean() == pytest.approx(lam, rel=0.02)

"""The Dixon-Coles likelihood, its gradient, and whether fitting recovers the truth.

The model is where a subtle error (a flipped sign on defence, a tau term on the
wrong cell, a gradient that is almost right) produces plausible numbers that are
quietly wrong. Hence: exact checks of each formula, a finite-difference check of
the gradient, and a recovery test on data simulated from known parameters.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest
from scipy.optimize import approx_fprime
from scipy.stats import poisson

from tabletalk.model.dixon_coles import (
    DixonColesModel,
    TeamPrior,
    _FitData,
    _negative_log_posterior,
    decay_weights,
    outcome_probabilities,
    score_matrix,
    tau,
)

# ---------------------------------------------------------------------------
# The formulas
# ---------------------------------------------------------------------------


def test_tau_on_each_low_score_cell():
    lam, mu, rho = 1.5, 1.2, -0.1
    assert tau(0, 0, lam, mu, rho) == pytest.approx(1 - lam * mu * rho)
    assert tau(0, 1, lam, mu, rho) == pytest.approx(1 + lam * rho)
    assert tau(1, 0, lam, mu, rho) == pytest.approx(1 + mu * rho)
    assert tau(1, 1, lam, mu, rho) == pytest.approx(1 - rho)


@pytest.mark.parametrize("x, y", [(2, 0), (0, 2), (2, 1), (1, 2), (3, 3), (2, 2)])
def test_tau_is_one_away_from_the_low_scores(x, y):
    assert tau(x, y, 1.5, 1.2, -0.1) == pytest.approx(1.0)


def test_tau_is_one_everywhere_when_rho_is_zero():
    x, y = np.meshgrid(np.arange(4), np.arange(4))
    assert np.allclose(tau(x, y, 1.4, 1.1, 0.0), 1.0)


def test_score_matrix_with_zero_rho_is_two_independent_poissons():
    lam, mu = 1.6, 1.1
    matrix = score_matrix(lam, mu, rho=0.0, max_goals=15)
    goals = np.arange(16)
    expected = np.outer(poisson.pmf(goals, lam), poisson.pmf(goals, mu))
    assert np.allclose(matrix, expected / expected.sum())


def test_score_matrix_sums_to_one():
    assert score_matrix(1.7, 0.9, -0.12).sum() == pytest.approx(1.0)


def test_negative_rho_moves_probability_into_low_scoring_draws():
    """The whole point of Dixon-Coles: more 0-0 and 1-1, fewer 1-0 and 0-1."""
    independent = score_matrix(1.3, 1.1, 0.0)
    adjusted = score_matrix(1.3, 1.1, -0.1)
    assert adjusted[0, 0] > independent[0, 0]
    assert adjusted[1, 1] > independent[1, 1]
    assert adjusted[1, 0] < independent[1, 0]
    assert adjusted[0, 1] < independent[0, 1]
    # ...and leaves everything else alone (up to renormalisation, which is ~0).
    assert adjusted[2, 1] == pytest.approx(independent[2, 1], rel=1e-6)


def test_tau_adjustments_cancel_exactly():
    """Dixon-Coles' four adjustments add zero net probability."""
    lam, mu, rho = 1.4, 1.2, -0.13
    p00 = poisson.pmf(0, lam) * poisson.pmf(0, mu)
    p01 = poisson.pmf(0, lam) * poisson.pmf(1, mu)
    p10 = poisson.pmf(1, lam) * poisson.pmf(0, mu)
    p11 = poisson.pmf(1, lam) * poisson.pmf(1, mu)
    net = (
        p00 * (tau(0, 0, lam, mu, rho) - 1)
        + p01 * (tau(0, 1, lam, mu, rho) - 1)
        + p10 * (tau(1, 0, lam, mu, rho) - 1)
        + p11 * (tau(1, 1, lam, mu, rho) - 1)
    )
    assert net == pytest.approx(0.0, abs=1e-15)


def test_outcome_probabilities_read_the_right_triangles():
    matrix = np.zeros((3, 3))
    matrix[2, 0] = 0.5  # home win 2-0
    matrix[1, 1] = 0.3  # draw
    matrix[0, 2] = 0.2  # away win 0-2
    assert outcome_probabilities(matrix) == pytest.approx((0.5, 0.3, 0.2))


def test_decay_weights():
    assert decay_weights(np.array([0.0]), 180)[0] == pytest.approx(1.0)
    assert decay_weights(np.array([180.0]), 180)[0] == pytest.approx(0.5)
    assert decay_weights(np.array([360.0]), 180)[0] == pytest.approx(0.25)
    assert np.all(decay_weights(np.array([0.0, 1000.0]), None) == 1.0)
    with pytest.raises(ValueError):
        decay_weights(np.array([1.0]), 0)


# ---------------------------------------------------------------------------
# Likelihood and gradient
# ---------------------------------------------------------------------------


def _random_fit_data(seed: int = 0, n_teams: int = 6, n_matches: int = 300) -> _FitData:
    rng = np.random.default_rng(seed)
    home = rng.integers(0, n_teams, n_matches)
    away = (home + rng.integers(1, n_teams, n_matches)) % n_teams
    return _FitData(
        home=home,
        away=away,
        home_goals=rng.poisson(1.4, n_matches).astype(float),
        away_goals=rng.poisson(1.1, n_matches).astype(float),
        home_flag=(rng.random(n_matches) > 0.2).astype(float),  # some neutral venues
        division=rng.integers(0, 2, n_matches),                  # two divisions
        weights=rng.random(n_matches),                           # arbitrary decay weights
        n_teams=n_teams,
        n_offsets=1,
        prior_attack=rng.normal(0, 0.2, n_teams),
        prior_defence=rng.normal(0, 0.2, n_teams),
        prior_sd=np.full(n_teams, 0.7),
    )


def test_analytic_gradient_matches_finite_differences():
    data = _random_fit_data()
    rng = np.random.default_rng(1)
    theta = np.concatenate([rng.normal(0, 0.3, 2 * data.n_teams), [0.1, 0.25, -0.08], [0.15]])
    analytic = _negative_log_posterior(theta, data)[1]
    numeric = approx_fprime(theta, lambda t: _negative_log_posterior(t, data)[0], 1e-7)
    assert np.allclose(analytic, numeric, rtol=1e-4, atol=1e-3)


def test_objective_matches_a_hand_computed_likelihood():
    """Compute the weighted DC log-likelihood the slow, obvious way and compare."""
    data = _random_fit_data(seed=3, n_matches=40)
    data.prior_sd = np.full(data.n_teams, 1e6)  # make the prior term negligible
    rng = np.random.default_rng(4)
    n = data.n_teams
    attack, defence = rng.normal(0, 0.3, n), rng.normal(0, 0.3, n)
    intercept, home_adv, rho, offset = 0.1, 0.25, -0.08, 0.15
    theta = np.concatenate([attack, defence, [intercept, home_adv, rho, offset]])

    total = 0.0
    for i in range(len(data.home)):
        h, a = data.home[i], data.away[i]
        base = intercept + (offset if data.division[i] == 1 else 0.0)
        lam = np.exp(base + home_adv * data.home_flag[i] + attack[h] - defence[a])
        mu = np.exp(base + attack[a] - defence[h])
        x, y = int(data.home_goals[i]), int(data.away_goals[i])
        p = tau(x, y, lam, mu, rho) * poisson.pmf(x, lam) * poisson.pmf(y, mu)
        total += data.weights[i] * np.log(p)

    prior_term = 0.5 * np.sum(((attack - data.prior_attack) / 1e6) ** 2 + ((defence - data.prior_defence) / 1e6) ** 2)
    assert _negative_log_posterior(theta, data)[0] == pytest.approx(-total + prior_term, rel=1e-10)


# ---------------------------------------------------------------------------
# Fitting: recovery, priors, look-ahead, neutral venues
# ---------------------------------------------------------------------------

_TRUE_TEAMS = [f"T{i}" for i in range(8)]
_TRUE_ATTACK = np.array([0.45, 0.30, 0.15, 0.05, -0.05, -0.15, -0.30, -0.45])
_TRUE_DEFENCE = np.array([0.35, 0.10, 0.25, -0.05, 0.05, -0.20, -0.15, -0.35])
_TRUE_INTERCEPT, _TRUE_HOME, _TRUE_RHO = 0.10, 0.25, -0.10


def _simulate_league(n_rounds: int, seed: int) -> pd.DataFrame:
    """Double round robins drawn from the exact Dixon-Coles score distribution."""
    rng = np.random.default_rng(seed)
    rows = []
    date = pd.Timestamp("2020-01-01")
    for _ in range(n_rounds):
        for h, home in enumerate(_TRUE_TEAMS):
            for a, away in enumerate(_TRUE_TEAMS):
                if h == a:
                    continue
                lam = np.exp(_TRUE_INTERCEPT + _TRUE_HOME + _TRUE_ATTACK[h] - _TRUE_DEFENCE[a])
                mu = np.exp(_TRUE_INTERCEPT + _TRUE_ATTACK[a] - _TRUE_DEFENCE[h])
                matrix = score_matrix(lam, mu, _TRUE_RHO, max_goals=12)
                cell = rng.choice(matrix.size, p=matrix.ravel())
                x, y = divmod(cell, matrix.shape[1])
                rows.append((date, home, away, x, y))
                date += pd.Timedelta(days=1)
    frame = pd.DataFrame(rows, columns=["date", "home_team", "away_team", "home_goals", "away_goals"])
    frame["competition"] = "sim"
    frame["season"] = "2020-21"
    frame["neutral"] = False
    frame["played"] = True
    return frame


@pytest.fixture(scope="module")
def recovered():
    # 11,200 matches: enough that sampling noise sits well inside the test
    # tolerances. (At 2,240 matches rho alone ranges from -0.02 to -0.14 across
    # seeds around a true -0.10 - it is the least well-identified parameter.)
    matches = _simulate_league(n_rounds=200, seed=42)
    return DixonColesModel(half_life_days=None, rating_prior_sd=10.0).fit(matches)


def test_fit_recovers_team_ratings(recovered):
    """Ratings are identified up to a shared constant, so compare centred values."""
    ratings = recovered.ratings(_TRUE_TEAMS).set_index("team").loc[_TRUE_TEAMS]
    attack = ratings["attack"].to_numpy()
    defence = ratings["defence"].to_numpy()
    assert np.allclose(attack - attack.mean(), _TRUE_ATTACK - _TRUE_ATTACK.mean(), atol=0.05)
    assert np.allclose(defence - defence.mean(), _TRUE_DEFENCE - _TRUE_DEFENCE.mean(), atol=0.05)


def test_fit_recovers_home_advantage_and_rho(recovered):
    assert recovered.home_advantage == pytest.approx(_TRUE_HOME, abs=0.03)
    assert recovered.rho == pytest.approx(_TRUE_RHO, abs=0.04)
    assert recovered.converged


def test_fit_recovers_match_probabilities(recovered):
    """The quantity that matters downstream: outcome probabilities."""
    for h, a in [(0, 7), (7, 0), (3, 4)]:
        lam = np.exp(_TRUE_INTERCEPT + _TRUE_HOME + _TRUE_ATTACK[h] - _TRUE_DEFENCE[a])
        mu = np.exp(_TRUE_INTERCEPT + _TRUE_ATTACK[a] - _TRUE_DEFENCE[h])
        truth = outcome_probabilities(score_matrix(lam, mu, _TRUE_RHO))
        fitted = recovered.outcome_probabilities(_TRUE_TEAMS[h], _TRUE_TEAMS[a])
        assert np.allclose(fitted, truth, atol=0.03)


def test_neutral_venue_removes_home_advantage(recovered):
    lam_home, mu_home = recovered.expected_goals("T0", "T1")
    lam_neutral, mu_neutral = recovered.expected_goals("T0", "T1", neutral=True)
    assert lam_neutral == pytest.approx(lam_home / np.exp(recovered.home_advantage))
    assert mu_neutral == pytest.approx(mu_home)


def test_neutral_match_between_equal_teams_is_symmetric(recovered):
    p_home, p_draw, p_away = recovered.outcome_probabilities("T3", "T3", neutral=True)
    assert p_home == pytest.approx(p_away)
    assert p_home + p_draw + p_away == pytest.approx(1.0)


def test_prior_centres_ratings_on_zero():
    """The ridge prior is what pins down the level of the ratings.

    The likelihood is unchanged by shifting every attack up and the intercept
    down, and a prior centred on zero prefers the shift that makes the mean
    exactly zero. Uses the configured prior width (sd 1.0): with a near-flat
    prior (the recovery test's sd 10) that direction is so flat the optimiser
    stops a little short, which moves no prediction but blurs the display.
    """
    fit = DixonColesModel(half_life_days=None, rating_prior_sd=1.0).fit(_simulate_league(20, seed=7))
    assert abs(fit.attack.mean()) < 1e-4
    assert abs(fit.defence.mean()) < 1e-4


def test_team_without_matches_takes_its_prior():
    matches = _simulate_league(n_rounds=2, seed=1)
    prior = TeamPrior(attack=-0.3, defence=-0.25, sd=0.2)
    fit = DixonColesModel(half_life_days=None).fit(matches, teams=["Newcomer"], priors={"Newcomer": prior})
    row = fit.ratings(["Newcomer"]).iloc[0]
    assert row["attack"] == pytest.approx(-0.3, abs=1e-5)
    assert row["defence"] == pytest.approx(-0.25, abs=1e-5)
    assert row["matches"] == 0


def test_fit_ignores_results_on_or_after_as_of():
    """No look-ahead: fitting as of a date equals fitting on the truncated data."""
    matches = _simulate_league(n_rounds=3, seed=2)
    cutoff = matches["date"].iloc[100]
    model = DixonColesModel(half_life_days=90)
    with_future = model.fit(matches, as_of=cutoff)
    without_future = model.fit(matches.loc[matches["date"] < cutoff], as_of=cutoff)
    assert with_future.n_matches == 100
    assert np.allclose(with_future.attack, without_future.attack)
    assert with_future.rho == pytest.approx(without_future.rho)


def test_second_division_gets_its_own_goal_rate():
    top = _simulate_league(n_rounds=4, seed=5)
    lower = _simulate_league(n_rounds=4, seed=6)
    lower["competition"] = "second"
    lower["home_team"] = "L-" + lower["home_team"]
    lower["away_team"] = "L-" + lower["away_team"]
    lower["home_goals"] = lower["home_goals"] + 1  # a higher-scoring division
    fit = DixonColesModel(half_life_days=None).fit(pd.concat([top, lower]), base_division="sim")
    assert fit.base_division == "sim"
    assert set(fit.division_offsets) == {"second"}
    assert fit.division_offsets["second"] > 0


def test_unknown_team_gives_a_clear_error(recovered):
    with pytest.raises(KeyError, match="has no rating"):
        recovered.expected_goals("T0", "Nobody FC")


def test_predict_adds_probabilities_to_a_fixture_frame(recovered):
    fixtures = pd.DataFrame({"home_team": ["T0", "T5"], "away_team": ["T7", "T2"], "neutral": [False, True]})
    predicted = recovered.predict(fixtures)
    assert list(predicted.columns[:3]) == ["home_team", "away_team", "neutral"]
    totals = predicted[["p_home", "p_draw", "p_away"]].sum(axis=1)
    assert np.allclose(totals, 1.0)
    assert predicted.loc[0, "p_home"] > predicted.loc[0, "p_away"]  # best v worst


# A 30-day half-life leaves ~40 matches of effective data: far too few to pin
# down rho, which duly hits its bound. Irrelevant to what this test checks.
@pytest.mark.filterwarnings("ignore:rho=.*search bound")
def test_negligible_weight_matches_are_dropped():
    """Matches that decay below min_weight are excluded; the rest are unchanged."""
    matches = _simulate_league(n_rounds=6, seed=8)  # 336 matches, one a day
    as_of = matches["date"].max() + pd.Timedelta(days=1)
    # half-life 30 days: after ~300 days a match weighs < 0.001
    trimmed = DixonColesModel(half_life_days=30, min_weight=1e-3).fit(matches, as_of=as_of)
    everything = DixonColesModel(half_life_days=30, min_weight=0).fit(matches, as_of=as_of)
    assert trimmed.n_matches < everything.n_matches
    assert everything.n_matches == len(matches)
    assert np.allclose(trimmed.attack, everything.attack, atol=0.01)

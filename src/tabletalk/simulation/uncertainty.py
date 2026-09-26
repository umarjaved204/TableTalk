"""Strength uncertainty: simulated seasons where team strengths are not frozen.

The plain simulator uses one set of ratings, today's best estimates, for every
simulated season and every remaining fixture. That leaves out two real sources
of spread in how a season ends:

1. **We do not know today's strengths exactly.** The fit's own curvature says
   how well the data pin each rating down (``parameter_covariance`` in the model).
   So each simulated season draws its own set of ratings from that uncertainty.
   A promoted team with five matches gets a much wider range than a side with
   two recent seasons of evidence, with no extra tuning.

2. **Strengths change during the season** (injuries, transfers, managers). Each
   team's attack and defence follow a random walk through the real fixture
   dates, so a simulated side can improve or fade mid-season. Nobody knows in
   advance *which* teams will: the walk is symmetric, so it widens outcomes
   without changing any team's expected strength.

The drift step size is not a free parameter. Exponential time decay, which the
fit already uses, is exactly what the optimal tracker of a random-walk strength
(a steady-state Kalman filter) does: it discounts each older match by a fixed
factor. So the half-life implies how fast strength must be drifting relative to
the noise in a single match. :func:`implied_drift_variance_per_day` inverts that
relationship.

Scorelines are then drawn match by match from the Dixon-Coles distribution with
each simulation's own expected goals, using exact rejection sampling
(:func:`sample_dixon_coles`).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping, Sequence

import numpy as np

from ..model.dixon_coles import RHO_BOUNDS, FittedDixonColes, tau


@dataclass(frozen=True)
class StrengthUncertainty:
    """Which sources of strength uncertainty to simulate.

    Args:
        parameter_uncertainty: draw each season's ratings from the fit's
            uncertainty (Laplace approximation) instead of using the best
            estimate every time.
        drift_variance_per_day: variance added to each attack and defence
            rating per day of the remaining season (a random walk). 0 turns
            drift off.
    """

    parameter_uncertainty: bool = True
    drift_variance_per_day: float = 0.0

    @property
    def active(self) -> bool:
        return self.parameter_uncertainty or self.drift_variance_per_day > 0

    @classmethod
    def from_config(cls, settings: Mapping | None, model: FittedDixonColes) -> "StrengthUncertainty":
        """Build from a config's ``simulation.strength_uncertainty`` block.

        ``drift: implied`` derives the drift rate from the model's half-life;
        a number is taken as the drift variance per day; ``none`` disables it.
        """
        settings = dict(settings or {})
        drift = settings.get("drift", "implied")
        if drift in (None, "none", 0, False):
            variance = 0.0
        elif drift == "implied":
            variance = implied_drift_variance_per_day(
                model.half_life_days, goals_per_team_match=float(np.exp(model.intercept + model.home_advantage / 2))
            )
        else:
            variance = float(drift)
        return cls(
            parameter_uncertainty=bool(settings.get("parameter_uncertainty", True)),
            drift_variance_per_day=variance,
        )


FIXED = StrengthUncertainty(parameter_uncertainty=False, drift_variance_per_day=0.0)


def implied_drift_variance_per_day(
    half_life_days: float | None,
    *,
    goals_per_team_match: float = 1.4,
    days_between_matches: float = 7.0,
) -> float:
    """Random-walk variance per day that a given decay half-life implies.

    The reasoning, in four steps:

    1. Model a rating as a random walk observed through noisy matches. The best
       running estimate (a Kalman filter) settles into an exponentially
       weighted average: each new match gets weight ``K`` (the Kalman gain),
       and everything older is discounted by ``1 - K``.
    2. Our fit discounts a match by ``0.5 ** (days / half_life)``, so with a
       match every ``days_between_matches`` days, ``1 - K = 0.5 ** (7 / half_life)``.
    3. For that filter, the ratio of drift variance per match to the noise
       variance of one match is ``Q = K**2 / (1 - K)``.
    4. One match tells us about a team's attacking (log-scale) rating with
       noise variance about ``1 / expected_goals``, the Poisson information.

    So drift per day = ``Q * (1 / goals_per_team_match) / days_between_matches``.
    With a 180-day half-life and 1.4 goals a game that is about 7e-5 per day:
    over a 280-day season a rating wanders with a standard deviation of about
    0.14, i.e. roughly ±15% in goals scored or conceded.

    It is an approximation (matches are not exactly weekly; attack and defence
    are estimated jointly), but it ties the drift to a number the backtests
    already chose, instead of adding a new knob to tune.
    """
    if half_life_days is None:
        return 0.0
    discount = 0.5 ** (days_between_matches / half_life_days)
    gain = 1.0 - discount
    signal_to_noise = gain**2 / discount
    noise_variance = 1.0 / goals_per_team_match
    return signal_to_noise * noise_variance / days_between_matches


def draw_parameters(model: FittedDixonColes, n_draws: int, rng: np.random.Generator) -> np.ndarray:
    """``n_draws`` parameter vectors from the fit's Gaussian (Laplace) approximation.

    Draws are joint, so correlations are respected: the near-flat direction
    (every attack up, the intercept down) moves together and cancels out of
    every prediction, as it should.
    """
    if model.covariance is None:
        raise ValueError("the model was fitted without compute_covariance=True")
    mean = model.parameter_vector()
    draws = rng.multivariate_normal(mean, model.covariance, size=n_draws, method="eigh")
    return draws


def sample_dixon_coles(lam, mu, rho, rng: np.random.Generator) -> tuple[np.ndarray, np.ndarray]:
    """Exact draws from the Dixon-Coles score distribution, one per element.

    ``lam``, ``mu`` and ``rho`` are arrays (one entry per simulation), so every
    simulated season can have its own expected goals.

    Rejection sampling: propose (x, y) from two independent Poissons, and
    accept with probability ``tau(x, y) / M``, where ``M`` bounds tau. The
    accepted draws follow ``tau * Poisson * Poisson``, which is exactly the
    Dixon-Coles distribution (its four adjustments cancel, so it needs no
    normalising). With realistic rho most proposals are accepted first time.
    """
    lam = np.asarray(lam, dtype=float)
    mu = np.asarray(mu, dtype=float)
    rho = np.broadcast_to(np.asarray(rho, dtype=float), lam.shape)
    bound = np.maximum.reduce([np.ones_like(lam), 1 - lam * mu * rho, 1 + lam * rho, 1 + mu * rho, 1 - rho])

    home = np.empty(lam.shape, dtype=np.int16)
    away = np.empty(lam.shape, dtype=np.int16)
    pending = np.arange(lam.size)
    while pending.size:
        x = rng.poisson(lam[pending])
        y = rng.poisson(mu[pending])
        weight = np.clip(tau(x, y, lam[pending], mu[pending], rho[pending]), 0.0, None)
        accepted = rng.random(pending.size) * bound[pending] < weight
        home[pending[accepted]] = x[accepted]
        away[pending[accepted]] = y[accepted]
        pending = pending[~accepted]
    return home, away


def simulate_fixtures(
    model: FittedDixonColes,
    uncertainty: StrengthUncertainty,
    home_teams: Sequence[str],
    away_teams: Sequence[str],
    days_ahead: np.ndarray,
    neutral: np.ndarray,
    n_simulations: int,
    rng: np.random.Generator,
) -> tuple[np.ndarray, np.ndarray]:
    """Scorelines for every fixture in every run, with uncertain, drifting strengths.

    Returns (home goals, away goals), each shaped (fixtures, runs).

    Fixtures are processed in date order. Each run carries its own attack and
    defence vector: drawn once from the fit's uncertainty, then nudged by a
    random-walk step every time the calendar moves on.
    """
    n_teams = len(model.teams)
    if uncertainty.parameter_uncertainty:
        draws = draw_parameters(model, n_simulations, rng)
    else:
        draws = np.tile(model.parameter_vector(), (n_simulations, 1))
    attack = draws[:, :n_teams].copy()
    defence = draws[:, n_teams : 2 * n_teams].copy()
    intercept = draws[:, 2 * n_teams]
    home_advantage = draws[:, 2 * n_teams + 1]
    # A drawn rho outside its fitting bounds would not be a valid model.
    rho = np.clip(draws[:, 2 * n_teams + 2], *RHO_BOUNDS)
    # League fixtures are all in the base division, so no division offset applies.

    # A fixture with no date yet (kick-off to be confirmed) is treated as the
    # last of the season: the most drift, the conservative choice.
    days_ahead = np.asarray(days_ahead, dtype=float)
    if np.isnan(days_ahead).any():
        latest = np.nanmax(days_ahead) if np.isfinite(days_ahead).any() else 0.0
        days_ahead = np.where(np.isnan(days_ahead), latest, days_ahead)
    days_ahead = np.maximum(days_ahead, 0.0)

    home_index = np.array([model.team_index(team) for team in home_teams])
    away_index = np.array([model.team_index(team) for team in away_teams])
    order = np.argsort(days_ahead, kind="stable")

    home_goals = np.empty((len(order), n_simulations), dtype=np.int16)
    away_goals = np.empty((len(order), n_simulations), dtype=np.int16)
    drift_sd_per_day = np.sqrt(uncertainty.drift_variance_per_day)
    clock = 0.0
    for k in order:
        step = float(days_ahead[k]) - clock
        if drift_sd_per_day > 0 and step > 0:
            scale = drift_sd_per_day * np.sqrt(step)
            attack += rng.normal(0.0, scale, attack.shape)
            defence += rng.normal(0.0, scale, defence.shape)
            clock = float(days_ahead[k])
        h, a = home_index[k], away_index[k]
        home_term = 0.0 if neutral[k] else home_advantage
        lam = np.exp(intercept + home_term + attack[:, h] - defence[:, a])
        mu = np.exp(intercept + attack[:, a] - defence[:, h])
        home_goals[k], away_goals[k] = sample_dixon_coles(lam, mu, rho, rng)
    return home_goals, away_goals

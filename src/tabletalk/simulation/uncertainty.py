"""Strength uncertainty: simulated seasons where team strengths are not frozen.

The plain simulator uses one set of ratings, today's best estimates, for every
simulated season and every remaining fixture. That leaves out a real source of
spread in how a season ends: **we do not know today's strengths exactly.** The
fit's own curvature says how well the data pin each rating down
(``parameter_covariance`` in the model). So each simulated season draws its own
set of ratings from that uncertainty. A promoted team with five matches gets a
much wider range than a side with two recent seasons of evidence, with no extra
tuning.

A second option, a random walk in every rating through the season ("drift"),
was built and backtested in September 2026. It added nothing (docs/results.md),
so it was removed in October 2026.

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
    """

    parameter_uncertainty: bool = True

    @property
    def active(self) -> bool:
        return self.parameter_uncertainty

    @classmethod
    def from_config(cls, settings: Mapping | None, model: FittedDixonColes) -> "StrengthUncertainty":
        """Build from a config's ``simulation.strength_uncertainty`` block."""
        settings = dict(settings or {})
        if "drift" in settings:
            raise ValueError("simulation.strength_uncertainty.drift was removed in October 2026; delete the key")
        return cls(parameter_uncertainty=bool(settings.get("parameter_uncertainty", True)))


FIXED = StrengthUncertainty(parameter_uncertainty=False)


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
    """Scorelines for every fixture in every run, with uncertain strengths.

    Returns (home goals, away goals), each shaped (fixtures, runs).

    Each run carries its own attack and defence vector, drawn once from the
    fit's uncertainty. Fixtures are sampled in date order, the order the random
    numbers are drawn in, so a given seed gives the same seasons as before
    drift was removed.
    """
    n_teams = len(model.teams)
    if uncertainty.parameter_uncertainty:
        draws = draw_parameters(model, n_simulations, rng)
    else:
        draws = np.tile(model.parameter_vector(), (n_simulations, 1))
    attack = draws[:, :n_teams]
    defence = draws[:, n_teams : 2 * n_teams]
    intercept = draws[:, 2 * n_teams]
    home_advantage = draws[:, 2 * n_teams + 1]
    # A drawn rho outside its fitting bounds would not be a valid model.
    rho = np.clip(draws[:, 2 * n_teams + 2], *RHO_BOUNDS)
    # League fixtures are all in the base division, so no division offset applies.

    # A fixture with no date yet (kick-off to be confirmed) is sampled last.
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
    for k in order:
        h, a = home_index[k], away_index[k]
        home_term = 0.0 if neutral[k] else home_advantage
        lam = np.exp(intercept + home_term + attack[:, h] - defence[:, a])
        mu = np.exp(intercept + attack[:, a] - defence[:, h])
        home_goals[k], away_goals[k] = sample_dixon_coles(lam, mu, rho, rng)
    return home_goals, away_goals

"""The Dixon-Coles match model, written out from first principles.

Given two teams and a venue, the model produces a probability for every
scoreline. It knows nothing about tables, points or brackets - the simulators
turn scorelines into those.

The model in five lines
-----------------------
For a match between home team ``h`` and away team ``a``::

    log(lambda) = intercept + home_advantage + attack[h] - defence[a]   # home team's expected goals
    log(mu)     = intercept                  + attack[a] - defence[h]   # away team's expected goals

    P(home scores x, away scores y) = tau(x, y) * Poisson(x; lambda) * Poisson(y; mu)

* ``attack[t]`` > 0 means team ``t`` scores more than an average team; each
  +0.1 is roughly +10% goals (``exp(0.1) = 1.105``).
* ``defence[t]`` > 0 means ``t`` concedes *less* than average (it is subtracted).
* ``home_advantage`` multiplies the home side's expected goals by
  ``exp(home_advantage)``. It is dropped for neutral-venue matches.
* ``intercept`` sets the overall goal rate: ``exp(intercept)`` is what an
  average team scores away to an average team.

The Dixon-Coles correction, ``tau``
-----------------------------------
Two independent Poissons get low scores wrong: real football has more 0-0 and
1-1 draws, and fewer 1-0 and 0-1 results, than independence predicts. Dixon and
Coles (1997) reweight exactly those four cells with one parameter, ``rho``::

    tau(0, 0) = 1 - lambda * mu * rho
    tau(0, 1) = 1 + lambda * rho
    tau(1, 0) = 1 + mu * rho
    tau(1, 1) = 1 - rho
    tau(x, y) = 1                       for every other score

A negative ``rho`` (the usual fitted value, around -0.05 to -0.15) makes 0-0 and
1-1 more likely and 1-0 and 0-1 less likely. The four adjustments cancel
exactly, so the probabilities still sum to one.

Fitting
-------
Parameters are chosen to maximise the *weighted* log-likelihood of past results:

* **Time decay.** A match played ``t`` days before the fit date gets weight
  ``0.5 ** (t / half_life)``: recent form counts for more, and a team's rating
  can drift over a season. This is Dixon and Coles' ``exp(-xi * t)`` with
  ``xi = ln 2 / half_life``, expressed as a half-life because it is easier to
  reason about.
* **A Gaussian prior on each team's attack and defence** (i.e. ridge
  regularisation). With the default wide prior it is worth less than a single
  match of data; it exists to make the fit well-posed, and it also pins down the
  otherwise arbitrary level of the ratings (adding a constant to every attack
  and subtracting it from the intercept would leave the likelihood unchanged).
  It is also the hook for promoted teams: a team with little or no data can be
  given an informative prior (see ``tabletalk.model.promoted``).
* **Division offsets.** When matches from another competition are included (the
  Championship, to rate promoted teams), each extra competition gets its own
  intercept offset, because a division's overall goal rate differs from the
  Premier League's and should not leak into team ratings.

The objective is minimised with L-BFGS-B using the analytic gradient, derived in
``_negative_log_posterior``. The gradient is checked against finite differences
in the tests; it makes each fit fast enough to refit weekly in a backtest.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Mapping, Sequence

import numpy as np
import pandas as pd
from scipy.optimize import minimize
from scipy.special import gammaln
from scipy.stats import poisson

#: Probabilities are floored here before taking logs, so a pathological
#: parameter value during optimisation cannot produce log(0).
_TINY = 1e-10


# ---------------------------------------------------------------------------
# Pure functions: the math, testable on its own
# ---------------------------------------------------------------------------


def decay_weights(age_days: np.ndarray, half_life_days: float | None) -> np.ndarray:
    """Weight of a match played ``age_days`` ago. ``None`` means no decay."""
    age = np.asarray(age_days, dtype=float)
    if half_life_days is None:
        return np.ones_like(age)
    if half_life_days <= 0:
        raise ValueError("half_life_days must be positive (or None for no decay)")
    return 0.5 ** (age / half_life_days)


def tau(home_goals, away_goals, lam, mu, rho):
    """Dixon-Coles low-score adjustment factor, vectorised over matches."""
    x = np.asarray(home_goals)
    y = np.asarray(away_goals)
    lam = np.asarray(lam, dtype=float)
    mu = np.asarray(mu, dtype=float)
    out = np.ones(np.broadcast(x, y, lam, mu).shape, dtype=float)
    out = np.where((x == 0) & (y == 0), 1.0 - lam * mu * rho, out)
    out = np.where((x == 0) & (y == 1), 1.0 + lam * rho, out)
    out = np.where((x == 1) & (y == 0), 1.0 + mu * rho, out)
    out = np.where((x == 1) & (y == 1), 1.0 - rho, out)
    return out


def score_matrix(lam: float, mu: float, rho: float, max_goals: int = 10) -> np.ndarray:
    """Probability of every scoreline up to ``max_goals`` each.

    ``matrix[x, y]`` is P(home scores x, away scores y). Truncating at
    ``max_goals`` drops a negligible sliver of probability (less than 1e-6 at
    realistic scoring rates); the matrix is renormalised to sum to one so
    downstream code never sees a total of 0.99999.
    """
    goals = np.arange(max_goals + 1)
    matrix = np.outer(poisson.pmf(goals, lam), poisson.pmf(goals, mu))
    matrix[0, 0] *= 1.0 - lam * mu * rho
    matrix[0, 1] *= 1.0 + lam * rho
    matrix[1, 0] *= 1.0 + mu * rho
    matrix[1, 1] *= 1.0 - rho
    matrix = np.clip(matrix, 0.0, None)
    return matrix / matrix.sum()


def outcome_probabilities(matrix: np.ndarray) -> tuple[float, float, float]:
    """(home win, draw, away win) from a score matrix."""
    home = float(np.tril(matrix, k=-1).sum())  # x > y: below the diagonal
    draw = float(np.trace(matrix))
    away = float(np.triu(matrix, k=1).sum())
    return home, draw, away


# ---------------------------------------------------------------------------
# Fitting
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class TeamPrior:
    """Gaussian prior on one team's attack and defence (log scale).

    ``sd`` of None means "use the model's default"; a small sd means "I am
    fairly sure where this team should be before seeing its results".
    """

    attack: float = 0.0
    defence: float = 0.0
    sd: float | None = None


@dataclass
class _FitData:
    """Matches converted to integer-indexed numpy arrays, built once per fit."""

    home: np.ndarray        # team index of the home side
    away: np.ndarray        # team index of the away side
    home_goals: np.ndarray
    away_goals: np.ndarray
    home_flag: np.ndarray   # 1.0 normally, 0.0 at a neutral venue
    division: np.ndarray    # 0 = base competition, 1.. = other divisions
    weights: np.ndarray     # time-decay weights
    n_teams: int
    n_offsets: int          # number of non-base divisions
    prior_attack: np.ndarray
    prior_defence: np.ndarray
    prior_sd: np.ndarray


def _negative_log_posterior(theta: np.ndarray, d: _FitData) -> tuple[float, np.ndarray]:
    """Objective and its gradient.

    Parameter vector layout::

        theta = [attack (n) | defence (n) | intercept | home_advantage | rho | offsets (k)]

    Derivation sketch, for one match with log-rates ``a = log lambda`` and
    ``b = log mu``, and log-likelihood

        l = x*a - e^a - log(x!)  +  y*b - e^b - log(y!)  +  log tau

        dl/da   = x - lambda + lambda * (dtau/dlambda) / tau
        dl/db   = y - mu     + mu     * (dtau/dmu)     / tau
        dl/drho = (dtau/drho) / tau

    and every team parameter enters ``a`` or ``b`` linearly with coefficient
    +1 or -1, so its gradient is a signed sum of dl/da and dl/db over the
    matches it appears in (accumulated with ``np.bincount``).
    """
    n = d.n_teams
    attack = theta[:n]
    defence = theta[n : 2 * n]
    intercept, home_adv, rho = theta[2 * n], theta[2 * n + 1], theta[2 * n + 2]
    offsets = np.concatenate(([0.0], theta[2 * n + 3 :]))

    base = intercept + offsets[d.division]
    log_lam = base + home_adv * d.home_flag + attack[d.home] - defence[d.away]
    log_mu = base + attack[d.away] - defence[d.home]
    lam = np.exp(log_lam)
    mu = np.exp(log_mu)
    x, y = d.home_goals, d.away_goals

    # --- Poisson part -----------------------------------------------------
    loglik = x * log_lam - lam - gammaln(x + 1) + y * log_mu - mu - gammaln(y + 1)
    dl_dloglam = x - lam
    dl_dlogmu = y - mu

    # --- tau part: only the 0-0, 0-1, 1-0 and 1-1 matches are affected ------
    tau_val = np.ones_like(lam)
    dtau_dlam = np.zeros_like(lam)
    dtau_dmu = np.zeros_like(lam)
    dtau_drho = np.zeros_like(lam)

    m00 = (x == 0) & (y == 0)
    tau_val[m00] = 1.0 - lam[m00] * mu[m00] * rho
    dtau_dlam[m00] = -mu[m00] * rho
    dtau_dmu[m00] = -lam[m00] * rho
    dtau_drho[m00] = -lam[m00] * mu[m00]

    m01 = (x == 0) & (y == 1)
    tau_val[m01] = 1.0 + lam[m01] * rho
    dtau_dlam[m01] = rho
    dtau_drho[m01] = lam[m01]

    m10 = (x == 1) & (y == 0)
    tau_val[m10] = 1.0 + mu[m10] * rho
    dtau_dmu[m10] = rho
    dtau_drho[m10] = mu[m10]

    m11 = (x == 1) & (y == 1)
    tau_val[m11] = 1.0 - rho
    dtau_drho[m11] = -1.0

    tau_val = np.maximum(tau_val, _TINY)
    loglik = loglik + np.log(tau_val)
    dl_dloglam = dl_dloglam + lam * dtau_dlam / tau_val
    dl_dlogmu = dl_dlogmu + mu * dtau_dmu / tau_val
    dl_drho = dtau_drho / tau_val

    # --- weighted negative log-likelihood and its gradient -------------------
    w = d.weights
    nll = -float(np.sum(w * loglik))
    g_lam = -w * dl_dloglam  # d(NLL)/d(log lambda), per match
    g_mu = -w * dl_dlogmu

    grad_attack = np.bincount(d.home, g_lam, n) + np.bincount(d.away, g_mu, n)
    grad_defence = -np.bincount(d.away, g_lam, n) - np.bincount(d.home, g_mu, n)
    grad_intercept = np.sum(g_lam + g_mu)
    grad_home = np.sum(g_lam * d.home_flag)
    grad_rho = -np.sum(w * dl_drho)
    grad_offsets = np.bincount(d.division, g_lam + g_mu, d.n_offsets + 1)[1:]

    # --- Gaussian prior on team ratings (ridge) ----------------------------
    z_att = (attack - d.prior_attack) / d.prior_sd
    z_def = (defence - d.prior_defence) / d.prior_sd
    nll += 0.5 * float(np.sum(z_att**2) + np.sum(z_def**2))
    grad_attack = grad_attack + z_att / d.prior_sd
    grad_defence = grad_defence + z_def / d.prior_sd

    grad = np.concatenate(
        (grad_attack, grad_defence, [grad_intercept, grad_home, grad_rho], grad_offsets)
    )
    return nll, grad


class DixonColesModel:
    """Configuration of a Dixon-Coles fit. Call :meth:`fit` to get parameters.

    Args:
        half_life_days: time-decay half-life; None disables decay.
        rating_prior_sd: default sd of the prior on each team's attack and
            defence. Large = weak. Individual teams can override it.
        max_goals: size of the scoreline grid used for predictions.
        rho_bounds: search range for rho. Keeps tau positive at realistic
            scoring rates; the fitted value should sit well inside it.
    """

    def __init__(
        self,
        half_life_days: float | None = 180.0,
        rating_prior_sd: float = 1.0,
        max_goals: int = 10,
        rho_bounds: tuple[float, float] = (-0.3, 0.3),
    ):
        if rating_prior_sd <= 0:
            raise ValueError("rating_prior_sd must be positive")
        self.half_life_days = half_life_days
        self.rating_prior_sd = float(rating_prior_sd)
        self.max_goals = int(max_goals)
        self.rho_bounds = rho_bounds

    @classmethod
    def from_config(cls, model_config: Mapping, **overrides) -> "DixonColesModel":
        """Build from a competition config's ``model:`` section."""
        settings = {
            "half_life_days": model_config.get("time_decay_half_life_days", 180.0),
            "rating_prior_sd": model_config.get("rating_prior_sd", 1.0),
            "max_goals": model_config.get("max_goals", 10),
        }
        settings.update({k: v for k, v in overrides.items() if v is not None})
        return cls(**settings)

    def fit(
        self,
        matches: pd.DataFrame,
        *,
        as_of: str | pd.Timestamp | None = None,
        teams: Sequence[str] | None = None,
        priors: Mapping[str, TeamPrior] | None = None,
        base_division: str | None = None,
    ) -> "FittedDixonColes":
        """Fit to played matches dated strictly before ``as_of``.

        Args:
            matches: standard match frame; only played rows before ``as_of`` are
                used, which is what keeps backtests free of look-ahead.
            as_of: the fit date. Decay ages are measured from here. Defaults to
                the day after the last match.
            teams: extra teams to include even with no matches in ``matches``
                (e.g. a promoted team before its first game). Their ratings
                then come entirely from their prior.
            priors: per-team priors; teams not listed get a prior centred on
                zero with ``rating_prior_sd``.
            base_division: the competition predictions are for. Other
                competitions in ``matches`` get their own goal-rate offset.
                Defaults to the most common competition in the data.
        """
        played = matches.loc[matches["played"].fillna(False).astype(bool)]
        if as_of is None:
            if played.empty:
                raise ValueError("no played matches to fit, and no as_of date given")
            as_of = played["date"].max() + pd.Timedelta(days=1)
        as_of = pd.Timestamp(as_of)
        train = played.loc[played["date"] < as_of]
        if train.empty:
            raise ValueError(f"no played matches before {as_of.date()}")

        # --- index teams and divisions -------------------------------------
        team_names = set(train["home_team"]) | set(train["away_team"]) | set(teams or ())
        team_list = sorted(str(t) for t in team_names)
        index = {team: i for i, team in enumerate(team_list)}
        n = len(team_list)

        competitions = train["competition"].astype(str)
        base = base_division or competitions.value_counts().idxmax()
        other_divisions = sorted(set(competitions) - {base})
        division_index = {base: 0, **{div: i + 1 for i, div in enumerate(other_divisions)}}

        # --- priors --------------------------------------------------------
        prior_attack = np.zeros(n)
        prior_defence = np.zeros(n)
        prior_sd = np.full(n, self.rating_prior_sd)
        for team, prior in (priors or {}).items():
            if team not in index:
                continue
            i = index[team]
            prior_attack[i] = prior.attack
            prior_defence[i] = prior.defence
            if prior.sd is not None:
                prior_sd[i] = prior.sd

        age_days = (as_of - train["date"]).dt.days.to_numpy(dtype=float)
        data = _FitData(
            home=train["home_team"].map(index).to_numpy(dtype=int),
            away=train["away_team"].map(index).to_numpy(dtype=int),
            home_goals=train["home_goals"].to_numpy(dtype=float),
            away_goals=train["away_goals"].to_numpy(dtype=float),
            home_flag=(~train["neutral"].fillna(False).astype(bool)).to_numpy(dtype=float),
            division=competitions.map(division_index).to_numpy(dtype=int),
            weights=decay_weights(age_days, self.half_life_days),
            n_teams=n,
            n_offsets=len(other_divisions),
            prior_attack=prior_attack,
            prior_defence=prior_defence,
            prior_sd=prior_sd,
        )

        # --- optimise --------------------------------------------------------
        mean_goals = float(np.average((data.home_goals + data.away_goals) / 2, weights=data.weights))
        theta0 = np.concatenate(
            (
                prior_attack,
                prior_defence,
                [np.log(max(mean_goals, 0.1)), 0.2, 0.0],
                np.zeros(len(other_divisions)),
            )
        )
        bounds = [(None, None)] * (2 * n + 2) + [self.rho_bounds] + [(None, None)] * len(other_divisions)
        result = minimize(
            _negative_log_posterior,
            theta0,
            args=(data,),
            jac=True,
            method="L-BFGS-B",
            bounds=bounds,
            # Tight tolerances: the ratings have one near-flat direction (shift
            # every attack up and the intercept down; only the prior resists
            # it), and loose tolerances stop partway along it. Predictions are
            # unaffected either way, but the displayed ratings are only centred
            # on zero at the true optimum.
            options={"maxiter": 10_000, "maxfun": 20_000, "ftol": 1e-12, "gtol": 1e-8},
        )

        theta = result.x
        rho = float(theta[2 * n + 2])
        if min(abs(rho - self.rho_bounds[0]), abs(rho - self.rho_bounds[1])) < 1e-6:
            # Hitting the bound means the constraint, not the data, chose rho.
            import warnings

            warnings.warn(f"rho={rho:.3f} is at its search bound {self.rho_bounds}", stacklevel=2)

        return FittedDixonColes(
            teams=tuple(team_list),
            attack=theta[:n].copy(),
            defence=theta[n : 2 * n].copy(),
            intercept=float(theta[2 * n]),
            home_advantage=float(theta[2 * n + 1]),
            rho=rho,
            division_offsets={div: float(theta[2 * n + 3 + i]) for i, div in enumerate(other_divisions)},
            base_division=str(base),
            as_of=as_of,
            half_life_days=self.half_life_days,
            max_goals=self.max_goals,
            n_matches=len(train),
            effective_matches=float(data.weights.sum()),
            objective=float(result.fun),
            converged=bool(result.success),
            optimiser_message=str(result.message),
            prior_attack=dict(zip(team_list, prior_attack)),
            prior_defence=dict(zip(team_list, prior_defence)),
            prior_sd=dict(zip(team_list, prior_sd)),
            matches_per_team=_matches_per_team(train, team_list),
        )


def _matches_per_team(train: pd.DataFrame, team_list: list[str]) -> dict[str, int]:
    counts = pd.concat([train["home_team"], train["away_team"]]).value_counts()
    return {team: int(counts.get(team, 0)) for team in team_list}


# ---------------------------------------------------------------------------
# Fitted model: predictions and inspection
# ---------------------------------------------------------------------------


@dataclass
class FittedDixonColes:
    """Fitted parameters plus everything needed to predict and to explain them."""

    teams: tuple[str, ...]
    attack: np.ndarray
    defence: np.ndarray
    intercept: float
    home_advantage: float
    rho: float
    division_offsets: dict[str, float]
    base_division: str
    as_of: pd.Timestamp
    half_life_days: float | None
    max_goals: int
    n_matches: int
    effective_matches: float
    objective: float
    converged: bool
    optimiser_message: str
    prior_attack: dict[str, float] = field(default_factory=dict)
    prior_defence: dict[str, float] = field(default_factory=dict)
    prior_sd: dict[str, float] = field(default_factory=dict)
    matches_per_team: dict[str, int] = field(default_factory=dict)

    def __post_init__(self) -> None:
        self._index = {team: i for i, team in enumerate(self.teams)}

    # -- core predictions ---------------------------------------------------
    def _team(self, team: str) -> int:
        try:
            return self._index[team]
        except KeyError:
            raise KeyError(
                f"{team!r} has no rating in this model (fitted {len(self.teams)} teams as of "
                f"{self.as_of.date()}). Pass it via `teams=` when fitting."
            ) from None

    def expected_goals(
        self, home: str, away: str, *, neutral: bool = False, division: str | None = None
    ) -> tuple[float, float]:
        """(lambda, mu): expected goals for the home and away side."""
        h, a = self._team(home), self._team(away)
        base = self.intercept + self.division_offsets.get(division or self.base_division, 0.0)
        home_term = 0.0 if neutral else self.home_advantage
        lam = np.exp(base + home_term + self.attack[h] - self.defence[a])
        mu = np.exp(base + self.attack[a] - self.defence[h])
        return float(lam), float(mu)

    def score_matrix(self, home: str, away: str, *, neutral: bool = False) -> np.ndarray:
        lam, mu = self.expected_goals(home, away, neutral=neutral)
        return score_matrix(lam, mu, self.rho, self.max_goals)

    def outcome_probabilities(
        self, home: str, away: str, *, neutral: bool = False
    ) -> tuple[float, float, float]:
        """(home win, draw, away win)."""
        return outcome_probabilities(self.score_matrix(home, away, neutral=neutral))

    def predict(self, fixtures: pd.DataFrame) -> pd.DataFrame:
        """Expected goals and 1X2 probabilities for each row of a match frame."""
        rows = []
        for fixture in fixtures.itertuples(index=False):
            neutral = bool(getattr(fixture, "neutral", False))
            lam, mu = self.expected_goals(fixture.home_team, fixture.away_team, neutral=neutral)
            p_home, p_draw, p_away = outcome_probabilities(
                score_matrix(lam, mu, self.rho, self.max_goals)
            )
            rows.append(
                {
                    "expected_home_goals": lam,
                    "expected_away_goals": mu,
                    "p_home": p_home,
                    "p_draw": p_draw,
                    "p_away": p_away,
                }
            )
        predictions = pd.DataFrame(rows, index=fixtures.index)
        return pd.concat([fixtures, predictions], axis=1)

    # -- inspection ---------------------------------------------------------
    def ratings(self, teams: Sequence[str] | None = None) -> pd.DataFrame:
        """One row per team, best first by net rating (attack + defence).

        ``attack_x`` / ``concede_x`` translate the log-scale numbers into
        "goals scored / conceded relative to an average team", which is how the
        ratings should be read out loud.
        """
        selected = list(teams) if teams is not None else list(self.teams)
        rows = []
        for team in selected:
            i = self._team(team)
            rows.append(
                {
                    "team": team,
                    "attack": self.attack[i],
                    "defence": self.defence[i],
                    "net": self.attack[i] + self.defence[i],
                    "attack_x": np.exp(self.attack[i]),
                    "concede_x": np.exp(-self.defence[i]),
                    "matches": self.matches_per_team.get(team, 0),
                    "prior_attack": self.prior_attack.get(team, 0.0),
                    "prior_defence": self.prior_defence.get(team, 0.0),
                    "prior_sd": self.prior_sd.get(team, np.nan),
                }
            )
        table = pd.DataFrame(rows).sort_values("net", ascending=False)
        return table.reset_index(drop=True)

    def summary(self) -> str:
        offsets = ", ".join(f"{d} {v:+.3f}" for d, v in self.division_offsets.items()) or "none"
        decay = f"{self.half_life_days:g}-day half-life" if self.half_life_days else "no decay"
        return (
            f"Dixon-Coles fit as of {self.as_of.date()} ({decay}): {self.n_matches} matches "
            f"({self.effective_matches:.0f} effective), {len(self.teams)} teams\n"
            f"  average team scores away : {np.exp(self.intercept):.3f} goals\n"
            f"  home advantage           : {self.home_advantage:+.3f} "
            f"(x{np.exp(self.home_advantage):.3f} goals at home)\n"
            f"  rho (low-score coupling) : {self.rho:+.4f}\n"
            f"  division offsets         : {offsets}\n"
            f"  converged                : {self.converged} ({self.optimiser_message})"
        )

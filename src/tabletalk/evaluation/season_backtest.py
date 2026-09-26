"""Season-level backtest: were the title, top-four and relegation odds any good?

The match-level backtest asks whether single-match forecasts are good. This one
asks the question the project exists for: were the *season* forecasts good?

Method
------
For each completed season, and each checkpoint in it (pre-season, then after
25%, 50% and 75% of the matches):

1. Forget every result from the checkpoint on.
2. Fit the model on what was known then, and simulate the rest of the season.
3. Compare every team's zone probabilities (title, top four, relegation, ...)
   and finishing-position distribution with the real final table.

Two baselines, because "better than nothing" is too low a bar here:

* **uniform** - knows nothing: every team has a 1-in-20 title chance, 4-in-20
  for the top four, and so on.
* **persistence** - "the table as it stands will be the final table". Before a
  ball is kicked, that is last season's final table (promoted teams at the
  bottom). This is the naive pundit, and a much harder baseline late in a
  season, when the table already says a lot.

Scores
------
* Zone forecasts: **Brier score** (for every method) and **log loss** (for the
  model and uniform; persistence gives certainties, so one miss makes its log
  loss infinite).
* Finishing position: the **ranked probability score** over positions 1-20,
  which rewards putting probability *near* the right place, not just on it;
  and the error in expected position.

Simulated probabilities of exactly 0 or 1 only mean "in none / all of N runs",
so they are clipped to 1/(2N) and 1 - 1/(2N) before taking logs.

Caveat: a dozen seasons is still a small sample for rare events. There are 12
champions to predict; the title numbers carry wide uncertainty.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Iterable, Sequence

import numpy as np
import pandas as pd

from ..config import CompetitionConfig
from ..model.promoted import estimate_promoted_prior, previous_season
from ..simulation import league_table, simulate_league

logger = logging.getLogger(__name__)

#: (label, fraction of the season's matches already played)
DEFAULT_CHECKPOINTS: tuple[tuple[str, float], ...] = (
    ("pre-season", 0.0),
    ("25% played", 0.25),
    ("50% played", 0.50),
    ("75% played", 0.75),
)


@dataclass
class SeasonBacktest:
    """Per-team forecasts at every checkpoint, next to what happened."""

    zones: pd.DataFrame      # one row per (season, checkpoint, team, zone)
    positions: pd.DataFrame  # one row per (season, checkpoint, team)
    n_simulations: int

    def zone_summary(self) -> pd.DataFrame:
        return summarise_zones(self.zones, self.n_simulations)

    def position_summary(self) -> pd.DataFrame:
        return summarise_positions(self.positions)


def checkpoint_dates(season_rows: pd.DataFrame, checkpoints: Sequence[tuple[str, float]]) -> list[tuple[str, pd.Timestamp]]:
    """The date at which each checkpoint's share of matches had been played.

    A checkpoint is placed on the date of the k-th match, so everything strictly
    before that date is known and everything from it on is simulated.
    """
    dates = season_rows.loc[season_rows["played"].fillna(False).astype(bool), "date"].sort_values().to_list()
    out = []
    for label, fraction in checkpoints:
        k = min(int(round(fraction * len(dates))), len(dates) - 1)
        out.append((label, pd.Timestamp(dates[k]).normalize()))
    return out


def persistence_order(matches: pd.DataFrame, config: CompetitionConfig, season: str, as_of: pd.Timestamp) -> list[str]:
    """The naive forecast: the table as it stands (or last season's, pre-season)."""
    own = matches.loc[matches["competition"].astype(str) == config.id]
    rows = own.loc[own["season"].astype(str) == season]
    teams = sorted(set(rows["home_team"]) | set(rows["away_team"]))
    before = rows.loc[rows["date"] < as_of]
    if before["played"].fillna(False).astype(bool).any():
        return league_table(before, config, season, teams=teams)["team"].tolist()
    # Pre-season: last season's finishing order, promoted teams at the bottom.
    last = league_table(own, config, previous_season(season))["team"].tolist()
    stayed = [team for team in last if team in teams]
    promoted = sorted(team for team in teams if team not in stayed)
    return stayed + promoted


def ranked_probability_score_positions(position_probabilities: np.ndarray, actual: np.ndarray) -> np.ndarray:
    """RPS of each row's distribution over positions 1..K against the actual position.

    Compares cumulative distributions, so 60% on 2nd when the team finished 1st
    scores far better than 60% on 15th.
    """
    probs = np.asarray(position_probabilities, dtype=float)
    k = probs.shape[1]
    forecast_cdf = np.cumsum(probs, axis=1)[:, :-1]
    observed_cdf = (np.arange(1, k)[None, :] >= np.asarray(actual)[:, None]).astype(float)
    return np.sum((forecast_cdf - observed_cdf) ** 2, axis=1) / (k - 1)


def season_backtest(
    config: CompetitionConfig,
    matches: pd.DataFrame,
    context: pd.DataFrame | None,
    seasons: Iterable[str],
    *,
    checkpoints: Sequence[tuple[str, float]] = DEFAULT_CHECKPOINTS,
    n_simulations: int = 5_000,
    seed: int = 20260926,
    strategy: str | None = None,
    fixed_strengths: bool = False,
    strength_uncertainty: dict | None = None,
) -> SeasonBacktest:
    own = matches.loc[matches["competition"].astype(str) == config.id]
    zone_rows: list[dict] = []
    position_frames: list[pd.DataFrame] = []

    for season_number, season in enumerate(seasons):
        season_rows = own.loc[own["season"].astype(str) == season]
        final = league_table(own, config, season)
        actual_position = dict(zip(final["team"], final["position"]))
        n_teams = len(final)
        prior = estimate_promoted_prior(
            own, config.id, season, rating_prior_sd=float(config.model.get("rating_prior_sd", 1.0))
        )

        for checkpoint_number, (label, as_of) in enumerate(checkpoint_dates(season_rows, checkpoints)):
            logger.info("%s %s: replaying from %s (%s)", config.id, season, as_of.date(), label)
            result = simulate_league(
                config,
                matches,
                context,
                season=season,
                as_of=as_of,
                n_simulations=n_simulations,
                seed=seed + 100 * season_number + checkpoint_number,
                strategy=strategy,
                prior=prior,
                fixed_strengths=fixed_strengths,
                strength_uncertainty=strength_uncertainty,
            )
            teams = list(result.teams)
            zone_probs = result.zone_probabilities()
            position_probs = result.position_probabilities().loc[teams].to_numpy()
            actual = np.array([actual_position[team] for team in teams])
            naive = persistence_order(matches, config, season, as_of)
            naive_position = np.array([naive.index(team) + 1 for team in teams])

            uniform = np.full_like(position_probs, 1.0 / n_teams)
            naive_probs = np.eye(n_teams)[naive_position - 1]
            position_frames.append(
                pd.DataFrame(
                    {
                        "season": season,
                        "checkpoint": label,
                        "as_of": as_of,
                        "team": teams,
                        "actual_position": actual,
                        "expected_position": result.positions.mean(axis=0),
                        "persistence_position": naive_position,
                        "rps_model": ranked_probability_score_positions(position_probs, actual),
                        "rps_uniform": ranked_probability_score_positions(uniform, actual),
                        "rps_persistence": ranked_probability_score_positions(naive_probs, actual),
                    }
                )
            )
            for zone in config.zones:
                in_zone = np.isin(actual, zone.positions)
                persistence_in_zone = np.isin(naive_position, zone.positions)
                for i, team in enumerate(teams):
                    zone_rows.append(
                        {
                            "season": season,
                            "checkpoint": label,
                            "team": team,
                            "zone": zone.id,
                            "p_model": float(zone_probs.loc[team, zone.id]),
                            "p_uniform": len(zone.positions) / n_teams,
                            "p_persistence": float(persistence_in_zone[i]),
                            "outcome": bool(in_zone[i]),
                        }
                    )

    return SeasonBacktest(
        zones=pd.DataFrame(zone_rows),
        positions=pd.concat(position_frames, ignore_index=True),
        n_simulations=n_simulations,
    )


def summarise_zones(zones: pd.DataFrame, n_simulations: int) -> pd.DataFrame:
    """Brier score and log loss per checkpoint and zone, for each method.

    ``skill_vs_*`` is the percentage reduction in Brier score; positive means
    the model beat that baseline.
    """
    floor = 1.0 / (2 * n_simulations)
    rows = []
    for (checkpoint, zone), group in zones.groupby(["checkpoint", "zone"], sort=False):
        y = group["outcome"].to_numpy(dtype=float)
        p_model = group["p_model"].to_numpy()
        p_model_clipped = np.clip(p_model, floor, 1 - floor)
        p_uniform = group["p_uniform"].to_numpy()
        brier = {name: float(np.mean((group[f"p_{name}"].to_numpy() - y) ** 2)) for name in ("model", "uniform", "persistence")}
        rows.append(
            {
                "checkpoint": checkpoint,
                "zone": zone,
                "n": len(group),
                "brier_model": brier["model"],
                "brier_uniform": brier["uniform"],
                "brier_persistence": brier["persistence"],
                "skill_vs_uniform_pct": 100 * (1 - brier["model"] / brier["uniform"]),
                "skill_vs_persistence_pct": 100 * (1 - brier["model"] / brier["persistence"]) if brier["persistence"] > 0 else np.nan,
                "log_loss_model": float(-np.mean(y * np.log(p_model_clipped) + (1 - y) * np.log(1 - p_model_clipped))),
                "log_loss_uniform": float(-np.mean(y * np.log(p_uniform) + (1 - y) * np.log(1 - p_uniform))),
            }
        )
    return pd.DataFrame(rows)


def summarise_positions(positions: pd.DataFrame) -> pd.DataFrame:
    """Finishing-position accuracy per checkpoint, for each method."""
    rows = []
    for checkpoint, group in positions.groupby("checkpoint", sort=False):
        rows.append(
            {
                "checkpoint": checkpoint,
                "n": len(group),
                "rps_model": group["rps_model"].mean(),
                "rps_uniform": group["rps_uniform"].mean(),
                "rps_persistence": group["rps_persistence"].mean(),
                "position_error_model": (group["expected_position"] - group["actual_position"]).abs().mean(),
                "position_error_persistence": (group["persistence_position"] - group["actual_position"]).abs().mean(),
            }
        )
    return pd.DataFrame(rows)


def season_calibration_by_phase(zones: pd.DataFrame) -> dict[str, pd.DataFrame]:
    """Zone-forecast calibration split into the first two and last two checkpoints.

    Pooling every checkpoint hides the main pattern: forecasts made with most of
    the season still to play are over-confident, later ones are not.
    """
    from .calibration import calibration_table

    labels = list(dict.fromkeys(zones["checkpoint"]))
    early, late = labels[: len(labels) // 2], labels[len(labels) // 2 :]
    out = {}
    for name, members in ((f"early: {' & '.join(early)}", early), (f"later: {' & '.join(late)}", late)):
        subset = zones.loc[zones["checkpoint"].isin(members)]
        out[name] = calibration_table(subset["p_model"], subset["outcome"])
    return out


def favourite_record(zones: pd.DataFrame, zone: str = "title") -> pd.DataFrame:
    """How often the model's favourite for a single-place zone got it, per checkpoint.

    Descriptive only: it throws away the probabilities, which is exactly why
    the proper scores above are the real evaluation.
    """
    subset = zones.loc[zones["zone"] == zone]
    favourites = subset.loc[subset.groupby(["checkpoint", "season"], sort=False)["p_model"].idxmax()]
    return (
        favourites.groupby("checkpoint", sort=False)
        .agg(seasons=("season", "size"), favourite_won=("outcome", "sum"), mean_favourite_probability=("p_model", "mean"))
        .reset_index()
    )


__all__ = [
    "DEFAULT_CHECKPOINTS",
    "SeasonBacktest",
    "checkpoint_dates",
    "favourite_record",
    "persistence_order",
    "ranked_probability_score_positions",
    "season_backtest",
    "season_calibration_by_phase",
    "summarise_positions",
    "summarise_zones",
]

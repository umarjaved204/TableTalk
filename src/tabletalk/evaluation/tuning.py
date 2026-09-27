"""Choosing the match model's settings on the tuning seasons only.

A setting chosen by scoring it on the seasons you then report results on makes
those results look better than they will be on new seasons: the choice has
been fitted to that test data's noise. So each competition config splits its
completed seasons in time (``evaluation.split``): settings are chosen on the
earlier ``tune`` seasons, headline results come from the later ``report``
seasons, and nothing is chosen by looking at the report seasons.

This module runs the grid search for the two numbers that shape the fit:

- the time-decay **half-life** (how fast old matches are forgotten), and
- the **ridge prior sd** (how strongly ratings are pulled toward average).

The rule is the simplest possible: the lowest log loss on the tuning seasons
wins. Paired standard errors are reported next to it so a reader can see when
the winner is only a nose ahead.
"""

from __future__ import annotations

import dataclasses
import itertools
from typing import Sequence

import numpy as np
import pandas as pd

from ..config import CompetitionConfig
from .backtest import match_backtest, per_match_log_loss


def with_model_settings(config: CompetitionConfig, **settings) -> CompetitionConfig:
    """A copy of ``config`` with some ``model:`` keys replaced (e.g. for one grid point)."""
    return dataclasses.replace(config, model={**config.model, **settings})


def tune_match_model(
    config: CompetitionConfig,
    matches: pd.DataFrame,
    context: pd.DataFrame | None,
    seasons: Sequence[str],
    *,
    half_lives: Sequence[float],
    prior_sds: Sequence[float],
    strategy: str = "prior",
) -> pd.DataFrame:
    """Log loss of every (half-life, prior sd) pair on ``seasons``, best first.

    ``diff_vs_best`` is each setting's log loss minus the winner's, on the same
    matches, with a 95% interval (``ci95``) from the per-match differences.
    """
    losses: dict[tuple[float, float], pd.Series] = {}
    for half_life, prior_sd in itertools.product(half_lives, prior_sds):
        candidate = with_model_settings(
            config, time_decay_half_life_days=float(half_life), rating_prior_sd=float(prior_sd)
        )
        predictions = match_backtest(candidate, matches, context, seasons, strategies=(strategy,))
        losses[(float(half_life), float(prior_sd))] = per_match_log_loss(predictions.loc[predictions["model"] == strategy])

    best = min(losses, key=lambda key: losses[key].mean())
    rows = []
    for (half_life, prior_sd), loss in losses.items():
        diff = (loss - losses[best]).dropna()
        rows.append(
            {
                "half_life_days": half_life,
                "rating_prior_sd": prior_sd,
                "n": len(loss),
                "log_loss": loss.mean(),
                "diff_vs_best": diff.mean(),
                "ci95": 1.96 * diff.std(ddof=1) / np.sqrt(len(diff)) if (half_life, prior_sd) != best else 0.0,
            }
        )
    return pd.DataFrame(rows).sort_values("log_loss").reset_index(drop=True)


def cutoff_effect(
    config: CompetitionConfig,
    matches: pd.DataFrame,
    context: pd.DataFrame | None,
    seasons: Sequence[str],
    *,
    strategy: str = "prior",
) -> dict[str, float]:
    """How much the ``min_match_weight`` speed cutoff changes the forecasts.

    Runs the backtest with the config's cutoff and with none, and reports the
    largest change in any win/draw/loss probability and the change in log loss.
    """
    with_cutoff = match_backtest(config, matches, context, seasons, strategies=(strategy,))
    without = match_backtest(with_model_settings(config, min_match_weight=0.0), matches, context, seasons, strategies=(strategy,))
    columns = ["p_home", "p_draw", "p_away"]
    a = with_cutoff.loc[with_cutoff["model"] == strategy, columns].to_numpy()
    b = without.loc[without["model"] == strategy, columns].to_numpy()
    return {
        "cutoff": float(config.model.get("min_match_weight", 1e-3)),
        "n": len(a),
        "max_probability_change": float(np.abs(a - b).max()),
        "log_loss_with_cutoff": float(per_match_log_loss(with_cutoff.loc[with_cutoff["model"] == strategy]).mean()),
        "log_loss_without": float(per_match_log_loss(without.loc[without["model"] == strategy]).mean()),
    }


__all__ = ["cutoff_effect", "tune_match_model", "with_model_settings"]

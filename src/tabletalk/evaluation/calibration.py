"""Calibration: when the model says 60%, does it happen about 60% of the time?

A forecast can score well on average and still be systematically over- or
under-confident. The check is simple: group forecasts by the probability they
gave, then compare each group's average forecast with how often the event
actually happened. A well-calibrated model sits on the diagonal.

Each group also gets a 95% interval for its observed frequency (the Wilson
score interval, which behaves sensibly for small groups and for frequencies
near 0 or 1, unlike the textbook ``p ± 1.96 * sqrt(p(1-p)/n)``). A point whose
interval crosses the diagonal is consistent with good calibration.

Caveat for pooled season-level forecasts: the same team appears at several
checkpoints, and the zone outcomes within one season constrain each other
(exactly one champion). Those observations are not independent, so the
intervals are narrower than they should be; read them as a guide, not a test.
"""

from __future__ import annotations

from typing import Sequence

import numpy as np
import pandas as pd

#: Default bin edges. Finer near 0 and 1, where most season-level forecasts
#: live (most teams have a tiny title chance), so those regions are not lumped
#: into one bin.
DEFAULT_EDGES: tuple[float, ...] = (0.0, 0.02, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.98, 1.0)

#: Even tenths: right for match outcomes, which rarely go below 5% or above 90%.
DECILE_EDGES: tuple[float, ...] = tuple(np.round(np.linspace(0, 1, 11), 2))


def wilson_interval(successes, trials, z: float = 1.96) -> tuple[np.ndarray, np.ndarray]:
    """Wilson score interval for a binomial proportion, vectorised."""
    successes = np.asarray(successes, dtype=float)
    trials = np.asarray(trials, dtype=float)
    with np.errstate(invalid="ignore", divide="ignore"):
        p = successes / trials
        denominator = 1 + z**2 / trials
        centre = (p + z**2 / (2 * trials)) / denominator
        half_width = z * np.sqrt(p * (1 - p) / trials + z**2 / (4 * trials**2)) / denominator
    return np.clip(centre - half_width, 0, 1), np.clip(centre + half_width, 0, 1)


def calibration_table(
    probabilities: Sequence[float],
    outcomes: Sequence[int | bool],
    edges: Sequence[float] = DEFAULT_EDGES,
) -> pd.DataFrame:
    """Bin forecasts and compare the average forecast with the observed rate.

    Returns one row per non-empty bin: the bin, the number of forecasts in it,
    their mean forecast probability, the observed frequency, a 95% Wilson
    interval, and the gap (observed minus forecast; positive = the model was
    under-confident in that range).
    """
    p = np.asarray(probabilities, dtype=float)
    y = np.asarray(outcomes, dtype=float)
    if p.shape != y.shape:
        raise ValueError("probabilities and outcomes differ in length")
    edges = np.asarray(edges, dtype=float)
    # right-closed on the last bin so a probability of exactly 1 is counted
    index = np.clip(np.digitize(p, edges[1:-1], right=False), 0, len(edges) - 2)

    rows = []
    for b in range(len(edges) - 1):
        in_bin = index == b
        n = int(in_bin.sum())
        if n == 0:
            continue
        hits = float(y[in_bin].sum())
        low, high = wilson_interval(hits, n)
        mean_forecast = float(p[in_bin].mean())
        observed = hits / n
        rows.append(
            {
                "bin": f"{edges[b]:.0%}-{edges[b + 1]:.0%}",
                "n": n,
                "mean_forecast": mean_forecast,
                "observed": observed,
                "ci_low": float(low),
                "ci_high": float(high),
                "gap": observed - mean_forecast,
            }
        )
    return pd.DataFrame(rows)


def expected_calibration_error(table: pd.DataFrame) -> float:
    """Average |observed - forecast|, weighted by how many forecasts each bin holds.

    One number for "how far off the diagonal, on average"; 0 is perfect.
    """
    if table.empty:
        return float("nan")
    return float(np.average(np.abs(table["gap"]), weights=table["n"]))


def match_calibration(predictions: pd.DataFrame, edges: Sequence[float] = DECILE_EDGES) -> dict[str, pd.DataFrame]:
    """Calibration of home-win, draw and away-win probabilities separately.

    ``predictions`` needs ``p_home``, ``p_draw``, ``p_away`` and ``outcome``
    (0 home, 1 draw, 2 away), as produced by the match backtest.
    """
    tables = {}
    for code, name in enumerate(("home", "draw", "away")):
        tables[name] = calibration_table(predictions[f"p_{name}"], predictions["outcome"] == code, edges)
    return tables

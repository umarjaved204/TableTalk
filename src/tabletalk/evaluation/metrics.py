"""Scoring probabilistic forecasts of match outcomes.

A forecast here is three probabilities (home win, draw, away win). Picking the
most likely outcome and counting hits throws most of that information away, so
TableTalk uses *proper scoring rules*: scores that are optimised, in
expectation, only by reporting your true beliefs. All three below are lower =
better.

log loss
    ``-log(probability given to what actually happened)``. Punishes confident
    mistakes hard (a 2% draw that happens costs 3.9; a 33% draw costs 1.1). The
    most sensitive of the three, and the one the model is fitted to optimise.

Brier score
    Squared distance between the forecast vector and the outcome vector, e.g.
    forecast (0.5, 0.3, 0.2) and a home win (1, 0, 0) score
    ``0.25 + 0.09 + 0.04 = 0.38``. Bounded (0 to 2), so one freak result cannot
    dominate.

Ranked probability score (RPS)
    Like Brier, but on *cumulative* probabilities, so it respects the order
    home win < draw < away win: predicting a draw when the home side wins is
    penalised less than predicting an away win. Standard in football
    forecasting papers, which makes it the one to quote when comparing with
    published models.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

#: Outcome encoding shared by the evaluation code, in the order used by RPS.
HOME, DRAW, AWAY = 0, 1, 2
OUTCOME_LABELS = ("home", "draw", "away")


def outcomes_from_goals(home_goals, away_goals) -> np.ndarray:
    """Encode results as 0 (home win), 1 (draw) or 2 (away win)."""
    home = np.asarray(home_goals, dtype=float)
    away = np.asarray(away_goals, dtype=float)
    return np.where(home > away, HOME, np.where(home == away, DRAW, AWAY)).astype(int)


def _check(probs: np.ndarray, outcomes: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    probs = np.asarray(probs, dtype=float)
    outcomes = np.asarray(outcomes, dtype=int)
    if probs.ndim != 2 or probs.shape[1] != 3:
        raise ValueError(f"probabilities must have shape (n, 3), got {probs.shape}")
    if len(probs) != len(outcomes):
        raise ValueError("probabilities and outcomes differ in length")
    if not np.allclose(probs.sum(axis=1), 1.0, atol=1e-6):
        raise ValueError("each row of probabilities must sum to 1")
    return probs, outcomes


def log_loss(probs, outcomes, eps: float = 1e-15) -> float:
    probs, outcomes = _check(probs, outcomes)
    chosen = probs[np.arange(len(outcomes)), outcomes]
    return float(-np.mean(np.log(np.clip(chosen, eps, 1.0))))


def brier_score(probs, outcomes) -> float:
    probs, outcomes = _check(probs, outcomes)
    onehot = np.eye(3)[outcomes]
    return float(np.mean(np.sum((probs - onehot) ** 2, axis=1)))


def ranked_probability_score(probs, outcomes) -> float:
    probs, outcomes = _check(probs, outcomes)
    onehot = np.eye(3)[outcomes]
    cumulative_gap = np.cumsum(probs, axis=1)[:, :-1] - np.cumsum(onehot, axis=1)[:, :-1]
    return float(np.mean(np.sum(cumulative_gap**2, axis=1) / (probs.shape[1] - 1)))


def score_forecasts(probs, outcomes) -> dict[str, float]:
    """All three scores plus the sample size, as one dict."""
    probs, outcomes = _check(probs, outcomes)
    return {
        "n": int(len(outcomes)),
        "log_loss": log_loss(probs, outcomes),
        "brier": brier_score(probs, outcomes),
        "rps": ranked_probability_score(probs, outcomes),
    }


def score_frame(predictions: pd.DataFrame, prefix: str = "p_") -> dict[str, float]:
    """Score a frame with ``p_home``, ``p_draw``, ``p_away`` and ``outcome`` columns."""
    probs = predictions[[f"{prefix}home", f"{prefix}draw", f"{prefix}away"]].to_numpy()
    return score_forecasts(probs, predictions["outcome"].to_numpy())

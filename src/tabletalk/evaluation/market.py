"""The betting market as a benchmark: how close does the model get to it?

Bookmakers' closing odds are the strongest public forecast of a football match:
they combine every model, every tipster and all team news up to kick-off, and
anyone who can beat them consistently can make money. So they are not a target
to beat, but a ceiling to measure against. The question is "how much of the gap
between knowing nothing and the market does the model close?".

From odds to probabilities
--------------------------
Decimal odds of 2.50 pay 2.50 for a 1.00 stake, so they "imply" a probability
of 1 / 2.50 = 40%. Across the three outcomes these implied probabilities add up
to *more* than 100%, e.g. 1/2.10 + 1/3.40 + 1/3.80 = 102.4%. The extra 2.4% is
the bookmaker's margin (the "overround"): it is how the bookmaker profits.

To get probabilities that sum to one, TableTalk divides each implied
probability by their total (**proportional normalisation**)::

    p_home = (1 / odds_home) / (1 / odds_home + 1 / odds_draw + 1 / odds_away)

ASSUMPTION: this spreads the margin evenly, in proportion to each price. In
practice bookmakers load more of it onto long shots (the "favourite-longshot
bias"), so proportional normalisation slightly overstates the chances of
outsiders. Alternatives that model this (Shin's method, the power method)
exist; with Pinnacle's low margin (about 2-3%) the choice moves probabilities by
a point or so at most, and proportional is the one anyone can check by hand.

Also note, when comparing: closing odds are set minutes before kick-off, with
team news, injuries and line-ups known. The model forecasts from results only,
using a fit up to a week old. Some of the market's edge is simply information
the model is never given.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from ..config import CompetitionConfig
from ..data.loaders import build_loaders
from .backtest import BASELINE, per_match_log_loss

MARKET = "market"


def implied_probabilities(odds: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Margin-free (home, draw, away) probabilities and the overround per match.

    ``odds`` is an (n, 3) array of decimal odds. Returns ``(probs, overround)``
    where ``overround`` is the sum of raw implied probabilities (1.03 = 3% margin).
    """
    odds = np.asarray(odds, dtype=float)
    if odds.ndim != 2 or odds.shape[1] != 3:
        raise ValueError(f"odds must have shape (n, 3), got {odds.shape}")
    if (odds <= 1.0).any() or np.isnan(odds).any():
        raise ValueError("decimal odds must all be present and greater than 1")
    raw = 1.0 / odds
    total = raw.sum(axis=1)
    return raw / total[:, None], total


def load_market_odds(config: CompetitionConfig, *, refresh: bool = False) -> pd.DataFrame:
    """Odds for the competition's matches, from every results source that has them.

    Returns an empty frame if no source publishes odds (or none is configured
    to), in which case the benchmark simply cannot be run for this competition.
    """
    frames = []
    for loader in build_loaders(config, role="results"):
        odds = loader.load_odds(refresh=refresh)
        if odds is not None and not odds.empty:
            frames.append(odds)
    if not frames:
        return pd.DataFrame(
            columns=["season", "date", "home_team", "away_team", "odds_home", "odds_draw", "odds_away", "odds_source"]
        )
    stacked = pd.concat(frames, ignore_index=True)
    return stacked.drop_duplicates(subset=["season", "home_team", "away_team"], keep="first")


def add_market_forecasts(predictions: pd.DataFrame, odds: pd.DataFrame) -> pd.DataFrame:
    """Append the market as one more forecaster in a match-backtest frame.

    Uses the baseline's rows as the template (one per match, already carrying
    the outcome and subgroup flags), so every summary that works on models
    works on the market too. Matches are joined on (season, home, away), which
    identifies a league match uniquely, as in the rest of the data layer.
    Matches without odds get no market row.
    """
    predictions = predictions.astype({"season": str, "home_team": str, "away_team": str})
    template = predictions.loc[predictions["model"] == BASELINE].drop(columns=["p_home", "p_draw", "p_away"])
    key = ["season", "home_team", "away_team"]
    priced = odds[[*key, "odds_home", "odds_draw", "odds_away", "odds_source"]].astype(
        {"season": str, "home_team": str, "away_team": str}
    )
    market = template.merge(priced, on=key, how="inner")
    probs, overround = implied_probabilities(market[["odds_home", "odds_draw", "odds_away"]].to_numpy())
    market["p_home"], market["p_draw"], market["p_away"] = probs.T
    market["overround"] = overround
    market["model"] = MARKET
    return pd.concat([predictions, market], ignore_index=True)


def odds_coverage(predictions: pd.DataFrame) -> pd.DataFrame:
    """Per season: matches, how many each odds source priced, and the average margin."""
    matches = predictions.loc[predictions["model"] == BASELINE].groupby("season").size().rename("matches")
    market = predictions.loc[predictions["model"] == MARKET]
    by_source = market.groupby(["season", "odds_source"]).size().unstack(fill_value=0)
    margin = market.groupby("season")["overround"].mean().sub(1).mul(100).rename("avg_margin_pct")
    return pd.concat([matches, by_source, margin], axis=1).fillna(0)


def gap_closed(predictions: pd.DataFrame, model: str) -> pd.DataFrame:
    """Per season, the share of the baseline-to-market gap in log loss the model closes.

    ``100%`` would mean as good as the market, ``0%`` no better than knowing
    nothing. Only matches the market priced are used for all three.
    """
    rows = []
    for season, group in predictions.groupby("season", sort=True):
        market = per_match_log_loss(group.loc[group["model"] == MARKET])
        if market.empty:
            continue
        losses = {
            name: per_match_log_loss(group.loc[group["model"] == name]).reindex(market.index).mean()
            for name in (BASELINE, model)
        }
        rows.append(
            {
                "season": season,
                "n": len(market),
                "baseline": losses[BASELINE],
                model: losses[model],
                "market": market.mean(),
                "model_minus_market": losses[model] - market.mean(),
                "gap_closed_pct": 100 * (losses[BASELINE] - losses[model]) / (losses[BASELINE] - market.mean()),
            }
        )
    return pd.DataFrame(rows)


__all__ = [
    "MARKET",
    "add_market_forecasts",
    "gap_closed",
    "implied_probabilities",
    "load_market_odds",
    "odds_coverage",
]

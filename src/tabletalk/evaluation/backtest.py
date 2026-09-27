"""Match-level backtest: would the model have forecast past matches well?

Method (a "rolling origin" backtest):

1. Pick a completed season to test, e.g. 2024-25.
2. Stand at the season's first matchday. Fit the model using only results from
   *before* that date - the same information a forecaster had at the time.
3. Forecast every match in the next ``refit_every_days`` days, and record the
   forecasts next to what actually happened.
4. Step forward a week, refit with the extra results, repeat to the season's
   end.

Because every fit uses only earlier results, there is no look-ahead: each
forecast could genuinely have been made on the day. The season's participant
list is used from the start, which is fine - it is known before a ball is
kicked.

Every model is compared against a **baseline** that knows nothing about the
teams: it predicts the competition's historical home/draw/away frequencies for
every match. A model that cannot beat that adds nothing.

The results are broken down by subgroup, because the promoted-team strategies
only differ where promoted teams play, and mostly early in the season before
their own results take over. An average over all 380 matches would hide that.
"""

from __future__ import annotations

import logging
from typing import Iterable, Sequence

import numpy as np
import pandas as pd

from ..config import CompetitionConfig
from ..model.promoted import estimate_promoted_prior, fit_competition_model, promoted_teams
from .metrics import outcomes_from_goals, score_frame

logger = logging.getLogger(__name__)

BASELINE = "baseline"

#: A match counts as "early season" while both teams have played at most this
#: many league games, i.e. roughly the first ten matchdays.
EARLY_SEASON_GAMES = 10


def base_rates(matches: pd.DataFrame, competition: str, before: pd.Timestamp) -> np.ndarray:
    """Historical (home, draw, away) frequencies from results before ``before``."""
    played = matches.loc[
        (matches["competition"].astype(str) == competition)
        & matches["played"].fillna(False).astype(bool)
        & (matches["date"] < before)
    ]
    if played.empty:
        return np.array([1 / 3, 1 / 3, 1 / 3])
    outcomes = outcomes_from_goals(played["home_goals"], played["away_goals"])
    return np.bincount(outcomes, minlength=3) / len(outcomes)


def _annotate_season(rows: pd.DataFrame, promoted: Sequence[str] | None) -> pd.DataFrame:
    """Add outcome, each side's game number in the season, and promoted flags."""
    out = rows.sort_values("date", kind="stable").copy()
    out["outcome"] = outcomes_from_goals(out["home_goals"], out["away_goals"])

    games_so_far: dict[str, int] = {}
    home_game, away_game = [], []
    for home, away in zip(out["home_team"], out["away_team"]):
        games_so_far[home] = games_so_far.get(home, 0) + 1
        games_so_far[away] = games_so_far.get(away, 0) + 1
        home_game.append(games_so_far[home])
        away_game.append(games_so_far[away])
    out["home_game_no"] = home_game
    out["away_game_no"] = away_game
    out["early_season"] = np.maximum(out["home_game_no"], out["away_game_no"]) <= EARLY_SEASON_GAMES

    promoted_set = set(promoted or ())
    out["promoted_match"] = out["home_team"].isin(promoted_set) | out["away_team"].isin(promoted_set)
    return out


def match_backtest(
    config: CompetitionConfig,
    matches: pd.DataFrame,
    context: pd.DataFrame | None,
    seasons: Iterable[str],
    *,
    strategies: Sequence[str] = ("none", "prior", "second_tier"),
    refit_every_days: int = 7,
    half_life_days: float | None = None,
) -> pd.DataFrame:
    """Forecast every match of ``seasons`` with rolling refits.

    Returns one row per (match, model) with the forecast probabilities and the
    observed ``outcome``, ready for :func:`summarise_backtest`.
    """
    own = matches.loc[matches["competition"].astype(str) == config.id]
    records: list[pd.DataFrame] = []

    for season in seasons:
        season_rows = own.loc[
            (own["season"].astype(str) == season) & own["played"].fillna(False).astype(bool)
        ]
        if season_rows.empty:
            raise ValueError(f"{config.id}: no played matches in {season} to backtest")
        promoted = promoted_teams(own, config.id, season)
        season_rows = _annotate_season(season_rows, promoted)

        # The promoted-team prior depends only on earlier seasons, so it is
        # estimated once per backtest season rather than at every refit.
        prior = None
        if "prior" in strategies:
            prior = estimate_promoted_prior(
                own, config.id, season, rating_prior_sd=float(config.model.get("rating_prior_sd", 1.0))
            )

        start = season_rows["date"].min().normalize()
        end = season_rows["date"].max()
        refit_dates = pd.date_range(start, end + pd.Timedelta(days=1), freq=f"{refit_every_days}D")
        logger.info(
            "%s %s: %d matches, %d refits, promoted=%s",
            config.id,
            season,
            len(season_rows),
            len(refit_dates),
            promoted,
        )

        for as_of in refit_dates:
            window = season_rows.loc[
                (season_rows["date"] >= as_of)
                & (season_rows["date"] < as_of + pd.Timedelta(days=refit_every_days))
            ]
            if window.empty:
                continue

            for strategy in strategies:
                fit = fit_competition_model(
                    config,
                    matches,
                    context,
                    season=season,
                    as_of=as_of,
                    strategy=strategy,
                    half_life_days=half_life_days,
                    prior=prior,
                )
                predicted = fit.model.predict(window)
                predicted["model"] = strategy
                predicted["fit_date"] = as_of
                records.append(predicted)

            rates = base_rates(matches, config.id, as_of)
            baseline = window.copy()
            baseline["p_home"], baseline["p_draw"], baseline["p_away"] = rates
            baseline["model"] = BASELINE
            baseline["fit_date"] = as_of
            records.append(baseline)

    return pd.concat(records, ignore_index=True)


#: Subgroups reported by :func:`summarise_backtest`, as (name, row filter).
SUBGROUPS = (
    ("all matches", lambda frame: np.ones(len(frame), dtype=bool)),
    ("promoted team involved", lambda frame: frame["promoted_match"].to_numpy(dtype=bool)),
    ("early season (games 1-10)", lambda frame: frame["early_season"].to_numpy(dtype=bool)),
    (
        "early season, promoted team involved",
        lambda frame: (frame["early_season"] & frame["promoted_match"]).to_numpy(dtype=bool),
    ),
)


def summarise_backtest(predictions: pd.DataFrame) -> pd.DataFrame:
    """Scores per subgroup and model, plus improvement over the baseline.

    ``vs_baseline`` is the percentage reduction in log loss relative to the
    base-rate forecast on the same matches; positive means the model is better.
    """
    rows = []
    for group_name, selector in SUBGROUPS:
        subset = predictions.loc[selector(predictions)]
        if subset.empty:
            continue
        baseline_loss = None
        baseline_rows = subset.loc[subset["model"] == BASELINE]
        if not baseline_rows.empty:
            baseline_loss = score_frame(baseline_rows)["log_loss"]
        for model_name, model_rows in subset.groupby("model", sort=False):
            scores = score_frame(model_rows)
            scores["vs_baseline_pct"] = (
                100 * (1 - scores["log_loss"] / baseline_loss) if baseline_loss else np.nan
            )
            rows.append({"group": group_name, "model": model_name, **scores})
    return pd.DataFrame(rows)


#: Columns that identify one match across the rows of different models.
MATCH_KEY = ["season", "date", "home_team", "away_team"]


def per_match_log_loss(rows: pd.DataFrame) -> pd.Series:
    """``-log(probability given to what happened)`` for each match, indexed by match."""
    probs = rows[["p_home", "p_draw", "p_away"]].to_numpy(dtype=float)
    chosen = probs[np.arange(len(rows)), rows["outcome"].to_numpy(dtype=int)]
    index = pd.MultiIndex.from_frame(rows[MATCH_KEY])
    return pd.Series(-np.log(np.clip(chosen, 1e-15, 1.0)), index=index)


def paired_comparison(predictions: pd.DataFrame, model: str, other: str) -> pd.DataFrame:
    """Log loss of ``model`` minus ``other`` on the same matches, per subgroup.

    Pairing matters: both models face the same matches, so the match-to-match
    luck that dominates any one model's score cancels in the difference. The
    95% interval (``ci95``) is 1.96 standard errors of the mean per-match
    difference. Negative means ``model`` is better.

    Caveat: matches in the same week or involving the same team are not fully
    independent, so the interval is, if anything, a little too narrow.
    """
    rows = []
    for group_name, selector in SUBGROUPS:
        subset = predictions.loc[selector(predictions)]
        a = per_match_log_loss(subset.loc[subset["model"] == model])
        b = per_match_log_loss(subset.loc[subset["model"] == other])
        diff = (a - b).dropna()
        if diff.empty:
            continue
        rows.append(
            {
                "group": group_name,
                "comparison": f"{model} - {other}",
                "n": len(diff),
                "diff": diff.mean(),
                "ci95": 1.96 * diff.std(ddof=1) / np.sqrt(len(diff)),
            }
        )
    return pd.DataFrame(rows)


def summarise_by_season(predictions: pd.DataFrame) -> pd.DataFrame:
    """Log loss per season and model, to check a result is not one season's fluke."""
    table = (
        predictions.groupby(["season", "model"], sort=True)
        .apply(lambda frame: score_frame(frame)["log_loss"], include_groups=False)
        .unstack("model")
    )
    return table

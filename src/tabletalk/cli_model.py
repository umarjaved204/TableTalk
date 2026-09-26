"""CLI commands for the match model: ``ratings`` and ``evaluate``.

Kept apart from ``cli.py``, which holds the parser and the data commands.
"""

from __future__ import annotations

import argparse
import warnings

import numpy as np
import pandas as pd

from .config import CompetitionConfig, load_competition
from .data import load_context_matches, load_matches, remaining_fixtures
from .data.seasons import Season
from .evaluation.backtest import match_backtest, summarise_backtest, summarise_by_season
from .model.promoted import STRATEGIES, fit_competition_model


def _load(config: CompetitionConfig, refresh: bool = False) -> tuple[pd.DataFrame, pd.DataFrame]:
    return load_matches(config, refresh=refresh), load_context_matches(config, refresh=refresh)


def cmd_ratings(args: argparse.Namespace) -> int:
    """Fit the model on everything played so far and show ratings + next fixtures."""
    config = load_competition(args.competition)
    matches, context = _load(config, refresh=args.refresh)
    fit = fit_competition_model(
        config, matches, context, strategy=args.strategy, half_life_days=args.half_life
    )
    model = fit.model

    print(f"=== {config.name} {fit.season}: match model ===")
    print(model.summary())

    print(f"\n--- promoted teams: strategy `{fit.strategy}` ---")
    print(f"promoted this season: {', '.join(fit.promoted or []) or '(unknown)'}")
    if fit.strategy == "prior" and fit.prior is not None:
        print(fit.prior.describe())
    elif fit.strategy == "second_tier":
        print("rated jointly with the Championship (context data); see division offsets above")
    else:
        print("no special handling: promoted teams start as an average team")

    season_rows = matches.loc[matches["season"].astype(str) == fit.season]
    season_teams = sorted(set(season_rows["home_team"]) | set(season_rows["away_team"]))
    table = model.ratings(season_teams)
    # Ratings are centred over every team in the fit (including relegated or
    # second-tier sides), so re-centre on this season's league for display.
    table["attack"] -= table["attack"].mean()
    table["defence"] -= table["defence"].mean()
    table["net"] = table["attack"] + table["defence"]
    table["attack_x"] = np.exp(table["attack"])
    table["concede_x"] = np.exp(-table["defence"])
    table = table.sort_values("net", ascending=False).reset_index(drop=True)
    table.index += 1
    columns = ["team", "attack", "defence", "net", "attack_x", "concede_x", "matches"]
    print(f"\n--- ratings, relative to the {fit.season} league average ---")
    print("attack_x: goals scored vs an average team; concede_x: goals conceded vs average")
    print(table[columns].round(3).to_string())

    upcoming = remaining_fixtures(matches, config, fit.season)
    if len(upcoming) and args.fixtures > 0:
        next_fixtures = model.predict(upcoming.head(args.fixtures))
        print(f"\n--- next {len(next_fixtures)} fixtures ---")
        shown = next_fixtures[
            ["date", "home_team", "away_team", "expected_home_goals", "expected_away_goals", "p_home", "p_draw", "p_away"]
        ].rename(columns={"expected_home_goals": "xg_home", "expected_away_goals": "xg_away"})
        print(shown.round(2).to_string(index=False))
    return 0


def _default_backtest_seasons(config: CompetitionConfig) -> list[str]:
    """Completed seasons where every strategy can run.

    The first season in the data has no predecessor (so promotion is unknown),
    and the second has no earlier promotion to learn a prior from.
    """
    current = Season.parse(config.current_season).start_year
    completed = [s for s in config.seasons if Season.parse(s).start_year < current]
    return completed[2:]


def cmd_evaluate(args: argparse.Namespace) -> int:
    """Match-level backtest: strategies vs each other and vs the base-rate baseline."""
    config = load_competition(args.competition)
    matches, context = _load(config)
    seasons = args.seasons or _default_backtest_seasons(config)
    strategies = tuple(args.strategies)

    print(f"=== {config.name}: match-level backtest ===")
    print(f"seasons: {', '.join(seasons)} | refit every {args.refit_days} days | "
          f"half-life {args.half_life or config.model.get('time_decay_half_life_days')} days")
    print("Each match is forecast from a fit using only results before it.\n")

    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)
        predictions = match_backtest(
            config,
            matches,
            context,
            seasons,
            strategies=strategies,
            refit_every_days=args.refit_days,
            half_life_days=args.half_life,
        )

    summary = summarise_backtest(predictions)
    print("lower is better for log_loss / brier / rps; vs_baseline_pct = % log-loss reduction")
    for group, rows in summary.groupby("group", sort=False):
        print(f"\n{group} (n={int(rows['n'].iloc[0])})")
        print(rows.drop(columns=["group", "n"]).round(4).to_string(index=False))

    print("\nlog loss by season")
    print(summarise_by_season(predictions).round(4).to_string())

    if args.save:
        predictions.to_csv(args.save, index=False)
        print(f"\nper-match predictions written to {args.save}")
    return 0


def add_model_commands(subparsers, add_competition_arg) -> None:
    """Register ``ratings`` and ``evaluate`` on the main parser."""
    ratings = subparsers.add_parser("ratings", help="fit the match model and show team ratings")
    add_competition_arg(ratings)
    ratings.add_argument("--strategy", choices=STRATEGIES, default=None,
                         help="promoted-team strategy (default: from the config)")
    ratings.add_argument("--half-life", type=float, default=None, help="time-decay half-life in days")
    ratings.add_argument("--fixtures", type=int, default=10, help="upcoming fixtures to predict")
    ratings.add_argument("--refresh", action="store_true", help="re-download data first")
    ratings.set_defaults(func=cmd_ratings)

    evaluate = subparsers.add_parser("evaluate", help="match-level backtest of the model")
    add_competition_arg(evaluate)
    evaluate.add_argument("--seasons", nargs="+", default=None,
                          help="completed seasons to test (default: all where every strategy can run)")
    evaluate.add_argument("--strategies", nargs="+", choices=STRATEGIES, default=list(STRATEGIES))
    evaluate.add_argument("--half-life", type=float, default=None, help="time-decay half-life in days")
    evaluate.add_argument("--refit-days", type=int, default=7, help="days between refits")
    evaluate.add_argument("--save", default=None, help="write per-match predictions to this CSV")
    evaluate.set_defaults(func=cmd_evaluate)


__all__ = ["add_model_commands", "cmd_evaluate", "cmd_ratings"]

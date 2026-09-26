"""CLI commands for the model: ``ratings``, ``evaluate`` and ``simulate``.

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
from .evaluation.calibration import calibration_table, expected_calibration_error, match_calibration
from .evaluation.plots import plot_calibration, save_themed
from .evaluation.season_backtest import favourite_record, season_backtest, season_calibration_by_phase
from .simulation import simulate_league


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


def _excluded_seasons(config: CompetitionConfig) -> dict[str, str]:
    """Seasons the config keeps out of headline backtests, with the reason."""
    evaluation = config.raw.get("evaluation") or {}
    excluded = evaluation.get("exclude_seasons") or {}
    return {str(season): " ".join(str(reason).split()) for season, reason in excluded.items()}


def _default_backtest_seasons(config: CompetitionConfig) -> list[str]:
    """Completed seasons where every strategy can run, minus configured exclusions.

    The first season in the data has no predecessor (so promotion is unknown),
    and the second has no earlier promotion to learn a prior from.
    """
    current = Season.parse(config.current_season).start_year
    completed = [s for s in config.seasons if Season.parse(s).start_year < current]
    excluded = _excluded_seasons(config)
    return [season for season in completed[2:] if season not in excluded]


def cmd_evaluate(args: argparse.Namespace) -> int:
    """Match-level backtest: strategies vs each other and vs the base-rate baseline."""
    config = load_competition(args.competition)
    matches, context = _load(config)
    seasons = args.seasons or _default_backtest_seasons(config)
    strategies = tuple(args.strategies)

    print(f"=== {config.name}: match-level backtest ===")
    print(f"seasons: {', '.join(seasons)} | refit every {args.refit_days} days | "
          f"half-life {args.half_life or config.model.get('time_decay_half_life_days')} days")
    print("Each match is forecast from a fit using only results before it.")
    if not args.seasons:
        for season, reason in _excluded_seasons(config).items():
            print(f"excluded {season}: {reason}")
    print()

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

    # Calibration of the headline model: when it said ~60%, did it happen ~60%?
    model_name = "prior" if "prior" in strategies else strategies[0]
    model_rows = predictions.loc[predictions["model"] == model_name]
    tables = match_calibration(model_rows)
    print(f"\ncalibration of `{model_name}`: forecasts grouped by probability, vs how often it happened")
    for outcome, table in tables.items():
        print(f"\n{outcome} win" if outcome != "draw" else "\ndraw", end="")
        print(f"  (average gap {100 * expected_calibration_error(table):.1f} pts)")
        shown = table.assign(**{c: (100 * table[c]).round(1) for c in ("mean_forecast", "observed", "ci_low", "ci_high")})
        print(shown.drop(columns="gap").to_string(index=False))

    if args.plot:
        labelled = {"home win": tables["home"], "draw": tables["draw"], "away win": tables["away"]}
        written = save_themed(
            lambda theme: plot_calibration(
                labelled,
                title="Match forecasts: calibration",
                subtitle=f"{len(model_rows):,} {config.name} matches, {seasons[0]} to {seasons[-1]}, "
                         "each forecast from results before it",
                theme=theme,
            ),
            args.plot,
        )
        print("\ncalibration chart written to " + ", ".join(str(path) for path in written))

    if args.save:
        predictions.to_csv(args.save, index=False)
        print(f"\nper-match predictions written to {args.save}")
    return 0


def cmd_evaluate_seasons(args: argparse.Namespace) -> int:
    """Season-level backtest: zone forecasts from several checkpoints vs final tables."""
    config = load_competition(args.competition)
    matches, context = _load(config)
    seasons = args.seasons or _default_backtest_seasons(config)

    print(f"=== {config.name}: season-level backtest ===")
    print(f"seasons: {', '.join(seasons)} | {args.n_simulations:,} simulations per checkpoint")
    print("Each checkpoint forgets every later result, fits on what was known then and\n"
          "simulates the rest; forecasts are scored against the real final table.")
    if not args.seasons:
        for season, reason in _excluded_seasons(config).items():
            print(f"excluded {season}: {reason}")
    print()

    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)
        backtest = season_backtest(
            config, matches, context, seasons,
            n_simulations=args.n_simulations, fixed_strengths=args.fixed_strengths,
        )

    zones = backtest.zone_summary()
    print("Brier score skill (% better than the baseline; higher is better)")
    for baseline in ("uniform", "persistence"):
        pivot = zones.pivot(index="checkpoint", columns="zone", values=f"skill_vs_{baseline}_pct")
        pivot = pivot.loc[zones["checkpoint"].unique(), [zone.id for zone in config.zones]]
        print(f"\nvs {baseline}" + (" (knows nothing)" if baseline == "uniform" else " (the table as it stands)"))
        print(pivot.round(1).to_string())

    print("\nfinishing position (lower is better): ranked probability score, and average error in places")
    print(backtest.position_summary().round(3).to_string(index=False))

    print("\nhow often the model's title favourite won (descriptive only)")
    print(favourite_record(backtest.zones).round(3).to_string(index=False))

    table = calibration_table(backtest.zones["p_model"], backtest.zones["outcome"])
    print(f"\nzone forecast calibration, all zones and checkpoints pooled "
          f"(average gap {100 * expected_calibration_error(table):.1f} pts)")
    shown = table.assign(**{c: (100 * table[c]).round(1) for c in ("mean_forecast", "observed", "ci_low", "ci_high")})
    print(shown.drop(columns="gap").to_string(index=False))

    confident = backtest.zones.loc[backtest.zones["p_model"].between(0.7, 0.99)]
    print("\nconfident forecasts (70-99%) by checkpoint: average forecast vs how often it happened")
    print(
        confident.groupby("checkpoint", sort=False)
        .agg(n=("outcome", "size"), forecast=("p_model", "mean"), observed=("outcome", "mean"))
        .assign(forecast=lambda f: (100 * f["forecast"]).round(1), observed=lambda f: (100 * f["observed"]).round(1))
        .to_string()
    )

    if args.plot:
        halves = season_calibration_by_phase(backtest.zones)
        written = save_themed(
            lambda theme: plot_calibration(
                halves,
                title="Season forecasts: calibration",
                subtitle=f"{len(backtest.zones):,} zone forecasts, {len(seasons)} seasons x 4 checkpoints",
                theme=theme,
            ),
            args.plot,
        )
        print("\ncalibration chart written to " + ", ".join(str(path) for path in written))
    if args.save:
        backtest.zones.to_csv(args.save, index=False)
        print(f"\nper-team zone forecasts written to {args.save}")
    return 0


def _percent(p: float) -> str:
    """Probabilities as a reader expects them: never a bare 0 or 100 unless certain."""
    if p == 0:
        return "-"
    if p == 1:
        return "100"
    if p < 0.001:
        return "<0.1"
    if p > 0.999:
        return ">99.9"
    return f"{100 * p:.1f}"


def _describe_uncertainty(uncertainty) -> str:
    if uncertainty is None or not uncertainty.active:
        return "fixed at today's ratings for every simulated season"
    parts = []
    if uncertainty.parameter_uncertainty:
        parts.append("each season draws its ratings from the fit's uncertainty")
    if uncertainty.drift_variance_per_day > 0:
        season_sd = (uncertainty.drift_variance_per_day * 280) ** 0.5
        parts.append(f"and ratings drift during it (about +/-{season_sd:.2f} over a season)")
    return " ".join(parts)


def cmd_simulate(args: argparse.Namespace) -> int:
    """Simulate the rest of the season and print zone probabilities."""
    import time

    config = load_competition(args.competition)
    matches, context = _load(config, refresh=args.refresh)
    season = args.season or config.current_season

    started = time.perf_counter()
    result = simulate_league(
        config,
        matches,
        context,
        n_simulations=args.n_simulations,
        seed=args.seed,
        strategy=args.strategy,
        as_of=args.as_of,
        season=season,
        fixed_strengths=args.fixed_strengths,
    )
    elapsed = time.perf_counter() - started

    played = int(result.current_table["played"].sum() // 2)
    title = f"{config.name} {season}"
    if args.as_of:
        title += f", replayed from {pd.Timestamp(args.as_of).date()}"
    print(f"=== {title}: {result.n_simulations:,} simulated seasons ===")
    print(f"model: Dixon-Coles fitted on results before {result.model_as_of.date()}, "
          f"promoted teams via `{result.metadata.get('strategy')}`")
    print(f"strengths: {_describe_uncertainty(result.metadata.get('uncertainty'))}")
    print(f"{played} matches played, {result.n_remaining} simulated per season; "
          f"{elapsed:.1f}s; seed {result.seed}")
    print(f"simulation noise: a 50% figure is good to about "
          f"+/-{100 * 1.96 * float(result.standard_error(0.5)):.1f} points (95%)\n")

    summary = result.summary()
    if args.table:
        _print_projected_table(result, summary)
        return 0
    table = pd.DataFrame(
        {
            "now": summary["position_now"],
            "pts": summary["points_now"],
            "exp pts": summary["expected_points"].round(1),
            "range (10-90%)": [f"{lo:.0f}-{hi:.0f}" for lo, hi in zip(summary["points_p10"], summary["points_p90"])],
            **{zone.id.replace("_", " "): summary[zone.id].map(_percent) for zone in config.zones},
        },
        index=summary.index,
    )
    table.index.name = None
    if played == 0:
        # Pre-season every team is on 0 points, and "now" would just be
        # alphabetical order: drop it rather than show a meaningless column.
        table = table.drop(columns=["now", "pts"])
    print("probabilities in %, teams ordered by expected finishing position")
    print(f"'-' = in none of the {result.n_simulations:,} runs; '100' = in all of them "
          "(likely, not necessarily mathematically certain)")
    print(table.to_string())

    if args.positions:
        positions = result.position_probabilities().loc[summary.index]
        print("\nfinishing-position probabilities (%)")
        print((100 * positions).round(0).astype(int).replace(0, "").to_string())

    if args.save:
        summary.to_csv(args.save)
        print(f"\nsummary written to {args.save}")
    return 0


def _print_projected_table(result, summary: pd.DataFrame) -> None:
    """The average simulated final table, laid out like a league table.

    Every figure is an average over all runs, so the numbers are not whole and
    the spread is compressed: see the note printed with it.
    """
    record = result.expected_record.loc[summary.index]
    table = pd.DataFrame(
        {
            "P": record[["won", "drawn", "lost"]].sum(axis=1),
            "W": record["won"],
            "D": record["drawn"],
            "L": record["lost"],
            "GF": record["goals_for"],
            "GA": record["goals_against"],
            "GD": record["goals_for"] - record["goals_against"],
            "Pts": summary["expected_points"],
        },
        index=summary.index,
    )
    table = table.round(1)
    table["P"] = table["P"].round().astype(int)
    table.insert(0, "pos", range(1, len(table) + 1))
    table.index.name = None
    print("projected final table: the average of every simulated season")
    print("(averages pull everyone toward the middle: the real champions usually finish above\n"
          " the top figure here, and the real bottom side below the bottom one)")
    print(table.to_string())


def add_model_commands(subparsers, add_competition_arg) -> None:
    """Register ``ratings``, ``evaluate``, ``evaluate-seasons`` and ``simulate``."""
    simulate = subparsers.add_parser("simulate", help="simulate the rest of the season")
    add_competition_arg(simulate)
    simulate.add_argument("--n-simulations", type=int, default=None, help="default: from the config")
    simulate.add_argument("--seed", type=int, default=None, help="default: from the config")
    simulate.add_argument("--strategy", choices=STRATEGIES, default=None, help="promoted-team strategy")
    simulate.add_argument("--season", default=None, help="season to simulate (default: current)")
    simulate.add_argument("--as-of", default=None,
                          help="replay from this date: results on or after it are simulated instead")
    simulate.add_argument("--positions", action="store_true", help="also print every finishing position")
    simulate.add_argument("--table", action="store_true",
                          help="print the projected final table (W/D/L/GF/GA/Pts) instead")
    simulate.add_argument("--refresh", action="store_true", help="re-download data first")
    simulate.add_argument("--fixed-strengths", action="store_true",
                          help="use today's ratings for every simulated season (no strength uncertainty)")
    simulate.add_argument("--save", default=None, help="write the summary to this CSV")
    simulate.set_defaults(func=cmd_simulate)

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
    evaluate.add_argument("--plot", default=None,
                          help="write a calibration chart: <PLOT>-light.png and <PLOT>-dark.png")
    evaluate.set_defaults(func=cmd_evaluate)

    seasons = subparsers.add_parser("evaluate-seasons", help="season-level backtest of zone probabilities")
    add_competition_arg(seasons)
    seasons.add_argument("--seasons", nargs="+", default=None,
                         help="completed seasons to test (default: all where every strategy can run)")
    seasons.add_argument("--n-simulations", type=int, default=5_000, help="simulations per checkpoint")
    seasons.add_argument("--fixed-strengths", action="store_true",
                         help="simulate without strength uncertainty, to compare")
    seasons.add_argument("--save", default=None, help="write per-team zone forecasts to this CSV")
    seasons.add_argument("--plot", default=None,
                         help="write a calibration chart: <PLOT>-light.png and <PLOT>-dark.png")
    seasons.set_defaults(func=cmd_evaluate_seasons)


__all__ = ["add_model_commands", "cmd_evaluate", "cmd_ratings", "cmd_simulate"]

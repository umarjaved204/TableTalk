"""Command-line entry point: ``python -m tabletalk ...``.

Phase 1 commands:

    python -m tabletalk competitions
    python -m tabletalk data fetch --competition premier_league [--refresh]
    python -m tabletalk data check --competition premier_league
    python -m tabletalk ratings    --competition premier_league [--strategy prior]
    python -m tabletalk evaluate   --competition premier_league [--seasons 2024-25 2025-26]

``simulate`` is registered but not implemented yet; it arrives with the
LeagueSimulator.
"""

from __future__ import annotations

import argparse
import logging
import sys
from typing import Sequence

import pandas as pd

from .config import ConfigError, available_competitions, load_competition
from .data import (
    check_fixture_list,
    load_matches,
    remaining_fixtures,
    season_progress,
    season_summary,
    team_seasons,
)
from .data.dataset import processed_path
from .data.loaders import available_loaders, build_loaders
from .data.normalise import default_normaliser
from .cli_model import add_model_commands
from .model.promoted import promoted_teams


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------


def cmd_competitions(args: argparse.Namespace) -> int:
    ids = available_competitions()
    if not ids:
        print("No competition configs found in configs/competitions/.")
        return 1
    print(f"{len(ids)} competition config(s):\n")
    for competition_id in ids:
        config = load_competition(competition_id)
        teams = config.league.n_teams if config.league else "-"
        print(f"  {competition_id:<20} {config.name} ({config.country}) "
              f"- {config.format}, {teams} teams, current season {config.current_season}")
    print(f"\nRegistered data loaders: {', '.join(available_loaders())}")
    return 0


def cmd_data_fetch(args: argparse.Namespace) -> int:
    config = load_competition(args.competition)
    matches = load_matches(config, refresh=args.refresh)
    print(f"{config.name}: {len(matches)} matches across {len(config.seasons)} season(s)")
    print(f"written to {processed_path(config)}\n")
    print(season_summary(matches).to_string(index=False))
    return 0


def cmd_data_check(args: argparse.Namespace) -> int:
    """Data-quality report. Run this after adding a season or a new source.

    Each section is its own function below, in the order it is printed.
    """
    config = load_competition(args.competition)
    _report_config(config)
    unknown = _report_team_names(config, refresh=args.refresh)
    matches = load_matches(config, refresh=args.refresh, strict_names=not unknown)
    _report_seasons(matches, config)
    _report_current_season(matches, config)
    _report_fixture_list(matches, config)
    _report_team_history(matches, config)
    _report_assumptions(config)
    return 1 if unknown else 0


def _report_config(config) -> None:
    print(f"=== {config.name} ({config.id}) ===")
    print(f"config:   {config.source_path}")
    print(f"format:   {config.format}, {config.league.n_teams} teams, "
          f"{config.league.matches_per_team} matches each, "
          f"{config.points.win}/{config.points.draw}/{config.points.loss} points")
    print(f"seasons:  {config.seasons[0]} to {config.seasons[-1]} "
          f"({len(config.seasons)}; current: {config.current_season})")


def _report_team_names(config, *, refresh: bool) -> set[str]:
    """Unknown team names, reported all at once rather than failing on the first."""
    normaliser = default_normaliser()
    unknown: set[str] = set()
    for loader in build_loaders(config):
        unknown.update(normaliser.unknown(loader.raw_team_names(refresh=refresh)))
    print("\n--- team names ---")
    if not unknown:
        print("all source team names resolve to a canonical name")
        return unknown
    print(f"{len(unknown)} name(s) missing from configs/team_aliases.yaml:")
    for name in sorted(unknown):
        print(f"  - {name!r}")
    return unknown


def _report_seasons(matches: pd.DataFrame, config) -> None:
    print("\n--- seasons ---")
    summary = season_summary(matches)
    print(summary.to_string(index=False))
    if not config.league:
        return
    expected = config.league.total_matches
    incomplete = summary.loc[summary["played"] != expected, "season"].tolist()
    if incomplete:
        print(f"\nseason(s) not at the full {expected} matches: {', '.join(incomplete)} "
              "(expected for the season in progress)")


def _report_current_season(matches: pd.DataFrame, config) -> None:
    print("\n--- current season ---")
    progress = season_progress(matches, config, config.current_season)
    print(f"{config.current_season}: {progress['played']} played, "
          f"{progress['remaining']} remaining of {progress['total']}")
    print("\n" + _provisional_table(matches, config).to_string(index=False))


def _report_fixture_list(matches: pd.DataFrame, config) -> None:
    print("\n--- fixture list ---")
    problems = check_fixture_list(matches, config, config.current_season)
    if problems:
        print("the loaded schedule does not match the configured format:")
        for problem in problems:
            print(f"  - {problem}")
    else:
        print("schedule matches the configured format "
              f"({config.league.n_teams} teams, {config.league.matches_per_team} matches each, "
              f"{config.league.total_matches} total)")
    upcoming = remaining_fixtures(matches, config)
    if len(upcoming):
        print(f"\nnext fixtures to be simulated ({len(upcoming)} remaining, through "
              f"{upcoming['date'].max():%Y-%m-%d}):")
        print(upcoming.head(5)[["date", "matchday", "home_team", "away_team"]].to_string(index=False))


def _report_team_history(matches: pd.DataFrame, config) -> None:
    """How much top-flight history each of this season's teams has."""
    print("\n--- this season's teams: history in this competition ---")
    counts = team_seasons(matches)
    past = [s for s in config.seasons if s != config.current_season]
    current_teams = counts.index[counts[config.current_season] > 0]
    recent = past[-5:]
    history = counts.loc[current_teams, recent].copy()
    history.insert(0, "seasons", (counts.loc[current_teams, past] > 0).sum(axis=1))
    print(f"(matches per season for the last {len(recent)} seasons; `seasons` counts all "
          f"{len(past)} completed seasons loaded)")
    print(history.sort_values("seasons").to_string())

    promoted = promoted_teams(matches, config.id, config.current_season)
    if promoted:
        strategy = (config.model.get("promoted_teams") or {}).get("strategy", "prior")
        print(f"\npromoted into {config.current_season}: {', '.join(promoted)}")
        print(f"These are rated with the `{strategy}` promoted-team strategy: any older "
              "top-flight spell\nis too far back to count once time decay is applied "
              "(see `python -m tabletalk ratings`).")


def _report_assumptions(config) -> None:
    print("\n--- flagged assumptions in this config ---")
    for assumption in config.assumptions:
        text = " ".join(str(assumption.get("text", "")).split())
        print(f"  [{assumption.get('id')}] {text}")


def _provisional_table(matches: pd.DataFrame, config) -> pd.DataFrame:
    """Points/goal-difference standings, for eyeballing the data only.

    This deliberately does NOT apply the config's tiebreakers - that logic
    belongs to the LeagueSimulator and is built (and unit-tested) in the next
    step. Rows tied on points and goal difference may be in the wrong order.
    """
    season = config.current_season
    played = matches.loc[
        (matches["season"].astype("string") == season) & matches["played"].fillna(False).astype(bool)
    ]
    rows = []
    teams = sorted(set(played["home_team"]) | set(played["away_team"]))
    points = config.points
    for team in teams:
        home = played.loc[played["home_team"] == team]
        away = played.loc[played["away_team"] == team]
        scored = int(home["home_goals"].sum() + away["away_goals"].sum())
        conceded = int(home["away_goals"].sum() + away["home_goals"].sum())
        wins = int((home["home_goals"] > home["away_goals"]).sum() + (away["away_goals"] > away["home_goals"]).sum())
        draws = int((home["home_goals"] == home["away_goals"]).sum() + (away["away_goals"] == away["home_goals"]).sum())
        losses = len(home) + len(away) - wins - draws
        rows.append(
            {
                "team": team,
                "played": len(home) + len(away),
                "w": wins,
                "d": draws,
                "l": losses,
                "gf": scored,
                "ga": conceded,
                "gd": scored - conceded,
                "pts": wins * points.win + draws * points.draw + losses * points.loss,
            }
        )
    table = pd.DataFrame(rows).sort_values(["pts", "gd", "gf"], ascending=False)
    table.insert(0, "pos", range(1, len(table) + 1))
    return table.reset_index(drop=True)


def cmd_simulate(args: argparse.Namespace) -> int:
    print(
        "`simulate` is not implemented yet.\n"
        "It arrives with the LeagueSimulator (tabletalk.simulation), the next step\n"
        "of Phase 1. Available now: `data fetch`, `data check`, `ratings`, `evaluate`.",
        file=sys.stderr,
    )
    return 2


# ---------------------------------------------------------------------------
# Parser
# ---------------------------------------------------------------------------


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m tabletalk",
        description="TableTalk: football competition probabilities from a Dixon-Coles match model.",
    )
    parser.add_argument("-v", "--verbose", action="store_true", help="log what the loaders are doing")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("competitions", help="list the configured competitions").set_defaults(
        func=cmd_competitions
    )

    data_parser = subparsers.add_parser("data", help="fetch and inspect match data")
    data_sub = data_parser.add_subparsers(dest="data_command", required=True)

    fetch = data_sub.add_parser("fetch", help="download and assemble a competition's matches")
    _add_competition_arg(fetch)
    fetch.add_argument("--refresh", action="store_true", help="re-download instead of using the raw cache")
    fetch.set_defaults(func=cmd_data_fetch)

    check = data_sub.add_parser("check", help="data-quality report for a competition")
    _add_competition_arg(check)
    check.add_argument("--refresh", action="store_true", help="re-download instead of using the raw cache")
    check.set_defaults(func=cmd_data_check)

    add_model_commands(subparsers, _add_competition_arg)

    simulate = subparsers.add_parser("simulate", help="simulate a competition (not yet implemented)")
    _add_competition_arg(simulate)
    simulate.add_argument("--n-simulations", type=int, default=None)
    simulate.set_defaults(func=cmd_simulate)

    return parser


def _add_competition_arg(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--competition",
        "-c",
        default="premier_league",
        help="competition id, i.e. a config file stem (default: premier_league)",
    )


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    logging.basicConfig(
        level=logging.INFO if args.verbose else logging.WARNING,
        format="%(levelname)s %(name)s: %(message)s",
    )
    try:
        return int(args.func(args))
    except ConfigError as exc:
        print(f"config error: {exc}", file=sys.stderr)
        return 2
    # Deliberately broad: this is the CLI boundary, where any failure should be
    # reported as one readable line rather than a traceback.
    except Exception as exc:  # noqa: BLE001
        print(f"error: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())

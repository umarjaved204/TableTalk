"""Command-line entry point: ``python -m tabletalk ...``.

Phase 1 commands:

    python -m tabletalk competitions
    python -m tabletalk data fetch --competition premier_league [--refresh]
    python -m tabletalk data check --competition premier_league
    python -m tabletalk data compare-fixtures --all
    python -m tabletalk update [--competitions premier_league serie_a] [--no-refresh]
    python -m tabletalk track-record [--refresh]
    python -m tabletalk ratings    --competition premier_league [--strategy prior]
    python -m tabletalk evaluate   --competition premier_league [--seasons 2024-25 2025-26]
    python -m tabletalk simulate   --competition premier_league [--n-simulations 10000]

The model commands (ratings, evaluate, simulate) live in ``cli_model.py``.
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
from .simulation import league_table


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
        current = config.for_season(config.current_season)
        teams = current.league.n_teams if current.league else "-"
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


def cmd_data_compare_fixtures(args: argparse.Namespace) -> int:
    """Which source should be primary for this season's fixtures?

    Measures the criteria in reports/protocols/step1-fixture-source.md and
    applies its decision rule (written before this was first run).
    """
    from .data.source_comparison import decide, kickoff_disagreements, score_source

    ids = available_competitions() if args.all else [args.competition]
    scores = {}
    for competition_id in ids:
        config = load_competition(competition_id)
        season = config.current_season
        loaders = {
            loader.name: loader for loader in build_loaders(config)
            if loader.name in ("openfootball", "football_data_org")
        }
        reference = next(
            (loader for loader in build_loaders(config, role="results") if loader.name == "football_data_uk"),
            None,
        )
        missing = [name for name in ("openfootball", "football_data_org") if name not in loaders]
        if missing or reference is None:
            raise ConfigError(
                f"{config.id}: compare-fixtures needs openfootball, football_data_org and "
                f"football_data_uk sources in the config; missing {missing or ['football_data_uk']}"
            )
        results = reference.load(refresh=args.refresh)
        frames = {name: loaders[name].load(refresh=args.refresh) for name in ("openfootball", "football_data_org")}
        pair = tuple(
            score_source(name, frames[name], results, config, season,
                         kickoffs_in_utc=loaders[name].kickoff_times_in_utc)
            for name in ("openfootball", "football_data_org")
        )
        scores[config.id] = pair
        _print_comparison(config, season, pair, kickoff_disagreements(
            frames["openfootball"], frames["football_data_org"], season))

    primary, reasons = decide(scores)
    print("\n=== decision (rule in reports/protocols/step1-fixture-source.md) ===")
    for reason in reasons:
        print(f"  {reason}")
    print(f"primary fixture source: {primary}")
    return 0


def _print_comparison(config, season, pair, disagreements) -> None:
    print(f"\n=== {config.name} {season} ===")
    rows = [
        ("matches listed", *(score.matches for score in pair)),
        ("C1 schedule passes checks", *("yes" if s.c1_pass else f"NO ({len(s.c1_problems)})" for s in pair)),
        ("C2 played-date mismatches", *(f"{len(s.c2_mismatches)} of {s.c2_compared}" for s in pair)),
        ("C3 confirmed UTC kick-offs", *(f"{s.c3_confirmed_utc} of {s.c3_upcoming}" for s in pair)),
        ("C4 marks postponements", *("yes" if s.c4_explicit_postponements else "no" for s in pair)),
        ("postponed right now", *(s.postponed_now for s in pair)),
    ]
    print(pd.DataFrame(rows, columns=["criterion", *(s.source for s in pair)]).to_string(index=False))
    for score in pair:
        for problem in score.c1_problems:
            print(f"  C1 {score.source}: {problem}")
        if len(score.c2_mismatches):
            print(f"  C2 {score.source}, first date mismatches:")
            print(score.c2_mismatches.head(10).to_string(index=False))
    print(f"upcoming matches where the UTC kick-offs differ: {len(disagreements)} "
          "(openfootball converted from local time; recheck once played)")
    if len(disagreements):
        print(disagreements.rename(columns={"kickoff_a": "openfootball", "kickoff_b": "football_data_org"})
              .head(10).to_string(index=False))


def cmd_update(args: argparse.Namespace) -> int:
    """The daily cycle for every league: fetch, check, refit, simulate, write."""
    from pathlib import Path

    from .pipeline.update import DEFAULT_OUTPUT_DIR, run_update, updated_today

    out_dir = Path(args.out) if args.out else DEFAULT_OUTPUT_DIR
    if args.skip_if_updated_today and updated_today(out_dir):
        print("today's run already updated every league; nothing to do")
        return 0
    outcomes = run_update(
        args.competitions or None, out_dir=out_dir, refresh=not args.no_refresh,
        n_simulations=args.n_simulations, stale_after=pd.Timedelta(days=args.stale_after_days),
    )
    print((out_dir / "latest" / "run_report.md").read_text(encoding="utf-8"))
    print(f"outputs in {out_dir}")
    return 0 if outcomes.ok else 1


def cmd_track_record(args: argparse.Namespace) -> int:
    """Score the locked predictions that have results, and write the track record."""
    from pathlib import Path

    from .pipeline.locks import LockStore
    from .pipeline.track_record import render, write_track_record
    from .pipeline.update import DEFAULT_OUTPUT_DIR

    out_dir = Path(args.out) if args.out else DEFAULT_OUTPUT_DIR
    store = LockStore(out_dir / "track_record")
    summary = write_track_record(store, out_dir, generated_at=pd.Timestamp.now(tz="UTC").floor("s"), refresh=args.refresh)
    print(render(summary))
    print(f"written to {store.directory}")
    return 0


def _report_config(config) -> None:
    print(f"=== {config.name} ({config.id}) ===")
    print(f"config:   {config.source_path}")
    current = config.for_season(config.current_season)
    print(f"format:   {current.format}, {current.league.n_teams} teams, "
          f"{current.league.matches_per_team} matches each, "
          f"{current.points.win}/{current.points.draw}/{current.points.loss} points ({config.current_season} rules)")
    changes = config.raw.get("rule_changes") or []
    if changes:
        print(f"rules:    {len(changes)} change(s) over the seasons loaded (config `rule_changes`)")
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
    # Each season is checked against its own rules: team counts can change.
    for season, played in zip(summary["season"], summary["played"]):
        rules = config.for_season(season)
        expected = rules.league.total_matches
        if played == expected:
            continue
        if season == config.current_season:
            print(f"\n{season}: {played} of {expected} matches played (the season in progress)")
        elif rules.completed_early:
            print(f"\n{season}: {played} of {expected} matches, as expected: the season was "
                  f"stopped early and ranked by {rules.ranking.replace('_', ' ')}")
        else:
            print(f"\n{season}: {played} matches, but that season's rules imply {expected}: check the data")


def _report_current_season(matches: pd.DataFrame, config) -> None:
    print("\n--- current season ---")
    progress = season_progress(matches, config, config.current_season)
    print(f"{config.current_season}: {progress['played']} played, "
          f"{progress['remaining']} remaining of {progress['total']}")
    print("\n" + league_table(matches, config).to_string(index=False))


def _report_fixture_list(matches: pd.DataFrame, config) -> None:
    print("\n--- fixture list ---")
    problems = check_fixture_list(matches, config, config.current_season)
    if problems:
        print("the loaded schedule does not match the configured format:")
        for problem in problems:
            print(f"  - {problem}")
    else:
        league = config.for_season(config.current_season).league
        print("schedule matches the configured format "
              f"({league.n_teams} teams, {league.matches_per_team} matches each, "
              f"{league.total_matches} total)")
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

    compare = data_sub.add_parser(
        "compare-fixtures", help="compare openfootball and football-data.org as the fixture source"
    )
    _add_competition_arg(compare)
    compare.add_argument("--all", action="store_true", help="all configured competitions")
    compare.add_argument("--refresh", action="store_true", help="re-download instead of using the raw cache")
    compare.set_defaults(func=cmd_data_compare_fixtures)

    add_model_commands(subparsers, _add_competition_arg)

    update = subparsers.add_parser(
        "update", help="daily cycle: fetch, check, refit, simulate and write snapshots for every league"
    )
    update.add_argument("--competitions", nargs="*", default=None, help="default: every configured league")
    update.add_argument("--out", default=None, help="output directory (default: outputs/)")
    update.add_argument("--no-refresh", action="store_true", help="use cached data only (no downloads)")
    update.add_argument("--n-simulations", type=int, default=None, help="default: from each config")
    update.add_argument(
        "--stale-after-days", type=float, default=2.0,
        help="flag a league when a match that kicked off this long ago has no result (default: 2)",
    )
    update.add_argument(
        "--skip-if-updated-today", action="store_true",
        help="do nothing if today's run already updated every league (the scheduled backup run)",
    )
    update.set_defaults(func=cmd_update)

    track = subparsers.add_parser("track-record", help="score locked predictions against results")
    track.add_argument("--out", default=None, help="output directory (default: outputs/)")
    track.add_argument("--refresh", action="store_true", help="download the latest results and odds first")
    track.set_defaults(func=cmd_track_record)

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

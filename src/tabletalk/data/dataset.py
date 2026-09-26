"""Assembling one competition's match history.

``load_matches(config)`` is what the rest of the project calls: it runs every
loader the config lists, stacks the results into the standard schema, and writes
a copy to ``data/processed/`` for notebooks and inspection.

The processed file is an output, never an input: each call rebuilds from the raw
cache, so there is no way to be looking at a stale dataset without knowing it.
Reading six local CSVs takes milliseconds; a confusing cache is expensive.
"""

from __future__ import annotations

import logging
from pathlib import Path

import pandas as pd

from ..config import CompetitionConfig, load_competition
from ..paths import PROCESSED_DATA_DIR, ensure_dir
from .loaders import build_loaders
from .reconcile import combine_results_and_fixtures
from .schema import empty_match_frame, validate_matches

logger = logging.getLogger(__name__)


def processed_path(config: CompetitionConfig) -> Path:
    return PROCESSED_DATA_DIR / f"{config.id}_matches.csv"


def load_matches(
    config: CompetitionConfig | str,
    *,
    refresh: bool = False,
    strict_names: bool = True,
    save: bool = True,
) -> pd.DataFrame:
    """Every match this competition's sources provide, in the standard schema.

    Args:
        config: a CompetitionConfig or a competition id.
        refresh: re-download from the source instead of using the raw cache.
            Needed during a live season to pick up recent results.
        strict_names: fail on team names missing from the alias map. Set False
            only for diagnostics (``tabletalk data check``).
        save: also write the assembled frame to ``data/processed/``.
    """
    if isinstance(config, str):
        config = load_competition(config)

    # Results sources give scores; fixture sources give the published schedule.
    results = _load_role(config, "results", refresh=refresh, strict_names=strict_names)
    fixtures = _load_role(config, "fixtures", refresh=refresh, strict_names=strict_names)

    results = validate_matches(results, source=f"{config.id} results")
    if fixtures.empty:
        logger.warning(
            "%s: no `role: fixtures` data source, so no upcoming fixtures are loaded; "
            "the competition cannot be simulated mid-season",
            config.id,
        )
        matches = results
    else:
        fixtures = validate_matches(fixtures, source=f"{config.id} fixtures")
        matches = combine_results_and_fixtures(results, fixtures, config)
    if save:
        path = processed_path(config)
        ensure_dir(path.parent)
        matches.to_csv(path, index=False, date_format="%Y-%m-%d")
        logger.info("%s: wrote %d matches to %s", config.id, len(matches), path)
    return matches


def load_context_matches(
    config: CompetitionConfig | str,
    *,
    refresh: bool = False,
    strict_names: bool = True,
) -> pd.DataFrame:
    """Results from related competitions (``role: context``), for model fitting only.

    Kept out of :func:`load_matches` on purpose: everything that tabulates,
    checks fixtures or simulates works on the competition's own matches, and a
    Championship row there would be a bug. The match model is the only consumer.
    Returns an empty frame when the config lists no context sources.
    """
    if isinstance(config, str):
        config = load_competition(config)
    context = _load_role(config, "context", refresh=refresh, strict_names=strict_names)
    if context.empty:
        return context
    return validate_matches(context, source=f"{config.id} context data")


def _load_role(
    config: CompetitionConfig, role: str, *, refresh: bool, strict_names: bool
) -> pd.DataFrame:
    """Load and stack every source with the given role, in config order."""
    frames = []
    for loader in build_loaders(config, role=role):
        frame = loader.load(refresh=refresh, strict_names=strict_names)
        logger.info("%s: loaded %d %s rows via %s", config.id, len(frame), role, loader.name)
        frames.append(frame)
    if not frames:
        return empty_match_frame()
    stacked = pd.concat(frames, ignore_index=True)
    # Sources with the same role can overlap; the first one in config order wins.
    before = len(stacked)
    stacked = stacked.drop_duplicates(
        subset=["competition", "season", "date", "home_team", "away_team"], keep="first"
    )
    if len(stacked) < before:
        logger.info(
            "%s: dropped %d overlapping %s row(s) between sources",
            config.id,
            before - len(stacked),
            role,
        )
    return stacked


def filter_matches(
    matches: pd.DataFrame,
    *,
    season: str | None = None,
    seasons: list[str] | None = None,
    before: str | pd.Timestamp | None = None,
    played_only: bool = False,
    team: str | None = None,
) -> pd.DataFrame:
    """Convenience filters used by the model, the simulators and the backtests.

    ``before`` is exclusive and is how backtests avoid leakage: fit on
    ``filter_matches(m, before="2025-01-01")`` and nothing after that date can
    influence the model.
    """
    out = matches
    if season is not None:
        out = out.loc[out["season"].astype("string") == season]
    if seasons is not None:
        out = out.loc[out["season"].astype("string").isin(seasons)]
    if before is not None:
        out = out.loc[out["date"] < pd.Timestamp(before)]
    if played_only:
        out = out.loc[out["played"].fillna(False).astype(bool)]
    if team is not None:
        out = out.loc[(out["home_team"] == team) | (out["away_team"] == team)]
    return out.reset_index(drop=True)


def season_summary(matches: pd.DataFrame) -> pd.DataFrame:
    """One row per season: matches, teams, date range, goals per game.

    A quick data-quality read: a season with the wrong number of matches, a
    surprising team count or an implausible goals-per-game figure points at a
    loading or normalisation problem before any modelling happens.
    """
    rows = []
    for season, group in matches.groupby(matches["season"].astype("string"), sort=True):
        played = group.loc[group["played"].fillna(False).astype(bool)]
        teams = pd.concat([group["home_team"], group["away_team"]]).dropna().nunique()
        home_goals = played["home_goals"].astype("float")
        away_goals = played["away_goals"].astype("float")
        rows.append(
            {
                "season": season,
                "matches": len(group),
                "played": len(played),
                "teams": int(teams),
                "first_match": played["date"].min(),
                "last_match": played["date"].max(),
                "goals_per_game": round(float((home_goals + away_goals).mean()), 3),
                "home_goals_per_game": round(float(home_goals.mean()), 3),
                "away_goals_per_game": round(float(away_goals.mean()), 3),
                "home_win_pct": round(float((home_goals > away_goals).mean()) * 100, 1),
                "draw_pct": round(float((home_goals == away_goals).mean()) * 100, 1),
                "away_win_pct": round(float((home_goals < away_goals).mean()) * 100, 1),
            }
        )
    return pd.DataFrame(rows)


def team_seasons(matches: pd.DataFrame) -> pd.DataFrame:
    """Matches played per team per season.

    Used to spot promoted teams: a team with no rows in earlier seasons has no
    history in this competition, which the match model must handle explicitly
    rather than treating as an average team.
    """
    played = matches.loc[matches["played"].fillna(False).astype(bool)]
    long = pd.concat(
        [
            played[["season", "home_team"]].rename(columns={"home_team": "team"}),
            played[["season", "away_team"]].rename(columns={"away_team": "team"}),
        ]
    )
    counts = long.groupby(["team", "season"], observed=True).size().unstack(fill_value=0)
    return counts.sort_index()

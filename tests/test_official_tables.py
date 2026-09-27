"""Every rebuilt final table must match the official one, for every league and season.

The official tables live in ``tests/data/<competition>_official_tables.csv``,
fetched from Wikipedia's structured season tables by
``scripts/fetch_official_tables.py``. Matching them exactly, finishing order
included, checks the results data, the team-name mapping, each league's
configured tiebreakers and the points-deductions file at the same time.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

from tabletalk.config import load_competition

DATA = Path(__file__).parent / "data"
COMPETITIONS = sorted(path.name.removesuffix("_official_tables.csv") for path in DATA.glob("*_official_tables.csv"))
COLUMNS = ["team", "won", "drawn", "lost", "goals_for", "goals_against", "points"]


@pytest.fixture(scope="module", params=COMPETITIONS)
def league(request):
    from tabletalk.data import load_matches
    from tabletalk.data.loaders import build_loaders

    config = load_competition(request.param)
    for loader in build_loaders(config, role="results"):
        if any(not loader.cache_path(season).exists() for season in loader.seasons):
            pytest.skip(f"raw data not cached; run `python -m tabletalk data fetch -c {config.id}` first")
    official = pd.read_csv(DATA / f"{config.id}_official_tables.csv")
    return config, load_matches(config, save=False), official


def test_every_completed_season_is_covered(league):
    config, _, official = league
    completed = [season for season in config.seasons if season != config.current_season]
    assert sorted(official["season"].unique()) == sorted(completed)


def test_every_final_table_matches_the_official_one(league):
    from tabletalk.simulation import league_table

    config, matches, official = league
    for season, table in official.groupby("season"):
        rebuilt = league_table(matches, config, season)[COLUMNS]
        expected = table.sort_values("position")[COLUMNS]
        assert [tuple(row) for row in rebuilt.itertuples(index=False, name=None)] == [
            tuple(row) for row in expected.itertuples(index=False, name=None)
        ], f"{config.id} {season}"


def test_official_adjustments_are_all_in_the_deductions_file(league):
    """Every points adjustment in an official table is a recorded deduction."""
    from tabletalk.data.deductions import load_points_deductions

    config, _, official = league
    recorded = load_points_deductions()
    recorded = recorded.loc[recorded["competition"] == config.id].groupby(["season", "team"])["points"].sum()
    adjusted = official.loc[official["points_adjustment"] != 0].set_index(["season", "team"])["points_adjustment"]
    assert adjusted.sort_index().to_dict() == recorded[recorded != 0].sort_index().to_dict()

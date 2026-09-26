"""Schema validation, season labels and the results loader."""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

from conftest import make_matches
from tabletalk.data.loaders.football_data_uk import FootballDataUKLoader
from tabletalk.data.schema import MATCH_COLUMNS, SchemaError, validate_matches
from tabletalk.data.seasons import Season, canonical_season

# ---------------------------------------------------------------------------
# Season labels
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "label, start_year, code",
    [("2025-26", 2025, "2526"), ("2021-22", 2021, "2122"), ("1999-00", 1999, "9900")],
)
def test_season_parsing(label, start_year, code):
    season = Season.parse(label)
    assert season.start_year == start_year
    assert season.label == label
    assert season.football_data_code == code


def test_single_calendar_year_season():
    season = Season.parse("2026")
    assert not season.spans_two_years
    with pytest.raises(ValueError, match="two-year seasons"):
        season.football_data_code


@pytest.mark.parametrize("label", ["2025-27", "not a season", "25-26", ""])
def test_bad_season_labels_rejected(label):
    with pytest.raises(ValueError):
        Season.parse(label)


def test_canonical_season_accepts_slash_form():
    assert canonical_season("2025/26") == "2025-26"


# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------


def test_validate_matches_sorts_and_types():
    frame = make_matches([("B", "A", 1, 1), ("A", "B", 2, 0)])
    frame.loc[0, "date"] = pd.Timestamp("2025-09-01")
    frame.loc[1, "date"] = pd.Timestamp("2025-08-01")
    out = validate_matches(frame)
    assert list(out["home_team"]) == ["A", "B"]  # sorted by date
    assert str(out["home_goals"].dtype) == "Int64"
    assert list(out.columns) == list(MATCH_COLUMNS)


def test_played_match_without_score_is_rejected():
    frame = make_matches([("A", "B", 1, 0)])
    frame.loc[0, "home_goals"] = None
    with pytest.raises(SchemaError, match="without a full-time score"):
        validate_matches(frame)


def test_unplayed_fixture_with_score_is_rejected():
    frame = make_matches([("A", "B", None, None)])
    frame.loc[0, "home_goals"] = 2
    frame.loc[0, "away_goals"] = 1
    with pytest.raises(SchemaError, match="carry a score"):
        validate_matches(frame)


def test_unplayed_fixture_may_have_no_date():
    frame = make_matches([("A", "B", None, None)])
    assert pd.isna(validate_matches(frame).loc[0, "date"])


def test_team_playing_itself_is_rejected():
    with pytest.raises(SchemaError, match="playing themselves"):
        validate_matches(make_matches([("A", "A", 1, 1)]))


def test_duplicate_fixture_is_rejected():
    frame = make_matches([("A", "B", 1, 0), ("A", "B", 1, 0)])
    frame.loc[1, "date"] = frame.loc[0, "date"]
    with pytest.raises(SchemaError, match="duplicate fixture"):
        validate_matches(frame)


def test_same_pairing_on_different_dates_is_allowed():
    """Leagues with four meetings per pair, and cup re-matches, are legitimate."""
    frame = make_matches([("A", "B", 1, 0), ("A", "B", 2, 2)])
    assert len(validate_matches(frame)) == 2


def test_missing_column_is_rejected():
    frame = make_matches([("A", "B", 1, 0)]).drop(columns=["neutral"])
    with pytest.raises(SchemaError, match="missing column"):
        validate_matches(frame)


# ---------------------------------------------------------------------------
# football-data.co.uk loader (offline: reads a CSV we write ourselves)
# ---------------------------------------------------------------------------

_SAMPLE_CSV = """Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,FTR,B365H
E0,15/08/2025,20:00,Liverpool,Bournemouth,4,2,H,1.30
E0,16/08/2025,12:30,Aston Villa,Newcastle,0,0,D,2.10
E0,16/08/2025,15:00,Man United,Arsenal,0,1,A,2.75
E0,17/08/2025,14:00,Nott'm Forest,Brentford,3,1,H,1.95
E0,23/08/2026,15:00,Wolves,Spurs,,,,2.50
,,,,,,,,
"""


@pytest.fixture
def loader(tmp_path: Path) -> FootballDataUKLoader:
    cache = tmp_path / "raw"
    cache.mkdir()
    (cache / "E0_2526.csv").write_text(_SAMPLE_CSV, encoding="utf-8")
    return FootballDataUKLoader(
        "premier_league", division="E0", seasons=["2025-26"], cache_dir=str(cache)
    )


def test_loader_url_and_cache_path(loader):
    season = Season.parse("2025-26")
    assert loader.csv_url(season).endswith("/mmz4281/2526/E0.csv")
    assert loader.cache_path(season).name == "E0_2526.csv"


def test_loader_produces_standard_schema(loader):
    matches = loader.load()
    assert list(matches.columns)[: len(MATCH_COLUMNS)] == list(MATCH_COLUMNS)
    # Four played results; the scoreless row and the blank row are dropped.
    assert len(matches) == 4
    assert matches["played"].all()
    assert matches["competition"].unique().tolist() == ["premier_league"]
    assert matches["season"].unique().tolist() == ["2025-26"]
    assert not matches["neutral"].any()


def test_loader_normalises_team_names(loader):
    names = set(loader.load()["home_team"]) | set(loader.load()["away_team"])
    assert "Manchester United" in names and "Man United" not in names
    assert "Nottingham Forest" in names
    assert "Bournemouth" in names


def test_loader_reads_dates_day_first(loader):
    matches = loader.load()
    first = matches.iloc[0]
    assert first["date"] == pd.Timestamp("2025-08-15")
    assert (first["home_team"], first["home_goals"], first["away_goals"]) == ("Liverpool", 4, 2)


def test_loader_reports_raw_names_for_alias_upkeep(loader):
    assert "Man United" in loader.raw_team_names()



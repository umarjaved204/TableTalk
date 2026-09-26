"""Config loading and validation.

These tests exist because a config mistake (a zone pointing at position 21, a
tiebreaker spelled wrong) would otherwise show up as a confusing crash or, worse,
as plausible-looking wrong probabilities.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from tabletalk.config import (
    KNOWN_TIEBREAKERS,
    ConfigError,
    LeagueFormat,
    available_competitions,
    load_competition,
)


def test_premier_league_config_loads(premier_league):
    config = premier_league
    assert config.id == "premier_league"
    assert config.format == "league"
    assert config.league.n_teams == 20
    assert config.league.matches_per_team == 38
    assert config.league.total_matches == 380
    assert (config.points.win, config.points.draw, config.points.loss) == (3, 1, 0)


def test_premier_league_tiebreakers_are_in_published_order(premier_league):
    """Rule C.17: goal difference, then goals scored, then head-to-head."""
    assert premier_league.tiebreakers[:4] == (
        "goal_difference",
        "goals_scored",
        "head_to_head_points",
        "head_to_head_away_goals",
    )
    assert all(t in KNOWN_TIEBREAKERS for t in premier_league.tiebreakers)


def test_premier_league_zones(premier_league):
    assert premier_league.zone("title").positions == (1,)
    assert premier_league.zone("relegation").positions == (18, 19, 20)
    assert premier_league.zone("top_four").positions == (1, 2, 3, 4)
    # Every zone documented enough to print in a report.
    for zone in premier_league.zones:
        assert zone.label


def test_every_shipped_config_is_valid():
    ids = available_competitions()
    assert "premier_league" in ids
    for competition_id in ids:
        load_competition(competition_id)  # raises on any problem


def test_league_format_rejects_inconsistent_numbers():
    with pytest.raises(ConfigError, match="inconsistent"):
        LeagueFormat.from_dict({"n_teams": 20, "meetings_per_pair": 2, "matches_per_team": 34})


def test_league_format_allows_non_round_robin():
    """The Champions League league phase: 36 teams, 8 matches, not a round robin."""
    fmt = LeagueFormat.from_dict({"n_teams": 36, "meetings_per_pair": 0, "matches_per_team": 8})
    assert not fmt.is_round_robin
    assert fmt.total_matches == 144


def _write(tmp_path: Path, body: str, stem: str = "broken") -> Path:
    directory = tmp_path / "competitions"
    directory.mkdir(exist_ok=True)
    (directory / f"{stem}.yaml").write_text(body, encoding="utf-8")
    return directory


_VALID_BODY = """
id: broken
name: Broken League
format: league
league: {n_teams: 4, meetings_per_pair: 2, matches_per_team: 6}
points: {win: 3, draw: 1, loss: 0}
tiebreakers: [goal_difference]
zones: [{id: title, positions: [1]}]
data:
  current_season: "2025-26"
  sources: [{loader: football_data_uk, params: {division: XX, seasons: ["2025-26"]}}]
"""


def test_valid_minimal_config(tmp_path):
    directory = _write(tmp_path, _VALID_BODY)
    assert load_competition("broken", config_dir=directory).name == "Broken League"


@pytest.mark.parametrize(
    "replacement, expected_message",
    [
        ("tiebreakers: [goals_difference]", "unknown tiebreaker"),
        ("zones: [{id: title, positions: [5]}]", "outside 1..4"),
        ("zones: [{id: a, positions: [1]}, {id: a, positions: [2]}]", "duplicate zone id"),
        ("format: elimination", "not supported"),
        ('  current_season: "2030-31"', "not among the seasons"),
    ],
)
def test_invalid_configs_are_rejected(tmp_path, replacement, expected_message):
    key = replacement.split(":")[0].strip()
    body = "\n".join(
        replacement if line.strip().startswith(key) else line for line in _VALID_BODY.splitlines()
    )
    directory = _write(tmp_path, body)
    with pytest.raises(ConfigError, match=expected_message):
        load_competition("broken", config_dir=directory)


def test_config_id_must_match_filename(tmp_path):
    directory = _write(tmp_path, _VALID_BODY.replace("id: broken", "id: other"))
    with pytest.raises(ConfigError, match="does not match filename"):
        load_competition("broken", config_dir=directory)


def test_missing_config_lists_alternatives(tmp_path):
    directory = _write(tmp_path, _VALID_BODY)
    with pytest.raises(ConfigError, match="Available: broken"):
        load_competition("does_not_exist", config_dir=directory)

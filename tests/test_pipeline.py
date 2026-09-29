"""The daily update: safety checks, awarded matches, snapshots and writing.

Offline. The end-to-end test uses the cached Premier League data and is
skipped when it is not there.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from conftest import make_matches
from tabletalk.data.awarded import AwardedResultError, load_awarded_results
from tabletalk.data.reconcile import check_scores_agree
from tabletalk.pipeline import checks
from tabletalk.pipeline.awarded import review_awarded
from tabletalk.pipeline.snapshot import config_hash, run_seed, validate
from tabletalk.pipeline.update import LeagueOutcome, write_outputs
from tabletalk.simulation import league_table

# ---------------------------------------------------------------------------
# Seeds and config hash
# ---------------------------------------------------------------------------


def test_seed_is_fixed_by_date_and_competition():
    assert run_seed("2026-09-29", "serie_a") == run_seed("2026-09-29", "serie_a")
    assert run_seed("2026-09-29", "serie_a") != run_seed("2026-09-30", "serie_a")
    assert run_seed("2026-09-29", "serie_a") != run_seed("2026-09-29", "ligue_1")


def test_config_hash_ignores_line_endings_but_not_content(tmp_path):
    unix, windows = tmp_path / "a.yaml", tmp_path / "b" / "a.yaml"
    windows.parent.mkdir()
    unix.write_bytes(b"points:\n  win: 3\n")
    windows.write_bytes(b"points:\r\n  win: 3\r\n")
    assert config_hash([unix]) == config_hash([windows])
    windows.write_bytes(b"points:\r\n  win: 2\r\n")
    assert config_hash([unix]) != config_hash([windows])


# ---------------------------------------------------------------------------
# Safety checks: each must catch the problem it is for
# ---------------------------------------------------------------------------


def _predictions(**changes):
    frame = pd.DataFrame(
        {"home_team": ["A"], "away_team": ["B"], "p_home": [0.5], "p_draw": [0.3], "p_away": [0.2],
         "expected_home_goals": [1.5], "expected_away_goals": [1.0]}
    )
    return frame.assign(**changes)


def test_match_probabilities_that_sum_to_one_pass():
    assert checks.check_match_predictions(_predictions()) == []


def test_match_probabilities_that_do_not_sum_to_one_fail():
    assert "do not sum to 1" in checks.check_match_predictions(_predictions(p_away=[0.25]))[0]


def test_non_positive_expected_goals_fail():
    assert checks.check_match_predictions(_predictions(expected_home_goals=[0.0]))


def _simulation(four_team_config, positions=None, zones=None, expected=None):
    teams = ["A", "B", "C", "D"]
    positions = positions if positions is not None else pd.DataFrame(np.eye(4), index=teams, columns=range(1, 5))
    if zones is None:
        zones = pd.DataFrame({"title": positions[1], "relegation": positions[4]})
    expected = expected if expected is not None else pd.Series([10.0, 8.0, 6.0, 4.0], index=teams)
    return checks.check_simulation(
        positions, zones, four_team_config,
        expected_points=expected, points_now=pd.Series(3.0, index=teams), matches_left=pd.Series(3.0, index=teams),
    )


def test_a_consistent_simulation_passes(four_team_config):
    assert _simulation(four_team_config) == []


def test_a_position_distribution_that_does_not_sum_to_one_fails(four_team_config):
    positions = pd.DataFrame(np.eye(4) * 0.9, index=list("ABCD"), columns=range(1, 5))
    assert any("do not sum to 1" in p for p in _simulation(four_team_config, positions=positions))


def test_a_title_chance_above_a_wider_zone_fails(tmp_path):
    from tabletalk.config import load_competition

    directory = tmp_path / "competitions"
    directory.mkdir()
    (directory / "toy.yaml").write_text(
        """
id: toy
name: Toy
country: Nowhere
format: league
league: {n_teams: 4, meetings_per_pair: 2, matches_per_team: 6}
points: {win: 3, draw: 1, loss: 0}
tiebreakers: [goal_difference]
zones:
  - {id: title, label: Title, positions: [1]}
  - {id: top_two, label: Top two, positions: [1, 2]}
data:
  current_season: "2025-26"
  sources: [{loader: football_data_uk, params: {division: XX, seasons: ["2025-26"]}}]
""",
        encoding="utf-8",
    )
    config = load_competition("toy", config_dir=directory)
    positions = pd.DataFrame(np.eye(4), index=list("ABCD"), columns=range(1, 5))
    zones = pd.DataFrame({"title": [1.0, 0.0, 0.0, 0.0], "top_two": [0.9, 0.6, 0.5, 0.0]}, index=list("ABCD"))
    problems = _simulation(config, positions=positions, zones=zones)
    assert any("P(title) is higher than P(top_two)" in p for p in problems)


def test_zone_probabilities_that_do_not_add_up_fail(four_team_config):
    positions = pd.DataFrame(np.eye(4), index=list("ABCD"), columns=range(1, 5))
    zones = pd.DataFrame({"title": [1.0, 0.5, 0.0, 0.0], "relegation": [0.0, 0.0, 0.0, 1.0]}, index=list("ABCD"))
    assert any("zone title" in p for p in _simulation(four_team_config, positions=positions, zones=zones))


def test_impossible_expected_points_fail(four_team_config):
    expected = pd.Series([20.0, 8.0, 6.0, 4.0], index=list("ABCD"))  # 3 now + 3 matches x 3 = 12 at most
    assert any("expected points" in p for p in _simulation(four_team_config, expected=expected))


def _toy_results():
    return make_matches([("A", "B", 2, 1), ("C", "D", 0, 0), ("B", "C", 1, 3), ("D", "A", 2, 2)])


def test_a_table_built_from_the_results_passes(four_team_config):
    matches = _toy_results()
    table = league_table(matches, four_team_config, "2025-26")
    assert checks.check_table(table, matches, four_team_config, "2025-26") == []


def test_a_table_that_does_not_match_the_results_fails(four_team_config):
    matches = _toy_results()
    table = league_table(matches, four_team_config, "2025-26")
    table.loc[table["team"] == "A", "points"] += 3
    problems = checks.check_table(table, matches, four_team_config, "2025-26")
    assert any("A: table says" in p and "points" in p for p in problems)


def test_a_table_missing_a_result_fails(four_team_config):
    matches = _toy_results()
    table = league_table(matches.iloc[1:], four_team_config, "2025-26")
    assert checks.check_table(table, matches, four_team_config, "2025-26")


def test_a_fixture_list_that_does_not_match_the_config_fails(four_team_config):
    assert checks.check_fixtures(_toy_results(), four_team_config, "2025-26")


# ---------------------------------------------------------------------------
# Awarded matches (rule agreed 2026-09-29)
# ---------------------------------------------------------------------------


def _uk_and_api(api_score=(3, 0)):
    uk = make_matches([("A", "B", 0, 0), ("C", "D", 1, 0)])
    uk["source"] = "football_data_uk"
    api = make_matches([("A", "B", *api_score), ("C", "D", 1, 0)])
    api["status"] = ["AWARDED", "FINISHED"]
    api["source"] = "football_data_org"
    return uk, api


_NO_RECORDS = load_awarded_results().iloc[0:0]


def test_an_awarded_score_and_a_played_score_are_not_a_source_mismatch():
    uk, api = _uk_and_api()
    check_scores_agree([("uk", uk), ("org", api)], label="toy")  # does not raise


def test_unconfirmed_awarded_match_is_provisional_in_the_table_and_played_in_the_model(four_team_config):
    uk, api = _uk_and_api()
    review = review_awarded(four_team_config, uk, api, recorded=_NO_RECORDS)
    assert review.provisional
    ab = lambda frame: frame.loc[(frame["home_team"] == "A") & (frame["away_team"] == "B")].iloc[0]  # noqa: E731
    assert (ab(review.table_matches)["home_goals"], ab(review.table_matches)["away_goals"]) == (3, 0)
    assert (ab(review.model_matches)["home_goals"], ab(review.model_matches)["away_goals"]) == (0, 0)
    assert review.matches[0].played_score == (0, 0)


def test_awarded_match_only_the_api_has_is_left_out_of_the_model(four_team_config):
    _, api = _uk_and_api()
    review = review_awarded(four_team_config, api, api, recorded=_NO_RECORDS)
    assert len(review.table_matches) == 2
    assert len(review.model_matches) == 1  # the AWARDED score never reaches the model
    assert review.model_matches.iloc[0]["home_team"] == "C"


def test_confirmed_awarded_match_is_not_provisional(four_team_config):
    uk, api = _uk_and_api()
    recorded = pd.DataFrame([{
        "competition": "toy_league", "season": "2025-26", "home_team": "A", "away_team": "B",
        "home_goals": 3, "away_goals": 0, "date_applied": pd.Timestamp("2025-08-10"), "source": "x",
        "reason": "x", "result": None,
    }])
    review = review_awarded(four_team_config, uk, api, recorded=recorded)
    assert not review.provisional
    assert review.matches[0].confirmed
    # The table gets the awarded score from the file (as for past seasons), not here.
    assert review.table_matches.equals(uk)


def test_draft_entry_cannot_be_pasted_unchecked(four_team_config, tmp_path):
    uk, api = _uk_and_api()
    draft = review_awarded(four_team_config, uk, api, recorded=_NO_RECORDS).draft_entries("toy_league")
    assert "TO FILL IN" in draft and "home_goals: 3" in draft
    path = tmp_path / "awarded.yaml"
    path.write_text("awarded:\n" + draft, encoding="utf-8")
    with pytest.raises(AwardedResultError, match="draft placeholders"):
        load_awarded_results(path)


# ---------------------------------------------------------------------------
# Writing: a failed league keeps its previous files
# ---------------------------------------------------------------------------


def _snapshot(competition: str, generated_at: str) -> dict:
    return {"generated_at": generated_at, "data_through": "2026-09-20", "provisional": False,
            "competition": competition, "upcoming_matches": []}


def test_a_failed_league_keeps_its_previous_file_and_the_index_says_so(tmp_path):
    first = pd.Timestamp("2026-09-28T04:00:00Z")
    write_outputs(
        [LeagueOutcome("aa", "A league", snapshot=_snapshot("aa", "2026-09-28T04:00:00Z")),
         LeagueOutcome("bb", "B league", snapshot=_snapshot("bb", "2026-09-28T04:00:00Z"))],
        out_dir=tmp_path, generated_at=first,
    )
    before = (tmp_path / "latest" / "bb.json").read_bytes()

    second = pd.Timestamp("2026-09-29T04:00:00Z")
    history = write_outputs(
        [LeagueOutcome("aa", "A league", snapshot=_snapshot("aa", "2026-09-29T04:00:00Z")),
         LeagueOutcome("bb", "B league", error="SafetyCheckError: bb: table does not match")],
        out_dir=tmp_path, generated_at=second,
    )
    assert (tmp_path / "latest" / "bb.json").read_bytes() == before
    assert not (history / "bb.json").exists()
    index = json.loads((tmp_path / "latest" / "index.json").read_text(encoding="utf-8"))
    status = {entry["id"]: entry for entry in index["competitions"]}
    assert status["aa"]["status"] == "updated"
    assert status["bb"]["status"] == "kept_previous"
    assert status["bb"]["snapshot_generated_at"] == "2026-09-28T04:00:00Z"
    assert "table does not match" in status["bb"]["error"]
    # Both runs are in the history; no half-written files are left behind.
    assert len(list((tmp_path / "history").iterdir())) == 2
    assert not list(tmp_path.rglob("*.tmp"))


def test_the_run_index_follows_the_contract(tmp_path):
    write_outputs(
        [LeagueOutcome("aa", "A league", error="boom")], out_dir=tmp_path,
        generated_at=pd.Timestamp("2026-09-29T04:00:00Z"),
    )
    index = json.loads((tmp_path / "latest" / "index.json").read_text(encoding="utf-8"))
    assert validate(index, "index.schema.json") == []
    assert index["competitions"][0]["status"] == "no_snapshot"


# ---------------------------------------------------------------------------
# End to end on the cached Premier League data
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def real_run(tmp_path_factory, premier_league):
    from tabletalk.data.loaders import build_loaders
    from tabletalk.pipeline.update import run_update

    for loader in build_loaders(premier_league):
        if any(not loader.cache_path(season).exists() for season in loader.seasons):
            pytest.skip("raw data not cached; run `python -m tabletalk update` once first")
    out = tmp_path_factory.mktemp("outputs")
    result = run_update(
        ["premier_league"], out_dir=out, refresh=False, n_simulations=300,
        now=pd.Timestamp("2026-09-29T04:00:00Z"), locked_at=pd.Timestamp("2026-09-29T04:01:00Z"),
    )
    assert result.track_record_error is None, result.track_record_error
    return result.outcomes[0], out


def test_real_run_writes_a_snapshot_that_follows_the_contract(real_run):
    outcome, out = real_run
    assert outcome.ok, outcome.error
    snapshot = json.loads((out / "latest" / "premier_league.json").read_text(encoding="utf-8"))
    assert validate(snapshot) == []
    assert len(snapshot["table"]) == 20 and len(snapshot["teams"]) == 20
    assert snapshot["run"]["seed"] == run_seed("2026-09-29", "premier_league")
    for match in snapshot["upcoming_matches"]:
        total = sum(match["probabilities"].values())
        assert abs(total - 1) < 1e-5


def test_real_run_hands_every_upcoming_prediction_to_the_lock_store(real_run):
    """Every match still to come with a known day is pending a lock, with its model version."""
    _, out = real_run
    pending = json.loads((out / "track_record" / "pending.json").read_text(encoding="utf-8"))
    snapshot = json.loads((out / "latest" / "premier_league.json").read_text(encoding="utf-8"))
    assert set(pending) == {m["match_id"] for m in snapshot["upcoming_matches"]}
    entry = next(iter(pending.values()))
    assert entry["predicted_at"] == "2026-09-29T04:01:00Z"
    assert entry["snapshot"] == "history/2026-09-29T0400Z/premier_league.json"
    assert entry["model"]["config_hash"] == snapshot["run"]["config_hash"]
    summary = json.loads((out / "track_record" / "summary.json").read_text(encoding="utf-8"))
    assert summary["live_since"] == "2026-09-29T04:01:00Z"


def test_a_broken_snapshot_breaks_the_contract(real_run):
    _, out = real_run
    snapshot = json.loads((out / "latest" / "premier_league.json").read_text(encoding="utf-8"))
    snapshot["upcoming_matches"][0]["probabilities"]["home"] = 1.7
    del snapshot["table"]
    problems = validate(snapshot)
    assert any("table" in p for p in problems)
    assert any("1.7" in p for p in problems)

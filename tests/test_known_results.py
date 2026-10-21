"""Results never disappear once a source has given them (pipeline.known_results).

The 20 Oct 2026 case: football-data.org listed six finished Serie A matches as
TIMED again, football-data.co.uk did not have them yet, and the run published
a table without them and a track record that had stopped scoring 13 locks.
Offline; the end-to-end replay uses the cached Premier League data and is
skipped when it is not there.
"""

from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace

import pandas as pd
import pytest

from tabletalk.data.loaders.base import MatchLoader
from tabletalk.data.loaders.football_data_org import FootballDataOrgLoader
from tabletalk.data.loaders.football_data_uk import FootballDataUKLoader
from tabletalk.pipeline import known_results
from tabletalk.pipeline import state as pipeline_state
from tabletalk.pipeline import track_record

T = pd.Timestamp
SEASON = "2026-27"


def _matches(*rows) -> pd.DataFrame:
    """(home, away, home goals or None, away goals or None) -> the run's matches for SEASON."""
    return pd.DataFrame(
        {
            "date": [T("2026-10-17")] * len(rows), "season": [SEASON] * len(rows),
            "home_team": [r[0] for r in rows], "away_team": [r[1] for r in rows],
            "home_goals": pd.array([r[2] for r in rows], dtype="Int64"),
            "away_goals": pd.array([r[3] for r in rows], dtype="Int64"),
            "played": pd.array([r[2] is not None for r in rows], dtype="boolean"),
        }
    )


def _fixtures(*rows) -> pd.DataFrame:
    """(match id, home, away, status) -> fixture-source rows."""
    return pd.DataFrame(
        {
            "source_id": [r[0] for r in rows], "home_team": [r[1] for r in rows], "away_team": [r[2] for r in rows],
            "status": [r[3] for r in rows], "kickoff_utc": [T("2026-10-17T13:00:00Z")] * len(rows),
        }
    )


def _known(*rows) -> dict[tuple[str, str], dict]:
    """(match id, home, away, home goals, away goals) -> remembered entries."""
    return {
        (r[1], r[2]): {"competition": "serie_a", "season": SEASON, "match_id": r[0], "home_team": r[1],
                       "away_team": r[2], "home_goals": r[3], "away_goals": r[4], "date": "2026-10-17",
                       "kickoff_utc": "2026-10-17T13:00:00Z"}
        for r in rows
    }


# ---------------------------------------------------------------------------
# restore
# ---------------------------------------------------------------------------


def test_a_result_the_fixture_source_flipped_back_to_timed_is_put_back():
    matches = _matches(("Venezia", "Napoli", None, None), ("Roma", "Genoa", 2, 0))
    fixtures = _fixtures(("fdorg:1", "Venezia", "Napoli", "TIMED"), ("fdorg:2", "Roma", "Genoa", "FINISHED"))
    kept = known_results.restore(matches, fixtures, _known(("fdorg:1", "Venezia", "Napoli", 1, 3)), SEASON)
    row = kept.matches.loc[kept.matches["home_team"] == "Venezia"].iloc[0]
    assert bool(row["played"]) and (int(row["home_goals"]), int(row["away_goals"])) == (1, 3)
    assert [entry["match_id"] for entry in kept.restored] == ["fdorg:1"]
    assert not kept.changed and not kept.withdrawn
    assert not bool(matches.loc[0, "played"])  # the input is left alone


def test_a_source_that_has_the_score_wins_and_a_different_score_is_reported():
    matches = _matches(("Roma", "Genoa", 2, 1))
    kept = known_results.restore(matches, _fixtures(("fdorg:2", "Roma", "Genoa", "FINISHED")),
                                 _known(("fdorg:2", "Roma", "Genoa", 2, 0)), SEASON)
    assert int(kept.matches.loc[0, "away_goals"]) == 1
    assert [(entry["match_id"], score) for entry, score in kept.changed] == [("fdorg:2", (2, 1))]
    assert not kept.restored


@pytest.mark.parametrize("status", ["POSTPONED", "SUSPENDED", "CANCELLED", "AWARDED"])
def test_a_match_now_called_off_or_awarded_is_not_put_back(status):
    matches = _matches(("Venezia", "Napoli", None, None))
    kept = known_results.restore(matches, _fixtures(("fdorg:1", "Venezia", "Napoli", status)),
                                 _known(("fdorg:1", "Venezia", "Napoli", 1, 3)), SEASON)
    assert not bool(kept.matches.loc[0, "played"])
    assert [(entry["match_id"], why) for entry, why in kept.withdrawn] == [("fdorg:1", f"now listed as {status}")]


def test_a_match_no_longer_in_the_fixture_list_is_not_put_back():
    kept = known_results.restore(_matches(("Roma", "Genoa", 2, 0)), _fixtures(("fdorg:2", "Roma", "Genoa", "FINISHED")),
                                 _known(("fdorg:1", "Venezia", "Napoli", 1, 3)), SEASON)
    assert len(kept.matches) == 1 and not kept.restored
    assert [why for _entry, why in kept.withdrawn] == ["no longer in the fixture list"]


def test_a_restored_result_counts_as_complete_for_the_done_rule():
    """A due match whose score is restored is not missing, so later tries skip and no email is sent.

    The same steps as run_league: restore, then the played rows go to
    checks.missing_results (which decides results_complete in run_state.json).
    """
    from tabletalk.pipeline import checks

    matches = _matches(("Venezia", "Napoli", None, None))
    fixtures = _fixtures(("fdorg:1", "Venezia", "Napoli", "TIMED"))  # finished, but listed as TIMED again
    fixtures["date"] = T("2026-10-17")
    now = T("2026-10-20T06:34:00Z")  # three days after kick-off: due
    played = lambda frame: frame.loc[frame["played"].fillna(False).astype(bool)]

    assert list(checks.missing_results(fixtures, played(matches), now)["source_id"]) == ["fdorg:1"]  # without the memory
    kept = known_results.restore(matches, fixtures, _known(("fdorg:1", "Venezia", "Napoli", 1, 3)), SEASON)
    assert checks.missing_results(fixtures, played(kept.matches), now).empty
    assert checks.check_staleness(fixtures, now, max_age=pd.Timedelta(days=2), played=played(kept.matches)) == []


def test_live_results_carry_the_match_id_and_leave_out_awarded_matches():
    matches = _matches(("Roma", "Genoa", 2, 0), ("Lazio", "Monza", 3, 0), ("Venezia", "Napoli", None, None))
    fixtures = _fixtures(("fdorg:2", "Roma", "Genoa", "FINISHED"), ("fdorg:3", "Lazio", "Monza", "AWARDED"),
                         ("fdorg:1", "Venezia", "Napoli", "TIMED"))
    assert known_results.live_results(matches, fixtures, SEASON) == [{
        "home_team": "Roma", "away_team": "Genoa", "home_goals": 2, "away_goals": 0, "match_id": "fdorg:2",
        "date": "2026-10-17", "kickoff_utc": "2026-10-17T13:00:00Z",
    }]


# ---------------------------------------------------------------------------
# The working file
# ---------------------------------------------------------------------------

AT = T("2026-10-19T06:46:00Z")


def _result(match_id, home, away, home_goals, away_goals) -> dict:
    return {"home_team": home, "away_team": away, "home_goals": home_goals, "away_goals": away_goals,
            "match_id": match_id, "date": "2026-10-17", "kickoff_utc": "2026-10-17T13:00:00Z"}


def test_the_file_remembers_replaces_a_changed_score_and_forgets_called_off_matches(tmp_path):
    record = pipeline_state.record_known_results
    record(tmp_path, competition="serie_a", season=SEASON, forget=set(), recorded_at=AT,
           results=[_result("fdorg:1", "Venezia", "Napoli", 1, 3), _result("fdorg:2", "Roma", "Genoa", 2, 0)])
    later = T("2026-10-20T08:50:00Z")
    record(tmp_path, competition="serie_a", season=SEASON, forget={("Venezia", "Napoli")}, recorded_at=later,
           results=[_result("fdorg:2", "Roma", "Genoa", 2, 1)])
    known = pipeline_state.known_for(pipeline_state.read_known_results(tmp_path), "serie_a", SEASON)
    assert list(known) == [("Roma", "Genoa")]
    assert known[("Roma", "Genoa")]["away_goals"] == 1
    assert known[("Roma", "Genoa")]["recorded_at"] == "2026-10-20T08:50:00Z"
    assert pipeline_state.known_for(pipeline_state.read_known_results(tmp_path), "serie_a", "2025-26") == {}


def test_an_unchanged_result_keeps_when_it_was_recorded(tmp_path):
    for at in (AT, T("2026-10-20T08:50:00Z")):
        pipeline_state.record_known_results(tmp_path, competition="serie_a", season=SEASON, forget=set(),
                                            recorded_at=at, results=[_result("fdorg:2", "Roma", "Genoa", 2, 0)])
    entry = next(iter(pipeline_state.read_known_results(tmp_path).values()))
    assert entry["recorded_at"] == "2026-10-19T06:46:00Z"


def test_a_missing_or_corrupt_file_means_nothing_remembered(tmp_path):
    assert pipeline_state.read_known_results(tmp_path) == {}
    path = tmp_path / "state" / "known_results.json"
    path.parent.mkdir(parents=True)
    for text in ("{not json", '["a list"]', '{"matches": "nope"}'):
        path.write_text(text, encoding="utf-8")
        assert pipeline_state.read_known_results(tmp_path) == {}


# ---------------------------------------------------------------------------
# The track record keeps scoring
# ---------------------------------------------------------------------------


class _FixtureSource:
    def __init__(self, frame):
        self.frame = frame

    def load(self, **_):
        return self.frame


def _fixture_source(*rows) -> pd.DataFrame:
    """(match id, status, home goals or None, away goals or None)."""
    return pd.DataFrame(
        {
            "source_id": [r[0] for r in rows], "status": [r[1] for r in rows],
            "date": pd.to_datetime(["2026-10-17"] * len(rows)),
            "kickoff_utc": pd.to_datetime(["2026-10-17T13:00:00Z"] * len(rows), utc=True),
            "home_goals": pd.array([r[2] for r in rows], dtype="Int64"),
            "away_goals": pd.array([r[3] for r in rows], dtype="Int64"),
            "played": pd.array([r[1] == "FINISHED" for r in rows], dtype="boolean"),
        }
    )


def test_scoring_uses_a_remembered_result_only_where_the_fixture_source_has_none(monkeypatch):
    frame = _fixture_source(("fdorg:1", "TIMED", None, None), ("fdorg:2", "FINISHED", 2, 1),
                            ("fdorg:3", "POSTPONED", None, None))
    monkeypatch.setattr(track_record, "build_loaders", lambda config, role: [_FixtureSource(frame)])
    known = {f"k{i}": entry for i, entry in enumerate(_known(
        ("fdorg:1", "Venezia", "Napoli", 1, 3), ("fdorg:2", "Roma", "Genoa", 2, 0), ("fdorg:3", "Lazio", "Monza", 0, 0),
    ).values())}
    config = SimpleNamespace(id="serie_a", current_season=SEASON)
    results = track_record._results(config, refresh=False, known=known).set_index("match_id")
    assert sorted(results.index) == ["fdorg:1", "fdorg:2"]
    assert (results.loc["fdorg:1", "home_goals"], results.loc["fdorg:1", "away_goals"]) == (1.0, 3.0)
    assert results.loc["fdorg:2", "away_goals"] == 1.0  # the source wins
    assert results.loc["fdorg:1", "kickoff"] == T("2026-10-17T13:00:00Z")
    other = {key: {**entry, "competition": "ligue_1"} for key, entry in known.items()}
    assert sorted(track_record._results(config, refresh=False, known=other)["match_id"]) == ["fdorg:2"]


# ---------------------------------------------------------------------------
# End to end: the flip replayed on the real Premier League
# ---------------------------------------------------------------------------


def _flip(monkeypatch, pairs: set[tuple[str, str]]) -> None:
    """football-data.org lists these as TIMED with no score; football-data.co.uk does not have them yet."""

    def org_load(self, **kwargs):
        frame = MatchLoader.load(self, **kwargs).copy()
        hit = pd.Series(list(zip(frame["home_team"], frame["away_team"])), index=frame.index).isin(pairs)
        hit &= frame["season"].astype(str) == SEASON
        frame.loc[hit, "status"] = "TIMED"
        frame.loc[hit, ["home_goals", "away_goals"]] = pd.NA
        frame.loc[hit, "played"] = False
        return frame

    def uk_load(self, **kwargs):
        frame = MatchLoader.load(self, **kwargs)
        hit = pd.Series(list(zip(frame["home_team"], frame["away_team"])), index=frame.index).isin(pairs)
        return frame.loc[~(hit & (frame["season"].astype(str) == SEASON))]

    monkeypatch.setattr(FootballDataOrgLoader, "load", org_load)
    monkeypatch.setattr(FootballDataUKLoader, "load", uk_load)


def test_a_flipped_result_stays_in_the_published_table(tmp_path, monkeypatch, premier_league):
    from tabletalk.data.loaders import build_loaders
    from tabletalk.pipeline.update import run_update

    if premier_league.current_season != SEASON:
        pytest.skip("written for the 2026-27 season")
    for loader in build_loaders(premier_league):
        if any(not loader.cache_path(season).exists() for season in loader.seasons):
            pytest.skip("raw data not cached; run `python -m tabletalk update` once first")
    api = next(loader for loader in build_loaders(premier_league, role="fixtures") if loader.name == "football_data_org")
    finished = api.load()
    finished = finished.loc[(finished["season"].astype(str) == SEASON) & (finished["status"] == "FINISHED")]
    latest = finished.sort_values("kickoff_utc").tail(3)
    flipped = set(zip(latest["home_team"].astype(str), latest["away_team"].astype(str)))
    now = latest["kickoff_utc"].max() + pd.Timedelta(hours=12)

    def run(at):
        result = run_update(["premier_league"], out_dir=tmp_path, refresh=False, n_simulations=200, now=at, locked_at=at)
        assert result.track_record_error is None, result.track_record_error
        outcome = result.outcomes[0]
        assert outcome.ok, outcome.error
        return outcome, json.loads((tmp_path / "latest" / "premier_league.json").read_text(encoding="utf-8"))

    _, before = run(now)
    known = pipeline_state.known_for(pipeline_state.read_known_results(tmp_path), "premier_league", SEASON)
    assert flipped <= set(known)

    _flip(monkeypatch, flipped)
    outcome, after = run(now + pd.Timedelta(hours=2))
    assert after["table"] == before["table"]
    assert after["data_through"] == before["data_through"]
    assert {(m["home_team"], m["away_team"]) for m in after["upcoming_matches"]}.isdisjoint(flipped)
    assert not outcome.missing and not outcome.warnings
    assert any(notice.startswith("Results kept from earlier runs: 3 match(es)") for notice in after["notices"])
    assert pipeline_state.read_run_state(tmp_path)["leagues"]["premier_league"]["results_complete"] is True

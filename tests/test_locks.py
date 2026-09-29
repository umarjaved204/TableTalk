"""Locking predictions before kick-off, and the live track record.

Each test walks one match through several nightly runs, using hand-built
snapshots and fixture lists, and checks the lock log that results. Offline.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from tabletalk.pipeline.locks import LockStore, LockStoreError, scoreable_locks, update_locks
from tabletalk.pipeline.track_record import render, summarise, verdict
from tabletalk.pipeline.snapshot import validate

MATCH = "fdorg:1"
T = pd.Timestamp


def _snapshot(*matches: dict) -> dict:
    return {
        "competition": {"season": "2026-27"},
        "generated_at": "2026-10-01T04:00:00Z",
        "run": {"code_commit": "abc123", "code_dirty": False, "config_hash": "sha256:" + "0" * 64},
        "upcoming_matches": list(matches),
    }


def _upcoming(kickoff: str | None, status: str = "TIMED", p_home: float = 0.5, match_id: str = MATCH,
              date: str | None = None) -> dict:
    return {
        "match_id": match_id, "matchday": "Matchday 7",
        "date": date or (kickoff[:10] if kickoff else None), "kickoff_utc": kickoff, "status": status,
        "home_team": "Arsenal", "away_team": "Leeds United",
        "probabilities": {"home": p_home, "draw": 0.3, "away": round(0.7 - p_home, 6)},
        "expected_goals": {"home": 1.6, "away": 1.0},
        "likely_scorelines": [{"home": 1, "away": 0, "probability": 0.12}],
    }


def _fixtures(status: str, kickoff: str | None, match_id: str = MATCH, date: str | None = None) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "source_id": [match_id], "status": [status],
            "kickoff_utc": [T(kickoff) if kickoff else pd.NaT],
            "date": [T(date or kickoff[:10])],
            "home_team": ["Arsenal"], "away_team": ["Leeds United"],
        }
    )


def _run(store, at: str, snapshot: dict, fixtures: pd.DataFrame) -> list[dict]:
    return update_locks(store, competition="premier_league", snapshot=snapshot, fixtures=fixtures, predicted_at=T(at))


@pytest.fixture
def store(tmp_path: Path) -> LockStore:
    return LockStore(tmp_path / "track_record")


def _kinds(events):
    return [(e["event"], e.get("lock_id") or e.get("match_id")) for e in events]


# ---------------------------------------------------------------------------
# The normal case
# ---------------------------------------------------------------------------


def test_the_last_prediction_before_kickoff_becomes_the_lock(store):
    kickoff = "2026-10-10T14:00:00Z"
    _run(store, "2026-10-08T04:00:00Z", _snapshot(_upcoming(kickoff, p_home=0.40)), _fixtures("TIMED", kickoff))
    _run(store, "2026-10-10T04:00:00Z", _snapshot(_upcoming(kickoff, p_home=0.45)), _fixtures("TIMED", kickoff))
    assert store.events() == []  # nothing is locked before kick-off
    assert store.pending()[MATCH]["probabilities"]["home"] == 0.45

    events = _run(store, "2026-10-11T04:00:00Z", _snapshot(), _fixtures("FINISHED", kickoff))
    assert _kinds(events) == [("lock", f"{MATCH}#1")]
    lock = events[0]
    assert lock["probabilities"]["home"] == 0.45  # the latest one, not the first
    assert lock["predicted_at"] == "2026-10-10T04:00:00Z"
    assert lock["model"] == {"code_commit": "abc123", "code_dirty": False, "config_hash": "sha256:" + "0" * 64}
    assert store.pending() == {}


def test_a_run_after_kickoff_does_not_replace_the_prediction(store):
    """A match under way by the source's clock is not re-predicted."""
    kickoff = "2026-10-10T14:00:00Z"
    _run(store, "2026-10-10T04:00:00Z", _snapshot(_upcoming(kickoff, p_home=0.45)), _fixtures("TIMED", kickoff))
    _run(store, "2026-10-10T14:30:00Z", _snapshot(_upcoming(kickoff, p_home=0.90)), _fixtures("TIMED", kickoff))
    assert store.pending()[MATCH]["probabilities"]["home"] == 0.45


# ---------------------------------------------------------------------------
# Locks never change
# ---------------------------------------------------------------------------


def test_later_runs_only_ever_append(store):
    kickoff = "2026-10-10T14:00:00Z"
    _run(store, "2026-10-10T04:00:00Z", _snapshot(_upcoming(kickoff)), _fixtures("TIMED", kickoff))
    _run(store, "2026-10-11T04:00:00Z", _snapshot(), _fixtures("FINISHED", kickoff))
    before = store.log_path.read_bytes()

    for day in ("12", "13", "14"):  # later runs: same match, still finished
        assert _run(store, f"2026-10-{day}T04:00:00Z", _snapshot(), _fixtures("FINISHED", kickoff)) == []
    assert store.log_path.read_bytes() == before


def test_an_edited_lock_is_detected(store):
    kickoff = "2026-10-10T14:00:00Z"
    _run(store, "2026-10-10T04:00:00Z", _snapshot(_upcoming(kickoff)), _fixtures("TIMED", kickoff))
    _run(store, "2026-10-11T04:00:00Z", _snapshot(), _fixtures("FINISHED", kickoff))
    _run(store, "2026-10-12T04:00:00Z", _snapshot(_upcoming("2026-10-20T14:00:00Z", match_id="fdorg:2")),
         pd.concat([_fixtures("FINISHED", kickoff), _fixtures("TIMED", "2026-10-20T14:00:00Z", "fdorg:2")]))
    _run(store, "2026-10-21T04:00:00Z", _snapshot(),
         pd.concat([_fixtures("FINISHED", kickoff), _fixtures("FINISHED", "2026-10-20T14:00:00Z", "fdorg:2")]))
    lines = store.log_path.read_text(encoding="utf-8").splitlines()
    assert len(lines) == 2

    store.log_path.write_text(lines[0].replace('"home":0.5', '"home":0.9') + "\n" + lines[1] + "\n", encoding="utf-8")
    with pytest.raises(LockStoreError, match="edited, reordered or had lines removed"):
        store.events()


def test_a_deleted_lock_is_detected(store):
    for n, day in enumerate(("10", "11"), start=1):
        kickoff = f"2026-10-{day}T14:00:00Z"
        _run(store, f"2026-10-{day}T04:00:00Z", _snapshot(_upcoming(kickoff, match_id=f"fdorg:{n}")),
             _fixtures("TIMED", kickoff, f"fdorg:{n}"))
        _run(store, f"2026-10-{day}T20:00:00Z", _snapshot(), _fixtures("FINISHED", kickoff, f"fdorg:{n}"))
    lines = store.log_path.read_text(encoding="utf-8").splitlines()
    store.log_path.write_text(lines[1] + "\n", encoding="utf-8")
    with pytest.raises(LockStoreError):
        store.events()


# ---------------------------------------------------------------------------
# Postponed, suspended, moved, missed
# ---------------------------------------------------------------------------


def test_postponed_then_replayed_keeps_both_locks_and_scores_only_the_second(store):
    first, second = "2026-10-10T14:00:00Z", "2026-11-04T19:45:00Z"
    _run(store, "2026-10-09T04:00:00Z", _snapshot(_upcoming(first, p_home=0.40)), _fixtures("TIMED", first))
    # Postponed (say, a waterlogged pitch): the lock is kept and voided.
    events = _run(store, "2026-10-10T04:00:00Z", _snapshot(_upcoming(first, "POSTPONED")), _fixtures("POSTPONED", first))
    assert _kinds(events) == [("lock", f"{MATCH}#1"), ("void", f"{MATCH}#1")]
    assert events[1]["reason"] == "postponed"
    assert store.pending() == {}  # nothing is predicted while it has no new date

    _run(store, "2026-10-20T04:00:00Z", _snapshot(_upcoming(first, "POSTPONED")), _fixtures("POSTPONED", first))
    _run(store, "2026-11-04T04:00:00Z", _snapshot(_upcoming(second, p_home=0.55)), _fixtures("TIMED", second))
    events = _run(store, "2026-11-05T04:00:00Z", _snapshot(), _fixtures("FINISHED", second))
    assert _kinds(events) == [("lock", f"{MATCH}#2")]

    locks, counts = scoreable_locks(store.events())
    assert list(locks["lock_id"]) == [f"{MATCH}#2"]
    assert locks.iloc[0]["p_home"] == 0.55
    assert counts == {"locks": 2, "voided": 1, "invalid": 0, "missed": 0}


def test_a_suspended_match_is_locked_then_voided(store):
    kickoff = "2026-10-10T14:00:00Z"
    _run(store, "2026-10-10T04:00:00Z", _snapshot(_upcoming(kickoff)), _fixtures("TIMED", kickoff))
    events = _run(store, "2026-10-11T04:00:00Z", _snapshot(), _fixtures("SUSPENDED", kickoff))
    assert _kinds(events) == [("lock", f"{MATCH}#1"), ("void", f"{MATCH}#1")]
    assert events[1]["reason"] == "suspended"
    # Still suspended on later runs: nothing more is recorded (in particular, not "missed").
    assert _run(store, "2026-10-12T04:00:00Z", _snapshot(), _fixtures("SUSPENDED", kickoff)) == []


def test_moved_earlier_after_our_last_prediction_is_invalid_not_scored(store):
    """The source still said Sunday when we predicted; the match was really played on Friday."""
    _run(store, "2026-10-10T04:00:00Z", _snapshot(_upcoming("2026-10-11T14:00:00Z")), _fixtures("TIMED", "2026-10-11T14:00:00Z"))
    events = _run(store, "2026-10-12T04:00:00Z", _snapshot(), _fixtures("FINISHED", "2026-10-09T19:00:00Z"))
    assert _kinds(events) == [("lock", f"{MATCH}#1"), ("invalid", f"{MATCH}#1")]
    assert events[1]["actual_kickoff_utc"] == "2026-10-09T19:00:00Z"
    locks, counts = scoreable_locks(store.events())
    assert locks.empty and counts["invalid"] == 1


def test_moved_earlier_but_still_after_our_prediction_is_a_valid_lock(store):
    _run(store, "2026-10-08T04:00:00Z", _snapshot(_upcoming("2026-10-11T14:00:00Z")), _fixtures("TIMED", "2026-10-11T14:00:00Z"))
    events = _run(store, "2026-10-12T04:00:00Z", _snapshot(), _fixtures("FINISHED", "2026-10-09T19:00:00Z"))
    assert _kinds(events) == [("lock", f"{MATCH}#1")]


def test_a_match_never_predicted_is_missed_once(store):
    store.live_since(T("2026-10-01T04:00:00Z"))
    finished = _fixtures("FINISHED", "2026-10-05T14:00:00Z")
    events = _run(store, "2026-10-06T04:00:00Z", _snapshot(), finished)
    assert _kinds(events) == [("missed", MATCH)]
    assert _run(store, "2026-10-07T04:00:00Z", _snapshot(), finished) == []


def test_matches_played_before_the_pipeline_existed_are_not_missed(store):
    store.live_since(T("2026-10-01T04:00:00Z"))
    assert _run(store, "2026-10-06T04:00:00Z", _snapshot(), _fixtures("FINISHED", "2026-09-20T14:00:00Z")) == []


def test_a_match_without_a_kickoff_time_is_predicted_until_its_day(store):
    upcoming = _upcoming(None, "SCHEDULED", date="2026-12-05")
    _run(store, "2026-10-06T04:00:00Z", _snapshot(upcoming), _fixtures("SCHEDULED", None, date="2026-12-05"))
    assert MATCH in store.pending()


# ---------------------------------------------------------------------------
# The track record: wording rule and contract
# ---------------------------------------------------------------------------


def test_verdict_follows_the_wording_rule():
    assert verdict(np.array([]))[0] == "no scored matches yet"
    assert verdict(np.array([-0.1]))[0] == "too few matches to compare"
    rng = np.random.default_rng(0)
    assert verdict(rng.normal(0, 0.5, 40))[0] == "no detectable difference"
    assert verdict(np.full(40, -0.2) + rng.normal(0, 0.01, 40))[0] == "model better"
    assert verdict(np.full(40, 0.2) + rng.normal(0, 0.01, 40))[0] == "model worse"
    # Clearly better overall, but the second half went the other way.
    split = np.concatenate([np.full(20, -0.3), np.full(20, 0.05)]) + rng.normal(0, 0.01, 40)
    assert verdict(split)[0] == "consistently better but modest"


def _scored(n: int) -> pd.DataFrame:
    rng = np.random.default_rng(1)
    probs = rng.dirichlet([4, 3, 3], n)
    outcome = rng.integers(0, 3, n)
    frame = pd.DataFrame(
        {
            "lock_id": [f"fdorg:{i}#1" for i in range(n)], "competition": "premier_league",
            "home_team": "Arsenal", "away_team": "Leeds United",
            "kickoff": pd.date_range("2026-10-10", periods=n, freq="D", tz="UTC"),
            "predicted_at": "2026-10-09T04:00:00Z", "code_commit": "abc123",
            "p_home": probs[:, 0], "p_draw": probs[:, 1], "p_away": probs[:, 2], "outcome": outcome,
            "home_goals": (outcome == 0).astype(int), "away_goals": (outcome == 2).astype(int),
        }
    )
    chosen = probs[np.arange(n), outcome]
    frame["ll_model"] = -np.log(chosen)
    frame["ll_base"] = -np.log(np.array([0.45, 0.27, 0.28])[outcome])
    frame["ll_market"] = np.nan
    return frame


def test_track_record_summary_follows_the_contract():
    counts = {"locks": 12, "voided": 1, "invalid": 0, "missed": 0, "scored": 12, "awaiting_result": 0, "awarded_not_scored": 0}
    summary = summarise(_scored(12), counts, live_since="2026-10-01T04:00:00Z", generated_at=T("2026-10-25T04:00:00Z"))
    assert validate(summary, "track_record.schema.json") == []
    market = summary["competitions"][0]["comparisons"][1]
    assert market["against"] == "market" and market["n"] == 0  # no closing odds yet
    text = render(summary)
    assert "beats" not in text
    assert "matches are needed" in text or "no detectable difference" in text


def test_empty_track_record_follows_the_contract():
    counts = {"locks": 0, "voided": 0, "invalid": 0, "missed": 0, "scored": 0, "awaiting_result": 0, "awarded_not_scored": 0}
    summary = summarise(pd.DataFrame(), counts, live_since=None, generated_at=T("2026-10-01T04:00:00Z"))
    assert validate(summary, "track_record.schema.json") == []
    assert summary["competitions"][0]["comparisons"][0]["verdict"] == "no scored matches yet"


# ---------------------------------------------------------------------------
# Scoring real locks against real (cached) results
# ---------------------------------------------------------------------------


def test_real_finished_matches_are_scored_against_base_rates(store, premier_league):
    from tabletalk.data.loaders import build_loaders
    from tabletalk.pipeline.track_record import score

    for loader in build_loaders(premier_league):
        if any(not loader.cache_path(season).exists() for season in loader.seasons):
            pytest.skip("raw data not cached")
    fixtures = next(l for l in build_loaders(premier_league, role="fixtures")).load()
    finished = fixtures.loc[fixtures["status"] == "FINISHED"].sort_values("kickoff_utc").head(10)
    # Pretend the pipeline had predicted these matches the morning of each game.
    for row in finished.itertuples(index=False):
        kickoff = row.kickoff_utc.strftime("%Y-%m-%dT%H:%M:%SZ")
        morning = row.kickoff_utc.normalize().strftime("%Y-%m-%dT04:00:00Z")
        snapshot = _snapshot({**_upcoming(kickoff, match_id=row.source_id), "home_team": row.home_team, "away_team": row.away_team})
        # The whole fixture list, as a real run passes it, as it stood that morning.
        update_locks(store, competition="premier_league", snapshot=snapshot,
                     fixtures=fixtures.assign(status="TIMED"), predicted_at=T(morning))
    update_locks(store, competition="premier_league", snapshot=_snapshot(), fixtures=fixtures,
                 predicted_at=T("2026-09-29T04:00:00Z"))
    scored, counts = score(store)
    assert counts["scored"] == 10 and counts["invalid"] == 0
    assert scored["ll_base"].notna().all() and scored["ll_model"].notna().all()
    assert json.dumps(summarise(scored, counts, live_since=None, generated_at=T("2026-09-29T04:00:00Z")))

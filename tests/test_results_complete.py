"""A day is "done" only when its results are complete; and what the run report says about it.

Covers: the missing-results rule, the fail-safe state file, the last try,
tries starting out of order, cancelled / postponed matches, the first-seen
results log staying frozen, the first-update timing warning, and a whole day with results
missing run through ``run_update``. Offline.
"""

from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace

import pandas as pd
import pytest
import yaml

from tabletalk.pipeline import checks
from tabletalk.pipeline import state as pipeline_state
from tabletalk.pipeline import update
from tabletalk.pipeline.locks import LockStore
from tabletalk.pipeline.update import LeagueOutcome, RunResult, done_today, first_update_timing, write_outputs

T = pd.Timestamp
ROOT = Path(__file__).resolve().parents[1]


def _fixtures(*rows) -> pd.DataFrame:
    """(match id, home, away, status, kickoff or None, date) -> a fixture-source frame."""
    return pd.DataFrame(
        {
            "source_id": [r[0] for r in rows], "home_team": [r[1] for r in rows], "away_team": [r[2] for r in rows],
            "status": [r[3] for r in rows],
            "kickoff_utc": [T(r[4]) if r[4] else pd.NaT for r in rows],
            "date": [T(r[5]) for r in rows],
        }
    )


def _played(*pairs) -> pd.DataFrame:
    return pd.DataFrame({"home_team": [p[0] for p in pairs], "away_team": [p[1] for p in pairs]})


NO_SCORES = _played()


# ---------------------------------------------------------------------------
# Which matches are missing a result
# ---------------------------------------------------------------------------


def test_a_match_is_due_three_hours_after_kickoff_not_before():
    fixtures = _fixtures(("m1", "A", "B", "TIMED", "2026-10-11T13:00:00Z", "2026-10-11"))
    assert checks.missing_results(fixtures, NO_SCORES, T("2026-10-11T15:59:00Z")).empty  # 2h59: may still be on
    assert list(checks.missing_results(fixtures, NO_SCORES, T("2026-10-11T16:00:00Z"))["source_id"]) == ["m1"]


def test_a_match_with_no_kickoff_time_is_due_once_its_day_is_over():
    fixtures = _fixtures(("m1", "A", "B", "SCHEDULED", None, "2026-10-11"))
    assert checks.missing_results(fixtures, NO_SCORES, T("2026-10-11T23:00:00Z")).empty
    assert len(checks.missing_results(fixtures, NO_SCORES, T("2026-10-12T03:00:00Z"))) == 1


def test_called_off_matches_are_complete_and_a_match_in_play_is_missing():
    fixtures = _fixtures(
        ("m1", "A", "B", "POSTPONED", "2026-10-11T13:00:00Z", "2026-10-11"),
        ("m2", "C", "D", "SUSPENDED", "2026-10-11T13:00:00Z", "2026-10-11"),
        ("m3", "E", "F", "CANCELLED", "2026-10-11T13:00:00Z", "2026-10-11"),
        ("m4", "G", "H", "IN_PLAY", "2026-10-11T13:00:00Z", "2026-10-11"),
    )
    missing = checks.missing_results(fixtures, NO_SCORES, T("2026-10-12T08:00:00Z"))
    assert list(missing["source_id"]) == ["m4"]


def test_finished_without_a_score_in_the_runs_data_counts_as_missing():
    """What counts is the data the predictions were made from, not the source's status."""
    fixtures = _fixtures(
        ("m1", "A", "B", "FINISHED", "2026-10-11T13:00:00Z", "2026-10-11"),
        ("m2", "C", "D", "AWARDED", "2026-10-11T13:00:00Z", "2026-10-11"),
    )
    now = T("2026-10-12T08:00:00Z")
    assert list(checks.missing_results(fixtures, NO_SCORES, now)["source_id"]) == ["m1", "m2"]
    assert checks.missing_results(fixtures, _played(("A", "B"), ("C", "D")), now).empty


def test_a_score_only_the_other_results_source_has_counts_as_complete():
    fixtures = _fixtures(("m1", "A", "B", "TIMED", "2026-10-11T13:00:00Z", "2026-10-11"))  # fixture source lags
    assert checks.missing_results(fixtures, _played(("A", "B")), T("2026-10-12T08:00:00Z")).empty


# ---------------------------------------------------------------------------
# The state file: fail safe
# ---------------------------------------------------------------------------

MORNING = T("2026-10-12T07:57:00Z")
LATER = T("2026-10-12T11:15:00Z")


def _outcome(competition="aa", missing=(), **extra) -> LeagueOutcome:
    snapshot = {"generated_at": "2026-10-12T07:57:00Z", "data_through": "2026-10-11", "provisional": False,
                "upcoming_matches": []}
    return LeagueOutcome(competition, competition.upper(), snapshot=snapshot, missing=list(missing), **extra)


MISSING_MATCH = {"match_id": "fdorg:1", "home_team": "Hull City", "away_team": "Everton", "date": "2026-10-11",
                 "kickoff_utc": "2026-10-11T13:00:00Z", "status": "TIMED"}


def test_no_state_file_means_not_done(tmp_path):
    assert not done_today(tmp_path, ["aa"], LATER)


def test_a_corrupt_state_file_means_not_done(tmp_path):
    path = tmp_path / "state" / "run_state.json"
    path.parent.mkdir(parents=True)
    path.write_text("{not json", encoding="utf-8")
    assert not done_today(tmp_path, ["aa"], LATER)
    path.write_text('["a list, not a state"]', encoding="utf-8")
    assert not done_today(tmp_path, ["aa"], LATER)
    path.write_text('{"date": "2026-10-12", "leagues": {"aa": "updated"}}', encoding="utf-8")
    assert not done_today(tmp_path, ["aa"], LATER)


def test_yesterdays_state_means_not_done(tmp_path):
    write_outputs([_outcome()], out_dir=tmp_path, generated_at=MORNING)
    assert done_today(tmp_path, ["aa"], LATER)
    assert not done_today(tmp_path, ["aa"], T("2026-10-13T07:40:00Z"))


def test_a_league_the_state_does_not_mention_means_not_done(tmp_path):
    write_outputs([_outcome("aa")], out_dir=tmp_path, generated_at=MORNING)
    assert not done_today(tmp_path, ["aa", "bb"], LATER)


def test_missing_results_mean_not_done_and_the_report_says_a_later_try_runs(tmp_path):
    write_outputs([_outcome(missing=[MISSING_MATCH])], out_dir=tmp_path, generated_at=MORNING)
    assert not done_today(tmp_path, ["aa"], LATER)
    state = json.loads((tmp_path / "state" / "run_state.json").read_text(encoding="utf-8"))
    assert state["leagues"]["aa"] == {"updated": True, "results_complete": False, "missing": ["fdorg:1"]}
    report = (tmp_path / "latest" / "run_report.md").read_text(encoding="utf-8")
    assert "Results not in yet (1): Hull City v Everton (11 Oct 13:00 UTC, TIMED)" in report
    assert "the next scheduled try today runs the update again" in report


# ---------------------------------------------------------------------------
# The last try, and tries out of order
# ---------------------------------------------------------------------------


def test_missing_results_fail_the_run_only_on_the_last_try(tmp_path):
    outcomes = [_outcome(missing=[MISSING_MATCH])]
    assert RunResult(outcomes).ok  # an earlier try: published, no email, the next try runs again
    assert not RunResult(outcomes, last_try=True).ok  # the last try: published, warned, job fails
    write_outputs(outcomes, out_dir=tmp_path, generated_at=MORNING, last_try=True)
    report = (tmp_path / "latest" / "run_report.md").read_text(encoding="utf-8")
    assert "WARNING: this was the day's last scheduled try" in report


def test_a_complete_last_try_does_not_fail():
    assert RunResult([_outcome()], last_try=True).ok


def test_tries_out_of_order_the_last_try_alarms_and_the_earlier_try_still_completes_the_day(tmp_path):
    """GitHub starts the 07:37 try before the 05:37 one; results arrive in between.

    The 07:37 ("last") try fails (a false alarm); the day is not done, so the
    05:37 try, starting later, still runs, and completes the day.
    """
    last_try = RunResult([_outcome(missing=[MISSING_MATCH])], last_try=True)
    write_outputs(last_try.outcomes, out_dir=tmp_path, generated_at=T("2026-10-12T12:40:00Z"), last_try=True)
    assert not last_try.ok
    assert not done_today(tmp_path, ["aa"], T("2026-10-12T13:30:00Z"))  # so the 05:37 try does not skip

    earlier_try = RunResult([_outcome()])
    write_outputs(earlier_try.outcomes, out_dir=tmp_path, generated_at=T("2026-10-12T13:30:00Z"))
    assert earlier_try.ok
    assert done_today(tmp_path, ["aa"], T("2026-10-12T16:00:00Z"))


def test_the_last_try_is_defined_once_and_is_the_latest_scheduled_try():
    workflow = yaml.safe_load((ROOT / ".github" / "workflows" / "daily-update.yml").read_text(encoding="utf-8"))
    triggers = workflow.get("on", workflow.get(True))  # YAML 1.1 reads a bare `on` as True
    crons = [entry["cron"] for entry in triggers["schedule"]]
    last = workflow["env"]["LAST_TRY_SCHEDULE"]
    assert last in crons
    assert max(crons, key=lambda cron: (int(cron.split()[1]), int(cron.split()[0]))) == last
    run_step = next(step for step in workflow["jobs"]["update"]["steps"] if step.get("id") == "update")
    assert '"$LAST_TRY_SCHEDULE"' in run_step["run"] and "--last-try" in run_step["run"]


# ---------------------------------------------------------------------------
# Postponed, suspended and cancelled matches
# ---------------------------------------------------------------------------


def test_a_cancelled_match_is_explained_in_the_notices_and_the_run_report(tmp_path):
    row = _fixtures(("fdorg:564698", "Rayo Vallecano", "Athletic Bilbao", "CANCELLED",
                     "2026-10-10T12:00:00Z", "2026-10-10")).iloc[0]
    notice = update._called_off_notice(SimpleNamespace(**row.to_dict()))
    assert notice.startswith("Cancelled: Rayo Vallecano v Athletic Bilbao (listed for 10 Oct).")
    assert "still simulated" in notice and "awarded_results.yaml" in notice and "voided" in notice

    cancelled = {"match_id": "fdorg:564698", "home_team": "Rayo Vallecano", "away_team": "Athletic Bilbao",
                 "date": "2026-10-10", "kickoff_utc": "2026-10-10T12:00:00Z", "status": "CANCELLED"}
    write_outputs([_outcome(called_off=[cancelled])], out_dir=tmp_path, generated_at=MORNING)
    report = (tmp_path / "latest" / "run_report.md").read_text(encoding="utf-8")
    assert "Cancelled: Rayo Vallecano v Athletic Bilbao (listed for 10 Oct)" in report
    assert "a cancelled\nmatch is assumed to be replayed" in report
    assert done_today(tmp_path, ["aa"], LATER)  # a called-off match is not a missing result


def test_a_voided_lock_is_listed_in_the_report_after_locking():
    events = [
        {"event": "lock", "lock_id": "fdorg:564698#1", "home_team": "Rayo Vallecano", "away_team": "Athletic Bilbao"},
        {"event": "void", "lock_id": "fdorg:564698#1", "reason": "cancelled"},
    ]
    text = update._after_locking_report(events, [])
    assert "1 prediction(s) locked" in text
    assert "Voided: Rayo Vallecano v Athletic Bilbao (fdorg:564698#1): cancelled; not scored" in text


# ---------------------------------------------------------------------------
# First seen: frozen (no longer written)
# ---------------------------------------------------------------------------
# Stopped on 23 Oct 2026: it could not measure what it was for. The test that
# runs a whole update day (below) checks the file on the data branch is left
# exactly as it was.


# ---------------------------------------------------------------------------
# The day's first update, close to the first kick-off
# ---------------------------------------------------------------------------


def _with_kickoffs(*kickoffs) -> LeagueOutcome:
    rows = [(f"m{i}", f"H{i}", f"A{i}", "TIMED", k, k[:10]) for i, k in enumerate(kickoffs)]
    return _outcome(fixtures=_fixtures(*rows))


def test_a_first_update_less_than_an_hour_before_the_first_kickoff_is_warned():
    outcomes = [_with_kickoffs("2026-10-11T10:30:00Z", "2026-10-11T13:00:00Z")]
    warning = first_update_timing(outcomes, published_at=T("2026-10-11T09:45:00Z"), run_date="2026-10-11")
    assert "only 45 minutes before the first kick-off (AA: H0 v A0, 10:30 UTC)" in warning
    late = first_update_timing(outcomes, published_at=T("2026-10-11T10:40:00Z"), run_date="2026-10-11")
    assert "10 minutes AFTER the first kick-off" in late


def test_no_warning_with_an_hour_to_spare_or_no_match_today():
    outcomes = [_with_kickoffs("2026-10-11T10:30:00Z")]
    assert first_update_timing(outcomes, published_at=T("2026-10-11T09:30:00Z"), run_date="2026-10-11") is None
    assert first_update_timing(outcomes, published_at=T("2026-10-12T09:30:00Z"), run_date="2026-10-12") is None


# ---------------------------------------------------------------------------
# A whole day with results missing, through run_update
# ---------------------------------------------------------------------------

HULL = ("fdorg:1", "Hull City", "Everton", "2026-10-11T13:00:00Z")          # Sunday; the source is slow
ATALANTA = ("fdorg:3", "Atalanta", "Venezia", "2026-10-12T16:30:00Z")       # kicks off between the tries
COVENTRY = ("fdorg:2", "Coventry City", "Newcastle United", "2026-10-12T19:00:00Z")


class _FakeDay:
    """Stands in for run_league: the real missing-results rule on a hand-built fixture list."""

    def __init__(self):
        self.statuses: dict[str, str] = {}
        self.played: set[tuple[str, str]] = set()
        self.p_home = 0.5

    def fixtures(self) -> pd.DataFrame:
        return _fixtures(*[(m[0], m[1], m[2], self.statuses.get(m[0], "TIMED"), m[3], m[3][:10])
                           for m in (HULL, ATALANTA, COVENTRY)])

    def run_league(self, config, *, run_date, now, **_):
        fixtures = self.fixtures()
        played = _played(*self.played)
        missing = checks.missing_results(fixtures, played, now)
        upcoming = [row for row in fixtures.itertuples(index=False) if (row.home_team, row.away_team) not in self.played]
        run = SimpleNamespace(
            notices=[], fixtures=fixtures, season="2026-27",
            missing=[update._match_record(row) for row in missing.itertuples(index=False)], called_off=[],
            sources_results=[], forget=set(),
            upcoming=upcoming, p_home=self.p_home, now=now,
        )
        return run, ""

    @staticmethod
    def build_snapshot(run, *, generated_at):
        stamp = generated_at.strftime("%Y-%m-%dT%H:%M:%SZ")
        return {
            "generated_at": stamp, "data_through": "2026-10-10", "provisional": False,
            "competition": {"season": "2026-27"},
            "run": {"code_commit": "abc123", "code_dirty": False, "config_hash": "sha256:" + "0" * 64},
            "upcoming_matches": [
                {"match_id": row.source_id, "date": pd.Timestamp(row.date).strftime("%Y-%m-%d"),
                 "kickoff_utc": row.kickoff_utc.strftime("%Y-%m-%dT%H:%M:%SZ"), "status": row.status,
                 "home_team": row.home_team, "away_team": row.away_team,
                 "probabilities": {"home": run.p_home, "draw": 0.3, "away": round(0.7 - run.p_home, 6)},
                 "expected_goals": {"home": 1.5, "away": 1.0}, "likely_scorelines": []}
                for row in run.upcoming
            ],
        }


@pytest.fixture
def day(monkeypatch):
    fake = _FakeDay()
    monkeypatch.setattr(update, "run_league", fake.run_league)
    monkeypatch.setattr(update, "build_snapshot", fake.build_snapshot)
    monkeypatch.setattr(update, "validate", lambda document, *args: [])
    monkeypatch.setattr(update, "load_competition",
                        lambda cid: SimpleNamespace(id=cid, name="Premier League", current_season="2026-27"))
    monkeypatch.setattr("tabletalk.pipeline.track_record.write_track_record", lambda *a, **k: {})
    return fake


def _try(out: Path, at: str, *, last_try: bool = False) -> RunResult:
    return update.run_update(["premier_league"], out_dir=out, now=T(at), locked_at=T(at), last_try=last_try)


def test_a_day_with_results_missing_runs_again_and_locks_the_newest_pre_kickoff_prediction(tmp_path, day):
    # 07:57: Sunday's Hull v Everton has no result yet (the source is slow).
    day.statuses = {HULL[0]: "TIMED"}
    first = _try(tmp_path, "2026-10-12T07:57:00Z")
    assert first.ok  # not the last try: published, no email
    assert [m["match_id"] for m in first.outcomes[0].missing] == ["fdorg:1"]
    assert not done_today(tmp_path, ["premier_league"], T("2026-10-12T11:00:00Z"))  # so the next try runs
    report = (tmp_path / "latest" / "run_report.md").read_text(encoding="utf-8")
    assert "Results not in yet (1): Hull City v Everton" in report

    # 17:00: the result is in. Atalanta v Venezia kicked off at 16:30 (the source still says TIMED).
    day.statuses = {HULL[0]: "FINISHED"}
    day.played = {("Hull City", "Everton")}
    day.p_home = 0.6
    second = _try(tmp_path, "2026-10-12T17:00:00Z")
    assert second.ok and not second.outcomes[0].missing
    assert done_today(tmp_path, ["premier_league"], T("2026-10-12T17:30:00Z"))  # later tries now skip
    assert len(list((tmp_path / "history").iterdir())) == 2  # one history folder per publishing try

    # Next morning both evening matches are finished: each keeps its newest pre-kick-off prediction.
    day.statuses = {HULL[0]: "FINISHED", ATALANTA[0]: "FINISHED", COVENTRY[0]: "FINISHED"}
    day.played = {("Hull City", "Everton"), ("Atalanta", "Venezia"), ("Coventry City", "Newcastle United")}
    _try(tmp_path, "2026-10-13T08:25:00Z")
    locks = {e["match_id"]: e for e in LockStore(tmp_path / "track_record").events() if e["event"] == "lock"}
    assert locks["fdorg:3"]["predicted_at"] == "2026-10-12T07:57:00Z"  # kicked off between the tries
    assert locks["fdorg:3"]["probabilities"]["home"] == 0.5
    assert locks["fdorg:2"]["predicted_at"] == "2026-10-12T17:00:00Z"  # the later try's prediction
    assert locks["fdorg:2"]["probabilities"]["home"] == 0.6


def test_the_last_try_with_results_still_missing_publishes_warns_and_fails(tmp_path, day):
    day.statuses = {HULL[0]: "TIMED"}
    result = _try(tmp_path, "2026-10-12T16:56:00Z", last_try=True)
    assert not result.ok
    assert (tmp_path / "latest" / "premier_league.json").exists()  # still published
    report = (tmp_path / "latest" / "run_report.md").read_text(encoding="utf-8")
    assert "WARNING: this was the day's last scheduled try" in report
    state = json.loads((tmp_path / "state" / "run_state.json").read_text(encoding="utf-8"))
    assert state["last_try"] is True and state["leagues"]["premier_league"]["results_complete"] is False


def test_the_frozen_first_seen_log_is_left_exactly_as_it_was(tmp_path, day):
    frozen = tmp_path / "state" / "results_seen.json"
    frozen.parent.mkdir(parents=True)
    frozen.write_bytes(b'{"matches": {}}\n')
    day.statuses = {HULL[0]: "FINISHED"}
    day.played = {("Hull City", "Everton")}
    _try(tmp_path, "2026-10-12T17:00:00Z")
    assert frozen.read_bytes() == b'{"matches": {}}\n'
    report = (tmp_path / "latest" / "run_report.md").read_text(encoding="utf-8")
    assert "first seen" not in report.lower()


def test_the_first_update_of_the_day_warns_when_close_to_kickoff_and_later_ones_do_not(tmp_path, day):
    day.statuses = {HULL[0]: "FINISHED"}
    day.played = {("Hull City", "Everton")}
    first = _try(tmp_path, "2026-10-12T16:00:00Z")  # 30 minutes before Atalanta v Venezia
    assert first.run_warnings and "only 30 minutes before" in first.run_warnings[0]
    assert "## Timing" in (tmp_path / "latest" / "run_report.md").read_text(encoding="utf-8")
    again = _try(tmp_path, "2026-10-12T16:10:00Z")
    assert again.run_warnings == []  # not the day's first update

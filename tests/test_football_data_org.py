"""football-data.org: parsing, the API key, throttling, and cross-source agreement.

Offline: the loader reads a response saved under tests/data/football_data_org/,
and every "download" goes to a fake ``requests.get``.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import pandas as pd
import pytest

from conftest import make_matches
from tabletalk.data.loaders import football_data_org as fdorg
from tabletalk.data.loaders.football_data_org import (
    FootballDataOrgError,
    FootballDataOrgLoader,
    RateLimiter,
)
from tabletalk.data.loaders.openfootball import OpenFootballLoader
from tabletalk.data.reconcile import SourceMismatchError, merge_results_sources
from tabletalk.data.seasons import Season

SAMPLE = Path(__file__).parent / "data" / "football_data_org" / "PL_2026-27.json"
FAKE_KEY = "test-key-0123456789abcdef"


@pytest.fixture(autouse=True)
def _fresh_run_cache():
    fdorg.clear_run_cache()
    yield
    fdorg.clear_run_cache()


@pytest.fixture
def cache_dir(tmp_path: Path) -> Path:
    directory = tmp_path / "raw"
    directory.mkdir()
    return directory


def _loader(cache_dir: Path) -> FootballDataOrgLoader:
    return FootballDataOrgLoader(
        "premier_league", competition_code="PL", seasons=["2026-27"], cache_dir=str(cache_dir)
    )


@pytest.fixture
def cached_loader(cache_dir: Path, monkeypatch) -> FootballDataOrgLoader:
    """A loader whose response is already cached, with no key in the environment."""
    monkeypatch.delenv("FOOTBALL_DATA_API_KEY", raising=False)
    shutil.copy(SAMPLE, cache_dir / "PL_2026-27.json")
    return _loader(cache_dir)


def _by_id(matches: pd.DataFrame, match_id: int) -> pd.Series:
    return matches.loc[matches["source_id"] == f"fdorg:{match_id}"].iloc[0]


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------


def test_url_uses_competition_code_and_season_start_year(cached_loader):
    assert cached_loader.url(Season.parse("2026-27")) == (
        "https://api.football-data.org/v4/competitions/PL/matches?season=2026"
    )


def test_finished_matches_are_results_with_the_full_time_score(cached_loader):
    matches = cached_loader.load()
    finished = _by_id(matches, 537001)
    assert bool(finished["played"])
    assert (finished["home_goals"], finished["away_goals"]) == (3, 0)
    assert finished["status"] == "FINISHED"


def test_a_match_in_progress_is_unplayed_and_its_score_is_dropped(cached_loader):
    live = _by_id(cached_loader.load(), 537020)
    assert not bool(live["played"])
    assert pd.isna(live["home_goals"]) and pd.isna(live["away_goals"])


def test_postponed_and_scheduled_matches_stay_as_fixtures_with_their_status(cached_loader):
    matches = cached_loader.load()
    assert _by_id(matches, 537016)["status"] == "POSTPONED"
    assert not bool(_by_id(matches, 537016)["played"])
    assert _by_id(matches, 537045)["status"] == "SCHEDULED"
    assert int(matches["played"].sum()) == 3


def test_kickoff_is_kept_in_utc_and_the_date_is_the_utc_date(cached_loader):
    timed = _by_id(cached_loader.load(), 537031)
    assert timed["kickoff_utc"] == pd.Timestamp("2026-10-10T11:30:00Z")
    assert str(timed["kickoff_utc"].tz) == "UTC"
    assert timed["date"] == pd.Timestamp("2026-10-10")
    assert timed["matchday"] == "Matchday 7"


def test_team_names_are_normalised(cached_loader):
    matches = cached_loader.load()
    teams = set(matches["home_team"]) | set(matches["away_team"])
    assert {"Arsenal", "Manchester United", "Bournemouth", "Nottingham Forest"} <= teams


def test_an_unknown_status_stops_the_load(cache_dir, monkeypatch):
    payload = json.loads(SAMPLE.read_text(encoding="utf-8"))
    payload["matches"][0]["status"] = "ABANDONED_BY_ALIENS"
    (cache_dir / "PL_2026-27.json").write_text(json.dumps(payload), encoding="utf-8")
    with pytest.raises(FootballDataOrgError, match="unknown match status"):
        _loader(cache_dir).load()


def test_a_finished_match_without_a_score_stops_the_load(cache_dir):
    payload = json.loads(SAMPLE.read_text(encoding="utf-8"))
    payload["matches"][0]["score"]["fullTime"] = {"home": None, "away": None}
    (cache_dir / "PL_2026-27.json").write_text(json.dumps(payload), encoding="utf-8")
    with pytest.raises(FootballDataOrgError, match="no full-time score"):
        _loader(cache_dir).load()


# ---------------------------------------------------------------------------
# The API key, downloading and caching
# ---------------------------------------------------------------------------


class _FakeResponse:
    def __init__(self, status_code: int, content: bytes = b"", headers=None, message: str = ""):
        self.status_code = status_code
        self.content = content
        self.headers = headers or {}
        self.reason = "reason"
        self._message = message

    def json(self):
        return {"message": self._message}

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


@pytest.fixture
def fake_api(monkeypatch):
    """Replace the network with a queue of responses; record every request."""
    calls: list[dict] = []
    responses: list[_FakeResponse] = []

    def fake_get(url, headers=None, timeout=None):
        calls.append({"url": url, "headers": dict(headers or {})})
        return responses.pop(0)

    monkeypatch.setattr(fdorg.requests, "get", fake_get)
    monkeypatch.setattr(fdorg, "_LIMITER", RateLimiter(10, 60, clock=lambda: 0.0, sleep=lambda s: None))
    monkeypatch.setattr(fdorg.time, "sleep", lambda seconds: None)
    return calls, responses


def test_no_key_and_no_cache_is_a_clear_error_naming_the_variable(cache_dir, monkeypatch, fake_api):
    monkeypatch.delenv("FOOTBALL_DATA_API_KEY", raising=False)
    calls, _ = fake_api
    with pytest.raises(FootballDataOrgError, match="FOOTBALL_DATA_API_KEY"):
        _loader(cache_dir).load()
    assert calls == []  # never tried the network without a key


def test_a_cached_response_needs_no_key(cached_loader, fake_api):
    calls, _ = fake_api
    assert len(cached_loader.load()) == 7
    assert calls == []


def test_the_key_goes_in_a_header_and_never_into_the_url_or_the_cache(cache_dir, monkeypatch, fake_api):
    monkeypatch.setenv("FOOTBALL_DATA_API_KEY", FAKE_KEY)
    calls, responses = fake_api
    responses.append(_FakeResponse(200, SAMPLE.read_bytes()))

    _loader(cache_dir).load(refresh=True)

    assert calls[0]["headers"] == {"X-Auth-Token": FAKE_KEY}
    assert FAKE_KEY not in calls[0]["url"]
    for path in cache_dir.rglob("*"):
        if path.is_file():
            assert FAKE_KEY not in path.read_text(encoding="utf-8")


def test_a_second_read_in_the_same_run_reuses_the_response(cache_dir, monkeypatch, fake_api):
    """`data check` reads each source twice; that must cost one request."""
    monkeypatch.setenv("FOOTBALL_DATA_API_KEY", FAKE_KEY)
    calls, responses = fake_api
    responses.append(_FakeResponse(200, SAMPLE.read_bytes()))

    loader = _loader(cache_dir)
    loader.load(refresh=True)
    loader.raw_team_names(refresh=True)
    _loader(cache_dir).load(refresh=True)
    assert len(calls) == 1


def test_rate_limited_response_waits_and_retries(cache_dir, monkeypatch, fake_api):
    monkeypatch.setenv("FOOTBALL_DATA_API_KEY", FAKE_KEY)
    calls, responses = fake_api
    responses.extend(
        [_FakeResponse(429, headers={"X-RequestCounter-Reset": "7"}), _FakeResponse(200, SAMPLE.read_bytes())]
    )
    assert len(_loader(cache_dir).load(refresh=True)) == 7
    assert len(calls) == 2


def test_a_refused_request_explains_itself_without_the_key(cache_dir, monkeypatch, fake_api, caplog):
    monkeypatch.setenv("FOOTBALL_DATA_API_KEY", FAKE_KEY)
    _, responses = fake_api
    responses.append(_FakeResponse(403, message="The resource you are looking for is restricted."))
    with caplog.at_level("DEBUG"):
        with pytest.raises(FootballDataOrgError, match="HTTP 403.*restricted") as error:
            _loader(cache_dir).load(refresh=True)
    assert FAKE_KEY not in str(error.value)
    assert FAKE_KEY not in caplog.text


def test_rate_limiter_waits_once_the_window_is_full():
    now = [0.0]
    slept: list[float] = []

    def sleep(seconds):
        slept.append(seconds)
        now[0] += seconds

    limiter = RateLimiter(10, 60, clock=lambda: now[0], sleep=sleep)
    for _ in range(10):
        limiter.wait()
        now[0] += 1.0  # ten requests, one a second
    assert slept == []
    limiter.wait()  # the eleventh must wait until the first is 60s old
    assert slept == [pytest.approx(50.0)]


def test_rate_limiter_follows_the_servers_remaining_request_count():
    """When the API says no requests are left, wait for its counter to reset."""
    now = [100.0]
    slept: list[float] = []

    def sleep(seconds):
        slept.append(seconds)
        now[0] += seconds

    limiter = RateLimiter(10, 60, clock=lambda: now[0], sleep=sleep)
    limiter.wait()
    limiter.observe({"X-RequestsAvailable": "3", "X-RequestCounter-Reset": "40"})
    limiter.wait()
    assert slept == []  # requests left: no wait
    limiter.observe({"X-RequestsAvailable": "0", "X-RequestCounter-Reset": "23"})
    limiter.wait()
    assert slept == [pytest.approx(23.0)]
    limiter.observe({})  # a response without the headers changes nothing
    limiter.wait()
    assert len(slept) == 1


# ---------------------------------------------------------------------------
# Two results sources: they must agree wherever they overlap
# ---------------------------------------------------------------------------


def test_results_sources_that_agree_are_merged_without_double_counting():
    uk = make_matches([("A", "B", 2, 1)])
    org = make_matches([("A", "B", 2, 1), ("C", "D", 0, 0)])
    org.loc[0, "date"] = uk.loc[0, "date"] + pd.Timedelta(days=1)  # dates may differ
    merged = merge_results_sources([("uk", uk), ("org", org)], label="toy")
    assert len(merged) == 2
    # The first source in config order supplies the shared match.
    assert merged.iloc[0]["date"] == uk.loc[0, "date"]


def test_a_source_that_lags_is_not_a_disagreement():
    uk = make_matches([("A", "B", 2, 1)])
    org = make_matches([("A", "B", 2, 1), ("C", "D", 0, 0), ("B", "A", 1, 1)])
    assert len(merge_results_sources([("uk", uk), ("org", org)], label="toy")) == 3


def test_results_sources_that_disagree_stop_the_run():
    uk = make_matches([("A", "B", 2, 1), ("C", "D", 1, 1)])
    org = make_matches([("A", "B", 2, 1), ("C", "D", 1, 0)])
    with pytest.raises(SourceMismatchError, match=r"C v D: uk 1-1, org 1-0"):
        merge_results_sources([("uk", uk), ("org", org)], label="toy")


# ---------------------------------------------------------------------------
# openfootball kick-off times in UTC (needs the league's timezone)
# ---------------------------------------------------------------------------


def test_openfootball_local_times_convert_to_utc_across_the_clock_change(tmp_path):
    cache = tmp_path / "raw"
    cache.mkdir()
    (cache / "en.1_2026-27.json").write_text(
        json.dumps(
            {"matches": [
                {"round": "Matchday 1", "date": "2026-08-21", "time": "20:00",
                 "team1": "Arsenal FC", "team2": "Coventry City FC"},
                {"round": "Matchday 14", "date": "2026-12-05", "time": "15:00",
                 "team1": "Everton FC", "team2": "Chelsea FC"},
                {"round": "Matchday 15", "date": "2026-12-12",
                 "team1": "Chelsea FC", "team2": "Everton FC"},
            ]}
        ),
        encoding="utf-8",
    )
    loader = OpenFootballLoader(
        "premier_league", league_code="en.1", seasons=["2026-27"], cache_dir=str(cache),
        timezone="Europe/London",
    )
    kickoffs = loader.load().sort_values("date")["kickoff_utc"].tolist()
    assert kickoffs[0] == pd.Timestamp("2026-08-21T19:00:00Z")  # BST: UTC+1
    assert kickoffs[1] == pd.Timestamp("2026-12-05T15:00:00Z")  # GMT: UTC+0
    assert pd.isna(kickoffs[2])  # no time in the file: unknown, not guessed


# ---------------------------------------------------------------------------
# Comparing fixture sources (protocol: reports/protocols/step1-fixture-source.md)
# ---------------------------------------------------------------------------


def _toy_schedule(played_dates: dict[tuple[str, str], str] | None = None) -> pd.DataFrame:
    teams = ["A", "B", "C", "D"]
    schedule = make_matches([(h, a, None, None) for h in teams for a in teams if h != a])
    schedule["date"] = pd.date_range("2025-08-09", periods=len(schedule), freq="7D")
    for (home, away), date in (played_dates or {}).items():
        target = (schedule["home_team"] == home) & (schedule["away_team"] == away)
        schedule.loc[target, "date"] = pd.Timestamp(date)
    return schedule


def test_comparison_counts_dates_that_disagree_with_when_the_match_was_played(four_team_config):
    from tabletalk.data.source_comparison import score_source

    results = make_matches([("A", "B", 1, 0)])
    results["date"] = pd.Timestamp("2025-08-09")  # A v B is the first scheduled match
    on_time = score_source("x", _toy_schedule(), results, four_team_config, "2025-26", kickoffs_in_utc=False)
    stale = score_source(
        "y", _toy_schedule({("A", "B"): "2025-12-01"}), results, four_team_config, "2025-26",
        kickoffs_in_utc=False,
    )
    assert on_time.c1_pass and len(on_time.c2_mismatches) == 0
    assert len(stale.c2_mismatches) == 1


def test_decision_rule_needs_every_league_to_pass(four_team_config):
    from tabletalk.data.source_comparison import SourceScore, decide

    def score(c1_ok=True, date_mismatches=0, utc=0):
        return SourceScore(
            source="s", matches=12, c1_problems=[] if c1_ok else ["short"], c2_compared=5,
            c2_mismatches=pd.DataFrame(index=range(date_mismatches)), c3_upcoming=7,
            c3_confirmed_utc=utc, c4_explicit_postponements=True, postponed_now=0,
        )

    good = (score(date_mismatches=1), score(date_mismatches=0, utc=7))
    assert decide({"one": good, "two": good})[0] == "football_data_org"
    worse_dates = (score(date_mismatches=0), score(date_mismatches=2, utc=7))
    assert decide({"one": good, "two": worse_dates})[0] == "openfootball"
    incomplete = (score(), score(c1_ok=False, utc=7))
    assert decide({"one": incomplete})[0] == "openfootball"


# ---------------------------------------------------------------------------
# Real responses (trimmed extracts saved 2026-09-28)
# ---------------------------------------------------------------------------

REAL = Path(__file__).parent / "data" / "football_data_org" / "real"
REAL_CODES = {"PL": "premier_league", "BL1": "bundesliga", "PD": "la_liga", "SA": "serie_a", "FL1": "ligue_1"}


@pytest.mark.parametrize("code", sorted(REAL_CODES))
def test_real_responses_parse_and_every_name_maps(code, cache_dir, monkeypatch):
    monkeypatch.delenv("FOOTBALL_DATA_API_KEY", raising=False)
    shutil.copy(REAL / f"{code}_2026-27.json", cache_dir / f"{code}_2026-27.json")
    loader = FootballDataOrgLoader(
        REAL_CODES[code], competition_code=code, seasons=["2026-27"], cache_dir=str(cache_dir)
    )
    matches = loader.load()  # strict names: raises if any name is unmapped
    finished = matches.loc[matches["status"] == "FINISHED"]
    assert len(finished) == 3 and finished["played"].all()
    assert finished["home_goals"].notna().all()
    timed = matches.loc[matches["status"] == "TIMED"]
    assert timed["kickoff_utc"].notna().all()


def test_a_scheduled_match_keeps_its_date_but_has_no_kickoff_time(cache_dir, monkeypatch):
    """The API puts SCHEDULED matches at 00:00 UTC as a placeholder; that is
    not a kick-off, and treating it as one would make locking wrong."""
    monkeypatch.delenv("FOOTBALL_DATA_API_KEY", raising=False)
    shutil.copy(REAL / "BL1_2026-27.json", cache_dir / "BL1_2026-27.json")
    matches = FootballDataOrgLoader(
        "bundesliga", competition_code="BL1", seasons=["2026-27"], cache_dir=str(cache_dir)
    ).load()
    scheduled = matches.loc[matches["status"] == "SCHEDULED"]
    assert len(scheduled) == 2
    assert scheduled["kickoff_utc"].isna().all()
    assert scheduled["date"].notna().all()


# ---------------------------------------------------------------------------
# Config: one fixture list, any number of cross-checks
# ---------------------------------------------------------------------------

_CONFIG = """
id: toy_league
name: Toy League
country: Nowhere
format: league
league: {{n_teams: 4, meetings_per_pair: 2, matches_per_team: 6}}
points: {{win: 3, draw: 1, loss: 0}}
tiebreakers: [goal_difference]
zones: [{{id: title, label: Champions, positions: [1]}}]
data:
  current_season: "2025-26"
  sources:
    - {{loader: football_data_uk, role: results, params: {{division: XX, seasons: ["2025-26"]}}}}
{extra}
"""


def _write_config(tmp_path: Path, extra: str):
    from tabletalk.config import load_competition

    directory = tmp_path / "competitions"
    directory.mkdir()
    (directory / "toy_league.yaml").write_text(_CONFIG.format(extra=extra), encoding="utf-8")
    return load_competition("toy_league", config_dir=directory)


def test_a_cross_check_source_is_a_valid_role(tmp_path):
    config = _write_config(
        tmp_path, '    - {loader: openfootball, role: check, params: {league_code: xx.1, seasons: ["2025-26"]}}'
    )
    assert [source.role for source in config.data_sources] == ["results", "check"]


def test_two_fixture_lists_are_refused(tmp_path):
    from tabletalk.config import ConfigError

    extra = "\n".join(
        f'    - {{loader: {name}, role: fixtures, params: {{league_code: xx.1, competition_code: XX, seasons: ["2025-26"]}}}}'
        for name in ("openfootball", "football_data_org")
    )
    with pytest.raises(ConfigError, match="more than one data source has role `fixtures`"):
        _write_config(tmp_path, extra)

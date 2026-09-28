"""football-data.org loader: the current season's results and schedule, from an API.

Not to be confused with football-data.co.uk (``football_data_uk.py``), which
stays the source for history, odds and second-tier context data. This loader
exists for the live season, where two things matter that the CSVs lack:

- kick-off times in UTC (needed to lock a prediction before kick-off), and
- an explicit match status, so a postponed match says so instead of simply
  staying unplayed.

API (v4, documented at https://docs.football-data.org/general/v4/):

``GET https://api.football-data.org/v4/competitions/<code>/matches?season=<start year>``

with the key in the ``X-Auth-Token`` header. Competition codes, from the
documentation's lookup table (checked 2026-09-28): ``PL`` Premier League,
``BL1`` Bundesliga, ``PD`` La Liga (Primera División), ``SA`` Serie A,
``FL1`` Ligue 1.

.. code-block:: json

    {"filters": {"season": "2026"},
     "competition": {"code": "PL", "name": "Premier League"},
     "matches": [
       {"id": 537001, "utcDate": "2026-08-21T19:00:00Z", "status": "FINISHED",
        "matchday": 1, "stage": "REGULAR_SEASON",
        "homeTeam": {"id": 57, "name": "Arsenal FC", "shortName": "Arsenal", "tla": "ARS"},
        "awayTeam": {"id": 1076, "name": "Coventry City FC", "shortName": "Coventry", "tla": "COV"},
        "score": {"winner": "HOME_TEAM", "duration": "REGULAR",
                  "fullTime": {"home": 3, "away": 0}, "halfTime": {"home": 2, "away": 0}}}]}

The API key
-----------
Read from the environment variable named by the ``api_key_env`` param
(default ``FOOTBALL_DATA_API_KEY``), and only when a download is needed: a run
that finds its responses cached never touches the key. The key travels in a
header, never in a URL, so it cannot end up in a log line, an error message or
a cached file.

Free-tier limits
----------------
10 requests per minute. A whole update needs one request per league (five), so
the throttle below is a safety net, not a bottleneck. It follows the API's
response headers (``X-RequestsAvailable``, ``X-RequestCounter-Reset``), as the
API's documentation asks. Each response is also
kept in memory for the rest of the process, so ``data check`` (which reads the
source twice) costs one request, not two. The free tier's scores are
"delayed" (not live), which is irrelevant for a once-a-day run.
"""

from __future__ import annotations

import json
import logging
import os
import time
from collections import deque
from pathlib import Path
from typing import Any, Callable, Iterable, Mapping

import pandas as pd
import requests

from ...paths import RAW_DATA_DIR, ensure_dir
from ..seasons import Season
from .base import MatchLoader

logger = logging.getLogger(__name__)

BASE_URL = "https://api.football-data.org/v4"
DEFAULT_API_KEY_ENV = "FOOTBALL_DATA_API_KEY"

#: What each API status means for TableTalk. Anything not listed stops the run:
#: a status we do not understand must not be guessed at.
PLAYED_STATUSES = frozenset({"FINISHED", "AWARDED"})
UNPLAYED_STATUSES = frozenset(
    {
        "SCHEDULED",   # date known, time not set: utcDate is a 00:00 UTC placeholder
        "TIMED",       # a kick-off time is given (in the Premier League this
                       # includes default 15:00 slots months ahead: not "final")
        "POSTPONED",   # will be replayed at a later date; still to be simulated
        "SUSPENDED",   # stopped part-way; outcome not final
        "CANCELLED",   # rare; flagged by `data check`, still counted as unplayed
    }
)
#: Matches in progress when the run happens. Their score is not final, so it is
#: dropped and they count as unplayed.
LIVE_STATUSES = frozenset({"IN_PLAY", "PAUSED", "EXTRA_TIME", "PENALTY_SHOOTOUT"})
KNOWN_STATUSES = PLAYED_STATUSES | UNPLAYED_STATUSES | LIVE_STATUSES


class FootballDataOrgError(RuntimeError):
    """The API could not be read (no key, key rejected, unexpected response)."""


class RateLimiter:
    """Throttle requests using two signals, whichever is stricter.

    1. The server's own count. Every response carries ``X-RequestsAvailable``
       (requests left before being blocked) and ``X-RequestCounter-Reset``
       (seconds until the counter resets). When none are left, the next
       request waits for the reset. This is what the API's author asks
       clients to do, and it stays right if the plan's limit changes.
    2. A local sliding window of ``max_calls`` per ``period`` seconds, as a
       backstop for responses without those headers.

    ``clock`` and ``sleep`` are injectable so tests can check the waiting
    without actually waiting.
    """

    def __init__(
        self,
        max_calls: int = 10,
        period: float = 60.0,
        *,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], None] = time.sleep,
    ):
        self.max_calls = max_calls
        self.period = period
        self._clock = clock
        self._sleep = sleep
        self._calls: deque[float] = deque()
        self._blocked_until: float | None = None

    def observe(self, headers: Mapping[str, str]) -> None:
        """Read the server's remaining-request count from a response."""
        try:
            available = int(headers["X-RequestsAvailable"])
            reset = float(headers["X-RequestCounter-Reset"])
        except (KeyError, TypeError, ValueError):
            return
        if available <= 0:
            self._blocked_until = self._clock() + reset

    def wait(self) -> None:
        """Block until one more request is allowed, then record it."""
        if self._blocked_until is not None:
            delay = self._blocked_until - self._clock()
            self._blocked_until = None
            if delay > 0:
                logger.info("football-data.org: no requests left; waiting %.1fs for the reset", delay)
                self._sleep(delay)
        now = self._clock()
        while self._calls and now - self._calls[0] >= self.period:
            self._calls.popleft()
        if len(self._calls) >= self.max_calls:
            delay = self.period - (now - self._calls[0])
            logger.info("football-data.org rate limit: waiting %.1fs", delay)
            self._sleep(delay)
            now = self._clock()
            self._calls.popleft()
        self._calls.append(now)


#: Shared by every loader instance in the process: the limit is per API key,
#: not per league. A 1-second margin allows for clock differences with the server.
_LIMITER = RateLimiter(max_calls=10, period=61.0)

#: Responses already fetched in this process, by URL. "Cache responses during a
#: run": a second read of the same league-season in one run reuses the first.
_RUN_CACHE: dict[str, bytes] = {}


def clear_run_cache() -> None:
    """Forget in-memory responses (tests, or a long-lived process)."""
    _RUN_CACHE.clear()


def api_key(env_var: str = DEFAULT_API_KEY_ENV) -> str:
    key = os.environ.get(env_var, "").strip()
    if not key:
        raise FootballDataOrgError(
            f"no football-data.org API key: set the environment variable {env_var} "
            "(register for a free key at https://www.football-data.org/client/register)"
        )
    return key


class FootballDataOrgLoader(MatchLoader):
    """One league's matches for the configured seasons, played and unplayed.

    Parameters (from ``data.sources[].params`` in a competition config):
        competition_code: football-data.org code, e.g. ``PL``.
        seasons: canonical season labels, e.g. ``["2026-27"]``.
        api_key_env: environment variable holding the key
            (default ``FOOTBALL_DATA_API_KEY``).
    """

    name = "football_data_org"
    kickoff_times_in_utc = True

    def __init__(self, competition: str, **params):
        super().__init__(competition, **params)
        try:
            self.competition_code: str = str(self.params["competition_code"])
            seasons: Iterable[str] = self.params["seasons"]
        except KeyError as exc:  # pragma: no cover - config validation path
            raise KeyError(
                f"{self.name} loader requires params: competition_code, seasons ({exc})"
            ) from exc
        self.seasons: tuple[Season, ...] = tuple(Season.parse(s) for s in seasons)
        self.api_key_env: str = str(self.params.get("api_key_env", DEFAULT_API_KEY_ENV))
        cache_dir = self.params.get("cache_dir")
        self.cache_dir: Path = Path(cache_dir) if cache_dir else RAW_DATA_DIR / self.name
        self.timeout: int = int(self.params.get("timeout_seconds", 30))

    # -- fetching -----------------------------------------------------------
    def url(self, season: Season) -> str:
        return f"{BASE_URL}/competitions/{self.competition_code}/matches?season={season.start_year}"

    def cache_path(self, season: Season) -> Path:
        return self.cache_dir / f"{self.competition_code}_{season.label}.json"

    def fetch_raw(self, *, refresh: bool = False) -> pd.DataFrame:
        """One row per match, as the API describes it (names not yet normalised)."""
        records: list[dict[str, Any]] = []
        for season in self.seasons:
            payload = json.loads(self._payload(season, refresh=refresh))
            matches = payload.get("matches")
            if not isinstance(matches, list) or not matches:
                raise FootballDataOrgError(
                    f"{self.competition_code} {season.label}: response has no `matches` array"
                )
            records.extend(_match_record(match, season) for match in matches)
        return pd.DataFrame.from_records(records)

    def _payload(self, season: Season, *, refresh: bool) -> bytes:
        url = self.url(season)
        path = self.cache_path(season)
        if url in _RUN_CACHE:
            return _RUN_CACHE[url]
        if refresh or not path.exists():
            content = self._download(url)
            ensure_dir(path.parent)
            path.write_bytes(content)
        else:
            content = path.read_bytes()
        _RUN_CACHE[url] = content
        return content

    def _download(self, url: str) -> bytes:
        headers = {"X-Auth-Token": api_key(self.api_key_env)}
        for _attempt in range(3):
            _LIMITER.wait()
            logger.info("downloading %s", url)
            response = requests.get(url, headers=headers, timeout=self.timeout)
            _LIMITER.observe(response.headers)
            if response.status_code == 429:
                # Over the limit anyway (another client on the same key?). The
                # API says how long until the counter resets.
                delay = float(response.headers.get("X-RequestCounter-Reset", 60))
                logger.warning("football-data.org returned 429; retrying in %.0fs", delay)
                time.sleep(delay)
                continue
            if response.status_code in (400, 401, 403, 404):
                raise FootballDataOrgError(
                    f"football-data.org refused {url} (HTTP {response.status_code}): "
                    f"{_api_message(response)}"
                )
            response.raise_for_status()
            return response.content
        raise FootballDataOrgError(f"football-data.org kept returning 429 for {url}")

    # -- mapping ------------------------------------------------------------
    def to_standard(self, raw: pd.DataFrame) -> pd.DataFrame:
        unknown = sorted(set(raw["status"]) - KNOWN_STATUSES)
        if unknown:
            raise FootballDataOrgError(
                f"{self.competition_code}: unknown match status(es) {unknown}; "
                "update the status lists in football_data_org.py before trusting this data"
            )
        played = raw["status"].isin(PLAYED_STATUSES)
        home_goals = pd.to_numeric(raw["home_goals"], errors="coerce").astype("Int64").where(played)
        away_goals = pd.to_numeric(raw["away_goals"], errors="coerce").astype("Int64").where(played)
        missing_score = played & (home_goals.isna() | away_goals.isna())
        if bool(missing_score.any()):
            raise FootballDataOrgError(
                f"{self.competition_code}: {int(missing_score.sum())} finished match(es) have no "
                "full-time score"
            )

        kickoff = pd.to_datetime(raw["utc_date"], utc=True, errors="coerce")
        # A SCHEDULED match's time is a 00:00 UTC placeholder (seen in every
        # SCHEDULED match on 2026-09-28): keep the date, but the kick-off is
        # unknown, so it must never be mistaken for a real one.
        known_time = kickoff.where(raw["status"] != "SCHEDULED")
        return pd.DataFrame(
            {
                # The UTC date. For these five leagues it is also the local date:
                # no league match kicks off after midnight UTC.
                "date": kickoff.dt.tz_localize(None).dt.normalize(),
                "competition": self.competition,
                "season": raw["season"].astype("string"),
                "home_team": raw["home_team"].astype("string").str.strip(),
                "away_team": raw["away_team"].astype("string").str.strip(),
                "home_goals": home_goals,
                "away_goals": away_goals,
                "neutral": False,
                "played": played.astype("boolean"),
                "matchday": raw["matchday"].map(
                    lambda value: f"Matchday {int(value)}" if pd.notna(value) else pd.NA
                ).astype("string"),
                "kickoff_utc": known_time,
                "status": raw["status"].astype("string"),
                "source_id": ("fdorg:" + raw["id"].astype("string")).astype("string"),
                "source": self.name,
            }
        )


def _match_record(match: dict[str, Any], season: Season) -> dict[str, Any]:
    full_time = ((match.get("score") or {}).get("fullTime")) or {}
    home = match.get("homeTeam") or {}
    away = match.get("awayTeam") or {}
    return {
        "id": match.get("id"),
        "season": season.label,
        "utc_date": match.get("utcDate"),
        "status": match.get("status"),
        "matchday": match.get("matchday"),
        # The full name ("Manchester United FC"): short names can be ambiguous.
        "home_team": home.get("name") or home.get("shortName"),
        "away_team": away.get("name") or away.get("shortName"),
        "home_goals": full_time.get("home"),
        "away_goals": full_time.get("away"),
    }


def _api_message(response: requests.Response) -> str:
    """The API's own error text (it never contains the key)."""
    try:
        return str(response.json().get("message", "")) or response.reason
    except ValueError:
        return response.reason

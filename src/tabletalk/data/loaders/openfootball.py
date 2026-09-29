"""openfootball loader: the published fixture list, with dates.

Why a second source at all: football-data.co.uk publishes *results*. To simulate
the rest of a season we need the *schedule* - which matches are left and when they
are played. That has to come from the real fixture list; guessing the remaining
pairings from the format would be reconstructing something the league already
publishes, and would silently go wrong for any competition that is not a balanced
round robin.

Why openfootball (https://github.com/openfootball/football.json):

- free, no API key, no rate limits, plain JSON over HTTPS;
- public-domain open data, and versioned in git, so a run can be pinned to a
  commit (``ref`` param) and reproduced exactly;
- one file per league-season with a consistent path, covering every league in
  Phase 1 and 2 (``en.1``, ``es.1``, ``it.1``, ``de.1``, ``fr.1``, ...);
- full club names ("Manchester United FC"), which the normaliser resolves against
  football-data's abbreviations ("Man United").

The alternative considered was fixturedownload.com, which also publishes complete
season CSVs. It is a fine fallback, but it is one site's export with no stated
licence or history, where openfootball is public-domain data with a commit log.

Caveat: openfootball is community-maintained, so a rescheduled match can take a
while to be corrected, and it carries scores of its own that may lag. TableTalk
uses it for the schedule only - results always come from the results source (see
``tabletalk.data.reconcile``).

Source format
-------------
``https://raw.githubusercontent.com/openfootball/football.json/<ref>/<season>/<league>.json``

.. code-block:: json

    {"name": "English Premier League 2026/27",
     "matches": [
       {"round": "Matchday 1", "date": "2026-08-21", "time": "20:00",
        "team1": "Arsenal FC", "team2": "Coventry City FC",
        "score": {"ht": [2, 0], "ft": [3, 0]}},
       {"round": "Matchday 6", "date": "2026-10-10", "time": "12:30",
        "team1": "Arsenal FC", "team2": "Leeds United FC"}]}

``score`` is absent for an unplayed fixture, and appears either as
``{"ht": [...], "ft": [...]}`` or as a bare ``[home, away]`` full-time pair.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Iterable

import pandas as pd
import requests

from ...paths import RAW_DATA_DIR, ensure_dir
from ..seasons import Season
from .base import MatchLoader, should_download

logger = logging.getLogger(__name__)

BASE_URL = "https://raw.githubusercontent.com/openfootball/football.json"


class OpenFootballLoader(MatchLoader):
    """Loads one league's full season schedule (played and unplayed) as JSON.

    Parameters (from ``data.sources[].params`` in a competition config):
        league_code: openfootball league file stem, e.g. ``en.1`` (Premier
            League), ``es.1`` (La Liga), ``de.1`` (Bundesliga).
        seasons: canonical season labels, e.g. ``["2026-27"]``. openfootball's
            directory names use the same convention.
        ref: git ref to fetch from (default ``master``). Pin a commit SHA for a
            fully reproducible run.
        timezone: IANA timezone of the kick-off times in the file, e.g.
            ``Europe/London``. The files give local times with no zone; with
            this set, the loader adds a ``kickoff_utc`` column. Assumption,
            checked against football-data.org's UTC times: the times are the
            league's local time.
    """

    name = "openfootball"

    def __init__(self, competition: str, **params):
        super().__init__(competition, **params)
        try:
            self.league_code: str = str(self.params["league_code"])
            seasons: Iterable[str] = self.params["seasons"]
        except KeyError as exc:  # pragma: no cover - config validation path
            raise KeyError(
                f"{self.name} loader requires params: league_code, seasons ({exc})"
            ) from exc
        self.seasons: tuple[Season, ...] = tuple(Season.parse(s) for s in seasons)
        self.ref: str = str(self.params.get("ref", "master"))
        cache_dir = self.params.get("cache_dir")
        self.cache_dir: Path = Path(cache_dir) if cache_dir else RAW_DATA_DIR / self.name
        self.timeout: int = int(self.params.get("timeout_seconds", 30))
        self.timezone: str | None = self.params.get("timezone")

    # -- fetching -----------------------------------------------------------
    def json_url(self, season: Season) -> str:
        return f"{BASE_URL}/{self.ref}/{season.label}/{self.league_code}.json"

    def cache_path(self, season: Season) -> Path:
        return self.cache_dir / f"{self.league_code}_{season.label}.json"

    def fetch_raw(self, *, refresh: bool = False) -> pd.DataFrame:
        """One row per scheduled match across the configured seasons.

        Pass ``refresh=True`` to re-download. During a live season you want it:
        both the results and the schedule move (postponements, TV rescheduling).
        """
        records: list[dict[str, Any]] = []
        for season in self.seasons:
            path = self.cache_path(season)
            if should_download(refresh, season, path):
                self._download(season, path)
            payload = json.loads(path.read_text(encoding="utf-8"))
            matches = payload.get("matches")
            if not isinstance(matches, list) or not matches:
                raise ValueError(f"{path}: no `matches` array found")
            for match in matches:
                home_goals, away_goals = _full_time_score(match.get("score"))
                records.append(
                    {
                        "date": match.get("date"),
                        "time": match.get("time"),
                        "season": season.label,
                        "home_team": match.get("team1"),
                        "away_team": match.get("team2"),
                        "home_goals": home_goals,
                        "away_goals": away_goals,
                        "matchday": match.get("round"),
                    }
                )
        if not records:
            raise ValueError(f"{self.name} loader for {self.competition}: no seasons configured")
        return pd.DataFrame.from_records(records)

    def _download(self, season: Season, path: Path) -> None:
        url = self.json_url(season)
        logger.info("downloading %s -> %s", url, path)
        response = requests.get(url, timeout=self.timeout)
        if response.status_code == 404:
            raise ValueError(
                f"{url} not found: openfootball has no {self.league_code} file for "
                f"{season.label} (yet). Check the league code and season."
            )
        response.raise_for_status()
        ensure_dir(path.parent)
        path.write_bytes(response.content)

    # -- mapping ------------------------------------------------------------
    def to_standard(self, raw: pd.DataFrame) -> pd.DataFrame:
        frame = raw.dropna(subset=["home_team", "away_team"]).copy()

        home_goals = pd.to_numeric(frame["home_goals"], errors="coerce").astype("Int64")
        away_goals = pd.to_numeric(frame["away_goals"], errors="coerce").astype("Int64")
        played = home_goals.notna() & away_goals.notna()

        out = pd.DataFrame(
            {
                # ISO dates here, so no day-first ambiguity to resolve.
                "date": pd.to_datetime(frame["date"], errors="coerce"),
                "competition": self.competition,
                "season": frame["season"].astype("string"),
                "home_team": frame["home_team"].astype("string").str.strip(),
                "away_team": frame["away_team"].astype("string").str.strip(),
                "home_goals": home_goals,
                "away_goals": away_goals,
                "neutral": False,
                "played": played.astype("boolean"),
                "matchday": frame["matchday"].astype("string"),
                "source": self.name,
            }
        )
        if self.timezone:
            out["kickoff_utc"] = _kickoff_utc(frame["date"], frame["time"], self.timezone)

        undated = out["date"].isna() & out["played"].fillna(False).astype(bool)
        if int(undated.sum()):
            # A played match with no date cannot be time-weighted; a scheduled
            # match with no date is legal (TBC fixtures) and kept.
            logger.warning(
                "%s: %d played match(es) have no date and are dropped", self.name, int(undated.sum())
            )
            out = out.loc[~undated]
        return out.reset_index(drop=True)


def _kickoff_utc(dates: pd.Series, times: pd.Series, timezone: str) -> pd.Series:
    """Local date + local time -> UTC timestamp; NaT where the time is missing."""
    local = pd.to_datetime(
        dates.astype("string") + " " + times.astype("string"), format="%Y-%m-%d %H:%M", errors="coerce"
    )
    # A kick-off inside the one-hour autumn clock change would be ambiguous;
    # none is ever scheduled then, so NaT (not a guess) is the right answer.
    return local.dt.tz_localize(timezone, ambiguous="NaT", nonexistent="NaT").dt.tz_convert("UTC")


def _full_time_score(score: Any) -> tuple[int | None, int | None]:
    """Extract the full-time score from either shape openfootball uses."""
    if isinstance(score, dict):
        full_time = score.get("ft")
    elif isinstance(score, list):
        full_time = score
    else:
        full_time = None
    if isinstance(full_time, (list, tuple)) and len(full_time) == 2:
        try:
            return int(full_time[0]), int(full_time[1])
        except (TypeError, ValueError):
            return None, None
    return None, None

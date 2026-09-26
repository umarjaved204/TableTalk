"""football-data.co.uk loader.

Why this source for Phase 1: it is free, needs no API key, publishes one CSV per
league per season with a stable column layout going back to the 1990s, and is
updated during the season. It covers England's top tiers plus the other major
European leagues (used in Phase 2), which is exactly the Phase 1/2 scope.

What it does *not* cover: the Champions League and other UEFA competitions, so
Phase 3 will add a second loader alongside this one.

Source layout
-------------
``https://www.football-data.co.uk/mmz4281/<season code>/<division>.csv``
e.g. ``mmz4281/2526/E0.csv`` for the 2025-26 Premier League. The columns we use:

======  ==================================================
Date    kick-off date, ``dd/mm/yyyy`` (``dd/mm/yy`` in older files)
HomeTeam / AwayTeam  team names, source spelling
FTHG / FTAG          full-time goals
======  ==================================================

Everything else in the file (half-time scores, shots, cards, bookmaker odds) is
ignored here. The odds columns are worth revisiting later as a benchmark to
compare the model against; they are not used as model input.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Iterable

import pandas as pd
import requests

from ...paths import RAW_DATA_DIR, ensure_dir
from ..seasons import Season
from .base import MatchLoader

logger = logging.getLogger(__name__)

BASE_URL = "https://www.football-data.co.uk/mmz4281"

#: Columns we read. Requesting them explicitly means a change elsewhere in the
#: file (they add bookmakers regularly) cannot break the loader silently.
_USED_COLUMNS = ["Date", "HomeTeam", "AwayTeam", "FTHG", "FTAG"]


class FootballDataUKLoader(MatchLoader):
    """Loads one division across several seasons from football-data.co.uk.

    Parameters (from ``data.sources[].params`` in a competition config):
        division: source division code, e.g. ``E0`` (Premier League),
            ``SP1`` (La Liga), ``D1`` (Bundesliga).
        seasons: canonical season labels, e.g. ``["2024-25", "2025-26"]``.
        cache_dir: optional override for where downloads are kept.
    """

    name = "football_data_uk"

    def __init__(self, competition: str, **params):
        super().__init__(competition, **params)
        try:
            self.division: str = str(self.params["division"])
            seasons: Iterable[str] = self.params["seasons"]
        except KeyError as exc:  # pragma: no cover - config validation path
            raise KeyError(f"{self.name} loader requires params: division, seasons ({exc})") from exc
        self.seasons: tuple[Season, ...] = tuple(Season.parse(s) for s in seasons)
        cache_dir = self.params.get("cache_dir")
        self.cache_dir: Path = Path(cache_dir) if cache_dir else RAW_DATA_DIR / self.name
        self.timeout: int = int(self.params.get("timeout_seconds", 30))

    # -- fetching -----------------------------------------------------------
    def csv_url(self, season: Season) -> str:
        return f"{BASE_URL}/{season.football_data_code}/{self.division}.csv"

    def cache_path(self, season: Season) -> Path:
        return self.cache_dir / f"{self.division}_{season.football_data_code}.csv"

    def fetch_raw(self, *, refresh: bool = False) -> pd.DataFrame:
        """Return every configured season's rows, downloading what is missing.

        Files are cached under ``data/raw/football_data_uk/``. Pass
        ``refresh=True`` to re-download; you need it during a live season,
        because a cached current-season file stops at the date you fetched it.
        """
        frames: list[pd.DataFrame] = []
        for season in self.seasons:
            path = self.cache_path(season)
            if refresh or not path.exists():
                self._download(season, path)
            frame = _read_csv_tolerantly(path)
            missing = [column for column in _USED_COLUMNS if column not in frame.columns]
            if missing:
                raise ValueError(f"{path}: expected column(s) {missing} not found")
            frame = frame.loc[:, _USED_COLUMNS].copy()
            frame["season"] = season.label
            frames.append(frame)
        if not frames:
            raise ValueError(f"{self.name} loader for {self.competition}: no seasons configured")
        return pd.concat(frames, ignore_index=True)

    def _download(self, season: Season, path: Path) -> None:
        url = self.csv_url(season)
        logger.info("downloading %s -> %s", url, path)
        response = requests.get(url, timeout=self.timeout)
        response.raise_for_status()
        if not response.content.strip():
            raise ValueError(f"{url} returned an empty file (season not published yet?)")
        ensure_dir(path.parent)
        path.write_bytes(response.content)

    # -- mapping ------------------------------------------------------------
    def to_standard(self, raw: pd.DataFrame) -> pd.DataFrame:
        frame = raw.copy()

        # Drop the blank trailing rows these files often end with.
        frame = frame.dropna(subset=["HomeTeam", "AwayTeam"], how="any")

        dates = _parse_dates(frame["Date"])
        home_goals = pd.to_numeric(frame["FTHG"], errors="coerce").astype("Int64")
        away_goals = pd.to_numeric(frame["FTAG"], errors="coerce").astype("Int64")

        out = pd.DataFrame(
            {
                "date": dates,
                "competition": self.competition,
                "season": frame["season"].astype("string"),
                "home_team": frame["HomeTeam"].astype("string").str.strip(),
                "away_team": frame["AwayTeam"].astype("string").str.strip(),
                "home_goals": home_goals,
                "away_goals": away_goals,
                # Every match in these files is at the home team's ground.
                "neutral": False,
                "played": home_goals.notna() & away_goals.notna(),
                "source": self.name,
            }
        )

        # A row with no parseable date is unusable; a row with no score is a
        # fixture the source has not filled in yet. Both are dropped here, and
        # counted in the log so a source change does not pass unnoticed.
        unusable = out["date"].isna()
        if int(unusable.sum()):
            logger.warning("%s: dropping %d row(s) with an unparseable date", self.name, int(unusable.sum()))
        out = out.loc[~unusable]

        unplayed = ~out["played"].astype(bool)
        if int(unplayed.sum()):
            logger.info(
                "%s: dropping %d row(s) with no full-time score (not played yet or abandoned)",
                self.name,
                int(unplayed.sum()),
            )
            # Goals must be null for unplayed rows; here we simply drop them,
            # because this source lists results, and upcoming fixtures for a
            # round-robin league are derived instead (see data/fixtures.py).
            out = out.loc[out["played"].astype(bool)]

        out["played"] = out["played"].astype("boolean")
        return out.reset_index(drop=True)


def _read_csv_tolerantly(path: Path) -> pd.DataFrame:
    """Read a football-data CSV, coping with its BOM and legacy encodings."""
    for encoding in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            return pd.read_csv(path, encoding=encoding, on_bad_lines="skip")
        except UnicodeDecodeError:
            continue
    raise ValueError(f"could not decode {path} with utf-8, cp1252 or latin-1")


def _parse_dates(values: pd.Series) -> pd.Series:
    """Parse day-first dates, tolerating the two- and four-digit year mix.

    Older files use ``17/08/02``, newer ones ``17/08/2002``; pandas is asked to
    treat each value on its own terms rather than inferring one format.
    """
    return pd.to_datetime(values, dayfirst=True, format="mixed", errors="coerce")

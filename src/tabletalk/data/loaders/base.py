"""The loader interface every data source implements.

A loader's only job: turn some source of truth into the standard match frame
(see ``tabletalk.data.schema``). It does not know about models, tables or
brackets, and nothing downstream knows which loader produced a row.

Adding a source in a later phase means writing one subclass and registering it,
not editing anything that already works.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Collection, Mapping, Union

import pandas as pd

from ..normalise import TeamNameNormaliser, default_normaliser
from ..schema import validate_matches

#: ``refresh`` is either True/False (every season, or none) or a collection of
#: season labels to re-download, e.g. ``{"2026-27"}``: a nightly run needs the
#: season in progress, not 17 seasons of unchanging history.
Refresh = Union[bool, Collection[str]]


def should_download(refresh: Refresh, season: Any, path: Path) -> bool:
    """Download when there is no cached copy, or when ``refresh`` asks for this season."""
    if not path.exists():
        return True
    if isinstance(refresh, bool):
        return refresh
    return str(getattr(season, "label", season)) in {str(label) for label in refresh}


class MatchLoader(ABC):
    """Base class for match-results loaders.

    Subclasses implement :meth:`fetch_raw` (get the data, in whatever shape the
    source provides) and :meth:`to_standard` (map it onto the standard schema).
    :meth:`load` runs both, normalises team names and validates the result, so
    every loader inherits the same guarantees.
    """

    #: Registry key used in competition configs (``data.sources[].loader``).
    name: str = ""

    #: True when the source itself states kick-off times in UTC (so a
    #: ``kickoff_utc`` column needs no timezone assumption).
    kickoff_times_in_utc: bool = False

    def __init__(
        self,
        competition: str,
        *,
        normaliser: TeamNameNormaliser | None = None,
        **params: Any,
    ):
        self.competition = competition
        self.params: Mapping[str, Any] = params
        self._normaliser = normaliser or default_normaliser()

    # -- to implement -------------------------------------------------------
    @abstractmethod
    def fetch_raw(self, *, refresh: bool = False) -> pd.DataFrame:
        """Return the source's data as-is (download or read from cache)."""

    @abstractmethod
    def to_standard(self, raw: pd.DataFrame) -> pd.DataFrame:
        """Map the source's columns onto the standard match schema."""

    # -- shared behaviour ---------------------------------------------------
    def load(self, *, refresh: bool = False, strict_names: bool = True) -> pd.DataFrame:
        """Fetch, map, normalise team names, validate. The only public entry point."""
        raw = self.fetch_raw(refresh=refresh)
        frame = self.to_standard(raw)
        frame = self.normalise_team_names(frame, strict=strict_names)
        return validate_matches(frame, source=f"{self.name or type(self).__name__} loader")

    def normalise_team_names(self, frame: pd.DataFrame, *, strict: bool = True) -> pd.DataFrame:
        out = frame.copy()
        for column in ("home_team", "away_team"):
            out[column] = self._normaliser.normalise_series(out[column], strict=strict)
        return out

    def load_odds(self, *, refresh: bool = False) -> pd.DataFrame | None:
        """Pre-match 1X2 odds, if this source publishes them; None if it does not.

        Odds are a *benchmark* (what the betting market thought), never an input
        to the model, so they stay out of the standard match schema. A source
        that has them returns one row per match: ``season``, ``date``,
        ``home_team``, ``away_team`` (normalised names), ``odds_home``,
        ``odds_draw``, ``odds_away`` (decimal odds) and ``odds_source`` (which
        bookmaker's prices they are).
        """
        return None

    def raw_team_names(self, *, refresh: bool = False) -> list[str]:
        """Distinct team names as the source spells them (for alias-map upkeep)."""
        frame = self.to_standard(self.fetch_raw(refresh=refresh))
        names = pd.concat([frame["home_team"], frame["away_team"]]).dropna().astype(str)
        return sorted(set(names))

    def __repr__(self) -> str:  # pragma: no cover - debugging convenience
        return f"{type(self).__name__}(competition={self.competition!r}, params={dict(self.params)!r})"

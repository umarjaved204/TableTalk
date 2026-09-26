"""Season labels.

TableTalk's canonical label for a season that spans two calendar years is
``"2025-26"``. Leagues played inside one calendar year (MLS, Brazil) would use
``"2026"``; both are supported so Phase 2+ does not need a new convention.

Sources encode seasons differently (football-data.co.uk uses ``2526``), so each
loader converts from the canonical label rather than the config carrying
source-specific codes.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

_SPLIT_SEASON = re.compile(r"^(\d{4})[-/](\d{2}|\d{4})$")
_SINGLE_SEASON = re.compile(r"^(\d{4})$")


@dataclass(frozen=True, order=True)
class Season:
    """A season label, parsed into its start year."""

    start_year: int
    spans_two_years: bool = True

    @classmethod
    def parse(cls, label: str) -> "Season":
        text = str(label).strip()
        match = _SPLIT_SEASON.match(text)
        if match:
            start = int(match.group(1))
            end_raw = match.group(2)
            end = int(end_raw) if len(end_raw) == 4 else (start // 100) * 100 + int(end_raw)
            # Handle the century rollover, e.g. "1999-00".
            if end < start:
                end += 100
            if end != start + 1:
                raise ValueError(
                    f"season {label!r} does not span consecutive years "
                    f"({start} to {end}); expected e.g. '2025-26'"
                )
            return cls(start_year=start, spans_two_years=True)
        match = _SINGLE_SEASON.match(text)
        if match:
            return cls(start_year=int(match.group(1)), spans_two_years=False)
        raise ValueError(f"unrecognised season label {label!r} (expected '2025-26' or '2026')")

    @property
    def label(self) -> str:
        if not self.spans_two_years:
            return str(self.start_year)
        return f"{self.start_year}-{(self.start_year + 1) % 100:02d}"

    @property
    def football_data_code(self) -> str:
        """football-data.co.uk directory code, e.g. "2526" for 2025-26."""
        if not self.spans_two_years:
            raise ValueError(
                "football-data.co.uk only publishes two-year seasons; "
                f"{self.label!r} is a single-calendar-year season"
            )
        return f"{self.start_year % 100:02d}{(self.start_year + 1) % 100:02d}"

    def __str__(self) -> str:  # pragma: no cover - convenience only
        return self.label


def canonical_season(label: str) -> str:
    """Normalise any accepted season spelling to the canonical label."""
    return Season.parse(label).label

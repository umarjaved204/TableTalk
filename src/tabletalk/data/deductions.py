"""Points deductions, read from ``configs/points_deductions.yaml``.

A league table is normally just the sum of results, but a governing body can
also add or remove points: for a breach of financial rules, for fielding an
ineligible player, for entering administration. Those decisions are facts about
a competition, so they live in a data file with a source link for each one, not
in code.

Each entry is a dated *change* to a team's total. An appeal that reduces a
deduction is a separate entry that gives points back, so the table on any date
is exactly what the official table showed that day.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Sequence

import numpy as np
import pandas as pd
import yaml

from ..paths import CONFIG_DIR
from .seasons import Season

DEDUCTIONS_FILE = CONFIG_DIR / "points_deductions.yaml"

_REQUIRED = ("competition", "season", "team", "points", "date_applied", "source")


class DeductionError(ValueError):
    """Raised when the deductions file is malformed or names an unknown team."""


def load_points_deductions(path: Path | None = None) -> pd.DataFrame:
    """Every entry in the deductions file, validated, one row per decision."""
    return _load(Path(path or DEDUCTIONS_FILE)).copy()


@lru_cache(maxsize=4)
def _load(path: Path) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame(columns=[*_REQUIRED, "reason"])
    with path.open("r", encoding="utf-8") as handle:
        raw = yaml.safe_load(handle) or {}
    entries = raw.get("deductions") or []
    rows = []
    for number, entry in enumerate(entries, start=1):
        missing = [key for key in _REQUIRED if entry.get(key) in (None, "")]
        if missing:
            raise DeductionError(f"{path}: entry {number} is missing {missing}")
        points = entry["points"]
        if not isinstance(points, int) or points == 0:
            raise DeductionError(f"{path}: entry {number} needs a non-zero whole number of points, got {points!r}")
        season = Season.parse(str(entry["season"])).label
        date = pd.Timestamp(str(entry["date_applied"]))
        if not str(entry["source"]).startswith("http"):
            raise DeductionError(f"{path}: entry {number} needs a source link")
        rows.append(
            {
                "competition": str(entry["competition"]),
                "season": season,
                "team": str(entry["team"]),
                "points": int(points),
                "date_applied": date,
                "source": str(entry["source"]),
                "reason": " ".join(str(entry.get("reason", "")).split()),
            }
        )
    return pd.DataFrame(rows, columns=[*_REQUIRED, "reason"])


def points_adjustments(
    competition: str,
    season: str,
    teams: Sequence[str],
    *,
    as_of: str | pd.Timestamp | None = None,
    deductions: pd.DataFrame | None = None,
) -> np.ndarray:
    """Net points change for each of ``teams`` (in that order) in one season.

    ``as_of``: only decisions dated strictly before it count, matching how
    results are cut off when a season is replayed from a date. None means
    every decision on file.

    Raises if a decision names a team not in the season: that is a typo or a
    missing alias, and silently ignoring it would leave the table wrong.
    """
    table = load_points_deductions() if deductions is None else deductions
    rows = table.loc[(table["competition"] == competition) & (table["season"] == season)]
    if as_of is not None:
        rows = rows.loc[rows["date_applied"] < pd.Timestamp(as_of)]
    index = {team: i for i, team in enumerate(teams)}
    unknown = sorted(set(rows["team"]) - set(index))
    if unknown:
        raise DeductionError(
            f"points deductions for {competition} {season} name team(s) {unknown} "
            "that are not in that season's data (check the canonical name)"
        )
    out = np.zeros(len(teams), dtype=int)
    for team, points in zip(rows["team"], rows["points"]):
        out[index[team]] += int(points)
    return out


__all__ = ["DEDUCTIONS_FILE", "DeductionError", "load_points_deductions", "points_adjustments"]

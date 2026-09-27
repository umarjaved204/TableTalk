"""Results of position play-offs that were actually played, from configs/playoff_results.yaml.

When a league decides a place with a one-off match (Serie A since 2022-23, for
the title and for the last place above the drop zone), the final table depends
on a result that is not a league match. Simulated seasons play such matches
with the match model; for a *real* past season the result is a fact, recorded
here with its source, the same way points deductions are.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import pandas as pd
import yaml

from ..paths import CONFIG_DIR
from .seasons import Season

PLAYOFF_RESULTS_FILE = CONFIG_DIR / "playoff_results.yaml"
_REQUIRED = ("competition", "season", "winner", "loser", "source")


class PlayoffResultError(ValueError):
    """Raised when the play-off results file is malformed."""


def load_playoff_results(path: Path | None = None) -> pd.DataFrame:
    """Every recorded play-off, one row per match."""
    return _load(Path(path or PLAYOFF_RESULTS_FILE)).copy()


@lru_cache(maxsize=4)
def _load(path: Path) -> pd.DataFrame:
    columns = [*_REQUIRED, "score", "date"]
    if not path.exists():
        return pd.DataFrame(columns=columns)
    with path.open("r", encoding="utf-8") as handle:
        entries = (yaml.safe_load(handle) or {}).get("playoffs") or []
    rows = []
    for number, entry in enumerate(entries, start=1):
        missing = [key for key in _REQUIRED if not entry.get(key)]
        if missing:
            raise PlayoffResultError(f"{path}: entry {number} is missing {missing}")
        rows.append({
            "competition": str(entry["competition"]),
            "season": Season.parse(str(entry["season"])).label,
            "winner": str(entry["winner"]),
            "loser": str(entry["loser"]),
            "source": str(entry["source"]),
            "score": str(entry.get("score", "")),
            "date": str(entry.get("date", "")),
        })
    return pd.DataFrame(rows, columns=columns)


def recorded_playoff_winner(competition: str, season: str, first: str, second: str) -> str | None:
    """The winner of a recorded play-off between two clubs, or None if none is recorded."""
    table = load_playoff_results()
    pair = {first, second}
    rows = table.loc[(table["competition"] == competition) & (table["season"] == season)]
    for winner, loser in zip(rows["winner"], rows["loser"]):
        if {winner, loser} == pair:
            return winner
    return None


__all__ = ["PLAYOFF_RESULTS_FILE", "PlayoffResultError", "load_playoff_results", "recorded_playoff_winner"]

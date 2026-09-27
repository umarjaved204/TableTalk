"""Results changed off the pitch, from configs/awarded_results.yaml.

A disciplinary body can overturn a result: Verona v Roma, Serie A 2020-21,
finished 0-0 but was awarded 3-0 to Verona because Roma fielded an ineligible
player. The league table uses the awarded result; the match model keeps the
real one, because 0-0 is what the two teams actually produced.

Some leagues count the win but not the goals (France records a forfeit as 0-0
won by the other side): an entry's optional ``result`` (home_win / draw /
away_win) then decides the points, and its goals are the goals counted.

Each entry is dated, like a points deduction: a table rebuilt (or a season
replayed) from before the decision shows the result as it stood then.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import pandas as pd
import yaml

from ..paths import CONFIG_DIR
from .seasons import Season

AWARDED_RESULTS_FILE = CONFIG_DIR / "awarded_results.yaml"
_REQUIRED = ("competition", "season", "home_team", "away_team", "home_goals", "away_goals", "date_applied", "source")
_RESULTS = {"home_win": 0, "draw": 1, "away_win": 2}


class AwardedResultError(ValueError):
    """Raised when the awarded-results file is malformed."""


def load_awarded_results(path: Path | None = None) -> pd.DataFrame:
    return _load(Path(path or AWARDED_RESULTS_FILE)).copy()


@lru_cache(maxsize=4)
def _load(path: Path) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame(columns=[*_REQUIRED, "reason", "result"])
    with path.open("r", encoding="utf-8") as handle:
        entries = (yaml.safe_load(handle) or {}).get("awarded") or []
    rows = []
    for number, entry in enumerate(entries, start=1):
        missing = [key for key in _REQUIRED if entry.get(key) in (None, "")]
        if missing:
            raise AwardedResultError(f"{path}: entry {number} is missing {missing}")
        result = entry.get("result")
        if result is not None and result not in _RESULTS:
            raise AwardedResultError(f"{path}: entry {number} result {result!r}; expected one of {sorted(_RESULTS)}")
        rows.append({
            "result": result,
            "competition": str(entry["competition"]),
            "season": Season.parse(str(entry["season"])).label,
            "home_team": str(entry["home_team"]),
            "away_team": str(entry["away_team"]),
            "home_goals": int(entry["home_goals"]),
            "away_goals": int(entry["away_goals"]),
            "date_applied": pd.Timestamp(str(entry["date_applied"])),
            "source": str(entry["source"]),
            "reason": " ".join(str(entry.get("reason", "")).split()),
        })
    return pd.DataFrame(rows, columns=[*_REQUIRED, "reason", "result"])


def apply_awarded_results(
    rows: pd.DataFrame,
    competition: str,
    *,
    as_of: str | pd.Timestamp | None = None,
    awarded: pd.DataFrame | None = None,
) -> pd.DataFrame:
    """``rows`` with the scores of awarded matches replaced (decisions before ``as_of`` only).

    For tables only: never pass the result to the match model.
    """
    table = load_awarded_results() if awarded is None else awarded
    table = table.loc[table["competition"] == competition]
    if as_of is not None:
        table = table.loc[table["date_applied"] < pd.Timestamp(as_of)]
    if table.empty or rows.empty:
        return rows
    out = rows.copy()
    for entry in table.itertuples(index=False):
        match = (
            (out["season"].astype(str) == entry.season)
            & (out["home_team"] == entry.home_team)
            & (out["away_team"] == entry.away_team)
            & out["played"].fillna(False).astype(bool)
        )
        out.loc[match, "home_goals"] = entry.home_goals
        out.loc[match, "away_goals"] = entry.away_goals
        if isinstance(entry.result, str):
            if "forced_outcome" not in out.columns:
                out["forced_outcome"] = pd.Series(pd.NA, index=out.index, dtype="Int64")
            out.loc[match, "forced_outcome"] = _RESULTS[entry.result]
    return out


__all__ = ["AWARDED_RESULTS_FILE", "AwardedResultError", "apply_awarded_results", "load_awarded_results"]

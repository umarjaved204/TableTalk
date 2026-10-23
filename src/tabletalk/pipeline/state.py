"""Working files that carry the pipeline from one run to the next.

Both live under ``<out>/state/`` on the ``data`` branch. They are working
files, not part of the data contract (like ``track_record/pending.json``): the
website must not read them, and their format can change without a version
bump.

``run_state.json``: is today done?
-----------------------------------
Written by every run. A day is **done** when the latest run updated every
league and every league's results were complete (no match that should have
finished was missing its final score; see ``checks.missing_results``). Until
then each scheduled try runs the whole update again.

It fails safe: a missing, unreadable or malformed file, a file from another
day, or a league it does not mention all mean "not done", so the update runs.
Running once too often costs a minute; skipping wrongly costs a day.

``results_seen.json``: frozen, no longer written
---------------------------------------------------
Was meant to show how soon each results source has a final score. Written
from 13 to 23 Oct 2026, then stopped: the delays it recorded were bounded by
our own run times (9 to 18 hours after kick-off), so it could not answer that
question. The file stays on the ``data`` branch as it was (the publish check
forbids deletions there); nothing reads or writes it.

``known_results.json``: every final score a source has given
--------------------------------------------------------------
For every played match of the current season, the final score as the results
sources last gave it, with the fixture source's match id. football-data.org
has been seen to list finished matches as TIMED again for a while, with no
score; while it does, and no other source has the score yet, the run takes it
from here (``known_results.restore``), so a result never disappears from the
table, the predictions or the track record once it has been published.

A live source always wins: a score here that a source now gives differently is
replaced (and the run warns). An entry is removed when the fixture source says
the match was called off after all. Unlike the two files above this one
matters to the numbers, but losing it is still safe: the run then works from
what the sources give, as it did before the file existed.
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path

import pandas as pd

logger = logging.getLogger(__name__)

RUN_STATE = Path("state") / "run_state.json"
KNOWN_RESULTS = Path("state") / "known_results.json"


# ---------------------------------------------------------------------------
# run_state.json
# ---------------------------------------------------------------------------


def write_run_state(out_dir: Path, *, generated_at: pd.Timestamp, last_try: bool, leagues: dict[str, dict]) -> None:
    """Record what this run did. ``leagues``: id -> {updated, results_complete, missing}."""
    state = {
        "date": generated_at.strftime("%Y-%m-%d"),
        "generated_at": generated_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "last_try": bool(last_try),
        "leagues": leagues,
    }
    _atomic_write(out_dir / RUN_STATE, json.dumps(state, indent=1, sort_keys=True, ensure_ascii=False) + "\n")


def read_run_state(out_dir: Path) -> dict | None:
    """The last run's state, or None if there is none or it cannot be read."""
    try:
        state = json.loads((out_dir / RUN_STATE).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return state if isinstance(state, dict) else None


def done_today(out_dir: Path, competitions: list[str], now: pd.Timestamp | None = None) -> bool:
    """True only if today's latest run updated every league with complete results.

    Anything unexpected in the file means False (run again).
    """
    state = read_run_state(out_dir)
    if state is None:
        return False
    today = (now or pd.Timestamp.now(tz="UTC")).tz_convert("UTC").strftime("%Y-%m-%d")
    leagues = state.get("leagues")
    if state.get("date") != today or not isinstance(leagues, dict):
        return False
    for competition in competitions:
        entry = leagues.get(competition)
        if not isinstance(entry, dict) or entry.get("updated") is not True or entry.get("results_complete") is not True:
            return False
    return True


def published_today(out_dir: Path, now: pd.Timestamp) -> bool:
    """True if an earlier run today already wrote a state file (so this is not the day's first update)."""
    state = read_run_state(out_dir)
    return state is not None and state.get("date") == now.tz_convert("UTC").strftime("%Y-%m-%d")


# ---------------------------------------------------------------------------
# known_results.json
# ---------------------------------------------------------------------------


def read_known_results(out_dir: Path) -> dict[str, dict]:
    """Every remembered result, keyed ``competition|season|home|away``. Empty if there is no usable file."""
    path = out_dir / KNOWN_RESULTS
    try:
        log = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}
    except (OSError, ValueError):
        logger.warning("%s cannot be read; working from the sources' results only", path)
        return {}
    matches = log.get("matches") if isinstance(log, dict) else None
    return matches if isinstance(matches, dict) else {}


def known_for(known: dict[str, dict], competition: str, season: str) -> dict[tuple[str, str], dict]:
    """One league's remembered results for one season, keyed (home, away)."""
    return {
        (entry["home_team"], entry["away_team"]): entry
        for entry in known.values()
        if isinstance(entry, dict) and entry.get("competition") == competition and entry.get("season") == season
    }


def record_known_results(
    out_dir: Path,
    *,
    competition: str,
    season: str,
    results: list[dict],
    forget: set[tuple[str, str]],
    recorded_at: pd.Timestamp,
) -> None:
    """Remember the scores the sources gave in this run, and drop the matches that were called off.

    ``results``: one dict per played match, with ``home_team``, ``away_team``,
    ``home_goals``, ``away_goals``, ``match_id``, ``date`` and ``kickoff_utc``.
    A score that differs from the remembered one replaces it (the sources win).
    """
    known = read_known_results(out_dir)
    stamp = recorded_at.tz_convert("UTC").strftime("%Y-%m-%dT%H:%M:%SZ")
    for home, away in forget:
        known.pop(f"{competition}|{season}|{home}|{away}", None)
    for result in results:
        key = f"{competition}|{season}|{result['home_team']}|{result['away_team']}"
        entry = {"competition": competition, "season": season, **result}
        before = known.get(key)
        if before is not None and all(before.get(field) == entry[field] for field in entry):
            continue
        entry["recorded_at"] = stamp
        known[key] = entry
    _atomic_write(out_dir / KNOWN_RESULTS, json.dumps({"matches": known}, indent=1, sort_keys=True, ensure_ascii=False) + "\n")


def _atomic_write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(text, encoding="utf-8")
    os.replace(temporary, path)

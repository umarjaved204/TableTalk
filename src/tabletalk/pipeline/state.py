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

``results_seen.json``: when each result first appeared
-------------------------------------------------------
For every played match of the current season, and for each results source,
the first run that saw its final score ("first seen at"). The gap between
kick-off and first seen is an upper bound on how slow the source was: our runs
only look a few times a day, so the source may have had it earlier.

When a league has no entries yet (the first run with this file), everything
already played is recorded as a baseline and left out of the delay figures:
we do not know when those results arrived.

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
import statistics
from pathlib import Path

import pandas as pd

logger = logging.getLogger(__name__)

RUN_STATE = Path("state") / "run_state.json"
RESULTS_SEEN = Path("state") / "results_seen.json"
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
# results_seen.json
# ---------------------------------------------------------------------------


def record_results_seen(
    out_dir: Path,
    *,
    competition: str,
    season: str,
    played_by_source: dict[str, set[tuple[str, str]]],
    kickoffs: dict[tuple[str, str], str | None],
    seen_at: pd.Timestamp,
) -> list[dict]:
    """Add every result seen for the first time, per source. Returns the new ones.

    ``played_by_source``: source name -> (home, away) pairs that source has a
    final score for this season. ``kickoffs``: (home, away) -> kick-off (UTC,
    ISO) where known. Each returned item has ``source``, ``home_team``,
    ``away_team``, ``kickoff_utc``, ``first_seen``, ``hours_after_kickoff``
    (None when the kick-off is unknown) and ``baseline``.
    """
    path = out_dir / RESULTS_SEEN
    try:
        log = json.loads(path.read_text(encoding="utf-8"))
        matches = log["matches"] if isinstance(log, dict) and isinstance(log.get("matches"), dict) else {}
    except (OSError, ValueError):
        matches = {}
    baseline = not any(entry.get("competition") == competition for entry in matches.values())
    stamp = seen_at.tz_convert("UTC").strftime("%Y-%m-%dT%H:%M:%SZ")
    new = []
    for source, pairs in played_by_source.items():
        for home, away in sorted(pairs):
            key = f"{competition}|{season}|{home}|{away}"
            entry = matches.setdefault(key, {
                "competition": competition, "season": season, "home_team": home, "away_team": away,
                "kickoff_utc": kickoffs.get((home, away)), "first_seen": {}, "baseline": [],
            })
            if entry.get("kickoff_utc") is None and kickoffs.get((home, away)):
                entry["kickoff_utc"] = kickoffs[(home, away)]
            if source in entry["first_seen"]:
                continue
            entry["first_seen"][source] = stamp
            if baseline:
                entry["baseline"].append(source)
            kickoff = entry.get("kickoff_utc")
            hours = None if kickoff is None else (seen_at - pd.Timestamp(kickoff)).total_seconds() / 3600
            new.append({
                "source": source, "home_team": home, "away_team": away, "kickoff_utc": kickoff,
                "first_seen": stamp, "hours_after_kickoff": hours, "baseline": baseline,
            })
    _atomic_write(path, json.dumps({"matches": matches}, indent=1, sort_keys=True, ensure_ascii=False) + "\n")
    return new


def describe_results_seen(new: list[dict]) -> list[str]:
    """Run-report lines: per source, how many new results and how long after kick-off."""
    lines = []
    for source in sorted({item["source"] for item in new}):
        items = [item for item in new if item["source"] == source]
        if all(item["baseline"] for item in items):
            lines.append(f"- {source}: {len(items)} result(s) already there when logging began (no delay recorded)")
            continue
        fresh = [item for item in items if not item["baseline"]]
        hours = [item["hours_after_kickoff"] for item in fresh if item["hours_after_kickoff"] is not None]
        text = f"- {source}: {len(fresh)} new result(s)"
        if hours:
            text += (f", first seen {statistics.median(hours):.1f} h after kick-off (median; "
                     f"range {min(hours):.1f}-{max(hours):.1f} h)")
        lines.append(text)
    return lines


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

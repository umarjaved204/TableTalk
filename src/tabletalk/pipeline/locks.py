"""Locking predictions before kick-off.

The rule (agreed 2026-09-29):

1. The latest prediction made before a match kicks off becomes its **lock**.
   Locks go into an append-only log and are never edited or deleted.
2. If a match is moved earlier, the lock is whatever the last run before the
   *new* kick-off produced. If the match started before any run predicted it,
   it gets no lock and is recorded as **missed**. Nothing is ever back-dated.
3. If a match is postponed (or suspended, or cancelled), its lock is kept and a
   **void** event is added. Once it has a new date, a new lock is made before
   the new kick-off. Both stay in the log; only the one that was not voided is
   scored.
4. Whether a lock came before kick-off is checked against the kick-off time the
   fixture source reports once the match has started, not the time we saw when
   predicting. A lock made at or after that time gets an **invalid** event and
   is never scored.
5. A match is followed through date changes by the fixture source's match id
   (football-data.org's id does not change when a match is moved).

How it works, per run and league:

- ``pending.json`` holds each upcoming match's newest prediction. It is a
  working file, not the record: each run replaces a match's entry, but only
  while the match has not kicked off.
- When a run finds that a pending match has started (or finished), the pending
  prediction becomes a ``lock`` event. When it finds the match postponed, the
  lock is written and immediately followed by a ``void`` event.
- ``locks.jsonl`` is the record: one JSON event per line, only ever appended.
  Each event carries the sha256 of the line before it (``prev``), so editing or
  deleting any earlier line breaks the chain, which ``verify_chain`` detects.

Times are UTC. ``predicted_at`` is when the prediction was written to disk,
after the run finished computing it: the strictest reading of "made before".

Matches played before the pipeline first ran (``meta.json``'s ``live_since``)
cannot have genuine locks and are never counted as missed.
"""

from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass
from pathlib import Path

import pandas as pd

#: Statuses meaning the match has kicked off (or been decided).
STARTED = frozenset({"FINISHED", "AWARDED", "IN_PLAY", "PAUSED", "EXTRA_TIME", "PENALTY_SHOOTOUT", "SUSPENDED"})
#: Statuses meaning the planned kick-off will not happen (for now).
CALLED_OFF = frozenset({"POSTPONED", "CANCELLED"})
#: Void reasons, by status.
VOID_REASON = {"POSTPONED": "postponed", "CANCELLED": "cancelled", "SUSPENDED": "suspended"}

GENESIS = "0" * 64


class LockStoreError(RuntimeError):
    """The lock log has been edited, reordered or truncated."""


def _utc(stamp) -> str:
    stamp = pd.Timestamp(stamp)
    stamp = stamp.tz_localize("UTC") if stamp.tzinfo is None else stamp.tz_convert("UTC")
    return stamp.strftime("%Y-%m-%dT%H:%M:%SZ")


def _line_hash(line: str) -> str:
    return hashlib.sha256(line.encode("utf-8")).hexdigest()


@dataclass
class LockStore:
    """The files under ``<out>/track_record/``."""

    directory: Path

    @property
    def log_path(self) -> Path:
        return self.directory / "locks.jsonl"

    @property
    def pending_path(self) -> Path:
        return self.directory / "pending.json"

    @property
    def meta_path(self) -> Path:
        return self.directory / "meta.json"

    # -- reading ------------------------------------------------------------
    def events(self) -> list[dict]:
        """Every event, oldest first, after checking the hash chain."""
        return [json.loads(line) for line in verify_chain(self.log_path)]

    def pending(self) -> dict[str, dict]:
        if not self.pending_path.exists():
            return {}
        return json.loads(self.pending_path.read_text(encoding="utf-8"))

    def live_since(self, now: pd.Timestamp) -> pd.Timestamp:
        """When the pipeline first ran with this store (created on first use)."""
        if self.meta_path.exists():
            return pd.Timestamp(json.loads(self.meta_path.read_text(encoding="utf-8"))["live_since"])
        self.directory.mkdir(parents=True, exist_ok=True)
        _atomic_write(self.meta_path, json.dumps({"live_since": _utc(now)}, indent=1) + "\n")
        return pd.Timestamp(_utc(now))

    # -- writing ------------------------------------------------------------
    def append(self, events: list[dict]) -> None:
        """Append events to the log. The only way the log is ever written."""
        if not events:
            return
        self.directory.mkdir(parents=True, exist_ok=True)
        lines = verify_chain(self.log_path)
        previous = _line_hash(lines[-1]) if lines else GENESIS
        with self.log_path.open("a", encoding="utf-8", newline="\n") as handle:
            for event in events:
                line = json.dumps({**event, "prev": previous}, ensure_ascii=False, separators=(",", ":"))
                handle.write(line + "\n")
                previous = _line_hash(line)
            handle.flush()
            os.fsync(handle.fileno())

    def save_pending(self, pending: dict[str, dict]) -> None:
        self.directory.mkdir(parents=True, exist_ok=True)
        _atomic_write(self.pending_path, json.dumps(pending, ensure_ascii=False, sort_keys=True, indent=0) + "\n")


def verify_chain(path: Path) -> list[str]:
    """The log's lines, if every ``prev`` matches the line before; else raise."""
    if not path.exists():
        return []
    lines = path.read_text(encoding="utf-8").splitlines()
    previous = GENESIS
    for number, line in enumerate(lines, start=1):
        try:
            recorded = json.loads(line).get("prev")
        except ValueError as exc:
            raise LockStoreError(f"{path}: line {number} is not valid JSON") from exc
        if recorded != previous:
            raise LockStoreError(
                f"{path}: line {number} does not follow line {number - 1}: the log has been "
                "edited, reordered or had lines removed. Locks are append-only; restore the "
                "file from its published history."
            )
        previous = _line_hash(line)
    return lines


def update_locks(
    store: LockStore,
    *,
    competition: str,
    snapshot: dict,
    fixtures: pd.DataFrame,
    predicted_at: pd.Timestamp,
    snapshot_file: str | None = None,
) -> list[dict]:
    """Apply the locking rule for one league after a successful run.

    Args:
        snapshot: the snapshot this run just wrote (its ``upcoming_matches``
            are the new predictions).
        fixtures: the fixture source's rows for the season, every status,
            with ``source_id``, ``status``, ``kickoff_utc`` and ``date``.
        predicted_at: when the snapshot was written (UTC).
        snapshot_file: the snapshot's path in the published history, so anyone
            can check a lock against the file it came from.

    Returns the events appended.
    """
    predicted_at = pd.Timestamp(predicted_at).tz_convert("UTC")
    live_since = store.live_since(predicted_at)
    history = store.events()
    pending = store.pending()
    by_id = {str(row.source_id): row for row in fixtures.itertuples(index=False) if pd.notna(row.source_id)}
    recorded_at = _utc(predicted_at)

    new = _resolve_started(pending, by_id, competition, _count_locks(history), recorded_at)
    _refresh_pending(pending, snapshot, competition, predicted_at, snapshot_file)
    new += _record_missed(by_id, pending, history + new, competition, live_since, recorded_at)

    store.append(new)
    store.save_pending(pending)
    return new


def _resolve_started(pending: dict, by_id: dict, competition: str, locks_per_match: dict, recorded_at: str) -> list[dict]:
    """Step 1: pending predictions whose match has started or been called off become locks.

    Removes them from ``pending`` and returns the events: a lock, plus a void
    (postponed, cancelled, suspended, or gone from the fixture list) or an
    invalid (not made before the actual kick-off) where the rule says so.
    """
    new: list[dict] = []
    for match_id, entry in list(pending.items()):
        if entry["competition"] != competition:
            continue
        row = by_id.get(match_id)
        status = None if row is None else str(row.status)
        if row is not None and status not in STARTED and status not in CALLED_OFF:
            continue  # still to come: this run refreshes it
        locks_per_match[match_id] = locks_per_match.get(match_id, 0) + 1
        lock_id = f"{match_id}#{locks_per_match[match_id]}"
        new.append({"event": "lock", "lock_id": lock_id, "recorded_at": recorded_at, **entry})
        if row is None:
            new.append(_event("void", lock_id, recorded_at, reason="removed from the fixture list"))
        elif status in CALLED_OFF:
            new.append(_event("void", lock_id, recorded_at, reason=VOID_REASON[status]))
        else:
            actual = row.kickoff_utc
            if pd.isna(actual) or pd.Timestamp(entry["predicted_at"]) >= pd.Timestamp(actual):
                new.append(_event(
                    "invalid", lock_id, recorded_at,
                    reason="prediction was not made before the actual kick-off",
                    actual_kickoff_utc=None if pd.isna(actual) else _utc(actual),
                ))
            if status == "SUSPENDED":
                new.append(_event("void", lock_id, recorded_at, reason=VOID_REASON[status]))
        del pending[match_id]
    return new


def _refresh_pending(pending: dict, snapshot: dict, competition: str, predicted_at: pd.Timestamp,
                     snapshot_file: str | None) -> None:
    """Step 2: this run's predictions replace pending ones for matches still to come.

    A match is skipped if it is called off (no new date yet), or already under
    way by the source's own clock, or has no time and its day has passed.
    """
    today = predicted_at.strftime("%Y-%m-%d")
    for match in snapshot["upcoming_matches"]:
        match_id, status = match["match_id"], match["status"]
        if match_id is None or status in CALLED_OFF or status in STARTED:
            continue
        kickoff = pd.Timestamp(match["kickoff_utc"]) if match["kickoff_utc"] else None
        if kickoff is not None and kickoff <= predicted_at:
            continue
        if kickoff is None and (match["date"] is None or match["date"] < today):
            continue
        pending[match_id] = {
            "match_id": match_id,
            "competition": competition,
            "season": snapshot["competition"]["season"],
            "home_team": match["home_team"],
            "away_team": match["away_team"],
            "listed_date": match["date"],
            "listed_kickoff_utc": match["kickoff_utc"],
            "listed_status": status,
            "predicted_at": _utc(predicted_at),
            "data_as_of": snapshot["generated_at"],
            "snapshot": snapshot_file,
            "model": {
                "code_commit": snapshot["run"]["code_commit"],
                "code_dirty": snapshot["run"]["code_dirty"],
                "config_hash": snapshot["run"]["config_hash"],
            },
            "probabilities": match["probabilities"],
            "expected_goals": match["expected_goals"],
            "likely_scorelines": match["likely_scorelines"],
        }


def _record_missed(by_id: dict, pending: dict, events: list[dict], competition: str,
                   live_since: pd.Timestamp, recorded_at: str) -> list[dict]:
    """Step 3: matches played after we went live that never had a prediction (recorded once)."""
    covered = _matches_with_open_lock(events)
    already_missed = {e["match_id"] for e in events if e["event"] == "missed"}
    played = STARTED - {"SUSPENDED"}  # a suspended match is finished later, or replayed
    new = []
    for match_id, row in by_id.items():
        if str(row.status) not in played or match_id in pending or match_id in covered or match_id in already_missed:
            continue
        kickoff = row.kickoff_utc if pd.notna(row.kickoff_utc) else pd.Timestamp(row.date).tz_localize("UTC")
        if pd.Timestamp(kickoff) < live_since:
            continue  # played before the pipeline existed: never a genuine lock
        new.append({
            "event": "missed", "match_id": match_id, "recorded_at": recorded_at,
            "competition": competition, "home_team": row.home_team, "away_team": row.away_team,
            "actual_kickoff_utc": _utc(kickoff),
            "reason": "kicked off before any run had predicted it",
        })
    return new


def _event(kind: str, lock_id: str, recorded_at: str, **fields) -> dict:
    return {"event": kind, "lock_id": lock_id, "recorded_at": recorded_at, **fields}


def _count_locks(events: list[dict]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for event in events:
        if event["event"] == "lock":
            counts[event["match_id"]] = counts.get(event["match_id"], 0) + 1
    return counts


def _matches_with_open_lock(events: list[dict]) -> set[str]:
    """Matches with a lock that has not been voided (valid or invalid)."""
    voided = {e["lock_id"] for e in events if e["event"] == "void"}
    return {e["match_id"] for e in events if e["event"] == "lock" and e["lock_id"] not in voided}


def scoreable_locks(events: list[dict]) -> tuple[pd.DataFrame, dict[str, int]]:
    """Locks that count: neither voided nor invalid. Plus counts of each kind."""
    voided = {e["lock_id"] for e in events if e["event"] == "void"}
    invalid = {e["lock_id"] for e in events if e["event"] == "invalid"}
    locks = [e for e in events if e["event"] == "lock"]
    counts = {
        "locks": len(locks),
        "voided": len(voided),
        "invalid": len(invalid),
        "missed": sum(1 for e in events if e["event"] == "missed"),
    }
    rows = []
    for lock in locks:
        if lock["lock_id"] in voided or lock["lock_id"] in invalid:
            continue
        rows.append(
            {
                "lock_id": lock["lock_id"], "match_id": lock["match_id"], "competition": lock["competition"],
                "season": lock["season"], "home_team": lock["home_team"], "away_team": lock["away_team"],
                "predicted_at": lock["predicted_at"],
                "p_home": lock["probabilities"]["home"], "p_draw": lock["probabilities"]["draw"],
                "p_away": lock["probabilities"]["away"],
                "code_commit": lock["model"]["code_commit"], "config_hash": lock["model"]["config_hash"],
            }
        )
    columns = ["lock_id", "match_id", "competition", "season", "home_team", "away_team", "predicted_at",
               "p_home", "p_draw", "p_away", "code_commit", "config_hash"]
    return pd.DataFrame(rows, columns=columns), counts


def _atomic_write(path: Path, text: str) -> None:
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(text, encoding="utf-8")
    os.replace(temporary, path)

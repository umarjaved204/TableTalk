// What the lock log says happened to each match: replay the events in order.
//
// The lock log (track_record/locks.jsonl) only ever grows. Each line is one
// event, oldest first:
//   lock     the last prediction made before kick-off (written once the match has started)
//   void     that lock won't be scored (postponed, suspended, cancelled, removed)
//   invalid  that lock wasn't made before the actual kick-off, so it is never scored
//   missed   a match nobody predicted in time (no lock at all)
// Played results come from summary.json's matches[], matched by lock id.
//
// Replaying the events for one match id, in order, gives its current state.
// A postponed match has two locks: "#1" then a void, later "#2". The current
// state is the newest lock; the voided one is kept as a note.
import { DataError } from "./load.ts";
import type { LockLine, LogLine } from "./track-record.ts";

export interface EarlierVoided {
  lockId: string;
  predictedAt: string;
  reason: string;
}

export type RecordState =
  | { kind: "locked"; lock: LockLine }
  | {
      kind: "played";
      lock: LockLine;
      score: { home: number; away: number };
      predictedAt: string;
      kickoffUtc: string | null;
    }
  | { kind: "voided"; lock: LockLine; reason: string }
  | { kind: "invalid"; lock: LockLine; actualKickoffUtc: string | null }
  | { kind: "missed"; actualKickoffUtc: string | null };

export interface MatchRecord {
  matchId: string;
  competition: string;
  home: string;
  away: string;
  state: RecordState;
  /** Earlier locks for this match that were voided (oldest first). */
  earlierVoided: EarlierVoided[];
}

/** A scored match from summary.json (only the fields used here). */
export interface ScoredMatch {
  lock_id: string;
  kickoff_utc: string | null;
  predicted_at: string;
  home_goals: number;
  away_goals: number;
}

/**
 * Replay the lock log and attach results. Returns one record per match id.
 *
 * The published files are checked by the pipeline, so anything that doesn't
 * fit the rules in contracts/README.md (a void for a lock that doesn't exist,
 * a second lock without the first being voided, a scored match the log
 * doesn't have) means the files contradict each other: the build stops.
 */
export function replayLockLog(lines: LogLine[], scored: ScoredMatch[]): Map<string, MatchRecord> {
  const records = new Map<string, MatchRecord>();
  const locks = new Map<string, LockLine>();

  /** The record a void/invalid line refers to, and its lock. */
  const target = (lockId: string, event: string) => {
    const lock = locks.get(lockId);
    if (!lock) throw new DataError(`lock log: ${event} for unknown lock ${lockId}`);
    const record = records.get(lock.match_id);
    if (!record || !("lock" in record.state) || record.state.lock.lock_id !== lockId) {
      throw new DataError(`lock log: ${event} for ${lockId}, which is not the match's current lock`);
    }
    return { record, lock };
  };

  /** Earlier voided locks carry over when a match gets a new lock or is missed. */
  const carriedOver = (matchId: string, event: string): EarlierVoided[] => {
    const previous = records.get(matchId);
    if (!previous) return [];
    if (previous.state.kind !== "voided") {
      throw new DataError(
        `lock log: ${event} for ${matchId}, whose previous ${previous.state.kind} state was never voided`,
      );
    }
    const { lock, reason } = previous.state;
    return [...previous.earlierVoided, { lockId: lock.lock_id, predictedAt: lock.predicted_at, reason }];
  };

  for (const line of lines) {
    switch (line.event) {
      case "lock": {
        const earlierVoided = carriedOver(line.match_id, "a new lock");
        locks.set(line.lock_id, line);
        records.set(line.match_id, {
          matchId: line.match_id,
          competition: line.competition,
          home: line.home_team,
          away: line.away_team,
          state: { kind: "locked", lock: line },
          earlierVoided,
        });
        break;
      }
      case "void": {
        // A void can follow an invalid (a suspended match whose lock was also late).
        const { record, lock } = target(line.lock_id, "void");
        record.state = { kind: "voided", lock, reason: line.reason };
        break;
      }
      case "invalid": {
        const { record, lock } = target(line.lock_id, "invalid");
        record.state = { kind: "invalid", lock, actualKickoffUtc: line.actual_kickoff_utc ?? null };
        break;
      }
      case "missed": {
        const earlierVoided = carriedOver(line.match_id, "missed");
        records.set(line.match_id, {
          matchId: line.match_id,
          competition: line.competition,
          home: line.home_team,
          away: line.away_team,
          state: { kind: "missed", actualKickoffUtc: line.actual_kickoff_utc ?? null },
          earlierVoided,
        });
        break;
      }
    }
  }

  for (const match of scored) {
    const lock = locks.get(match.lock_id);
    const record = lock ? records.get(lock.match_id) : undefined;
    if (!lock || !record || record.state.kind !== "locked" || record.state.lock.lock_id !== match.lock_id) {
      throw new DataError(
        `summary.json scores ${match.lock_id}, but the lock log has no open lock with that id`,
      );
    }
    record.state = {
      kind: "played",
      lock,
      score: { home: match.home_goals, away: match.away_goals },
      predictedAt: match.predicted_at,
      kickoffUtc: match.kickoff_utc,
    };
  }
  return records;
}

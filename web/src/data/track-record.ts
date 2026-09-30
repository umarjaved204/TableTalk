// The live track record: summary.json and the lock log (locks.jsonl).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { TrackRecordSummary } from "./contract.gen.ts";
import { DataError, loadFile, type FileResult } from "./load.ts";
import { dataDir } from "./paths.ts";

export function loadSummary(): FileResult<TrackRecordSummary> {
  return loadFile<TrackRecordSummary>("track_record/summary.json", "track_record");
}

// Lock log lines, as described in contracts/README.md. There is no JSON
// Schema for them yet (contract request R12), so these are written by hand
// and only cover the fields the site reads.
export interface LockLine {
  event: "lock";
  lock_id: string;
  match_id: string;
  competition: string;
  home_team: string;
  away_team: string;
  listed_kickoff_utc: string | null;
  predicted_at: string;
  probabilities: { home: number; draw: number; away: number };
}
export interface VoidLine {
  event: "void";
  lock_id: string;
  reason: string;
}
export interface InvalidLine {
  event: "invalid";
  lock_id: string;
  reason: string;
  actual_kickoff_utc: string | null;
}
export interface MissedLine {
  event: "missed";
  match_id: string;
  home_team: string;
  away_team: string;
  actual_kickoff_utc: string | null;
}
export type LogLine = LockLine | VoidLine | InvalidLine | MissedLine;

const EVENTS = new Set(["lock", "void", "invalid", "missed"]);

/**
 * Read the lock log.
 *
 * The file only appears once the first prediction is locked, so a missing
 * file is normal early on. But it is only "no locks yet" if summary.json
 * agrees that there are zero locks. If the summary counts locks and the log
 * is missing, the published files contradict each other and the build stops.
 */
export function loadLockLog(summary: TrackRecordSummary): LogLine[] {
  const path = join(dataDir(), "track_record", "locks.jsonl");
  if (!existsSync(path)) {
    if (summary.counts.locks === 0) return [];
    throw new DataError(
      `track_record/locks.jsonl is missing, but summary.json counts ${summary.counts.locks} locks.`,
    );
  }
  const lines = readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "");
  return lines.map((line, i) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      throw new DataError(`track_record/locks.jsonl line ${i + 1} is not valid JSON`);
    }
    const event = (parsed as { event?: unknown }).event;
    if (typeof event !== "string" || !EVENTS.has(event)) {
      throw new DataError(`track_record/locks.jsonl line ${i + 1}: unknown event ${JSON.stringify(event)}`);
    }
    return parsed as LogLine;
  });
}

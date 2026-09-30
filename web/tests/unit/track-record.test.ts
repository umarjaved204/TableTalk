import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { TrackRecordSummary } from "../../src/data/contract.gen.ts";
import { DataError } from "../../src/data/load.ts";
import { loadLockLog, loadSummary } from "../../src/data/track-record.ts";
import { REAL, copyOfReal, useDataDir } from "./helpers.ts";

/** The real summary with a different lock count. Reads the fixture file
 *  directly, so it doesn't change which data folder the test is using. */
function summaryWith(locks: number): TrackRecordSummary {
  const real = JSON.parse(
    readFileSync(join(REAL, "track_record/summary.json"), "utf8"),
  ) as TrackRecordSummary;
  return { ...real, counts: { ...real.counts, locks } };
}

describe("summary.json", () => {
  it("loads the real (empty) track record", () => {
    useDataDir(REAL);
    const result = loadSummary();
    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.data.counts.scored).toBe(0);
  });
});

describe("lock log (locks.jsonl)", () => {
  let dir = "";
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = "";
    useDataDir(REAL);
  });

  it("missing file + summary counts 0 locks = no locks yet", () => {
    useDataDir(REAL); // the real 29 Sep data has no locks.jsonl
    expect(loadLockLog(summaryWith(0))).toEqual([]);
  });

  it("missing file + summary counts locks = stop the build", () => {
    useDataDir(REAL);
    expect(() => loadLockLog(summaryWith(3))).toThrow(DataError);
  });

  it("reads lock, void, invalid and missed lines", () => {
    dir = copyOfReal();
    const lines = [
      { event: "lock", lock_id: "fdorg:1#1", match_id: "fdorg:1", predicted_at: "2026-10-09T04:41:00Z" },
      { event: "void", lock_id: "fdorg:1#1", reason: "postponed" },
      { event: "missed", match_id: "fdorg:2", home_team: "A", away_team: "B", actual_kickoff_utc: null },
    ];
    writeFileSync(
      join(dir, "track_record/locks.jsonl"),
      lines.map((l) => JSON.stringify(l)).join("\n") + "\n",
    );
    useDataDir(dir);
    expect(loadLockLog(summaryWith(1)).map((l) => l.event)).toEqual(["lock", "void", "missed"]);
  });

  it("rejects a line with an unknown event", () => {
    dir = copyOfReal();
    writeFileSync(join(dir, "track_record/locks.jsonl"), JSON.stringify({ event: "edit" }) + "\n");
    useDataDir(dir);
    expect(() => loadLockLog(summaryWith(1))).toThrow(/unknown event/);
  });
});

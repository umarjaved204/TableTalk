import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { TrackRecordSummary } from "../../src/data/contract.gen.ts";
import { DataError } from "../../src/data/load.ts";
import { loadLockLog, loadSummary } from "../../src/data/track-record.ts";
import { illustratedLog } from "../fixtures/illustrated.ts";
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
    writeFileSync(join(dir, "track_record/locks.jsonl"), illustratedLog());
    useDataDir(dir);
    expect(new Set(loadLockLog(summaryWith(9)).map((l) => l.event))).toEqual(
      new Set(["lock", "void", "invalid", "missed"]),
    );
  });

  it("rejects a line with an unknown event", () => {
    dir = copyOfReal();
    writeFileSync(join(dir, "track_record/locks.jsonl"), JSON.stringify({ event: "edit" }) + "\n");
    useDataDir(dir);
    expect(() => loadLockLog(summaryWith(1))).toThrow(/unknown event/);
  });
});

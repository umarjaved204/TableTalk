// REAL locks from the pipeline's trial (the data branch at 641d93f), checked
// through the same path the site uses: read the log, replay it, make the
// match view, word its label. The fixture lines are copied byte for byte
// from track_record/locks.jsonl; scored.json is their rows from summary.json.
//
// The rule: a locked match's label shows its predicted_at, in the visitor's
// time zone, never recorded_at and never the kick-off time.
import { copyFileSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { replayLockLog, type ScoredMatch } from "../../src/data/match-records.ts";
import { recordView, upcomingView } from "../../src/data/matches.ts";
import type { UpcomingMatch } from "../../src/data/models.ts";
import { loadLockLog, type LogLine } from "../../src/data/track-record.ts";
import type { TrackRecordSummary } from "../../src/data/contract.gen.ts";
import { earlierVoidedNote, labelText, statusLabel } from "../../src/format/match-status.ts";
import { formatDateTime } from "../../src/format/time.ts";
import { REAL, copyOfReal, useDataDir } from "./helpers.ts";

const FIXTURE = resolve("tests/fixtures/locks-641d93f");
const scored = JSON.parse(readFileSync(join(FIXTURE, "scored.json"), "utf8")) as ScoredMatch[];

const ARSENAL = "fdorg:560593";
const LIVERPOOL = "fdorg:560598";
const COMO = "fdorg:558585";
const RAYO = "fdorg:564698";

let dir = "";
let lines: LogLine[] = [];
beforeAll(() => {
  // Read through the site's own reader (loadLockLog), from a data folder.
  dir = copyOfReal();
  copyFileSync(join(FIXTURE, "locks.jsonl"), join(dir, "track_record", "locks.jsonl"));
  useDataDir(dir);
  lines = loadLockLog({ counts: { locks: 4 } } as TrackRecordSummary);
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  useDataDir(REAL);
});

/** The match's label as a visitor in `timeZone` reads it. */
function label(matchId: string, withResults: boolean, timeZone: string): string {
  const record = replayLockLog(lines, withResults ? scored : []).get(matchId);
  if (!record) throw new Error(`no record for ${matchId}`);
  const status = statusLabel(recordView(record).status);
  return `${status.badge} | ${labelText(status.parts, (utc) => formatDateTime(utc, timeZone))}`;
}

describe("real locks, before their results (awaiting result)", () => {
  it.each<[string, string, string, string]>([
    // Arsenal v Leeds: predicted 10 Oct 07:44:14Z, kick-off 11:30Z.
    [ARSENAL, "UTC", "10 Oct, 07:44", "normal case"],
    [ARSENAL, "Europe/London", "10 Oct, 08:44", "normal case"],
    [ARSENAL, "America/Los_Angeles", "10 Oct, 00:44", "normal case"],
    [ARSENAL, "Asia/Kolkata", "10 Oct, 13:14", "normal case"],
    // Liverpool v Man City: predicted 11 Oct 07:48:33Z, recorded 13 Oct 08:25:31Z, kick-off 15:30Z.
    [LIVERPOOL, "UTC", "11 Oct, 07:48", "recorded two days later"],
    [LIVERPOOL, "Europe/London", "11 Oct, 08:48", "recorded two days later"],
    [LIVERPOOL, "Pacific/Auckland", "11 Oct, 20:48", "recorded two days later"],
    // Como v Roma: predicted 11 Oct 07:48:33Z, the earliest kick-off (10:30Z).
    [COMO, "UTC", "11 Oct, 07:48", "earliest kick-off"],
    [COMO, "Europe/Rome", "11 Oct, 09:48", "earliest kick-off"],
  ])("%s in %s: Prediction made %s (%s)", (matchId, timeZone, time) => {
    expect(label(matchId, false, timeZone)).toBe(
      `Locked | Prediction made ${time} · locked at kick-off · awaiting result`,
    );
  });

  it("never shows recorded_at (Liverpool v Man City was recorded on 13 Oct)", () => {
    for (const timeZone of ["UTC", "Europe/London", "Asia/Tokyo"]) {
      const text = label(LIVERPOOL, false, timeZone);
      expect(text).not.toContain("13 Oct");
      expect(text).not.toContain(formatDateTime("2026-10-13T08:25:31Z", timeZone));
    }
  });

  it("never shows the kick-off time", () => {
    const kickoffs: [string, string][] = [
      [ARSENAL, "2026-10-10T11:30:00Z"],
      [LIVERPOOL, "2026-10-11T15:30:00Z"],
      [COMO, "2026-10-11T10:30:00Z"],
    ];
    for (const [matchId, kickoff] of kickoffs) {
      for (const timeZone of ["UTC", "Europe/London", "Europe/Rome"]) {
        expect(label(matchId, false, timeZone)).not.toContain(formatDateTime(kickoff, timeZone));
      }
    }
  });
});

describe("real locks, with their results (as the site shows them now)", () => {
  it.each<[string, string]>([
    [ARSENAL, "10 Oct, 07:44"],
    [LIVERPOOL, "11 Oct, 07:48"],
    [COMO, "11 Oct, 07:48"],
  ])("%s: Full time, still the predicted_at time", (matchId, time) => {
    expect(label(matchId, true, "UTC")).toBe(`Full time | Prediction made ${time}`);
  });
});

describe("Rayo Vallecano v Athletic Bilbao: voided (cancelled)", () => {
  it("is voided, not a normal locked prediction", () => {
    const record = replayLockLog(lines, scored).get(RAYO)!;
    expect(record.state).toMatchObject({ kind: "voided", reason: "cancelled" });
    expect(recordView(record).status.kind).toBe("voided");
  });

  it("says cancelled and not scored, with no lock wording", () => {
    const text = label(RAYO, true, "UTC");
    expect(text).toBe("Cancelled | Cancelled · this prediction won't be scored");
    expect(text).not.toMatch(/Locked|locked at kick-off|Prediction made/);
  });

  it("has no result in summary.json", () => {
    expect(scored.map((m) => m.lock_id)).not.toContain(`${RAYO}#1`);
  });

  // The 15 Oct snapshot (latest/la_liga.json at 641d93f) still lists it in
  // upcoming_matches, as CANCELLED, with its old kick-off.
  it("in Upcoming: cancelled, not 'kicked off' and no lock promised, with the voided prediction noted", () => {
    const record = replayLockLog(lines, scored).get(RAYO)!;
    const match: UpcomingMatch = {
      id: RAYO,
      matchday: "Matchday 8",
      date: "2026-10-10",
      kickoffUtc: "2026-10-10T12:00:00Z",
      status: "CANCELLED",
      home: "Rayo Vallecano",
      away: "Athletic Bilbao",
      probabilities: { home: 0.371697, draw: 0.300149, away: 0.328153 },
      expectedGoals: { home: 1.120593, away: 1.034807 },
      likelyScorelines: [],
    };
    const view = upcomingView(match, "2026-10-15T06:24:39Z", record);
    const status = statusLabel(view.status);
    const time = (utc: string) => formatDateTime(utc, "UTC");
    expect(`${status.badge} | ${labelText(status.parts, time)}`).toBe(
      "Cancelled | Prediction as of 15 Oct, 06:24 · nothing locks until the match is rescheduled",
    );
    expect(view.earlierVoided).toEqual([{ predictedAt: "2026-10-10T07:44:14Z", reason: "cancelled" }]);
    expect(labelText(earlierVoidedNote(view.earlierVoided[0]!), time)).toBe(
      "An earlier prediction (made 10 Oct, 07:44) was voided: cancelled. It won't be scored.",
    );
  });
});

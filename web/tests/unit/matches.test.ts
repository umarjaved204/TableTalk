import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadLeague } from "../../src/data/league.ts";
import { LEAGUES } from "../../src/data/leagues.ts";
import { DataError } from "../../src/data/load.ts";
import { loadRecords, recentViews, upcomingView, upcomingViews } from "../../src/data/matches.ts";
import type { MatchRecord } from "../../src/data/match-records.ts";
import type { ReadyLeague } from "../../src/data/models.ts";
import { writeIllustratedTrackRecord } from "../fixtures/illustrated.ts";
import { REAL, copyOfReal, editJson, useDataDir } from "./helpers.ts";

const PL = LEAGUES.find((l) => l.id === "premier_league")!;
const BL = LEAGUES.find((l) => l.id === "bundesliga")!;

function ready(league = PL): ReadyLeague {
  const data = loadLeague(league);
  if (data.state !== "ready") throw new Error(data.state);
  return data;
}

function records(): Map<string, MatchRecord> {
  const result = loadRecords();
  if (result.status !== "ok") throw new Error(result.status);
  return result.records;
}

let dir = "";
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = "";
  useDataDir(REAL);
});

describe("the matches page with the illustrated lock log", () => {
  beforeEach(() => {
    dir = copyOfReal();
    writeIllustratedTrackRecord(dir);
    useDataDir(dir);
  });

  it("Recent: this league's recorded matches, newest first, every status", () => {
    const recent = recentViews(ready(), records());
    expect(recent.map((m) => [m.home, m.status.kind])).toEqual([
      ["Hull City", "locked"],
      ["Aston Villa", "voided"],
      ["Fulham", "locked"],
      ["Liverpool", "played"],
      ["Chelsea", "played"],
      ["Brighton & Hove Albion", "missed"],
      ["Newcastle United", "invalid"],
    ]);
  });

  it("Recent: predicted_at comes from the data, never from the kick-off", () => {
    const fulham = recentViews(ready(), records()).find((m) => m.home === "Fulham")!;
    expect(fulham.status).toEqual({ kind: "locked", predictedAt: "2026-09-21T04:40:55Z" });
    expect(fulham.kickoffUtc).toBe("2026-09-21T19:00:00Z");
  });

  it("Recent: a missed match has no prediction to show", () => {
    const missed = recentViews(ready(), records()).find((m) => m.status.kind === "missed")!;
    expect(missed.prediction).toBeNull();
  });

  it("Recent: only this league (Bundesliga gets its own two)", () => {
    expect(recentViews(ready(BL), records()).map((m) => m.home)).toEqual([
      "Union Berlin",
      "Borussia Dortmund",
    ]);
  });

  it("Recent: only the last RECENT_DAYS days", () => {
    expect(recentViews(ready(), records(), 10).map((m) => m.home)).toEqual([
      "Hull City",
      "Aston Villa",
      "Fulham",
      "Liverpool",
      "Chelsea",
    ]);
  });

  it("Upcoming: a postponed (voided) match is upcoming again, with a note", () => {
    const villa = upcomingViews(ready(), records()).find((m) => m.home === "Aston Villa")!;
    expect(villa.status.kind).toBe("upcoming");
    expect(villa.earlierVoided).toEqual([{ predictedAt: "2026-09-27T04:40:44Z", reason: "postponed" }]);
  });

  it("Upcoming: a match the log says has started is not upcoming", () => {
    const league = ready();
    const firstId = league.upcoming[0]!.id!;
    const started = new Map(records());
    started.set(firstId, { ...started.get("fdorg:900003")!, matchId: firstId });
    expect(upcomingViews(league, started).some((m) => m.key === firstId)).toBe(false);
  });

  it("Upcoming: only the next UPCOMING_DAYS days (matches without a time go by their date)", () => {
    const league = ready();
    const all = upcomingViews(league, records(), 400).length;
    const month = upcomingViews(league, records()).length;
    expect(all).toBe(league.upcoming.length);
    expect(month).toBeGreaterThan(0);
    expect(month).toBeLessThan(all);
  });
});

describe("a snapshot made after a match's listed kick-off", () => {
  it("shows that match as kicked off, with a prediction that won't be the one recorded", () => {
    useDataDir(REAL);
    const match = ready().upcoming[0]!;
    const view = upcomingView(match, "2026-10-10T12:00:00Z");
    expect(view.status).toEqual({
      kind: "kicked_off",
      predictedAt: "2026-10-10T12:00:00Z",
      predictedBeforeKickoff: false,
    });
    expect(upcomingView(match, "2026-10-10T04:40:00Z").status.kind).toBe("upcoming");
  });
});

describe("loading the track record", () => {
  it("no locks.jsonl and summary counts 0 locks: fine, nothing recorded", () => {
    useDataDir(REAL);
    const result = loadRecords();
    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.records.size).toBe(0);
  });

  it("no locks.jsonl but summary counts locks: the build stops", () => {
    dir = copyOfReal();
    editJson(dir, "track_record/summary.json", (d) => {
      (d["counts"] as Record<string, number>)["locks"] = 4;
    });
    useDataDir(dir);
    expect(() => loadRecords()).toThrow(DataError);
  });

  it("summary.json missing: Recent is unavailable, the rest of the page still builds", () => {
    dir = copyOfReal();
    rmSync(join(dir, "track_record", "summary.json"));
    useDataDir(dir);
    expect(loadRecords()).toEqual({ status: "unavailable", reason: "missing" });
  });

  it("summary.json from a newer MAJOR version: unavailable (unsupported)", () => {
    dir = copyOfReal();
    editJson(dir, "track_record/summary.json", (d) => {
      d["contract_version"] = "2.0.0";
    });
    useDataDir(dir);
    expect(loadRecords()).toEqual({ status: "unavailable", reason: "unsupported" });
  });

  it("a lock line missing a field the site needs stops the build", () => {
    dir = copyOfReal();
    writeIllustratedTrackRecord(dir);
    writeFileSync(
      join(dir, "track_record", "locks.jsonl"),
      JSON.stringify({ event: "lock", lock_id: "x#1" }) + "\n",
    );
    useDataDir(dir);
    expect(() => loadRecords()).toThrow(/missing match_id/);
  });
});

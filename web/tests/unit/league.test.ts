import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Snapshot } from "../../src/data/contract.gen.ts";
import { isBoundaryBelow, loadLeague, markedZoneAt } from "../../src/data/league.ts";
import { LEAGUES, UnknownZoneError, ZONE_DISPLAY } from "../../src/data/leagues.ts";
import type { ReadyLeague, Zone } from "../../src/data/models.ts";
import { REAL, copyOfReal, editJson, useDataDir } from "./helpers.ts";

const PL = LEAGUES.find((l) => l.id === "premier_league")!;

function ready(league = PL): ReadyLeague {
  const data = loadLeague(league);
  if (data.state !== "ready") throw new Error(`expected ready, got ${data.state}`);
  return data;
}

describe("temporary zone map (until contract request R4)", () => {
  it.each(LEAGUES.map((l) => [l.id]))("covers every zone id in %s's real data", (id) => {
    const snapshot = JSON.parse(readFileSync(join(REAL, "latest", `${id}.json`), "utf8")) as Snapshot;
    const missing = snapshot.zones.map((z) => z.id).filter((zoneId) => !(zoneId in ZONE_DISPLAY));
    expect(missing).toEqual([]);
  });

  it("fails the build when a league has a zone id the map doesn't know", () => {
    const dir = copyOfReal();
    editJson(dir, "latest/premier_league.json", (d) => {
      (d["zones"] as { id: string }[])[0]!.id = "conference_league_place";
    });
    useDataDir(dir);
    expect(() => loadLeague(PL)).toThrow(UnknownZoneError);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("loadLeague with the real 29 Sep files", () => {
  afterEach(() => useDataDir(REAL));

  it("builds all five leagues", () => {
    useDataDir(REAL);
    for (const league of LEAGUES) expect(loadLeague(league).state).toBe("ready");
  });

  it("joins table and predictions", () => {
    useDataDir(REAL);
    const pl = ready();
    expect(pl.rows).toHaveLength(20);
    const city = pl.rows[0]!;
    expect(city).toMatchObject({ position: 1, team: "Manchester City", points: 15, played: 5 });
    expect(city.zoneChances["title"]).toBeCloseTo(0.587);
    expect(city.zone).toEqual({ id: "title", end: "top", marker: "solid" });
    expect(pl.upcoming[0]).toMatchObject({ home: "Arsenal", away: "Leeds United" });
  });

  it("sorts upcoming matches by kick-off", () => {
    useDataDir(REAL);
    const times = ready().upcoming.map((m) => m.kickoffUtc ?? "");
    expect([...times].sort()).toEqual(times);
  });

  it("Bundesliga has its play-off place", () => {
    useDataDir(REAL);
    const bl = ready(LEAGUES.find((l) => l.id === "bundesliga")!);
    expect(bl.rows.find((r) => r.position === 16)?.zone).toEqual({
      id: "relegation_playoff",
      end: "bottom",
      marker: "outline",
    });
  });
});

describe("league states", () => {
  let dir = "";
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    useDataDir(REAL);
  });

  it("no_snapshot -> unavailable, with the pipeline's reason", () => {
    dir = copyOfReal();
    editJson(dir, "latest/index.json", (d) => {
      const entry = (d["competitions"] as Record<string, unknown>[]).find(
        (c) => c["id"] === "premier_league",
      )!;
      Object.assign(entry, { status: "no_snapshot", file: null, error: "fixture list incomplete" });
    });
    useDataDir(dir);
    expect(loadLeague(PL)).toMatchObject({
      state: "unavailable",
      reason: "no_snapshot",
      error: "fixture list incomplete",
    });
  });

  it("kept_previous is shown as older numbers, not hidden", () => {
    dir = copyOfReal();
    editJson(dir, "latest/index.json", (d) => {
      const entry = (d["competitions"] as Record<string, unknown>[]).find(
        (c) => c["id"] === "premier_league",
      )!;
      Object.assign(entry, { status: "kept_previous", error: "results look late" });
    });
    useDataDir(dir);
    expect(loadLeague(PL)).toMatchObject({ state: "ready", runStatus: "kept_previous" });
  });

  it("a snapshot from a newer MAJOR version -> unsupported (numbers hidden)", () => {
    dir = copyOfReal();
    editJson(dir, "latest/premier_league.json", (d) => {
      d["contract_version"] = "2.0.0";
    });
    useDataDir(dir);
    expect(loadLeague(PL)).toMatchObject({ state: "unsupported", found: "2.0.0" });
  });
});

describe("zone markers and boundaries", () => {
  const zones: Zone[] = [
    { id: "title", label: "", short: "", end: "top", marker: "solid", positions: [1] },
    { id: "top_four", label: "", short: "", end: "top", marker: "light", positions: [1, 2, 3, 4] },
    {
      id: "top_half",
      label: "",
      short: "",
      end: "top",
      marker: null,
      positions: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    },
    { id: "relegation_playoff", label: "", short: "", end: "bottom", marker: "outline", positions: [16] },
    { id: "relegation", label: "", short: "", end: "bottom", marker: "dashed", positions: [17, 18] },
  ];

  it("picks the innermost marked zone", () => {
    expect(markedZoneAt(1, zones)?.id).toBe("title");
    expect(markedZoneAt(3, zones)?.id).toBe("top_four");
    expect(markedZoneAt(7, zones)).toBeNull(); // top half has no marker
    expect(markedZoneAt(16, zones)?.id).toBe("relegation_playoff");
  });

  it("draws boundaries under top zones and above bottom zones", () => {
    const below = Array.from({ length: 18 }, (_, i) => i + 1).filter((p) => isBoundaryBelow(p, zones));
    expect(below).toEqual([1, 4, 15, 16]);
  });
});

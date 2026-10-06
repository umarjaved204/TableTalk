import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  MIN_RESULT_DATES,
  buildRace,
  chartPoints,
  loadLeagueHistory,
  selectTeams,
  tableRows,
  type RunPoint,
  type Series,
} from "../../src/data/race.ts";
import { chanceTop, lastPoint, linePath, pointsRange, scale, xPositions } from "../../src/format/chart.ts";
import { HISTORY_RUNS, writeIllustratedHistory } from "../fixtures/illustrated.ts";
import { REAL, copyOfReal, editJson, useDataDir } from "./helpers.ts";

let dir = "";
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = "";
  useDataDir(REAL);
});

function withHistory(...leagues: string[]): string {
  dir = copyOfReal();
  for (const league of leagues) writeIllustratedHistory(dir, league);
  useDataDir(dir);
  return dir;
}

describe("extracting the chart's numbers from history/", () => {
  it("reads every run, oldest first, keeping only the chart's fields", () => {
    withHistory("premier_league");
    const { points, skipped } = loadLeagueHistory("premier_league");
    expect(skipped).toEqual([]);
    expect(points.map((p) => p.generatedAt)).toEqual([
      ...HISTORY_RUNS.map((r) => r.generatedAt),
      "2026-09-29T17:56:40Z",
    ]);
    const city = points.at(-1)!.teams.get("Manchester City")!;
    expect(city.zones["title"]).toBeCloseTo(0.587);
    expect(Object.keys(city).sort()).toEqual(["expectedPoints", "zones"]);
  });

  it("no history folder: no points (the section says it's too early)", () => {
    useDataDir(REAL);
    expect(loadLeagueHistory("premier_league")).toEqual({ points: [], skipped: [] });
  });

  it("skips a run in a newer MAJOR version, or one that breaks the contract, with a reason", () => {
    withHistory("premier_league");
    editJson(dir, `history/${HISTORY_RUNS[0].folder}/premier_league.json`, (d) => {
      d["contract_version"] = "2.0.0";
    });
    writeFileSync(join(dir, "history", HISTORY_RUNS[1].folder, "premier_league.json"), "{not json");
    const { points, skipped } = loadLeagueHistory("premier_league");
    expect(points).toHaveLength(HISTORY_RUNS.length - 1);
    expect(skipped).toHaveLength(2);
    expect(skipped[0]).toMatch(/2\.0\.0/);
  });

  it("a night the league failed (no file in that run) is simply absent", () => {
    withHistory("premier_league");
    mkdirSync(join(dir, "history", "2026-09-30T0440Z"));
    expect(loadLeagueHistory("premier_league").points).toHaveLength(HISTORY_RUNS.length + 1);
  });
});

describe("one point per day, current season only", () => {
  const point = (generatedAt: string, season = "2026-27"): RunPoint => ({
    generatedAt,
    dataThrough: "2026-09-20",
    season,
    teams: new Map(),
  });

  it("keeps the last run of each UTC day", () => {
    const kept = chartPoints(
      [point("2026-09-29T16:27:00Z"), point("2026-09-29T17:56:00Z"), point("2026-09-30T10:42:00Z")],
      "2026-27",
    );
    expect(kept.map((p) => p.generatedAt)).toEqual(["2026-09-29T17:56:00Z", "2026-09-30T10:42:00Z"]);
  });

  it("drops last season's runs", () => {
    expect(
      chartPoints([point("2026-05-20T04:40:00Z", "2025-26"), point("2026-09-29T04:40:00Z")], "2026-27"),
    ).toHaveLength(1);
  });
});

describe("which teams appear", () => {
  const s = (team: string, ...values: number[]): Series => ({ team, values });

  it("teams that reached the threshold at ANY point, listed by their latest value", () => {
    const chosen = selectTeams([s("A", 0.05, 0.3), s("B", 0.12, 0.04), s("C", 0.02, 0.09)], 0.1);
    expect(chosen.map((x) => x.team)).toEqual(["A", "B"]); // B fell below, but reached 12% earlier
  });

  it("at most MAX_TEAMS, keeping the highest peaks", () => {
    const many = ["A", "B", "C", "D", "E", "F", "G"].map((t, i) => s(t, 0.2 + i * 0.01));
    expect(selectTeams(many, 0.1, 6).map((x) => x.team)).not.toContain("A");
  });

  it("never empty: if nobody reaches the threshold, the team with the highest chance now", () => {
    expect(selectTeams([s("A", 0.03), s("B", 0.08)], 0.1).map((x) => x.team)).toEqual(["B"]);
  });

  it("Premier League (illustrated history): title, relegation and points teams", () => {
    withHistory("premier_league");
    const race = buildRace(chartPoints(loadLeagueHistory("premier_league").points, "2026-27"));
    expect(race.title.map((x) => x.team)).toEqual(["Manchester City", "Arsenal"]);
    expect(race.relegation.map((x) => x.team)).toEqual([
      "Coventry City",
      "Ipswich Town",
      "Hull City",
      "Tottenham Hotspur",
    ]);
    expect(race.points.map((x) => x.team).sort()).toEqual(
      [...race.title, ...race.relegation].map((x) => x.team).sort(),
    );
    expect(race.enoughForTrend).toBe(true);
  });

  it("Bundesliga (six zones): the relegation chart is the direct places (17th-18th), not the play-off", () => {
    withHistory("bundesliga");
    const race = buildRace(chartPoints(loadLeagueHistory("bundesliga").points, "2026-27"));
    const latest = loadLeagueHistory("bundesliga").points.at(-1)!;
    for (const series of race.relegation) {
      expect(series.values.at(-1)).toBe(latest.teams.get(series.team)!.zones["relegation"]);
    }
  });
});

describe("too early to show a trend", () => {
  it(`needs ${MIN_RESULT_DATES} different "results up to" dates`, () => {
    const at = (dataThrough: string, day: number): RunPoint => ({
      generatedAt: `2026-09-${String(day).padStart(2, "0")}T04:40:00Z`,
      dataThrough,
      season: "2026-27",
      teams: new Map([["A", { expectedPoints: 50, zones: { title: 0.2, relegation: 0.1 } }]]),
    });
    // The real data so far: four runs, all with results up to 20 Sep.
    const sameResults = [
      at("2026-09-20", 21),
      at("2026-09-20", 22),
      at("2026-09-20", 23),
      at("2026-09-20", 24),
    ];
    expect(buildRace(sameResults).enoughForTrend).toBe(false);
    expect(buildRace([at("2026-09-14", 15), at("2026-09-20", 21)]).enoughForTrend).toBe(false);
    expect(buildRace([at("2026-09-07", 8), at("2026-09-14", 15), at("2026-09-20", 21)]).enoughForTrend).toBe(
      true,
    );
  });
});

describe("chart geometry", () => {
  it("scale maps a domain onto a range (SVG y points down)", () => {
    const y = scale(0, 1, 70, 5);
    expect(y(0)).toBe(70);
    expect(y(1)).toBe(5);
    expect(y(0.5)).toBe(37.5);
  });

  it("x positions are spaced by real time", () => {
    const xs = xPositions(["2026-09-01T00:00:00Z", "2026-09-02T00:00:00Z", "2026-09-11T00:00:00Z"], {
      width: 110,
      height: 50,
      pad: 5,
    });
    expect(xs).toEqual([5, 15, 105]);
  });

  it("a missing value breaks the line", () => {
    expect(linePath([0, null, 1, 1], [0, 10, 20, 30], (v) => v * 10)).toBe("M0 0M20 10L30 10");
    expect(lastPoint([0, 1, null], [0, 10, 20], (v) => v)).toEqual({ x: 10, y: 1 });
  });

  it("y scales: chances to the next 25%, points to whole tens", () => {
    expect(chanceTop(0.2)).toBe(0.25);
    expect(chanceTop(0.59)).toBe(0.75);
    expect(chanceTop(0.84)).toBe(1);
    expect(pointsRange([28.6, 81.9])).toEqual([20, 90]);
    expect(pointsRange([40, 40])).toEqual([40, 50]);
  });
});

describe("the numbers tables: one row per round of results", () => {
  it("keeps the last update for each 'results up to' date, newest first", () => {
    // Updates: two with results up to 20 Sep, then three with 27 Sep.
    expect(tableRows(["2026-09-20", "2026-09-20", "2026-09-27", "2026-09-27", "2026-09-27"])).toEqual([4, 1]);
  });

  it("one row per update when every update has new results", () => {
    expect(tableRows(["2026-08-17", "2026-08-24", "2026-08-31"])).toEqual([2, 1, 0]);
  });

  it("before any results (null) counts as one round, and an empty chart has no rows", () => {
    expect(tableRows([null, null, "2026-08-17"])).toEqual([2, 1]);
    expect(tableRows([])).toEqual([]);
  });

  it("a whole season of daily updates gives one row per matchday, not per day", () => {
    const days = Array.from(
      { length: 250 },
      (_, i) => `round-${String(Math.floor(i / 6.5)).padStart(2, "0")}`,
    );
    expect(tableRows(days)).toHaveLength(new Set(days).size);
    expect(new Set(days).size).toBeLessThan(40);
  });
});

// Team pages: which pages exist (in every data state) and what each shows.
import { rmSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadLeague } from "../../src/data/league.ts";
import { LEAGUES, type LeagueInfo } from "../../src/data/leagues.ts";
import { loadRecords } from "../../src/data/matches.ts";
import type { LeagueData, ReadyLeague } from "../../src/data/models.ts";
import { MIN_RESULT_DATES, loadLeagueHistory, type RunPoint } from "../../src/data/race.ts";
import {
  TEAM_MATCHES,
  buildTeamPages,
  mostLikely,
  rosterFor,
  teamDescription,
  teamTrend,
  teamView,
  zoneBands,
} from "../../src/data/team-page.ts";
import { TeamSlugError } from "../../src/data/teams.ts";
import { writeIllustratedHistory } from "../fixtures/illustrated.ts";
import { REAL, copyOfReal, useDataDir } from "./helpers.ts";

const info = (id: string) => LEAGUES.find((l) => l.id === id) as LeagueInfo;
const ready = (id: string) => loadLeague(info(id)) as ReadyLeague;
const run = (teams: string[]): RunPoint => ({
  generatedAt: "2026-09-29T04:40:00Z",
  dataThrough: "2026-09-28",
  season: "2026-27",
  teams: new Map(teams.map((t) => [t, { expectedPoints: 50, zones: {} }])),
});

let dir = "";
beforeEach(() => useDataDir(REAL));
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = "";
  useDataDir(REAL);
});

describe("which team pages exist", () => {
  it("one per team in a league's table, in table order", () => {
    const pl = ready("premier_league");
    expect(rosterFor(pl, [])).toEqual(pl.rows.map((r) => r.team));
  });

  it("a league without numbers keeps its pages, from the newest history run", () => {
    const missing: LeagueData = {
      state: "unavailable",
      league: info("la_liga"),
      reason: "missing",
      error: null,
    };
    const hidden: LeagueData = { state: "unsupported", league: info("serie_a"), found: "2.0.0" };
    const history = [run(["Old Team"]), run(["Real Madrid", "Barcelona"])];
    expect(rosterFor(missing, history)).toEqual(["Real Madrid", "Barcelona"]);
    expect(rosterFor(hidden, history)).toEqual(["Real Madrid", "Barcelona"]);
    expect(rosterFor(missing, [])).toEqual([]);
  });

  it("covers every league of the real data, with unique slugs", () => {
    const pages = buildTeamPages(
      LEAGUES.map((league) => ({ league, data: loadLeague(league), history: [] })),
    );
    const expected = LEAGUES.map((l) => (loadLeague(l) as ReadyLeague).rows.length).reduce((a, b) => a + b);
    expect(pages).toHaveLength(expected);
    expect(new Set(pages.map((p) => p.slug)).size).toBe(pages.length);
    expect(pages.find((p) => p.slug === "brighton-and-hove-albion")?.league.slug).toBe("premier-league");
  });

  it("fails the build on a slug clash or a reserved slug, history-built pages included", () => {
    const missing: LeagueData = {
      state: "unavailable",
      league: info("la_liga"),
      reason: "missing",
      error: null,
    };
    const pl = { league: info("premier_league"), data: ready("premier_league"), history: [] };
    expect(() =>
      buildTeamPages([pl, { league: info("la_liga"), data: missing, history: [run(["Arsenal"])] }]),
    ).toThrow(TeamSlugError);
    expect(() =>
      buildTeamPages([{ league: info("la_liga"), data: missing, history: [run(["Matches"])] }]),
    ).toThrow(/page under each league/);
  });
});

describe("the finishing-position chart", () => {
  it("most likely: the highest chance, the higher place on a tie", () => {
    expect(mostLikely([0.1, 0.4, 0.3, 0.2])).toEqual({ position: 2, chance: 0.4 });
    expect(mostLikely([0.1, 0.4, 0.1, 0.4])).toEqual({ position: 2, chance: 0.4 });
    expect(mostLikely([0.25, 0.25, 0.25, 0.25])).toEqual({ position: 1, chance: 0.25 });
  });

  it("bands shade each position's innermost marked zone, as the table's row markers do", () => {
    const bands = (id: string) => zoneBands(ready(id)).map((b) => [b.id, b.from, b.to, b.end]);
    expect(bands("premier_league")).toEqual([
      ["title", 1, 1, "top"],
      ["top_four", 2, 4, "top"],
      ["top_five", 5, 5, "top"],
      ["relegation", 18, 20, "bottom"],
    ]);
    expect(bands("bundesliga")).toEqual([
      ["title", 1, 1, "top"],
      ["top_four", 2, 4, "top"],
      ["top_five", 5, 5, "top"],
      ["relegation_playoff", 16, 16, "bottom"],
      ["relegation", 17, 18, "bottom"],
    ]);
    expect(zoneBands(ready("premier_league"))[0]?.name).toBe("Title");
  });
});

describe("one team's page", () => {
  it("shows the team's row, every zone's chance and only its own matches", () => {
    const pl = ready("premier_league");
    const team = pl.rows[0]!.team;
    const view = teamView(pl, team, loadRecords(), []);
    expect(view.row.team).toBe(team);
    expect(view.chances.map((c) => c.id)).toEqual(pl.zones.map((z) => z.id));
    expect(view.chances.map((c) => c.name)).toEqual([
      "Title",
      "Top four",
      "Top five",
      "Top half",
      "Relegation",
    ]);
    expect(view.upcoming.length).toBeGreaterThan(0);
    expect(view.upcoming.length).toBeLessThanOrEqual(TEAM_MATCHES);
    for (const m of [...view.upcoming, ...(view.recent ?? [])]) expect([m.home, m.away]).toContain(team);
  });

  it("says recent matches can't be shown when the track record can't be read", () => {
    const pl = ready("premier_league");
    const view = teamView(pl, pl.rows[0]!.team, { status: "unavailable", reason: "missing" }, []);
    expect(view.recent).toBeNull();
  });

  it("stops the build for a team that isn't in the table", () => {
    expect(() => teamView(ready("premier_league"), "Nobody FC", loadRecords(), [])).toThrow(/no table row/);
  });

  it("describes the page with its league, place, points and main chances", () => {
    const pl = ready("premier_league");
    const team = pl.rows[0]!.team;
    const text = teamDescription(pl, teamView(pl, team, loadRecords(), []));
    expect(text).toMatch(
      new RegExp(`^${team} in the Premier League 2026-27: 1st with \\d+ points from \\d+ matches`),
    );
    expect(text).toMatch(/Chances: title \S+, top four \S+, relegation \S+\. Updated nightly\.$/);
  });
});

describe("chances over time (the race charts' rules)", () => {
  it("too early without enough different result dates", () => {
    const trend = teamTrend(ready("premier_league"), "Arsenal", []);
    expect(trend.resultDates).toBe(0);
    expect(trend.enoughForTrend).toBe(false);
  });

  it("one point per day this season, with the card's zones and projected points", () => {
    dir = copyOfReal();
    writeIllustratedHistory(dir, "premier_league");
    useDataDir(dir);
    const pl = ready("premier_league");
    const history = loadLeagueHistory("premier_league").points;
    const trend = teamTrend(pl, "Arsenal", history);
    expect(trend.resultDates).toBeGreaterThanOrEqual(MIN_RESULT_DATES);
    expect(trend.enoughForTrend).toBe(true);
    expect(trend.chances.map((c) => c.id)).toEqual(["title", "top_four", "relegation"]);
    for (const c of trend.chances) expect(c.values).toHaveLength(trend.runDates.length);
    expect(trend.points.at(-1)).toBe(pl.rows.find((r) => r.team === "Arsenal")!.projectedPoints);
    expect(trend.chances[0]!.chance).toBe(pl.rows.find((r) => r.team === "Arsenal")!.zoneChances["title"]);
    // A run from another season is left out.
    const other = { ...history[0]!, season: "2025-26", generatedAt: "2026-05-01T04:40:00Z" };
    expect(teamTrend(pl, "Arsenal", [other, ...history]).runDates).toEqual(trend.runDates);
  });
});

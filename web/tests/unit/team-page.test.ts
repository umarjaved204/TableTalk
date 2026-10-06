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
  buildStubs,
  buildTeamPages,
  mostLikely,
  rosterFor,
  sitemapPaths,
  teamDescription,
  teamHrefs,
  teamTrend,
  teamView,
  zoneBands,
} from "../../src/data/team-page.ts";
import { robotsTxt, sitemapXml } from "../../src/data/site-files.ts";
import { TeamSlugError } from "../../src/data/teams.ts";
import { cardFields, yourTeamCards } from "../../src/data/your-team.ts";
import { writeIllustratedHistory } from "../fixtures/illustrated.ts";
import { REAL, copyOfReal, useDataDir } from "./helpers.ts";

const info = (id: string) => LEAGUES.find((l) => l.id === id) as LeagueInfo;
const ready = (id: string) => loadLeague(info(id)) as ReadyLeague;
const run = (teams: string[], season = "2026-27"): RunPoint => ({
  generatedAt: "2026-09-29T04:40:00Z",
  dataThrough: "2026-09-28",
  season,
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

describe("links to team pages", () => {
  it("a team's name leads to its page; a team without a page has no address", () => {
    const pl = { league: info("premier_league"), data: ready("premier_league"), history: [] };
    const hrefs = teamHrefs(buildTeamPages([pl]));
    expect(hrefs.get("Brighton & Hove Albion")).toBe("/premier-league/brighton-and-hove-albion/");
    expect(hrefs.get("Barcelona")).toBeUndefined();
  });

  it("the Your team card links its name to the team's page", () => {
    const pl = ready("premier_league");
    const card = yourTeamCards(pl)[0]!;
    expect(cardFields(card, pl.league)["th"]).toBe(`/premier-league/${card.slug}/`);
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

describe("stub pages for last season's teams", () => {
  const league = (id: string, teams: string[], season: string, history: RunPoint[]) => ({
    league: info(id),
    data: {
      state: "ready",
      league: info(id),
      season,
      rows: teams.map((team) => ({ team })),
    } as unknown as LeagueData,
    history,
  });

  it("last season's teams that left, from the last run of the newest earlier season", () => {
    const leagues = [
      league("premier_league", ["Arsenal", "Burnley"], "2027-28", [
        run(["Arsenal", "Old Team"], "2025-26"),
        run(["Arsenal", "Hull City"], "2026-27"),
        run(["Arsenal", "Hull City", "Coventry City"], "2026-27"),
        run(["Arsenal", "Burnley"], "2027-28"),
      ]),
    ];
    const stubs = buildStubs(leagues, buildTeamPages(leagues));
    expect(stubs.map((s) => [s.slug, s.league.id, s.lastSeason])).toEqual([
      ["coventry-city", "premier_league", "2026-27"],
      ["hull-city", "premier_league", "2026-27"],
    ]);
  });

  it("none in a team's first covered season, or when the history has one season only", () => {
    const leagues = [
      league("premier_league", ["Arsenal"], "2026-27", [run(["Arsenal", "Hull City"], "2026-27")]),
    ];
    expect(buildStubs(leagues, buildTeamPages(leagues))).toEqual([]);
  });

  it("no stub for a team still covered, even in another league", () => {
    const leagues = [
      league("premier_league", ["Arsenal"], "2027-28", [run(["Arsenal", "Wanderers"], "2026-27")]),
      league("bundesliga", ["Wanderers"], "2027-28", []),
    ];
    expect(buildStubs(leagues, buildTeamPages(leagues))).toEqual([]);
  });

  it("a league without numbers uses its newest history run's season as this season", () => {
    const missing: LeagueData = {
      state: "unavailable",
      league: info("la_liga"),
      reason: "missing",
      error: null,
    };
    const leagues = [
      {
        league: info("la_liga"),
        data: missing,
        history: [run(["Málaga", "Elche"], "2026-27"), run(["Málaga", "Leganés"], "2027-28")],
      },
    ];
    expect(buildStubs(leagues, buildTeamPages(leagues)).map((s) => s.slug)).toEqual(["elche"]);
  });
});

describe("sitemap.xml and robots.txt", () => {
  it("lists every real page and never a stub, the 404 page or a QR image", () => {
    const pl = { league: info("premier_league"), data: ready("premier_league"), history: [] };
    const paths = sitemapPaths(buildTeamPages([pl]));
    expect(paths.slice(0, 3)).toEqual(["/", "/premier-league/", "/premier-league/matches/"]);
    expect(paths).toContain("/premier-league/brighton-and-hove-albion/");
    expect(paths).toContain("/la-liga/matches/");
    expect(paths.slice(-3)).toEqual(["/track-record/", "/methodology/", "/about/"]);
    expect(paths.filter((p) => p.includes("404") || p.includes("/qr/"))).toEqual([]);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("writes full addresses on the site's own domain", () => {
    const xml = sitemapXml(new URL("https://example.org"), ["/", "/premier-league/arsenal/"]);
    expect(xml).toBe(
      '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
        "<url><loc>https://example.org/</loc></url><url><loc>https://example.org/premier-league/arsenal/</loc></url></urlset>\n",
    );
  });

  it("robots.txt allows everything, and points to the sitemap once the address is known", () => {
    expect(robotsTxt(undefined)).toBe("User-agent: *\nAllow: /\n");
    expect(robotsTxt(new URL("https://example.org"))).toBe(
      "User-agent: *\nAllow: /\n\nSitemap: https://example.org/sitemap.xml\n",
    );
  });
});

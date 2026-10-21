// Team slugs (src/data/teams.ts): the rule, and the guards the build enforces.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { LEAGUES } from "../../src/data/leagues.ts";
import type { LeagueData, ReadyLeague } from "../../src/data/models.ts";
import {
  RESERVED_SLUGS,
  SLUG_PATTERN,
  TeamSlugError,
  buildTeamIndex,
  headIndex,
  teamSlug,
} from "../../src/data/teams.ts";

// Every canonical name in configs/team_aliases.yaml (327 clubs since 2010-11),
// with the slug an independent Python implementation of the rule gives.
const frozen = JSON.parse(readFileSync(resolve("tests/fixtures/team-slugs.json"), "utf8")) as {
  slugs: Record<string, string>;
};

describe("teamSlug", () => {
  it("gives the same slug as the independent implementation for all 327 canonical names", () => {
    const names = Object.keys(frozen.slugs);
    expect(names.length).toBe(327);
    for (const name of names) expect(teamSlug(name), name).toBe(frozen.slugs[name]);
  });

  it("never gives two clubs the same slug, and every slug is URL-safe", () => {
    const slugs = Object.keys(frozen.slugs).map(teamSlug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(slug).toMatch(SLUG_PATTERN);
      expect(RESERVED_SLUGS).not.toContain(slug);
    }
  });

  it.each([
    ["Brighton & Hove Albion", "brighton-and-hove-albion"],
    ["1. FC Köln", "1-fc-koln"],
    ["Borussia Mönchengladbach", "borussia-monchengladbach"],
    ["Preußen Münster", "preussen-munster"],
    ["Atlético Madrid", "atletico-madrid"],
    ["FC St. Pauli", "fc-st-pauli"],
    ["  Odd -- Name!  ", "odd-name"],
    ["Bodø/Glimt", "bodo-glimt"],
  ])("%s -> %s", (name, slug) => {
    expect(teamSlug(name)).toBe(slug);
  });
});

/** A ready league with just enough data for the team index. */
function league(id: string, teams: string[]): ReadyLeague {
  const info = LEAGUES.find((l) => l.id === id)!;
  return {
    state: "ready",
    league: info,
    rows: teams.map((team, i) => ({ team, position: i + 1 })),
  } as unknown as ReadyLeague;
}

describe("buildTeamIndex", () => {
  it("lists teams by league, alphabetically, with their league", () => {
    const index = buildTeamIndex([
      league("premier_league", ["Chelsea", "Arsenal"]),
      league("la_liga", ["Málaga"]),
    ]);
    expect(index.teams.map((t) => [t.slug, t.leagueId])).toEqual([
      ["arsenal", "premier_league"],
      ["chelsea", "premier_league"],
      ["malaga", "la_liga"],
    ]);
    expect(index.unavailableLeagues).toEqual([]);
  });

  it("records leagues without data, so a favourite there is kept rather than called 'gone'", () => {
    const missing = {
      state: "unavailable",
      league: LEAGUES[2],
      reason: "missing",
      error: null,
    } as LeagueData;
    const index = buildTeamIndex([league("premier_league", ["Arsenal"]), missing]);
    expect(index.unavailableLeagues).toEqual(["la_liga"]);
  });

  it("fails the build on two teams with the same slug, in different leagues too", () => {
    expect(() =>
      buildTeamIndex([league("premier_league", ["Real Madrid"]), league("la_liga", ["Real  Madrid"])]),
    ).toThrow(TeamSlugError);
  });

  it("fails the build on a slug that is a page name under a league, or empty", () => {
    expect(() => buildTeamIndex([league("premier_league", ["Matches"])])).toThrow(/page under each league/);
    expect(() => buildTeamIndex([league("premier_league", ["???"])])).toThrow(/no usable slug/);
  });

  it("writes a compact list for the early script, with league names as they read in a sentence", () => {
    const head = headIndex(
      buildTeamIndex([league("premier_league", ["Arsenal"]), league("la_liga", ["Málaga"])]),
    );
    expect(head.leagues).toEqual([
      ["premier_league", "Premier League", [["arsenal", "Arsenal"]]],
      ["la_liga", "La Liga", [["malaga", "Málaga"]]],
    ]);
    expect(head.names).toContainEqual(["premier_league", "the Premier League"]);
    expect(head.names).toContainEqual(["la_liga", "La Liga"]);
  });
});

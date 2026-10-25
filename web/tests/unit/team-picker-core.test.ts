// The Your team picker's logic (src/scripts/team-picker-core.ts): which
// league it opens on, and the order it lists teams in.
import { describe, expect, it } from "vitest";
import { LEAGUES } from "../../src/data/leagues.ts";
import { byName, openingLeague } from "../../src/scripts/team-picker-core.ts";

describe("the league the picker opens on", () => {
  it("the league asked for comes first (the home page's league buttons)", () => {
    expect(openingLeague("serie_a", "/bundesliga/", "la_liga", LEAGUES)).toBe("serie_a");
  });

  it("then the page's league: league, matches and team pages", () => {
    expect(openingLeague(null, "/bundesliga/", "la_liga", LEAGUES)).toBe("bundesliga");
    expect(openingLeague(null, "/premier-league/matches/", "la_liga", LEAGUES)).toBe("premier_league");
    expect(openingLeague(null, "/ligue-1/monaco/", "la_liga", LEAGUES)).toBe("ligue_1");
  });

  it("then the favourite's league, on pages without a league", () => {
    for (const path of ["/", "/about/", "/track-record/", "/methodology/"])
      expect(openingLeague(null, path, "la_liga", LEAGUES)).toBe("la_liga");
  });

  it("otherwise the first league", () => {
    expect(openingLeague(null, "/", null, LEAGUES)).toBe("premier_league");
  });

  it("skips a league the picker has no teams for, and anything unknown", () => {
    const withoutBundesliga = LEAGUES.filter((l) => l.id !== "bundesliga");
    expect(openingLeague("bundesliga", "/bundesliga/", "bundesliga", withoutBundesliga)).toBe(
      "premier_league",
    );
    expect(openingLeague("not_a_league", "/not-a-league/", "x", LEAGUES)).toBe("premier_league");
    expect(openingLeague(null, "/", null, [])).toBeNull();
  });
});

describe("the picker's team order", () => {
  it("A to Z by name, digits first", () => {
    const teams: [string, string][] = [
      ["vfb-stuttgart", "VfB Stuttgart"],
      ["borussia-monchengladbach", "Borussia Mönchengladbach"],
      ["1-fc-koln", "1. FC Köln"],
      ["bayern-munich", "Bayern Munich"],
      ["borussia-dortmund", "Borussia Dortmund"],
    ];
    expect(byName(teams).map(([, name]) => name)).toEqual([
      "1. FC Köln",
      "Bayern Munich",
      "Borussia Dortmund",
      "Borussia Mönchengladbach",
      "VfB Stuttgart",
    ]);
    expect(teams[0]![1], "the list passed in is left as it was").toBe("VfB Stuttgart");
  });
});

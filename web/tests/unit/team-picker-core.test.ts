// The Your team picker's logic (src/scripts/team-picker-core.ts): which
// league it opens on, the order it lists teams in, and how the filter matches.
import { describe, expect, it } from "vitest";
import { LEAGUES } from "../../src/data/leagues.ts";
import {
  byName,
  countMessage,
  matches,
  normalise,
  openingLeague,
} from "../../src/scripts/team-picker-core.ts";

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

describe("the filter's matching", () => {
  it("normalises case, accents, '&' and spaces", () => {
    expect(normalise("Borussia Mönchengladbach")).toBe("borussia monchengladbach");
    expect(normalise("Deportivo La Coruña")).toBe("deportivo la coruna");
    expect(normalise("Atlético Madrid")).toBe("atletico madrid");
    expect(normalise("1. FC Köln")).toBe("1. fc koln");
    expect(normalise("Brighton & Hove Albion")).toBe("brighton and hove albion");
    expect(normalise("  Real   Madrid ")).toBe("real madrid");
  });

  it("matches anywhere in the name, ignoring case and accents", () => {
    const name = normalise("Borussia Mönchengladbach");
    for (const typed of ["monch", "MÖNCH", "gladbach", "borussia m", " Borussia "])
      expect(matches(name, typed)).toBe(true);
    expect(matches(normalise("Deportivo La Coruña"), "coruna")).toBe(true);
    expect(matches(normalise("Brighton & Hove Albion"), "brighton &")).toBe(true);
    expect(matches(normalise("Brighton & Hove Albion"), "brighton and")).toBe(true);
    expect(matches(name, "dortmund")).toBe(false);
  });

  it("nothing typed (or only spaces) matches nothing", () => {
    expect(matches(normalise("Arsenal"), "")).toBe(false);
    expect(matches(normalise("Arsenal"), "   ")).toBe(false);
  });

  it("the live region's words", () => {
    expect(countMessage(0)).toBe("No teams match. Try fewer letters.");
    expect(countMessage(1)).toBe("1 team matches");
    expect(countMessage(3)).toBe("3 teams match");
  });
});

import { describe, expect, it } from "vitest";
import { loadLeague } from "../../src/data/league.ts";
import { LEAGUES } from "../../src/data/leagues.ts";
import { DataError } from "../../src/data/load.ts";
import type { ReadyLeague } from "../../src/data/models.ts";
import { sourcesUsed } from "../../src/data/sources.ts";
import { REAL, useDataDir } from "./helpers.ts";

function readyLeagues(): ReadyLeague[] {
  useDataDir(REAL);
  return LEAGUES.map(loadLeague).filter((l): l is ReadyLeague => l.state === "ready");
}

describe("data sources for the About page (from the real snapshots)", () => {
  it("lists each source once, with what it was used for and in which leagues", () => {
    const sources = sourcesUsed(readyLeagues());
    expect(sources.map((s) => [s.name, s.roles])).toEqual([
      ["football-data.co.uk", ["results", "context"]],
      ["Football-Data.org API", ["results", "fixtures"]],
      ["openfootball", ["check"]],
    ]);
    for (const source of sources) expect(source.leagues).toHaveLength(5);
  });

  it("a source the site doesn't know fails the build (no source without its attribution)", () => {
    const leagues = readyLeagues();
    leagues[0]!.sources.push({ loader: "new_source", role: "results" });
    expect(() => sourcesUsed(leagues)).toThrow(DataError);
  });
});

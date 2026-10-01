// Data sources for the About page, taken from each snapshot's `sources` list
// (which loader was used, and for what), so the page lists exactly what the
// pipeline used. The snapshot names a loader by its id; the display name and
// link are kept here. A loader id not listed here fails the build, so a new
// source can't appear without its attribution.
import { DataError } from "./load.ts";
import type { ReadyLeague } from "./models.ts";

export interface SourceDisplay {
  name: string;
  url: string;
}

export const SOURCE_DISPLAY: Readonly<Record<string, SourceDisplay>> = {
  football_data_org: { name: "Football-Data.org API", url: "https://www.football-data.org/" },
  football_data_uk: { name: "football-data.co.uk", url: "https://www.football-data.co.uk/" },
  openfootball: { name: "openfootball", url: "https://github.com/openfootball" },
};

/** What each role means, in words (contracts/README.md lists the roles). */
export const ROLE_TEXT: Readonly<Record<string, string>> = {
  results: "results",
  fixtures: "the fixture list with kick-off times",
  context: "second-division results (for promoted teams)",
  check: "a second opinion on the fixture list",
};

export interface SourceUse {
  loader: string;
  name: string;
  url: string;
  /** Roles in a fixed order: results, fixtures, context, check. */
  roles: string[];
  /** League names, in the site's order. */
  leagues: string[];
}

const ROLE_ORDER = Object.keys(ROLE_TEXT);

/** One entry per loader used by any league, with what it was used for and where. */
export function sourcesUsed(leagues: ReadyLeague[]): SourceUse[] {
  const byLoader = new Map<string, { roles: Set<string>; leagues: Set<string> }>();
  for (const league of leagues) {
    for (const source of league.sources) {
      if (!SOURCE_DISPLAY[source.loader]) {
        throw new DataError(
          `${league.league.id}: source "${source.loader}" is not in SOURCE_DISPLAY (src/data/sources.ts). Add its name and link.`,
        );
      }
      const entry = byLoader.get(source.loader) ?? { roles: new Set(), leagues: new Set() };
      entry.roles.add(source.role);
      entry.leagues.add(league.league.name);
      byLoader.set(source.loader, entry);
    }
  }
  return [...byLoader].map(([loader, entry]) => ({
    loader,
    // Every loader was checked against SOURCE_DISPLAY above.
    ...(SOURCE_DISPLAY[loader] ?? { name: loader, url: "" }),
    roles: [...entry.roles].sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b)),
    leagues: leagues.map((l) => l.league.name).filter((n) => entry.leagues.has(n)),
  }));
}

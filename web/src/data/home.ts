// The home page: one card per league with the headline numbers.
import type { ReadyLeague, TeamRow, Zone } from "./models.ts";

export interface ZoneLeader {
  team: string;
  chance: number;
  zone: Zone;
}

/** How many teams each race on a home card shows. Fixed, so every card is
 *  the same height. */
export const RACE_SIZE = 3;

export interface CardValues {
  /** The teams most likely to win the title, highest chance first. */
  title: ZoneLeader[];
  /** The teams most likely to finish in the (direct) relegation places, highest first. */
  relegation: ZoneLeader[];
}

/**
 * The `count` teams with the highest chance of a zone, highest first. Ties
 * (rare with 10,000 simulations, but possible at 0) go to the team higher in
 * the table for a top zone and lower in the table for a bottom zone.
 */
export function zoneLeaders(rows: TeamRow[], zone: Zone | undefined, count = RACE_SIZE): ZoneLeader[] {
  if (!zone) return [];
  const ordered = zone.end === "top" ? rows : [...rows].reverse();
  const chance = (row: TeamRow) => row.zoneChances[zone.id] ?? 0;
  // Array.prototype.sort is stable, so a tie keeps the table order above.
  return [...ordered]
    .sort((a, b) => chance(b) - chance(a))
    .slice(0, count)
    .map((row) => ({ team: row.team, chance: chance(row), zone }));
}

/**
 * "Season chances are the share of 10,000 simulated seasons that ended that
 * way.", or null when the leagues don't all use the same number of simulated
 * seasons (or none has a forecast). It describes season chances only: a
 * match's home, draw and away chances come from the match model.
 */
export function seasonChancesSentence(simulationCounts: number[]): string | null {
  const counts = [...new Set(simulationCounts)];
  if (counts.length !== 1 || counts[0] === undefined) return null;
  const seasons = new Intl.NumberFormat("en-GB").format(counts[0]);
  return `Season chances are the share of ${seasons} simulated seasons that ended that way.`;
}

export function cardValues(league: ReadyLeague): CardValues {
  const zone = (id: string) => league.zones.find((z) => z.id === id);
  return {
    title: zoneLeaders(league.rows, zone("title")),
    relegation: zoneLeaders(league.rows, zone("relegation")),
  };
}

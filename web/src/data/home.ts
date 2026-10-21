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

export function cardValues(league: ReadyLeague): CardValues {
  const zone = (id: string) => league.zones.find((z) => z.id === id);
  return {
    title: zoneLeaders(league.rows, zone("title")),
    relegation: zoneLeaders(league.rows, zone("relegation")),
  };
}

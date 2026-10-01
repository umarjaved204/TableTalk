// The home page: one card per league with the headline numbers.
import type { ReadyLeague, TeamRow, Zone } from "./models.ts";

export interface ZoneLeader {
  team: string;
  chance: number;
  zone: Zone;
}

export interface CardValues {
  /** The team most likely to win the title. */
  favourite: ZoneLeader | null;
  /** The team most likely to finish in the (direct) relegation places. */
  relegation: ZoneLeader | null;
  /** Leagues with a relegation play-off place (Bundesliga, Ligue 1): the team most likely to finish there. */
  playoff: ZoneLeader | null;
}

/**
 * The team with the highest chance of a zone. Ties (rare with 10,000
 * simulations, but possible at 0) go to the team higher in the table for a
 * top zone and lower in the table for a bottom zone.
 */
export function zoneLeader(rows: TeamRow[], zone: Zone | undefined): ZoneLeader | null {
  if (!zone) return null;
  const ordered = zone.end === "top" ? rows : [...rows].reverse();
  let best: TeamRow | null = null;
  for (const row of ordered) {
    // Strictly greater, so the first team in `ordered` wins a tie.
    if (best === null || (row.zoneChances[zone.id] ?? 0) > (best.zoneChances[zone.id] ?? 0)) best = row;
  }
  if (best === null) return null;
  return { team: best.team, chance: best.zoneChances[zone.id] ?? 0, zone };
}

export function cardValues(league: ReadyLeague): CardValues {
  const zone = (id: string) => league.zones.find((z) => z.id === id);
  return {
    favourite: zoneLeader(league.rows, zone("title")),
    relegation: zoneLeader(league.rows, zone("relegation")),
    playoff: zoneLeader(league.rows, zone("relegation_playoff")),
  };
}

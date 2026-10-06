// The home page's "Your team" card: what it shows for one team.
import type { ReadyLeague, UpcomingMatch, Zone } from "./models.ts";
import { formatOrdinal, formatPlaces } from "../format/number.ts";
import { formatChance, matchPercents } from "../format/probability.ts";
import { formatDateTime } from "../format/time.ts";
import { teamSlug } from "./teams.ts";

export interface YourTeamChance {
  /** The card's label for the zone, in plain words ("Top four", "Relegation"). */
  label: string;
  positions: number[];
  chance: number;
}

export interface YourTeamCard {
  slug: string;
  name: string;
  position: number;
  points: number;
  played: number;
  /** Title, the first top zone after it (top four, else top five), and relegation;
   *  plus the relegation play-off place where the league has one. */
  chances: YourTeamChance[];
  next: UpcomingMatch | null;
}

/** The card spells zones out: its labels aren't squeezed into a table column
 *  like the table's ("Top 4", "Down"). The team pages use the same words. */
const CARD_LABELS: Readonly<Record<string, string>> = {
  title: "Title",
  top_four: "Top four",
  top_five: "Top five",
  top_half: "Top half",
  relegation: "Relegation",
  relegation_playoff: "Play-off place",
};

/** A zone's name in plain words ("Top four", "Relegation"). */
export function zoneName(zone: Pick<Zone, "id" | "short">): string {
  return CARD_LABELS[zone.id] ?? zone.short;
}

/** The zones the card shows, in order. Ids are the pipeline's (see ZONE_DISPLAY in leagues.ts). */
export function cardZones(zones: readonly Zone[]): Zone[] {
  const byId = (id: string) => zones.find((z) => z.id === id);
  const top = byId("top_four") ?? byId("top_five");
  return [byId("title"), top, byId("relegation"), byId("relegation_playoff")].filter(
    (z): z is Zone => z !== undefined,
  );
}

/** One card per team in the league, in table order. */
export function yourTeamCards(league: ReadyLeague): YourTeamCard[] {
  const zones = cardZones(league.zones);
  return league.rows.map((row) => ({
    slug: teamSlug(row.team),
    name: row.team,
    position: row.position,
    points: row.points,
    played: row.played,
    chances: zones.map((z) => ({
      label: zoneName(z),
      positions: [...z.positions],
      chance: row.zoneChances[z.id] ?? 0,
    })),
    // Upcoming matches are sorted by kick-off (league.ts), so the first is the
    // next. One already kicked off when the snapshot was made is skipped (see
    // contract request R13): its prediction isn't the one that gets locked.
    next:
      league.upcoming.find(
        (m) =>
          (m.home === row.team || m.away === row.team) &&
          (m.kickoffUtc === null || m.kickoffUtc > league.generatedAt),
      ) ?? null,
  }));
}

/**
 * One card's values, flat, for the home page's data block. The page holds
 * ONE card template whose holes are named after these keys (YourTeamCard.astro);
 * the early script fills them in for the favourite. One copy of the card's
 * markup per team made the home page about 300 KB (22 KB compressed), over
 * the agreed 15 KB budget, so the agreed fallback is used: data, not markup.
 *   n name · th team page link · x context line · lh/lt league page link and text ·
 *   c0..c3: s label, p positions, v chance ·
 *   next match: mh/ma teams, mk kick-off (ISO, for <time>), mt kick-off as text,
 *   ph/pd/pa percentages, b* the probability bar's segment positions.
 */
export function cardFields(
  card: YourTeamCard,
  league: { name: string; slug: string },
): Record<string, string | number> {
  const fields: Record<string, string | number> = {
    n: card.name,
    th: `/${league.slug}/${card.slug}/`,
    x: `${league.name} · ${formatOrdinal(card.position)} · ${card.points} pts from ${card.played}`,
    lh: `/${league.slug}/`,
    lt: `${league.name} table`,
  };
  card.chances.forEach((c, i) => {
    fields[`c${i}s`] = c.label;
    fields[`c${i}p`] = formatPlaces(c.positions);
    fields[`c${i}v`] = formatChance(c.chance);
  });
  const next = card.next;
  if (next) {
    const p = matchPercents(next.probabilities);
    const gap = 0.8; // the same thin gaps as ProbabilityBar.astro
    Object.assign(fields, {
      mh: next.home,
      ma: next.away,
      mk: next.kickoffUtc ?? "",
      mt: next.kickoffUtc ? `${formatDateTime(next.kickoffUtc, "UTC")} UTC` : "",
      ph: `${p.home}%`,
      pd: `${p.draw}%`,
      pa: `${p.away}%`,
      b1w: Math.max(0, p.home - gap / 2),
      b2x: p.home + gap / 2,
      b2w: Math.max(0, p.draw - gap),
      b3x: p.home + p.draw + gap / 2,
      b3w: Math.max(0, p.away - gap / 2),
    });
  }
  return fields;
}

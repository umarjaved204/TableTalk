// The club registry: every club with its own crest and colours, keyed by
// team slug. One file per league, added league by league (Premier League,
// then La Liga, the Bundesliga and Serie A; Ligue 1 follows in its own file).
import { teamSlug } from "../../data/teams.ts";
import type { ClubIdentity } from "../types.ts";
import { BUNDESLIGA } from "./bundesliga.ts";
import { LA_LIGA } from "./la-liga.ts";
import { PREMIER_LEAGUE } from "./premier-league.ts";
import { SERIE_A } from "./serie-a.ts";

export const CLUBS: readonly ClubIdentity[] = [...PREMIER_LEAGUE, ...LA_LIGA, ...BUNDESLIGA, ...SERIE_A];

const BY_SLUG = new Map(CLUBS.map((club) => [club.slug, club]));

/** The club's registry entry, or undefined for a club without one yet. */
export function clubIdentity(slug: string): ClubIdentity | undefined {
  return BY_SLUG.get(slug);
}

/** A registry entry's slug must be the slug the site makes from its name,
 *  or it would never be found. tests/unit/identity.test.ts checks this. */
export function slugMatchesName(club: ClubIdentity): boolean {
  return club.slug === teamSlug(club.name);
}

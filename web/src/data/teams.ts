// Team identity for the website: a URL-safe slug for every team.
//
// The published data identifies a team only by its name ("Arsenal", the
// canonical name from configs/team_aliases.yaml); there is no id. Until the
// contract has permanent ids (contract request R14), the site makes a slug
// from the name with a fixed rule. Slugs are used for favourites, personal
// links (?team=arsenal) and, from Step 3, team pages.
//
// The risk: if the pipeline ever renames a team, its slug changes. Stored
// favourites, links and URLs would then point at the old slug. TEAM_SLUG_RENAMES
// below maps old slugs to new ones for that case (empty today).
import { loadIndex, loadLeague } from "./league.ts";
import { LEAGUES } from "./leagues.ts";
import type { LeagueData } from "./models.ts";

/**
 * The slug rule:
 *   1. "&" becomes " and "; ß, ø, æ become ss, o, ae (NFKD doesn't split them);
 *   2. Unicode NFKD, then drop the accent marks (ö -> o, é -> e, ñ -> n);
 *   3. lower case; every run of other characters becomes one hyphen; trim hyphens.
 * "Brighton & Hove Albion" -> "brighton-and-hove-albion", "1. FC Köln" -> "1-fc-koln".
 */
export function teamSlug(name: string): string {
  const spelled = name
    .replaceAll("&", " and ")
    .replaceAll("ß", "ss")
    .replaceAll("ø", "o")
    .replaceAll("Ø", "O")
    .replaceAll("æ", "ae")
    .replaceAll("Æ", "AE");
  return spelled
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, ""); // runs are already single hyphens
}

/** What a slug may look like. The browser checks stored values and links
 *  against this before comparing them with the team list. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MAX_LENGTH = 60;

/** Page names under a league (/premier-league/matches/). A team slug may never
 *  be one of these, or a team page would collide with that page. */
export const RESERVED_SLUGS: readonly string[] = ["matches"];

/** Old slug -> new slug, for a team the pipeline has renamed. Stored
 *  favourites and personal links with the old slug are upgraded quietly.
 *  Empty today: no canonical name has changed since 2010-11. */
export const TEAM_SLUG_RENAMES: Readonly<Record<string, string>> = {};

export interface TeamInfo {
  slug: string;
  name: string;
  leagueId: string;
  leagueSlug: string;
  leagueName: string;
}

export interface TeamIndex {
  /** Every team in a league whose data is ready, in league order, then alphabetical. */
  teams: TeamInfo[];
  /** Leagues with no readable data in this build (unavailable or a newer format).
   *  A favourite in one of these is kept, not treated as "no longer covered". */
  unavailableLeagues: string[];
  /** When each league with data was made (UTC), and the run index: the early
   *  script marks any older than 30 hours as out of date before the first
   *  paint (staleCss in src/scripts/favourite-core.js). */
  updated: string[];
}

export class TeamSlugError extends Error {
  override name = "TeamSlugError";
}

/** Stop the build on a slug that can't be used. */
export function checkSlug(slug: string, where: string, clash: TeamInfo | undefined): void {
  if (!SLUG_PATTERN.test(slug)) throw new TeamSlugError(`${where} has no usable slug ("${slug}")`);
  if (slug.length > SLUG_MAX_LENGTH)
    throw new TeamSlugError(`${where}: slug "${slug}" is over ${SLUG_MAX_LENGTH} characters`);
  if (RESERVED_SLUGS.includes(slug))
    throw new TeamSlugError(`${where}: slug "${slug}" is the name of a page under each league`);
  if (clash)
    throw new TeamSlugError(
      `${where} and ${clash.leagueId}: team "${clash.name}" both have the slug "${slug}". Add a rule to teamSlug() in src/data/teams.ts.`,
    );
}

const collator = new Intl.Collator("en-GB", { sensitivity: "base", numeric: true });

/** Build the team list from the leagues' data. Fails the build on a slug that
 *  is empty, too long, reserved, or shared by two teams (in any league: the
 *  favourite is stored without its league, so slugs must be unique site-wide). */
export function buildTeamIndex(leagues: readonly LeagueData[]): TeamIndex {
  const teams: TeamInfo[] = [];
  const unavailableLeagues: string[] = [];
  const updated: string[] = [];
  const bySlug = new Map<string, TeamInfo>();
  for (const data of leagues) {
    if (data.state !== "ready") {
      unavailableLeagues.push(data.league.id);
      continue;
    }
    updated.push(data.generatedAt);
    const names = [...new Set(data.rows.map((r) => r.team))].sort(collator.compare);
    for (const name of names) {
      const slug = teamSlug(name);
      checkSlug(slug, `${data.league.id}: team "${name}"`, bySlug.get(slug));
      const info = {
        slug,
        name,
        leagueId: data.league.id,
        leagueSlug: data.league.slug,
        leagueName: data.league.name,
      };
      bySlug.set(slug, info);
      teams.push(info);
    }
  }
  for (const [from, to] of Object.entries(TEAM_SLUG_RENAMES)) {
    if (!bySlug.has(to))
      console.warn(`[tabletalk] TEAM_SLUG_RENAMES: "${from}" -> "${to}", but no team has "${to}"`);
  }
  return { teams, unavailableLeagues, updated };
}

let cached: TeamIndex | null = null;

/** The team list for this build (read once). */
export function loadTeamIndex(): TeamIndex {
  if (!cached) {
    const built = buildTeamIndex(LEAGUES.map(loadLeague));
    const index = loadIndex();
    if ("index" in index) built.updated.push(index.index.generated_at);
    cached = built;
  }
  return cached;
}

/** What the early script needs, written into every page. See makeIndex() in
 *  src/scripts/favourite-core.js for how the browser reads it. Names are
 *  included so the browser can say "Make Arsenal your team?" without ever
 *  showing text from the address bar. */
export interface HeadIndex {
  /** Leagues with data in this build: [leagueId, leagueName, [[slug, name], ...]]. */
  leagues: [string, string, [string, string][]][];
  /** Every league's name as it reads mid-sentence, including unavailable
   *  ones ("no forecast for La Liga", "in the Premier League"). */
  names: [string, string][];
  unavailable: string[];
  /** Update times (UTC) the page may show, for the out-of-date check. */
  updated: string[];
  renames: Record<string, string>;
}

export function headIndex(index: TeamIndex): HeadIndex {
  const leagues = LEAGUES.flatMap((league): HeadIndex["leagues"] => {
    const teams = index.teams.filter((t) => t.leagueId === league.id);
    return teams.length > 0
      ? [[league.id, league.name, teams.map((t): [string, string] => [t.slug, t.name])]]
      : [];
  });
  return {
    leagues,
    names: LEAGUES.map((l): [string, string] => [l.id, l.inSentence]),
    unavailable: [...index.unavailableLeagues],
    updated: [...new Set(index.updated)].sort(),
    renames: { ...TEAM_SLUG_RENAMES },
  };
}

// Team pages (/<league>/<team-slug>/): which pages exist, and what each shows.
//
// A team page exists for every team in a league's table. When a league has no
// numbers in this build (unavailable, or in a newer format), its team pages
// still exist, so bookmarks, home-screen links and links from other pages
// keep working: the team list then comes from the newest readable history run,
// and the page says the numbers are unavailable. A league with neither (only
// possible on a brand-new site) has no team pages.
//
// All the team pages of a league use the same files, so each league's data,
// its history and the track record are read once per build (cached below),
// not once per page.
import { loadLeague, markedZoneAt } from "./league.ts";
import { LEAGUES, type LeagueInfo, type ZoneMarker } from "./leagues.ts";
import { loadRecords, recentViews, upcomingViews, type RecordsResult } from "./matches.ts";
import type { LeagueData, MatchView, ReadyLeague, TeamRow } from "./models.ts";
import { chartPoints, loadLeagueHistory, MIN_RESULT_DATES, type RunPoint } from "./race.ts";
import { checkSlug, teamSlug, type TeamInfo } from "./teams.ts";
import { cardZones, zoneName } from "./your-team.ts";
import { formatOrdinal, formatPoints } from "../format/number.ts";
import { formatChance } from "../format/probability.ts";

const leagueCache = new Map<string, LeagueData>();
const historyCache = new Map<string, RunPoint[]>();
let recordsCache: RecordsResult | null = null;

export function cachedLeague(league: LeagueInfo): LeagueData {
  let data = leagueCache.get(league.id);
  if (!data) {
    data = loadLeague(league);
    leagueCache.set(league.id, data);
  }
  return data;
}

export function cachedHistory(leagueId: string): RunPoint[] {
  let points = historyCache.get(leagueId);
  if (!points) {
    points = loadLeagueHistory(leagueId).points;
    historyCache.set(leagueId, points);
  }
  return points;
}

export function cachedRecords(): RecordsResult {
  recordsCache ??= loadRecords();
  return recordsCache;
}

export interface TeamPageEntry {
  slug: string;
  name: string;
  league: LeagueInfo;
}

/** The team names for one league's pages: today's table when the league has
 *  numbers, otherwise the newest readable history run. */
export function rosterFor(data: LeagueData, history: readonly RunPoint[]): string[] {
  if (data.state === "ready") return data.rows.map((r) => r.team);
  const newest = history.at(-1);
  return newest ? [...newest.teams.keys()] : [];
}

/** Every team page. Fails the build on a slug that can't be used, as the
 *  favourites' team list does (slugs are unique site-wide). */
export function buildTeamPages(
  leagues: readonly { league: LeagueInfo; data: LeagueData; history: readonly RunPoint[] }[],
): TeamPageEntry[] {
  const bySlug = new Map<string, TeamInfo>();
  const pages: TeamPageEntry[] = [];
  for (const { league, data, history } of leagues) {
    for (const name of rosterFor(data, history)) {
      const slug = teamSlug(name);
      checkSlug(slug, `${league.id}: team "${name}"`, bySlug.get(slug));
      bySlug.set(slug, { slug, name, leagueId: league.id, leagueSlug: league.slug, leagueName: league.name });
      pages.push({ slug, name, league });
    }
  }
  return pages;
}

let pagesCache: TeamPageEntry[] | null = null;
let hrefCache: Map<string, string> | null = null;

/** Every team page in this build (worked out once). */
export function teamPages(): TeamPageEntry[] {
  pagesCache ??= buildTeamPages(
    LEAGUES.map((league) => ({ league, data: cachedLeague(league), history: cachedHistory(league.id) })),
  );
  return pagesCache;
}

/** The address of a team's page, by name, from a list of pages. */
export function teamHrefs(pages: readonly TeamPageEntry[]): Map<string, string> {
  return new Map(pages.map((p) => [p.name, `/${p.league.slug}/${p.slug}/`]));
}

/** Where a team name links to: its page, or undefined if it has none in this
 *  build (a name is only a link when the page exists). */
export function teamHref(name: string): string | undefined {
  hrefCache ??= teamHrefs(teamPages());
  return hrefCache.get(name);
}

// ---------------------------------------------------------------------------
// What one team page shows.
// ---------------------------------------------------------------------------

/** How many upcoming and recent matches a team page lists. */
export const TEAM_MATCHES = 5;

export interface ZoneChance {
  id: string;
  /** In plain words: "Top four", "Relegation". */
  name: string;
  positions: number[];
  chance: number;
}

/** A run of positions shaded the same in the finishing-position chart: the
 *  innermost marked zone they are in (title beats top four), as in the table. */
export interface Band {
  id: string;
  name: string;
  end: "top" | "bottom";
  marker: ZoneMarker;
  from: number;
  to: number;
}

export interface TeamTrend {
  /** When each point's run was made (UTC), oldest first: one per day, this season. */
  runDates: string[];
  dataThrough: (string | null)[];
  resultDates: number;
  /** The race charts' rule: at least MIN_RESULT_DATES different "results up to" dates. */
  enoughForTrend: boolean;
  /** The Your team card's zones (title, top four or five, relegation, play-off place). */
  chances: (ZoneChance & { values: (number | null)[] })[];
  points: (number | null)[];
}

export interface TeamView {
  name: string;
  slug: string;
  row: TeamRow;
  /** Every zone the league has, in the data's order. */
  chances: ZoneChance[];
  mostLikely: { position: number; chance: number };
  bands: Band[];
  upcoming: MatchView[];
  /** null when the track record can't be read (recent matches can't be shown). */
  recent: MatchView[] | null;
  trend: TeamTrend;
}

const plays = (team: string) => (m: MatchView) => m.home === team || m.away === team;

/** The position with the highest chance (the higher place on a tie). */
export function mostLikely(finishing: readonly number[]): { position: number; chance: number } {
  let best = 0;
  finishing.forEach((p, i) => {
    if (p > (finishing[best] ?? 0)) best = i;
  });
  return { position: best + 1, chance: finishing[best] ?? 0 };
}

/** Consecutive positions grouped by their innermost marked zone. */
export function zoneBands(league: Pick<ReadyLeague, "zones" | "rows">): Band[] {
  const bands: Band[] = [];
  for (let position = 1; position <= league.rows.length; position++) {
    const zone = markedZoneAt(position, league.zones);
    if (!zone) continue;
    const last = bands.at(-1);
    if (last && last.id === zone.id && last.to === position - 1) {
      last.to = position;
      continue;
    }
    const info = league.zones.find((z) => z.id === zone.id);
    bands.push({
      id: zone.id,
      name: info ? zoneName(info) : zone.id,
      end: zone.end,
      marker: zone.marker,
      from: position,
      to: position,
    });
  }
  return bands;
}

export function teamTrend(league: ReadyLeague, team: string, history: readonly RunPoint[]): TeamTrend {
  const points = chartPoints([...history], league.season);
  const resultDates = new Set(points.map((p) => p.dataThrough)).size;
  const now = league.rows.find((r) => r.team === team)?.zoneChances ?? {};
  return {
    runDates: points.map((p) => p.generatedAt),
    dataThrough: points.map((p) => p.dataThrough),
    resultDates,
    enoughForTrend: resultDates >= MIN_RESULT_DATES,
    chances: cardZones(league.zones).map((z) => ({
      id: z.id,
      name: zoneName(z),
      positions: [...z.positions],
      chance: now[z.id] ?? 0,
      values: points.map((p) => p.teams.get(team)?.zones[z.id] ?? null),
    })),
    points: points.map((p) => p.teams.get(team)?.expectedPoints ?? null),
  };
}

export function teamView(
  league: ReadyLeague,
  team: string,
  records: RecordsResult,
  history: readonly RunPoint[],
): TeamView {
  const row = league.rows.find((r) => r.team === team);
  if (!row) throw new Error(`${league.league.id}: no table row for "${team}"`);
  const known = records.status === "ok" ? records.records : new Map();
  return {
    name: team,
    slug: teamSlug(team),
    row,
    chances: league.zones.map((z) => ({
      id: z.id,
      name: zoneName(z),
      positions: [...z.positions],
      chance: row.zoneChances[z.id] ?? 0,
    })),
    mostLikely: mostLikely(row.finishing),
    bands: zoneBands(league),
    upcoming: upcomingViews(league, known).filter(plays(team)).slice(0, TEAM_MATCHES),
    recent:
      records.status === "ok" ? recentViews(league, known).filter(plays(team)).slice(0, TEAM_MATCHES) : null,
    trend: teamTrend(league, team, history),
  };
}

/** The page's meta description: where the team stands and its main chances. */
export function teamDescription(league: ReadyLeague, view: TeamView): string {
  const { row } = view;
  const chances = cardZones(league.zones)
    .map((z) => `${zoneName(z).toLowerCase()} ${formatChance(row.zoneChances[z.id] ?? 0)}`)
    .join(", ");
  return (
    `${view.name} in ${league.league.inSentence} ${league.season}: ${formatOrdinal(row.position)} with ` +
    `${row.points} points from ${row.played} matches, projected ${formatPoints(row.projectedPoints)} points. ` +
    `Chances: ${chances}. Updated nightly.`
  );
}

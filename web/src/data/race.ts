// "How the race has moved": each team's chances and projected points over time.
//
// Until contract request R2 (a compact series file), the build reads every
// run's snapshot in history/<run>/<league>.json and keeps only the few
// numbers the chart needs. Each file is about 150-190 KB, so this is the part
// of the build that grows over a season (see web/README.md for timings).
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Snapshot } from "./contract.gen.ts";
import { DataError, loadFile } from "./load.ts";
import { dataDir } from "./paths.ts";

/** One run's numbers for one league: only what the chart uses. */
export interface RunPoint {
  generatedAt: string;
  dataThrough: string | null;
  season: string;
  /** Per team: projected points and the chance of each zone. */
  teams: Map<string, { expectedPoints: number; zones: Record<string, number> }>;
}

export interface HistoryResult {
  points: RunPoint[];
  /** Run folders whose file couldn't be used (newer format, or unreadable), with why. */
  skipped: string[];
}

/** Read this league's file from every history folder, oldest first. Each file
 *  goes through the same version check and validation as the latest files.
 *  One that can't be used is skipped with a warning, not fatal: history is extra. */
export function loadLeagueHistory(leagueId: string): HistoryResult {
  const root = join(dataDir(), "history");
  if (!existsSync(root)) return { points: [], skipped: [] };
  const points: RunPoint[] = [];
  const skipped: string[] = [];
  for (const folder of readdirSync(root).sort()) {
    if (!existsSync(join(root, folder, `${leagueId}.json`))) continue; // the league failed that night
    try {
      const result = loadFile<Snapshot>(`history/${folder}/${leagueId}.json`, "snapshot");
      if (result.status === "ok") points.push(extractPoint(result.data));
      else if (result.status === "unsupported")
        skipped.push(`${folder}: contract ${result.found ?? "missing"}`);
    } catch (error) {
      if (!(error instanceof DataError)) throw error;
      skipped.push(`${folder}: ${error.message}`);
    }
  }
  if (skipped.length > 0)
    console.warn(`[tabletalk] ${leagueId}: history runs skipped: ${skipped.join("; ")}`);
  return { points, skipped };
}

/** Keep only the chart's fields from one snapshot. */
export function extractPoint(snap: Snapshot): RunPoint {
  return {
    generatedAt: snap.generated_at,
    dataThrough: snap.data_through,
    season: snap.competition.season,
    teams: new Map(
      snap.teams.map((t) => [t.team, { expectedPoints: t.expected_points, zones: { ...t.zones } }]),
    ),
  };
}

/** Keep the current season's runs, and the last run of each day (UTC): the
 *  pipeline sometimes runs twice a day, and two points a few hours apart
 *  only add simulation noise. */
export function chartPoints(points: RunPoint[], season: string): RunPoint[] {
  const lastOfDay = new Map<string, RunPoint>();
  for (const point of points) {
    if (point.season !== season) continue;
    lastOfDay.set(point.generatedAt.slice(0, 10), point); // oldest first, so the last one wins
  }
  return [...lastOfDay.values()];
}

// ---------------------------------------------------------------------------
// Which teams appear.
//
// A chart with all 18-20 teams is unreadable, so each chart shows only the
// teams in that race:
//   Title:      teams whose title chance reached 10% at any point (about twice
//               the 5% an average team would have in a 20-team league).
//   Relegation: teams whose relegation chance reached 20% at any point.
//   Proj. pts:  the teams on the other two charts.
// At most MAX_TEAMS per chance chart (highest peak first), and never empty:
// if nobody reaches the threshold, the team with the highest chance now.
// ---------------------------------------------------------------------------
export const TITLE_THRESHOLD = 0.1;
export const RELEGATION_THRESHOLD = 0.2;
export const MAX_TEAMS = 6;

/** A trend needs this many different "results up to" dates. Runs between
 *  matchdays use the same results, so their differences are only simulation
 *  noise; three dates means at least two rounds of new results. */
export const MIN_RESULT_DATES = 3;

export interface Series {
  team: string;
  /** One value per chart point (null if the team isn't in that run). */
  values: (number | null)[];
}

function seriesFor(
  points: RunPoint[],
  team: string,
  pick: (t: { expectedPoints: number; zones: Record<string, number> }) => number | undefined,
): Series {
  return {
    team,
    values: points.map((p) => {
      const t = p.teams.get(team);
      const value = t ? pick(t) : undefined;
      return value === undefined ? null : value;
    }),
  };
}

const peak = (s: Series) => Math.max(...s.values.map((v) => v ?? 0));
const latest = (s: Series) => s.values.at(-1) ?? 0;

/** Apply the selection rule to one zone's chances. Returned in order of the
 *  latest value, highest first (the order the chart and table list them). */
export function selectTeams(all: Series[], threshold: number, max = MAX_TEAMS): Series[] {
  const byLatest = (a: Series, b: Series) => latest(b) - latest(a) || a.team.localeCompare(b.team);
  const chosen = all
    .filter((s) => peak(s) >= threshold)
    .sort((a, b) => peak(b) - peak(a) || a.team.localeCompare(b.team))
    .slice(0, max);
  // Nobody reached the threshold: the team with the highest chance now.
  if (chosen.length === 0) return [...all].sort(byLatest).slice(0, 1);
  return chosen.sort(byLatest);
}

export interface RaceData {
  /** When each point's run was made (UTC), oldest first. */
  runDates: string[];
  dataThrough: (string | null)[];
  /** How many different "results up to" dates the points cover. */
  resultDates: number;
  enoughForTrend: boolean;
  title: Series[];
  relegation: Series[];
  points: Series[];
  /** Per chart, the teams NOT shown in it (alphabetical). The page pre-builds
   *  a panel for each, and shows only the visitor's favourite's (if any), so
   *  the chart always includes the favourite. */
  extra: { title: Series[]; relegation: Series[]; points: Series[] };
}

export function buildRace(points: RunPoint[], relegationZone = "relegation"): RaceData {
  const teams = [...new Set(points.flatMap((p) => [...p.teams.keys()]))];
  const zone = (id: string) => teams.map((team) => seriesFor(points, team, (t) => t.zones[id]));
  const title = selectTeams(zone("title"), TITLE_THRESHOLD);
  const relegation = selectTeams(zone(relegationZone), RELEGATION_THRESHOLD);

  const shown = [...new Set([...title, ...relegation].map((s) => s.team))];
  const projected = shown
    .map((team) => seriesFor(points, team, (t) => t.expectedPoints))
    .sort((a, b) => latest(b) - latest(a) || a.team.localeCompare(b.team));

  // Teams in the latest run that a chart doesn't show (for the favourite's panel).
  const current = [...(points.at(-1)?.teams.keys() ?? [])].sort((a, b) => a.localeCompare(b));
  const missing = (shownIn: Series[], all: Series[]) => {
    const inChart = new Set(shownIn.map((s) => s.team));
    return all.filter((s) => current.includes(s.team) && !inChart.has(s.team));
  };
  const byName = (list: Series[]) => [...list].sort((a, b) => a.team.localeCompare(b.team));
  const extra = {
    title: byName(missing(title, zone("title"))),
    relegation: byName(missing(relegation, zone(relegationZone))),
    points: byName(
      missing(
        projected,
        teams.map((team) => seriesFor(points, team, (t) => t.expectedPoints)),
      ),
    ),
  };

  const resultDates = new Set(points.map((p) => p.dataThrough)).size;
  return {
    runDates: points.map((p) => p.generatedAt),
    dataThrough: points.map((p) => p.dataThrough),
    resultDates,
    enoughForTrend: resultDates >= MIN_RESULT_DATES,
    title,
    relegation,
    points: projected,
    extra,
  };
}

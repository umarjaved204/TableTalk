// Turn one league's published files into the site's LeagueData model.
import type { RunIndex, Snapshot } from "./contract.gen.ts";
import { DataError, loadFile } from "./load.ts";
import { zoneDisplay, type LeagueInfo, type ZoneMarker } from "./leagues.ts";
import type { LeagueData, TeamRow, UpcomingMatch, Zone } from "./models.ts";

type IndexEntry = RunIndex["competitions"][number];

/** The run index says what the last run did for each league. Without it the
 *  site has no data at all, so a missing or unreadable index stops the build. */
export function loadIndex(): { index: RunIndex; version: string } | { unsupported: string | null } {
  const result = loadFile<RunIndex>("latest/index.json", "index");
  if (result.status === "missing")
    throw new DataError("latest/index.json is missing. Run `npm run data` first.");
  if (result.status === "unsupported") return { unsupported: result.found };
  return { index: result.data, version: result.version };
}

export function loadLeague(league: LeagueInfo): LeagueData {
  const loaded = loadIndex();
  if ("unsupported" in loaded) return { state: "unsupported", league, found: loaded.unsupported };

  const entry = loaded.index.competitions.find((c) => c.id === league.id);
  if (!entry || entry.status === "no_snapshot" || entry.file === null) {
    return { state: "unavailable", league, reason: "no_snapshot", error: entry?.error ?? null };
  }

  // A snapshot that exists but breaks the contract makes only THIS league
  // unavailable, with a loud build warning; the other leagues still build.
  // (The pipeline checks every file before publishing, so this should never
  // happen.) A broken index.json still stops the build: without it there is
  // nothing to show at all.
  let result;
  try {
    result = loadFile<Snapshot>(`latest/${entry.file}`, "snapshot");
  } catch (error) {
    if (!(error instanceof DataError)) throw error;
    console.warn(`[tabletalk] ${league.id}: ${error.message}. Shown as unavailable.`);
    return { state: "unavailable", league, reason: "invalid", error: null };
  }
  if (result.status === "missing")
    return { state: "unavailable", league, reason: "missing", error: entry.error };
  if (result.status === "unsupported") return { state: "unsupported", league, found: result.found };
  return buildLeague(league, entry, result.data, result.version);
}

export function buildLeague(
  league: LeagueInfo,
  entry: IndexEntry,
  snap: Snapshot,
  version: string,
): LeagueData {
  if (snap.competition.id !== league.id) {
    throw new DataError(`latest/${entry.file} is for "${snap.competition.id}", expected "${league.id}"`);
  }
  const zones: Zone[] = snap.zones.map((z) => ({
    id: z.id,
    label: z.label,
    positions: [...z.positions],
    ...zoneDisplay(z.id, league.id),
  }));

  const teams = new Map(snap.teams.map((t) => [t.team, t]));
  const rows: TeamRow[] = snap.table.map((r) => {
    const t = teams.get(r.team);
    if (!t) throw new DataError(`${league.id}: "${r.team}" is in the table but has no predictions`);
    return {
      position: r.position,
      team: r.team,
      played: r.played,
      won: r.won,
      drawn: r.drawn,
      lost: r.lost,
      goalsFor: r.goals_for,
      goalsAgainst: r.goals_against,
      goalDifference: r.goal_difference,
      points: r.points,
      pointsDeducted: r.points_deducted,
      projectedPoints: t.expected_points,
      pointsP10: t.points_p10,
      pointsP90: t.points_p90,
      zoneChances: { ...t.zones },
      finishing: [...t.finishing_positions],
      zone: markedZoneAt(r.position, zones),
      boundaryBelow: isBoundaryBelow(r.position, zones),
    };
  });

  const upcoming: UpcomingMatch[] = snap.upcoming_matches
    .map((m) => ({
      id: m.match_id,
      matchday: m.matchday,
      date: m.date,
      kickoffUtc: m.kickoff_utc,
      status: m.status,
      home: m.home_team,
      away: m.away_team,
      probabilities: { ...m.probabilities },
      expectedGoals: { ...m.expected_goals },
      likelyScorelines: m.likely_scorelines.map((s) => ({ ...s })),
    }))
    .sort(byKickoff);

  return {
    state: "ready",
    league,
    season: snap.competition.season,
    country: snap.competition.country,
    generatedAt: snap.generated_at,
    runStatus: entry.status === "kept_previous" ? "kept_previous" : "updated",
    runError: entry.error,
    dataThrough: snap.data_through,
    provisional: snap.provisional,
    notices: [...snap.notices],
    nSimulations: snap.run.n_simulations,
    contractVersion: version,
    zones,
    rows,
    upcoming,
  };
}

/** The smallest marked zone containing this position (title beats top four). */
export function markedZoneAt(
  position: number,
  zones: Zone[],
): { id: string; end: "top" | "bottom"; marker: ZoneMarker } | null {
  let best: Zone | null = null;
  for (const zone of zones) {
    if (zone.marker === null || !zone.positions.includes(position)) continue;
    if (best === null || zone.positions.length < best.positions.length) best = zone;
  }
  return best && best.marker ? { id: best.id, end: best.end, marker: best.marker } : null;
}

/** A thicker rule goes under the last row of a marked top zone and above
 *  the first row of a marked bottom zone. */
export function isBoundaryBelow(position: number, zones: Zone[]): boolean {
  return zones.some((zone) => {
    if (zone.marker === null) return false;
    return zone.end === "top"
      ? Math.max(...zone.positions) === position
      : Math.min(...zone.positions) === position + 1;
  });
}

/** Earliest kick-off first. Matches without a time go after timed ones on the
 *  same date (and after everything if they have no date either). */
function byKickoff(a: UpcomingMatch, b: UpcomingMatch): number {
  const key = (m: UpcomingMatch) => m.kickoffUtc ?? (m.date ? `${m.date}T99` : "9999");
  return key(a).localeCompare(key(b)) || a.home.localeCompare(b.home);
}

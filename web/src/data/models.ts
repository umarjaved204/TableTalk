// The site's own shapes. Components only ever see these, never the raw
// contract types, so a contract change is handled in one place (league.ts).
import type { LeagueInfo, ZoneMarker } from "./leagues.ts";

export interface Zone {
  id: string;
  /** The pipeline's own label, e.g. "Relegation to the Championship". */
  label: string;
  short: string;
  end: "top" | "bottom";
  marker: ZoneMarker | null;
  positions: number[];
}

export interface TeamRow {
  position: number;
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  /** Net points change already included in `points` (negative for a deduction). */
  pointsDeducted: number;
  /** Average final points across the simulated seasons ("Proj. pts"). */
  projectedPoints: number;
  pointsP10: number;
  pointsP90: number;
  /** Chance of finishing in each zone, keyed by zone id. */
  zoneChances: Record<string, number>;
  /** Chance of finishing 1st, 2nd, ... last. */
  finishing: number[];
  /** The innermost marked zone this position is in, if any. */
  zone: { id: string; end: "top" | "bottom"; marker: ZoneMarker } | null;
  /** True when a zone boundary runs under this row (drawn as a thicker rule). */
  boundaryBelow: boolean;
}

export interface Probabilities {
  home: number;
  draw: number;
  away: number;
}

export interface UpcomingMatch {
  id: string | null;
  matchday: string | null;
  /** The listed date (YYYY-MM-DD, no time zone). */
  date: string | null;
  kickoffUtc: string | null;
  status: string | null;
  home: string;
  away: string;
  probabilities: Probabilities;
  expectedGoals: { home: number; away: number };
  likelyScorelines: { home: number; away: number; probability: number }[];
}

/** The prediction shown on a match card. Missed matches have none. */
export interface MatchPrediction {
  probabilities: Probabilities;
  expectedGoals: { home: number; away: number } | null;
  likelyScorelines: { home: number; away: number; probability: number }[];
}

/** Where a match stands. See src/data/matches.ts for how each one is decided,
 *  and src/format/match-status.ts for the words shown. */
export type MatchStatus =
  /** Not kicked off: the newest prediction, from the snapshot. */
  | { kind: "upcoming"; predictedAt: string; fixtureStatus: string | null }
  /** Past its listed kick-off but not in the lock log yet. `predictedBeforeKickoff`
   *  says whether the prediction shown was made before the listed kick-off. */
  | { kind: "kicked_off"; predictedAt: string; predictedBeforeKickoff: boolean }
  | { kind: "locked"; predictedAt: string }
  | { kind: "played"; predictedAt: string; score: { home: number; away: number } }
  | { kind: "voided"; predictedAt: string; reason: string }
  | { kind: "invalid"; predictedAt: string; actualKickoffUtc: string | null }
  | { kind: "missed" };

export interface MatchView {
  /** Unique on the page: the lock id or match id. */
  key: string;
  home: string;
  away: string;
  /** The kick-off to show and group by (listed, or actual when the log has it). */
  kickoffUtc: string | null;
  /** The listed date, for matches without a time. */
  date: string | null;
  prediction: MatchPrediction | null;
  status: MatchStatus;
  /** Earlier predictions for this match that were voided (a postponed match). */
  earlierVoided: { predictedAt: string; reason: string }[];
}

export interface ReadyLeague {
  state: "ready";
  league: LeagueInfo;
  season: string;
  country: string;
  /** When this league's snapshot was made (UTC). */
  generatedAt: string;
  /** "updated" or "kept_previous" (last night's run failed, these are older numbers). */
  runStatus: "updated" | "kept_previous";
  runError: string | null;
  dataThrough: string | null;
  provisional: boolean;
  notices: string[];
  nSimulations: number;
  contractVersion: string;
  /** Which data sources the pipeline used, and for what (`role`). */
  sources: { loader: string; role: string }[];
  zones: Zone[];
  rows: TeamRow[];
  upcoming: UpcomingMatch[];
}

export interface UnavailableLeague {
  state: "unavailable";
  league: LeagueInfo;
  /** no_snapshot: the pipeline has never produced one. missing: listed but not
   *  published. invalid: published but not readable (bad JSON or breaks the contract). */
  reason: "no_snapshot" | "missing" | "invalid";
  error: string | null;
}

export interface UnsupportedLeague {
  state: "unsupported";
  league: LeagueInfo;
  /** The contract version found in the file, if any. */
  found: string | null;
}

export type LeagueData = ReadyLeague | UnavailableLeague | UnsupportedLeague;

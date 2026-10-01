// The track record page's model, built from track_record/summary.json.
//
// summary.json already holds the pipeline's comparisons and calibration
// (src/tabletalk/pipeline/track_record.py); the site only arranges them and
// decides two display questions:
//   1. Is the sample big enough to judge? Each comparison carries
//      `matches_needed`: roughly how many matches it takes to detect a gap the
//      size the backtest found. Below that, the page says the sample is too small.
//   2. Show the calibration chart? Only once the all-leagues comparison with
//      base rates has at least `matches_needed` matches (agreed in the plan);
//      before that, the table only.
import type { TrackRecordSummary } from "./contract.gen.ts";
import { LEAGUES } from "./leagues.ts";

type RawComparison = TrackRecordSummary["competitions"][number]["comparisons"][number];
type RawCalibration = TrackRecordSummary["calibration"][number];
type RawMatch = TrackRecordSummary["matches"][number];

/** How many scored matches the page lists (newest first). The rest are in summary.json. */
export const MATCHES_SHOWN = 50;

export interface ComparisonView {
  against: "base rates" | "market";
  n: number;
  modelLogLoss: number | null;
  otherLogLoss: number | null;
  diff: number | null;
  ci95: number | null;
  firstHalf: number | null;
  secondHalf: number | null;
  /** The pipeline's verdict, as written. */
  verdict: RawComparison["verdict"];
  matchesNeeded: number | null;
  /** True once n >= matches_needed: the sample can detect a backtest-sized gap. */
  enoughMatches: boolean;
}

export interface CompetitionView {
  /** "all", or a league id. */
  id: string;
  name: string;
  n: number;
  base: ComparisonView | null;
  market: ComparisonView | null;
}

export interface CalibrationRow {
  bin: string;
  n: number;
  meanForecast: number;
  observed: number;
  ciLow: number;
  ciHigh: number;
}

export interface ScoredMatchView {
  lockId: string;
  competition: string;
  leagueName: string;
  home: string;
  away: string;
  kickoffUtc: string | null;
  predictedAt: string;
  probabilities: { home: number; draw: number; away: number };
  score: { home: number; away: number };
  logLoss: number;
  codeCommit: string | null;
}

export interface TrackRecordView {
  generatedAt: string;
  liveSince: string | null;
  chainVerified: boolean;
  counts: TrackRecordSummary["counts"];
  /** "All leagues" first, then each league in the site's order. */
  competitions: CompetitionView[];
  calibration: Record<"home" | "draw" | "away", CalibrationRow[]>;
  showCalibrationChart: boolean;
  /** Newest first, at most MATCHES_SHOWN. */
  latestScored: ScoredMatchView[];
  notes: string[];
}

function leagueName(id: string): string {
  if (id === "all") return "All leagues";
  return LEAGUES.find((l) => l.id === id)?.name ?? id;
}

function comparison(raw: RawComparison | undefined): ComparisonView | null {
  if (!raw) return null;
  return {
    against: raw.against,
    n: raw.n,
    modelLogLoss: raw.model_log_loss,
    otherLogLoss: raw.other_log_loss,
    diff: raw.diff,
    ci95: raw.ci95,
    firstHalf: raw.first_half,
    secondHalf: raw.second_half,
    verdict: raw.verdict,
    matchesNeeded: raw.matches_needed,
    enoughMatches: raw.matches_needed !== null && raw.n >= raw.matches_needed,
  };
}

/** Order: all leagues, then the site's league order, then anything unknown. */
function order(id: string): number {
  if (id === "all") return -1;
  const index = LEAGUES.findIndex((l) => l.id === id);
  return index === -1 ? LEAGUES.length : index;
}

function calibrationFor(rows: RawCalibration[], outcome: "home" | "draw" | "away"): CalibrationRow[] {
  return rows
    .filter((r) => r.outcome === outcome)
    .map((r) => ({
      bin: r.bin,
      n: r.n,
      meanForecast: r.mean_forecast,
      observed: r.observed,
      ciLow: r.ci_low,
      ciHigh: r.ci_high,
    }));
}

function scoredMatch(m: RawMatch): ScoredMatchView {
  return {
    lockId: m.lock_id,
    competition: m.competition,
    leagueName: leagueName(m.competition),
    home: m.home_team,
    away: m.away_team,
    kickoffUtc: m.kickoff_utc,
    predictedAt: m.predicted_at,
    probabilities: { ...m.probabilities },
    score: { home: m.home_goals, away: m.away_goals },
    logLoss: m.log_loss,
    codeCommit: m.code_commit,
  };
}

export function buildTrackRecord(summary: TrackRecordSummary): TrackRecordView {
  const competitions = summary.competitions
    .map((c) => ({
      id: c.id,
      name: leagueName(c.id),
      n: c.n,
      base: comparison(c.comparisons.find((x) => x.against === "base rates")),
      market: comparison(c.comparisons.find((x) => x.against === "market")),
    }))
    .sort((a, b) => order(a.id) - order(b.id));

  const allBase = competitions.find((c) => c.id === "all")?.base ?? null;
  const latestScored = [...summary.matches]
    .sort((a, b) => (b.kickoff_utc ?? "").localeCompare(a.kickoff_utc ?? ""))
    .slice(0, MATCHES_SHOWN)
    .map(scoredMatch);

  return {
    generatedAt: summary.generated_at,
    liveSince: summary.live_since,
    chainVerified: summary.chain_verified,
    counts: { ...summary.counts },
    competitions,
    calibration: {
      home: calibrationFor(summary.calibration, "home"),
      draw: calibrationFor(summary.calibration, "draw"),
      away: calibrationFor(summary.calibration, "away"),
    },
    showCalibrationChart: summary.calibration.length > 0 && allBase !== null && allBase.enoughMatches,
    latestScored,
    notes: [...summary.notes],
  };
}

// ILLUSTRATED fixtures: made-up lock-log events, scores and history runs, built
// on top of the real published files in data-16a5512/. They exist so every
// match status and the race chart can be tested before real ones exist.
// They are NOT real predictions or results, and are never published.
//
// Used by the unit tests and by make-e2e-data.ts (the site the browser tests run against).
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SEASON = "2026-27";
const MODEL = { code_commit: "illustrated", code_dirty: false, config_hash: "illustrated" };

interface LockSpec {
  matchId: string;
  attempt: number;
  competition: string;
  home: string;
  away: string;
  listedKickoff: string;
  predictedAt: string;
  probabilities: { home: number; draw: number; away: number };
}

function lock(spec: LockSpec): Record<string, unknown> {
  return {
    event: "lock",
    lock_id: `${spec.matchId}#${spec.attempt}`,
    recorded_at: spec.listedKickoff.replace(/T.*/, "T23:40:00Z"),
    match_id: spec.matchId,
    competition: spec.competition,
    season: SEASON,
    home_team: spec.home,
    away_team: spec.away,
    listed_kickoff_utc: spec.listedKickoff,
    predicted_at: spec.predictedAt,
    data_as_of: spec.predictedAt.slice(0, 10),
    snapshot: `history/${spec.predictedAt.slice(0, 13).replace(/[-:]/g, "")}/${spec.competition}.json`,
    model: MODEL,
    probabilities: spec.probabilities,
    expected_goals: { home: 1.6, away: 1.1 },
    likely_scorelines: [
      { home: 1, away: 1, probability: 0.121 },
      { home: 1, away: 0, probability: 0.104 },
    ],
  };
}

const PL = "premier_league";
const BL = "bundesliga";

/** One example of every status. Times are UTC. */
export const SCENARIOS = {
  playedHomeWin: {
    matchId: "fdorg:900001",
    competition: PL,
    home: "Chelsea",
    away: "Everton",
    listedKickoff: "2026-09-20T13:00:00Z",
    predictedAt: "2026-09-20T04:41:07Z",
    probabilities: { home: 0.512, draw: 0.262, away: 0.226 },
    score: [2, 1],
  },
  playedDraw: {
    matchId: "fdorg:900002",
    competition: PL,
    home: "Liverpool",
    away: "Brentford",
    listedKickoff: "2026-09-20T15:30:00Z",
    predictedAt: "2026-09-20T04:41:07Z",
    probabilities: { home: 0.583, draw: 0.231, away: 0.186 },
    score: [1, 1],
  },
  locked: {
    matchId: "fdorg:900003",
    competition: PL,
    home: "Fulham",
    away: "Coventry City",
    listedKickoff: "2026-09-21T19:00:00Z",
    predictedAt: "2026-09-21T04:40:55Z",
    probabilities: { home: 0.471, draw: 0.268, away: 0.261 },
  },
  // Postponed, voided, then played on a new date: lock #2 is the current one.
  relockedFirst: {
    matchId: "fdorg:900004",
    competition: PL,
    home: "Hull City",
    away: "Sunderland",
    listedKickoff: "2026-09-13T14:00:00Z",
    predictedAt: "2026-09-13T04:40:31Z",
    probabilities: { home: 0.402, draw: 0.281, away: 0.317 },
  },
  relockedSecond: {
    matchId: "fdorg:900004",
    competition: PL,
    home: "Hull City",
    away: "Sunderland",
    listedKickoff: "2026-09-28T19:00:00Z",
    predictedAt: "2026-09-28T04:41:12Z",
    probabilities: { home: 0.391, draw: 0.284, away: 0.325 },
  },
  // Kick-off was moved 30 minutes earlier, after the prediction was made.
  invalid: {
    matchId: "fdorg:900005",
    competition: PL,
    home: "Newcastle United",
    away: "Ipswich Town",
    listedKickoff: "2026-09-14T17:00:00Z",
    predictedAt: "2026-09-14T16:40:02Z",
    probabilities: { home: 0.552, draw: 0.247, away: 0.201 },
    actualKickoff: "2026-09-14T16:30:00Z",
  },
  missed: {
    matchId: "fdorg:900006",
    competition: PL,
    home: "Brighton & Hove Albion",
    away: "Crystal Palace",
    actualKickoff: "2026-09-15T19:00:00Z",
  },
  // A REAL upcoming match (Aston Villa v Brentford, now 10 Oct), illustrated
  // as postponed from 27 Sep: voided, and back in Upcoming with a note.
  voidedNowUpcoming: {
    matchId: "fdorg:560601",
    competition: PL,
    home: "Aston Villa",
    away: "Brentford",
    listedKickoff: "2026-09-27T14:00:00Z",
    predictedAt: "2026-09-27T04:40:44Z",
    probabilities: { home: 0.448, draw: 0.272, away: 0.28 },
  },
  bundesligaPlayed: {
    matchId: "fdorg:900101",
    competition: BL,
    home: "Borussia Dortmund",
    away: "Hamburger SV",
    listedKickoff: "2026-09-19T13:30:00Z",
    predictedAt: "2026-09-19T04:40:20Z",
    probabilities: { home: 0.661, draw: 0.196, away: 0.143 },
    score: [3, 0],
  },
  bundesligaLocked: {
    matchId: "fdorg:900102",
    competition: BL,
    home: "Union Berlin",
    away: "Mainz 05",
    listedKickoff: "2026-09-27T13:30:00Z",
    predictedAt: "2026-09-27T04:40:44Z",
    probabilities: { home: 0.389, draw: 0.291, away: 0.32 },
  },
} as const;

const S = SCENARIOS;

/** The lock-log lines, in the order the pipeline would write them. */
export function illustratedLogLines(): Record<string, unknown>[] {
  return [
    lock({ ...S.relockedFirst, attempt: 1 }),
    { event: "void", lock_id: "fdorg:900004#1", reason: "postponed", recorded_at: "2026-09-13T23:40:00Z" },
    lock({ ...S.invalid, attempt: 1 }),
    {
      event: "invalid",
      lock_id: "fdorg:900005#1",
      reason: "prediction was not made before the actual kick-off",
      actual_kickoff_utc: S.invalid.actualKickoff,
      recorded_at: "2026-09-14T23:40:00Z",
    },
    {
      event: "missed",
      match_id: S.missed.matchId,
      competition: PL,
      home_team: S.missed.home,
      away_team: S.missed.away,
      actual_kickoff_utc: S.missed.actualKickoff,
      reason: "kicked off before any run had predicted it",
      recorded_at: "2026-09-15T23:40:00Z",
    },
    lock({ ...S.bundesligaPlayed, attempt: 1 }),
    lock({ ...S.playedHomeWin, attempt: 1 }),
    lock({ ...S.playedDraw, attempt: 1 }),
    lock({ ...S.locked, attempt: 1 }),
    lock({ ...S.voidedNowUpcoming, attempt: 1 }),
    { event: "void", lock_id: "fdorg:560601#1", reason: "postponed", recorded_at: "2026-09-27T23:40:00Z" },
    lock({ ...S.bundesligaLocked, attempt: 1 }),
    lock({ ...S.relockedSecond, attempt: 2 }),
  ];
}

/** The log as the pipeline writes it: one compact JSON object per line,
 *  each with `prev` = sha256 of the line before (a real chain, though the site doesn't check it). */
export function illustratedLog(events = illustratedLogLines()): string {
  let previous = "0".repeat(64);
  const lines = events.map((event) => {
    const line = JSON.stringify({ ...event, prev: previous });
    previous = createHash("sha256").update(line, "utf8").digest("hex");
    return line;
  });
  return lines.join("\n") + "\n";
}

function scored(spec: {
  matchId: string;
  competition: string;
  home: string;
  away: string;
  listedKickoff: string;
  predictedAt: string;
  probabilities: { home: number; draw: number; away: number };
  score: readonly [number, number];
}) {
  const [h, a] = spec.score;
  const outcome = h > a ? "home" : h < a ? "away" : "draw";
  return {
    lock_id: `${spec.matchId}#1`,
    competition: spec.competition,
    home_team: spec.home,
    away_team: spec.away,
    kickoff_utc: spec.listedKickoff,
    predicted_at: spec.predictedAt,
    probabilities: spec.probabilities,
    home_goals: h,
    away_goals: a,
    log_loss: Math.round(-Math.log(spec.probabilities[outcome]) * 1e6) / 1e6,
    code_commit: "illustrated",
  };
}

/** summary.json consistent with the illustrated log (3 scored, too few to compare). */
export function illustratedSummary(): Record<string, unknown> {
  const tooFew = (against: string) => ({
    against,
    n: 3,
    model_log_loss: null,
    other_log_loss: null,
    diff: null,
    ci95: null,
    first_half: null,
    second_half: null,
    verdict: "too few matches to compare",
    matches_needed: null,
  });
  return {
    contract_version: "1.1.0",
    generated_at: "2026-09-29T17:56:40Z",
    live_since: "2026-09-01T04:40:00Z",
    chain_verified: true,
    counts: {
      locks: 9,
      voided: 2,
      invalid: 1,
      missed: 1,
      scored: 3,
      awaiting_result: 3,
      awarded_not_scored: 0,
    },
    competitions: [{ id: "all", n: 3, comparisons: [tooFew("base rates"), tooFew("market")] }],
    calibration: [],
    matches: [scored(S.bundesligaPlayed), scored(S.playedHomeWin), scored(S.playedDraw)],
    notes: ["ILLUSTRATED test data: not real predictions or results."],
  };
}

export function writeIllustratedTrackRecord(dir: string): void {
  mkdirSync(join(dir, "track_record"), { recursive: true });
  writeFileSync(join(dir, "track_record", "locks.jsonl"), illustratedLog());
  writeFileSync(join(dir, "track_record", "summary.json"), JSON.stringify(illustratedSummary()));
}

// ---------------------------------------------------------------------------
// History: earlier runs for the race chart, made from the real latest
// snapshot. Run k blends the real numbers with "every team equal" (weight w):
// chance = w * real + (1 - w) * (places in zone / teams); points likewise
// with the league average. So the lines move from level towards today's
// real values over five illustrated runs, ending at the real snapshot.
// ---------------------------------------------------------------------------
export const HISTORY_RUNS = [
  { folder: "2026-08-18T0440Z", generatedAt: "2026-08-18T04:40:00Z", dataThrough: "2026-08-17", weight: 0.2 },
  { folder: "2026-08-25T0440Z", generatedAt: "2026-08-25T04:40:00Z", dataThrough: "2026-08-24", weight: 0.4 },
  {
    folder: "2026-09-01T0440Z",
    generatedAt: "2026-09-01T04:40:00Z",
    dataThrough: "2026-08-31",
    weight: 0.55,
  },
  {
    folder: "2026-09-15T0440Z",
    generatedAt: "2026-09-15T04:40:00Z",
    dataThrough: "2026-09-14",
    weight: 0.75,
  },
  { folder: "2026-09-22T0440Z", generatedAt: "2026-09-22T04:40:00Z", dataThrough: "2026-09-20", weight: 0.9 },
] as const;

interface SnapshotLike {
  generated_at: string;
  data_through: string | null;
  zones: { id: string; positions: number[] }[];
  teams: { expected_points: number; zones: Record<string, number> }[];
}

/** Write illustrated history runs for one league, plus the real latest
 *  snapshot as the newest run (folder named after its generated_at). */
export function writeIllustratedHistory(dir: string, leagueId: string, runs = HISTORY_RUNS): void {
  const latestPath = join(dir, "latest", `${leagueId}.json`);
  const real = JSON.parse(readFileSync(latestPath, "utf8")) as SnapshotLike;
  const n = real.teams.length;
  const meanPoints = real.teams.reduce((sum, t) => sum + t.expected_points, 0) / n;
  for (const run of runs) {
    const snap = structuredClone(real);
    snap.generated_at = run.generatedAt;
    snap.data_through = run.dataThrough;
    for (const team of snap.teams) {
      team.expected_points = round(run.weight * team.expected_points + (1 - run.weight) * meanPoints);
      for (const zone of snap.zones) {
        const base = zone.positions.length / n;
        team.zones[zone.id] = round(run.weight * (team.zones[zone.id] ?? 0) + (1 - run.weight) * base);
      }
    }
    mkdirSync(join(dir, "history", run.folder), { recursive: true });
    writeFileSync(join(dir, "history", run.folder, `${leagueId}.json`), JSON.stringify(snap));
  }
  const folder = real.generated_at.slice(0, 16).replace(/:/g, "") + "Z";
  mkdirSync(join(dir, "history", folder), { recursive: true });
  cpSync(latestPath, join(dir, "history", folder, `${leagueId}.json`));
}

function round(x: number): number {
  return Math.round(x * 1e6) / 1e6;
}

// ---------------------------------------------------------------------------
// A MATURE track record, for the browser tests' site: the events above plus
// 180 illustrated scored matches in La Liga and Serie A (about six weeks of
// two leagues), enough for the calibration chart to appear. The comparison
// and calibration numbers are hand-set illustrations, not computed: the site
// only displays what summary.json says.
// ---------------------------------------------------------------------------
const MATURE_TEAMS: Record<string, string[]> = {
  la_liga: [
    "Real Madrid",
    "Barcelona",
    "Atlético Madrid",
    "Athletic Club",
    "Villarreal",
    "Real Sociedad",
    "Real Betis",
    "Sevilla",
  ],
  serie_a: ["Inter", "Napoli", "Juventus", "Milan", "Atalanta", "Roma", "Lazio", "Fiorentina"],
};
export const MATURE_EXTRA = 180;

/** A small deterministic random number generator (same numbers every run). */
function randomFrom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

interface MatureMatch {
  spec: LockSpec;
  score: [number, number];
}

function matureMatches(): MatureMatch[] {
  const random = randomFrom(20260929);
  const out: MatureMatch[] = [];
  for (let i = 0; i < MATURE_EXTRA; i++) {
    const competition = i % 2 === 0 ? "la_liga" : "serie_a";
    const teams = MATURE_TEAMS[competition] ?? [];
    const home = teams[i % teams.length] ?? "Home";
    const away = teams[(i + 3) % teams.length] ?? "Away";
    // Kick-offs spread from 1 to 26 Sep 2026, at 14:00 or 19:00 UTC.
    const day = 1 + Math.floor((i / MATURE_EXTRA) * 26);
    const kickoff = `2026-09-${String(day).padStart(2, "0")}T${i % 3 === 0 ? "19" : "14"}:00:00Z`;
    const pHome = round(0.3 + random() * 0.35);
    const pDraw = round(0.22 + random() * 0.08);
    const probabilities = { home: pHome, draw: pDraw, away: round(1 - pHome - pDraw) };
    const roll = random();
    const score: [number, number] = roll < pHome ? [2, 1] : roll < pHome + pDraw ? [1, 1] : [0, 1];
    out.push({
      spec: {
        matchId: `fdorg:91${String(i).padStart(4, "0")}`,
        attempt: 1,
        competition,
        home,
        away,
        listedKickoff: kickoff,
        predictedAt: kickoff.replace(/T\d\d:00:00Z/, "T04:40:00Z"),
        probabilities,
      },
      score,
    });
  }
  return out;
}

export function matureLogLines(): Record<string, unknown>[] {
  return [...illustratedLogLines(), ...matureMatches().map((m) => lock(m.spec))];
}

export function matureSummary(): Record<string, unknown> {
  const base = illustratedSummary();
  const extra = matureMatches().map((m) => scored({ ...m.spec, score: m.score }));
  const comparison = (
    against: string,
    n: number,
    model: number | null,
    other: number | null,
    diff: number | null,
    ci95: number | null,
    halves: [number, number] | null,
    verdict: string,
    needed: number | null,
  ) => ({
    against,
    n,
    model_log_loss: model,
    other_log_loss: other,
    diff,
    ci95,
    first_half: halves?.[0] ?? null,
    second_half: halves?.[1] ?? null,
    verdict,
    matches_needed: needed,
  });
  const calibrationRows = (outcome: string, rows: [string, number, number, number, number, number][]) =>
    rows.map(([bin, n, mean_forecast, observed, ci_low, ci_high]) => ({
      outcome,
      bin,
      n,
      mean_forecast,
      observed,
      ci_low,
      ci_high,
      gap: round(observed - mean_forecast),
    }));
  return {
    ...base,
    counts: {
      locks: 9 + MATURE_EXTRA,
      voided: 2,
      invalid: 1,
      missed: 1,
      scored: 3 + MATURE_EXTRA,
      awaiting_result: 3,
      awarded_not_scored: 0,
    },
    competitions: [
      {
        id: "all",
        n: 183,
        comparisons: [
          comparison("base rates", 183, 0.989, 1.061, -0.072, 0.044, [-0.081, -0.063], "model better", 152),
          comparison(
            "market",
            150,
            0.991,
            0.972,
            0.019,
            0.036,
            [0.024, 0.014],
            "no detectable difference",
            1381,
          ),
        ],
      },
      {
        id: "bundesliga",
        n: 1,
        comparisons: [
          comparison("base rates", 1, 0.414, 0.89, -0.476, null, null, "too few matches to compare", null),
          comparison("market", 0, null, null, null, null, null, "no scored matches yet", null),
        ],
      },
      {
        id: "la_liga",
        n: 90,
        comparisons: [
          comparison("base rates", 90, 0.982, 1.058, -0.076, 0.063, [-0.09, -0.062], "model better", 148),
          comparison(
            "market",
            75,
            0.986,
            0.97,
            0.016,
            0.052,
            [0.02, 0.012],
            "no detectable difference",
            1402,
          ),
        ],
      },
      {
        id: "premier_league",
        n: 2,
        comparisons: [
          comparison("base rates", 2, 0.97, 1.12, -0.15, 0.31, [-0.1, -0.2], "no detectable difference", 61),
          comparison("market", 0, null, null, null, null, null, "no scored matches yet", null),
        ],
      },
      {
        id: "serie_a",
        n: 90,
        comparisons: [
          comparison(
            "base rates",
            90,
            0.996,
            1.064,
            -0.068,
            0.061,
            [0.004, -0.14],
            "consistently better but modest",
            155,
          ),
          comparison(
            "market",
            75,
            0.997,
            0.975,
            0.022,
            0.05,
            [0.028, 0.016],
            "no detectable difference",
            1360,
          ),
        ],
      },
    ],
    calibration: [
      ...calibrationRows("home", [
        ["20%-40%", 61, 0.344, 0.328, 0.222, 0.455],
        ["40%-60%", 96, 0.491, 0.51, 0.413, 0.607],
        ["60%-80%", 26, 0.637, 0.654, 0.462, 0.806],
      ]),
      ...calibrationRows("draw", [["20%-40%", 183, 0.259, 0.246, 0.188, 0.314]]),
      ...calibrationRows("away", [
        ["0%-20%", 22, 0.171, 0.136, 0.047, 0.333],
        ["20%-40%", 140, 0.278, 0.271, 0.204, 0.351],
        ["40%-60%", 21, 0.428, 0.429, 0.245, 0.635],
      ]),
    ],
    matches: [...(base["matches"] as unknown[]), ...extra],
  };
}

/** The mature track record (for the browser tests' site). */
export function writeMatureTrackRecord(dir: string): void {
  mkdirSync(join(dir, "track_record"), { recursive: true });
  writeFileSync(join(dir, "track_record", "locks.jsonl"), illustratedLog(matureLogLines()));
  writeFileSync(join(dir, "track_record", "summary.json"), JSON.stringify(matureSummary()));
}

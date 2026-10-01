// Backtest results for the methodology page.
//
// TEMPORARY until contract request R10 (a published backtest summary file).
// Copied by hand from the project README's table "Phase 2: the five leagues
// side by side", at the commit below. tests/unit/backtests.test.ts reads
// ../README.md and fails if these numbers no longer match it, so the copy
// can't drift silently.

/** The README commit these numbers were copied from. */
export const README_COMMIT = "bcca0a5";

/** Report seasons: 2018-19 and 2021-22 to 2025-26 (settings chosen on 2012-13 to 2017-18). */
export const REPORT_SEASONS = "2018-19 and 2021-22 to 2025-26";

export interface LeagueBacktest {
  leagueId: string;
  matches: number;
  /** Log loss compared with base rates, as a percentage change (−9.4 = 9.4% lower). */
  vsBaseRatesPercent: number;
  /** Share of the gap between base rates and the market that the model closes, %. */
  gapClosedPercent: number;
  /** Model minus market, log loss, with its 95% interval. */
  minusMarket: { diff: number; ci95: number };
  /** Average distance from the diagonal, percentage points: home / draw / away. */
  calibrationGap: { home: number; draw: number; away: number };
}

export const BACKTESTS: readonly LeagueBacktest[] = [
  {
    leagueId: "premier_league",
    matches: 2280,
    vsBaseRatesPercent: -9.4,
    gapClosedPercent: 83,
    minusMarket: { diff: 0.02, ci95: 0.007 },
    calibrationGap: { home: 3.0, draw: 1.2, away: 1.9 },
  },
  {
    leagueId: "bundesliga",
    matches: 1836,
    vsBaseRatesPercent: -7.5,
    gapClosedPercent: 81,
    minusMarket: { diff: 0.019, ci95: 0.008 },
    calibrationGap: { home: 3.2, draw: 1.2, away: 2.4 },
  },
  {
    leagueId: "la_liga",
    matches: 2280,
    vsBaseRatesPercent: -7.6,
    gapClosedPercent: 83,
    minusMarket: { diff: 0.016, ci95: 0.007 },
    calibrationGap: { home: 3.0, draw: 2.1, away: 3.0 },
  },
  {
    leagueId: "serie_a",
    matches: 2280,
    vsBaseRatesPercent: -9.6,
    gapClosedPercent: 85,
    minusMarket: { diff: 0.018, ci95: 0.007 },
    calibrationGap: { home: 1.9, draw: 2.7, away: 3.1 },
  },
  {
    leagueId: "ligue_1",
    matches: 2058,
    vsBaseRatesPercent: -6.4,
    gapClosedPercent: 77,
    minusMarket: { diff: 0.02, ci95: 0.007 },
    calibrationGap: { home: 1.2, draw: 0.7, away: 2.1 },
  },
];

/** Premier League, report seasons: average log loss of each forecaster (README). */
export const PREMIER_LEAGUE_LOG_LOSS = { model: 0.965, baseRates: 1.064, market: 0.945 } as const;

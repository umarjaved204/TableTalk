// Track record wording: the one-line summary (home page) and the comparison
// and sample-size sentences (track record page).
//
// Wording rule: a difference is quoted as "difference ± 95% interval". If the
// interval includes zero it is "no detectable difference", whatever else is
// said. Never "beats".
import type { TrackRecordSummary } from "../data/contract.gen.ts";
import type { ComparisonView } from "../data/track-record-view.ts";
import { LOCALE } from "./time.ts";

const threeDecimals = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
  signDisplay: "exceptZero",
});
const plainThree = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const plainTwo = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const whole = new Intl.NumberFormat(LOCALE);

/** "−0.021 ± 0.015" (a true minus sign). */
export function formatDifference(diff: number, ci95: number): string {
  return `${threeDecimals.format(diff).replace("-", "−")} ± ${plainThree.format(ci95)}`;
}

/** True when diff ± ci95 includes zero. */
export function includesZero(diff: number, ci95: number): boolean {
  return diff - ci95 <= 0 && diff + ci95 >= 0;
}

/** A log loss, or a signed difference without an interval: "0.965", "−0.031". */
export function formatLogLoss(x: number, signed = false): string {
  return signed ? threeDecimals.format(x).replace("-", "−") : plainThree.format(x);
}

/** The log-loss gaps the backtest found (report seasons, README), as used by
 *  the pipeline to work out `matches_needed`. */
export const BACKTEST_GAPS = { "base rates": 0.08, market: 0.02 } as const;

/**
 * The verdict to show. The pipeline's verdict, except that an interval
 * including zero is always "no detectable difference" (the pipeline agrees;
 * this makes the rule impossible to break on the page).
 */
export function displayVerdict(c: Pick<ComparisonView, "verdict" | "diff" | "ci95">): string {
  if (c.diff !== null && c.ci95 !== null && includesZero(c.diff, c.ci95)) return "no detectable difference";
  return c.verdict;
}

/** "−0.031 ± 0.012", or "–" when there is no interval yet. */
export function comparisonDifference(c: Pick<ComparisonView, "diff" | "ci95">): string {
  return c.diff !== null && c.ci95 !== null ? formatDifference(c.diff, c.ci95) : "–";
}

/**
 * Whether the sample is big enough to judge, in one sentence, or null when it is.
 *   "12 matches scored so far, too few to judge: roughly 450 are needed to
 *    detect a gap the size the backtest found (0.08 in log loss)."
 */
export function sampleSentence(c: ComparisonView): string | null {
  if (c.n === 0 || c.enoughMatches) return null;
  const gap = plainTwo.format(BACKTEST_GAPS[c.against]);
  if (c.matchesNeeded === null) return `${matches(c.n)} so far: too few to compare yet.`;
  return `${matches(c.n)} so far, too few to judge: roughly ${whole.format(c.matchesNeeded)} are needed to detect a gap the size the backtest found (${gap} in log loss).`;
}

/** "a match" / "12 matches". */
function matches(n: number): string {
  return n === 1 ? "1 match" : `${whole.format(n)} matches`;
}

/**
 * One sentence about the live track record, from summary.json:
 *   - nothing scored yet: "No matches scored yet."
 *   - too few to compare: "3 matches scored: too few to compare yet."
 *   - otherwise, against base rates: "120 matches scored. Against base rates:
 *     no detectable difference (log loss difference −0.004 ± 0.020)."
 */
export function trackRecordLine(summary: TrackRecordSummary): string {
  const all = summary.competitions.find((c) => c.id === "all");
  const base = all?.comparisons.find((c) => c.against === "base rates");
  const scored = summary.counts.scored;
  if (scored === 0 || !base) return "No matches scored yet.";
  if (base.diff === null || base.ci95 === null || base.verdict === "too few matches to compare") {
    return `${matches(scored)} scored: too few to compare yet.`;
  }
  const verdict = displayVerdict(base);
  return `${matches(scored)} scored. Against base rates: ${verdict} (log loss difference ${formatDifference(base.diff, base.ci95)}).`;
}

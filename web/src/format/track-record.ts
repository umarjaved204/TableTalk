// The one-line track record summary (home page, placeholder page).
//
// Wording rule: a difference is quoted as "difference ± 95% interval". If the
// interval includes zero it is "no detectable difference", whatever else is
// said. Never "beats".
import type { TrackRecordSummary } from "../data/contract.gen.ts";
import { LOCALE } from "./time.ts";

const threeDecimals = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
  signDisplay: "exceptZero",
});
const plainThree = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const whole = new Intl.NumberFormat(LOCALE);

/** "−0.021 ± 0.015" (a true minus sign). */
export function formatDifference(diff: number, ci95: number): string {
  return `${threeDecimals.format(diff).replace("-", "−")} ± ${plainThree.format(ci95)}`;
}

/** True when diff ± ci95 includes zero. */
export function includesZero(diff: number, ci95: number): boolean {
  return diff - ci95 <= 0 && diff + ci95 >= 0;
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
  const verdict = includesZero(base.diff, base.ci95) ? "no detectable difference" : base.verdict;
  return `${matches(scored)} scored. Against base rates: ${verdict} (log loss difference ${formatDifference(base.diff, base.ci95)}).`;
}

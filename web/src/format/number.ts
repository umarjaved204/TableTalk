// Numbers other than probabilities.
import { LOCALE } from "./time.ts";

const whole = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const signed = new Intl.NumberFormat(LOCALE, { signDisplay: "exceptZero", maximumFractionDigits: 0 });

/** Intl writes a hyphen for negative numbers; tables use a true minus sign (U+2212). */
function minus(text: string): string {
  return text.replace("-", "−");
}

/** Projected points: whole points, because the simulation average is not more precise than that. */
export function formatPoints(points: number): string {
  return minus(whole.format(points));
}

/** Goal difference and points deductions: "+8", "−9", "0". */
export function formatSigned(n: number): string {
  return minus(signed.format(n));
}

/** "72–93": the range 80% of simulated seasons end in. */
export function formatRange(low: number, high: number): string {
  return `${formatPoints(low)}–${formatPoints(high)}`;
}

/** Expected goals, one decimal: "1.9". */
export function formatGoals(goals: number): string {
  return oneDecimal.format(goals);
}

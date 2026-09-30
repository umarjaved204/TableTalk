// How probabilities are shown. Two rules:
//
// 1. A single chance is a whole percentage, but never "0%" or "100%" unless
//    the data marks the outcome as certain. An exact 0.0 in the files means
//    "didn't happen in 10,000 simulations", not "impossible" (contract request
//    R1), so it shows as "<1%". Whole percentages because with 10,000
//    simulations a 50% chance has about ±1 point of simulation noise.
//
// 2. Home/draw/away must visibly add up to 100. Rounding each one on its own
//    can give 99 or 101, so they are rounded together with the largest
//    remainder method (see roundToHundred).

/** What the data says about certainty. Always null until contract request R1. */
export type Certainty = "certain" | "impossible" | null;

export function formatChance(p: number, certainty: Certainty = null): string {
  if (!Number.isFinite(p) || p < 0 || p > 1) throw new RangeError(`not a probability: ${p}`);
  if (certainty === "impossible") return "0%";
  if (certainty === "certain") return "100%";
  const percent = Math.round(p * 100);
  if (p < 0.005 || percent < 1) return "<1%";
  if (p > 0.995 || percent > 99) return ">99%";
  return `${percent}%`;
}

/**
 * Round probabilities that add up to 1 into whole percentages that add up to
 * exactly 100 (largest remainder method):
 *   1. take the whole-number part of each percentage;
 *   2. hand the points still missing to the values with the biggest
 *      fractional parts, one each (ties: the earlier value wins).
 * Then no value is allowed below `minimum`: in a match all three outcomes are
 * possible, so none is ever shown as 0. Any shortfall is taken from the
 * largest value. (So a 0.3% draw would show as 1%.)
 *
 * Example: 65.54 / 22.34 / 12.12 -> 65 / 22 / 12 (= 99) -> 66 / 22 / 12.
 */
export function roundToHundred(probabilities: readonly number[], minimum = 1): number[] {
  const total = probabilities.reduce((a, b) => a + b, 0);
  if (probabilities.length === 0 || Math.abs(total - 1) > 1e-4) {
    throw new RangeError(`probabilities must add up to 1, got ${total}`);
  }
  if (minimum * probabilities.length > 100) throw new RangeError("minimum too large");

  const exact = probabilities.map((p) => p * 100);
  const rounded = exact.map((x) => Math.floor(x));
  const missing = 100 - rounded.reduce((a, b) => a + b, 0);
  const byRemainder = exact
    .map((x, i) => ({ i, remainder: x - Math.floor(x) }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  for (let k = 0; k < missing; k++) {
    const target = byRemainder[k % byRemainder.length];
    if (target) rounded[target.i] = (rounded[target.i] ?? 0) + 1;
  }

  for (let i = 0; i < rounded.length; i++) {
    while ((rounded[i] ?? 0) < minimum) {
      const largest = rounded.indexOf(Math.max(...rounded));
      rounded[largest] = (rounded[largest] ?? 0) - 1;
      rounded[i] = (rounded[i] ?? 0) + 1;
    }
  }
  return rounded;
}

export interface OutcomePercents {
  home: number;
  draw: number;
  away: number;
}

export function matchPercents(p: { home: number; draw: number; away: number }): OutcomePercents {
  const [home = 0, draw = 0, away = 0] = roundToHundred([p.home, p.draw, p.away]);
  return { home, draw, away };
}

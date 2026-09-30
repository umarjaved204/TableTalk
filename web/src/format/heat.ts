// Finishing-position heatmap: which of the 7 colour steps a chance gets, and
// the number printed in the cell. The steps are ordinal bins, so equal
// colour steps are roughly equal jumps in how likely something is.
import { formatChance } from "./probability.ts";

/** Lower bound of steps 1..7. Below the first bound the cell is left blank. */
export const HEAT_BOUNDS = [0.005, 0.03, 0.07, 0.15, 0.25, 0.4, 0.6] as const;

/** 0 = blank (under 0.5%), otherwise 1..7. */
export function heatStep(p: number): number {
  let step = 0;
  for (const [i, bound] of HEAT_BOUNDS.entries()) if (p >= bound) step = i + 1;
  return step;
}

/** The number printed in a cell: "" when blank, otherwise the chance without "%" ("59", "<1" never occurs). */
export function heatLabel(p: number): string {
  return heatStep(p) === 0 ? "" : formatChance(p).replace("%", "");
}

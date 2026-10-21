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

/** One cell of a heatmap row: a coloured value, or a run of blank cells. */
export interface HeatCell {
  step: number;
  label: string;
  /** How many positions the cell covers (more than 1 only for a blank run). */
  span: number;
}

/**
 * A row's cells, with each run of blank cells (under 0.5%) merged into one
 * cell spanning those positions. It looks the same (blank cells have no
 * colour and no text) but needs fewer elements: about 65 fewer on a 20-team
 * league page early in the season, more later, when more finishes are out of
 * reach. Every position still has a value somewhere in its column, so the
 * column widths don't change.
 */
export function heatCells(finishing: readonly number[]): HeatCell[] {
  const cells: HeatCell[] = [];
  for (const p of finishing) {
    const step = heatStep(p);
    const last = cells.at(-1);
    if (step === 0 && last?.step === 0) last.span += 1;
    else cells.push({ step, label: heatLabel(p), span: 1 });
  }
  return cells;
}

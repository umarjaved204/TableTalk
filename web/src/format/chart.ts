// Geometry for the "How the race has moved" charts, drawn as SVG at build
// time. Plain functions from numbers to coordinates, no chart library.
//
// SVG's y axis points DOWN (0 is the top), so a higher value gets a smaller y.

export interface Box {
  width: number;
  height: number;
  /** Space kept clear inside the edges, so the end dot isn't cut off. */
  pad: number;
}

/** A straight-line mapping from [d0, d1] to [r0, r1]. */
export function scale(d0: number, d1: number, r0: number, r1: number): (v: number) => number {
  const span = d1 - d0 || 1; // a flat domain maps everything to r0
  return (v) => r0 + ((v - d0) / span) * (r1 - r0);
}

/** x positions for the run times: spaced by real time, so a gap of a few
 *  days without runs shows as a gap. */
export function xPositions(times: string[], box: Box): number[] {
  const ms = times.map((t) => new Date(t).getTime());
  const x = scale(Math.min(...ms), Math.max(...ms), box.pad, box.width - box.pad);
  return ms.map((t) => round(x(t)));
}

/** Top of the y scale for chances: the smallest of 25%, 50%, 75%, 100% that
 *  fits the highest value, so small chances aren't squashed at the bottom. */
export function chanceTop(max: number): number {
  return [0.25, 0.5, 0.75, 1].find((top) => max <= top) ?? 1;
}

/** y range for projected points: whole tens around the values. */
export function pointsRange(values: number[]): [number, number] {
  const low = Math.floor(Math.min(...values) / 10) * 10;
  const high = Math.ceil(Math.max(...values) / 10) * 10;
  return [low, high === low ? low + 10 : high];
}

/** An SVG path through the points. A missing value (null) breaks the line. */
export function linePath(values: (number | null)[], xs: number[], y: (v: number) => number): string {
  let path = "";
  let drawing = false;
  values.forEach((value, i) => {
    if (value === null) {
      drawing = false;
      return;
    }
    path += `${drawing ? "L" : "M"}${xs[i]} ${round(y(value))}`;
    drawing = true;
  });
  return path;
}

/** The last point with a value (for the end dot). */
export function lastPoint(
  values: (number | null)[],
  xs: number[],
  y: (v: number) => number,
): { x: number; y: number } | null {
  for (let i = values.length - 1; i >= 0; i--) {
    const value = values[i];
    const x = xs[i];
    if (value !== null && value !== undefined && x !== undefined) return { x, y: round(y(value)) };
  }
  return null;
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

// Smooth silhouettes from a list of outline points.
//
// The animals and birds are drawn as one closed outline each: a list of
// points round the shape, joined by curves that pass through every point
// (a Catmull-Rom curve, written as cubic Bezier segments). A point marked
// sharp is a corner instead (a claw, an ear tip, a feather's point): the
// curves meet there without smoothing. One flowing outline reads better than
// a body assembled from separate parts, and makes a smaller file.

/** [x, y] for a smooth point, [x, y, 1] for a sharp corner. */
export type OutlinePoint = readonly [number, number] | readonly [number, number, 1];

const r1 = (v: number) => {
  const s = (Math.round(v * 10) / 10).toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
};

/**
 * A closed path through the points. `tension` sets how round the curves are
 * (0 gives straight lines, 1 a full Catmull-Rom curve).
 */
export function outline(points: readonly OutlinePoint[], tension = 1): string {
  const n = points.length;
  const at = (i: number) => points[((i % n) + n) % n] as OutlinePoint;
  const sharp = (p: OutlinePoint) => p.length === 3;
  const k = tension / 6;
  let d = `M${r1(at(0)[0])} ${r1(at(0)[1])}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const c1 = sharp(p1) ? p1 : [p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k];
    const c2 = sharp(p2) ? p2 : [p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k];
    d += `C${r1(c1[0] ?? 0)} ${r1(c1[1] ?? 0)} ${r1(c2[0] ?? 0)} ${r1(c2[1] ?? 0)} ${r1(p2[0])} ${r1(p2[1])}`;
  }
  return `${d}Z`;
}

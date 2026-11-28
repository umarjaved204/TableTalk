// VfB Stuttgart's letters in a Gothic-inspired style, drawn by hand as
// shapes (28 Nov 2026): angular thick strokes with hairline flicks, a tall
// hooked f and a B with two broken bowls. Original drawings, not taken
// from a font file or the club's badge. Only these three letters exist.
import { mapPath } from "./lettering.ts";

// Each letter in its own box: cap height 100, baseline at y 100, the f's
// hook rising above the cap line and its stem dropping below the baseline.
const V =
  "M0 14L11 2L24 0L34 8L34 58Q34 77 46 89L38 100Q12 86 12 62L12 20L8 16Z" +
  "M44 8L58 0L72 6L74 15L64 23Q61 50 55 74Q49 92 38 100L46 89Q51 77 52 60Q53 40 53 23L45 16Z";
// The f's crossbar is drawn in two pieces either side of the stem, so the
// even-odd fill (needed for the B's bowls) never cuts a hole where they cross.
const F =
  "M12 108L12 18Q13 -5 36 -13L51 -11L53 -2L42 0Q30 2 30 20L30 100L22 108Z" +
  "M1 30L12 29L12 39L3 40ZM30 27.5L45 26L47 35L30 37Z";
const B =
  "M2 8L15 0L25 4Q52 -4 61 12Q66 26 52 40Q70 46 69 68Q67 95 35 100L10 100L3 94L10 87L10 16Z" +
  "M27 13L27 40Q45 37 45 24Q44 12 27 13Z" +
  "M27 53L27 89Q50 89 50 71Q50 54 27 53Z";
const WIDTHS = { V: 74, f: 52, B: 70 } as const;
const GAP = 6;

/** VfB as one path, centred on x, sitting on `baseline`, `cap` units tall.
 *  Use fill-rule="evenodd" so the B's bowls stay open. */
export function vfb(x: number, baseline: number, cap: number): string {
  const s = cap / 100;
  const total = WIDTHS.V + WIDTHS.f + WIDTHS.B + 2 * GAP;
  let left = x - (total * s) / 2;
  let d = "";
  for (const [letter, shape] of [
    ["V", V],
    ["f", F],
    ["B", B],
  ] as const) {
    const ox = left;
    d += mapPath(shape, (px, py) => [ox + px * s, baseline - (100 - py) * s]);
    left += (WIDTHS[letter] + GAP) * s;
  }
  return d;
}

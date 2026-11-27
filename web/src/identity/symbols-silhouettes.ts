// The third round of symbol drawings (27 Nov 2026, after the second gallery
// review): the animals and birds redrawn as single flowing silhouettes
// (outline.ts) for a more natural, elegant shape that still reads at 16 px.
// Same rules as symbols.ts: original drawings in a 100 x 100 box, coloured
// by role (main, accent, ground).
import { outline, type OutlinePoint } from "./outline.ts";
import type { Ink } from "./symbols.ts";

type Draw = (ink: Ink) => string;

const path = (d: string, fill: string) => `<path d="${d}" fill="${fill}"/>`;
const line = (d: string, stroke: string, width: number) =>
  `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
const circle = (cx: number, cy: number, r: number, fill: string) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;

// Aston Villa's lion rampant, facing left. Head up with the mouth open, a
// mane of four broad flame-shaped locks, the body on the diagonal with a deep
// chest and narrow waist, both forepaws raised, one hind leg planted and one
// stepping forward. Paws are rounded with three short claws each.
const LION: OutlinePoint[] = [
  [19, 13, 1],
  [21, 8],
  [26, 5],
  [32, 4],
  [37, 1],
  [45, 3],
  [51, 8],
  [54, 15],
  [56, 23],
  [53, 31],
  [48, 36],
  [52, 46],
  [57, 55],
  [65, 60],
  [71, 68],
  [72, 78],
  [71, 86],
  [73, 92],
  [78, 94, 1],
  [77, 97, 1],
  [60, 97, 1],
  [58, 94, 1],
  [62, 92],
  [64, 86],
  [61, 79],
  [56, 77],
  [48, 82],
  [38, 86],
  [30, 88],
  [25, 88, 1],
  [23, 85, 1],
  [26, 83, 1],
  [24, 80, 1],
  [30, 79],
  [38, 77],
  [46, 72],
  [47, 64],
  [44, 56],
  [40, 51],
  [29, 51],
  [18, 51],
  [13, 52, 1],
  [10, 49, 1],
  [13, 47, 1],
  [11, 44, 1],
  [17, 44],
  [27, 44],
  [36, 42],
  [38, 37],
  [33, 33],
  [24, 31],
  [16, 28],
  [10, 29, 1],
  [7, 26, 1],
  [10, 23, 1],
  [8, 20, 1],
  [13, 19],
  [20, 22],
  [27, 25],
  [28, 22],
  [23, 20],
  [18, 19, 1],
  [21, 16, 1],
  [17, 15, 1],
];

/** Fine lines in the ground colour: where the face meets the mane, and two
 *  locks within the mane. */
const LION_MANE = "M33 3C37 10 36 18 30 24M45 8C47 14 47 20 43 27M52 17C52 23 50 29 46 33";

// Hull City's tiger, prowling left: shoulders high, head carried low and
// forward, back dipping to the hips, tail curving up. Legs taper to rounded
// paws; the near forepaw is lifted mid-stride.
const TIGER: OutlinePoint[] = [
  [6, 52],
  [8, 46],
  [13, 42],
  [16, 37, 1],
  [20, 40],
  [25, 39],
  [28, 35, 1],
  [31, 40],
  [40, 37],
  [52, 40],
  [64, 41],
  [76, 43],
  [84, 48],
  [89, 42],
  [90, 33],
  [94, 28],
  [97, 31],
  [94, 38],
  [94, 48],
  [89, 57],
  [87, 66],
  [89, 78],
  [92, 82],
  [86, 83, 1],
  [82, 80],
  [78, 68],
  [72, 64],
  [70, 76],
  [73, 82],
  [66, 83, 1],
  [63, 79],
  [63, 66],
  [50, 65],
  [40, 66],
  [37, 77],
  [40, 82],
  [32, 83, 1],
  [30, 78],
  [29, 66],
  [25, 70],
  [19, 76],
  [12, 76, 1],
  [13, 72],
  [20, 66],
  [20, 60],
  [14, 59],
  [8, 57],
];

// Tottenham's fighting cock, standing tall and facing left: head high on a
// long neck, chest forward, slender legs with spurs, and long sickle feathers
// arching up and falling behind.
const COCK_BODY: OutlinePoint[] = [
  [31, 24],
  [33, 17],
  [37, 13],
  [42, 14],
  [44, 20],
  [43, 28],
  [46, 36],
  [56, 42],
  [66, 42],
  [72, 48],
  [72, 58],
  [66, 66],
  [56, 70],
  [46, 68],
  [38, 62],
  [33, 52],
  [32, 40],
  [30, 30],
];
/** A sickle feather: a crescent from a base at (bx, by) to a point at (tx, ty),
 *  bowed by `bow` (positive bows up and out) and `w` wide at its widest. */
function sickle(bx: number, by: number, tx: number, ty: number, bow: number, w: number): string {
  const [mx, my] = [(bx + tx) / 2, (by + ty) / 2];
  const len = Math.hypot(tx - bx, ty - by);
  const [nx, ny] = [-(ty - by) / len, (tx - bx) / len];
  const outer: OutlinePoint = [mx + nx * bow, my + ny * bow];
  const inner: OutlinePoint = [mx + nx * (bow - w), my + ny * (bow - w)];
  return outline([[bx, by], outer, [tx, ty, 1], inner]);
}

// Liverpool's sea bird: one flowing outline for the neck, body and tail, and
// one for the raised wing with three flight feathers.
const BIRD_BODY: OutlinePoint[] = [
  [42, 13],
  [48, 14],
  [50, 19],
  [46, 26],
  [43, 33],
  [45, 41],
  [53, 43],
  [61, 50],
  [65, 62],
  [72, 76],
  [83, 91, 1],
  [72, 90],
  [60, 81],
  [50, 81],
  [42, 75],
  [37, 64],
  [36, 52],
  [38, 44],
  [35, 36],
  [34, 28],
  [35, 20],
  [17, 22, 1],
  [16, 24, 1],
  [33, 24],
  [34, 22],
  [37, 16],
];
const BIRD_WING: OutlinePoint[] = [
  [49, 47],
  [53, 34],
  [62, 22],
  [77, 10, 1],
  [75, 19],
  [73, 23],
  [83, 18],
  [91, 18, 1],
  [83, 26],
  [78, 31],
  [87, 32],
  [94, 37, 1],
  [82, 42],
  [70, 47],
  [60, 51],
];

export const SILHOUETTES = {
  /** Aston Villa's lion rampant: one flowing silhouette with a small face set
   *  in a large, simple mane, rounded paws with short claws, and a tail
   *  rising in an S to a flame-shaped tuft. Reads as a lion at 16 px. */
  "lion-rampant": ({ main, accent, ground }) =>
    line("M70 70C86 68 90 55 86 45C83 37 85 29 90 25", main, 4.2) +
    path(
      outline([
        [88, 28],
        [86, 20, 1],
        [91, 24],
        [97, 19, 1],
        [94, 27],
        [99, 30, 1],
        [92, 31],
      ]),
      main,
    ) +
    path(outline(LION), main) +
    line(LION_MANE, ground, 1.4) +
    circle(27, 10, 1.6, ground) +
    path("M18 17Q13 18 14 21Q17 19 20 18Z", accent),

  /** The same lion for the small crest. The silhouette is already simple, so
   *  this is the same drawing without the tongue. */
  "lion-rampant-small": ({ main, ground }) =>
    line("M70 70C86 68 90 55 86 45C83 37 85 29 90 25", main, 4.6) +
    path(
      outline([
        [88, 28],
        [86, 20, 1],
        [91, 24],
        [97, 19, 1],
        [94, 27],
        [99, 30, 1],
        [92, 31],
      ]),
      main,
    ) +
    path(outline(LION), main) +
    circle(27, 10, 1.8, ground),

  /** Hull City's tiger, prowling left with its head low and tail lifted:
   *  one natural silhouette, with stripes in the accent colour and an eye
   *  and nose cut in the ground. With the accent the same as the main colour
   *  (the small crest), the silhouette stands alone. */
  tiger: ({ main, accent, ground }) =>
    path(outline(TIGER), main) +
    line(
      "M36 41Q38 47 37 53M45 40Q47 47 45 55M54 41Q56 48 54 56M63 42Q65 49 63 57M72 44Q73 50 71 56M80 47Q80 52 78 56" +
        "M22 43Q23 46 22 49M27 42Q28 45 27 48",
      accent,
      2.6,
    ) +
    circle(14, 47, 1.5, ground) +
    path("M6 50L9 51L7 53Z", ground),

  /** Tottenham's fighting cock, standing tall: long neck, full chest, comb
   *  and wattle in the accent, sickle tail feathers, slender legs with spurs. */
  cockerel: ({ main, accent, ground }) =>
    path(
      sickle(64, 50, 90, 14, -14, 6) +
        sickle(64, 52, 97, 32, -12, 6) +
        sickle(66, 55, 98, 52, -10, 5.5) +
        sickle(66, 58, 93, 70, -6, 5) +
        sickle(64, 52, 82, 22, -8, 5),
      main,
    ) +
    path(outline(COCK_BODY), main) +
    // Wing, set off from the body by a thin ground-coloured line.
    `<path d="${outline([
      [48, 46],
      [60, 46],
      [68, 52],
      [62, 58],
      [52, 58],
      [46, 52],
    ])}" fill="${main}" stroke="${ground}" stroke-width="1.6"/>` +
    // Comb, wattle and beak.
    path(
      outline([
        [34, 15],
        [33, 9, 1],
        [37, 11],
        [38, 5, 1],
        [41, 10],
        [44, 7, 1],
        [44, 14],
      ]),
      accent,
    ) +
    path(
      outline([
        [33, 22],
        [31, 28],
        [34, 30],
        [36, 25],
      ]),
      accent,
    ) +
    path("M33 17L25 20L33 22Z", main) +
    circle(38, 18, 1.6, ground) +
    // Legs: thighs, slender shanks with a spur on each, and toes.
    line("M48 68L46 80L44 94M58 68L58 80L60 94", main, 3.2) +
    line("M44 94L36 96M44 94L49 96M60 94L52 96M60 94L66 96M46 84L50 82M58 84L62 82", main, 2.2),

  /** Liverpool's sea bird: long neck flowing into the body and a tapering
   *  tail, one wing raised in a single sweep with three flight feathers, a
   *  hooked beak holding a sprig, and webbed feet. */
  "sea-bird": ({ main, accent, ground }) =>
    path(outline(BIRD_WING), main) +
    path(outline(BIRD_BODY), main) +
    circle(40, 18, 1.7, ground) +
    line("M48 79L46 93M46 93L40 95M46 93L51 95M56 80L58 93M58 93L52 95M58 93L63 95", main, 2.6) +
    line("M17 24L9 32", accent, 2.2) +
    path(
      outline([
        [12, 28],
        [8, 25, 1],
        [11, 29],
        [6, 31, 1],
        [10, 31],
        [7, 35, 1],
        [11, 33],
      ]),
      accent,
    ),
} satisfies Record<string, Draw>;

// A lion passant (walking left), for the Premier League concept mark: a
// small head in a large mane, the body level, three paws down and the near
// forepaw raised, the tail curving up over the back to a tuft. Drawn whole and
// walking, unlike the competition's crowned lion's head.
export const LION_PASSANT: OutlinePoint[] = [
  [8, 42, 1],
  [11, 37],
  [16, 33],
  [19, 27, 1],
  [23, 31],
  [26, 24],
  [33, 21],
  [40, 23],
  [45, 29],
  [48, 35],
  [72, 35],
  [86, 46],
  [84, 62],
  [86, 72],
  [89, 77],
  [83, 78, 1],
  [80, 74],
  [77, 63],
  [72, 60],
  [71, 71],
  [73, 77],
  [66, 78, 1],
  [64, 73],
  [64, 60],
  [44, 60],
  [43, 71],
  [45, 77],
  [38, 78, 1],
  [36, 73],
  [35, 61],
  [31, 58],
  [24, 61],
  [16, 63],
  [11, 63, 1],
  [11, 59, 1],
  [18, 57],
  [25, 54],
  [22, 54],
  [17, 53],
  [12, 48],
  [8, 44, 1],
];

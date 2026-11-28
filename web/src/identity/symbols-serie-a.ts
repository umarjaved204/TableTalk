// Serie A symbols (28 Nov 2026): original drawings for the Italian clubs'
// heritage, each in its own 100 x 100 box and coloured by role (main,
// accent, ground) like every other symbol. None is traced from, or measured
// off, an official badge; the owner's reference images were used for the
// broad structure of each crest only (clubs/serie-a.ts).
//
// The animals are built back to front from overlapping parts (far limbs,
// body, near limbs, head) with `limb` from symbols-detail.ts, so a crest can
// outline the whole figure with a stroked group if it needs to.
import { outline, type OutlinePoint } from "./outline.ts";
import { limb, toes } from "./symbols-detail.ts";
import type { Ink } from "./symbols.ts";

type Draw = (ink: Ink) => string;

const r1 = (v: number) => String(Math.round(v * 10) / 10);
/** Path data with every number rounded to a whole unit: these drawings are
 *  placed at about half size or less, so a unit here is half a crest unit
 *  at most (as in symbols-detail.ts), for a much smaller file. */
const coarse = (d: string) => d.replace(/-?\d+\.\d+/g, (n) => String(Math.round(Number(n))));
const path = (d: string, fill: string) => `<path d="${coarse(d)}" fill="${fill}"/>`;
const line = (d: string, stroke: string, width: number) =>
  `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
const circle = (cx: number, cy: number, r: number, fill: string) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;
const shape = (points: readonly OutlinePoint[], fill: string, tension = 1) =>
  path(outline(points, tension), fill);
/** The same outline points mirrored left to right in the 100 box. */
const mirror = (points: readonly OutlinePoint[]): OutlinePoint[] =>
  points.map((p) => (p.length === 3 ? [100 - p[0], p[1], 1] : [100 - p[0], p[1]]));

/** A flowing lock of hair or a flame: a tapering stroke along a wavy line,
 *  from (x, y) rightwards over `len` units, waving `amp` up and down. */
function strand(x: number, y: number, len: number, amp: number, w: number, rise: number): string {
  const n = 5;
  const spine: [number, number, number][] = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    spine.push([x + len * t, y - rise * t + amp * Math.sin(t * Math.PI * 2), w * (1 - t * 0.82)]);
  }
  return limb(spine as [[number, number, number], [number, number, number], ...[number, number, number][]]);
}

// --- Atalanta: the huntress Atalanta's head in profile, hair streaming ------

function goddess({ main, ground }: Ink, lite = false): string {
  const face: OutlinePoint[] = [
    [44, 17],
    [37, 22],
    [34, 30],
    [33, 35],
    [30, 39],
    [24, 46, 1],
    [29, 48],
    [28, 51, 1],
    [31, 53],
    [29, 56, 1],
    [31, 58],
    [31, 63],
    [36, 68],
    [42, 69],
    [42, 78],
    [40, 88, 1],
    [62, 88, 1],
    [60, 76],
    [62, 62],
    [60, 44],
    [56, 28],
    [50, 19],
  ];
  // Hair swept back from the brow, then the streaming locks.
  const locks = lite
    ? [strand(40, 20, 54, 3, 11, 6), strand(46, 33, 50, 4, 11, -1), strand(51, 47, 46, 4, 10, -4)]
    : [
        strand(40, 20, 54, 3, 9, 6),
        strand(44, 28, 52, 3.5, 9, 2),
        strand(48, 36, 50, 4, 9, -1),
        strand(50, 44, 48, 4, 8.5, -3),
        strand(52, 52, 44, 3.5, 8, -5),
        strand(54, 60, 38, 3, 7, -7),
      ];
  return (
    shape(face, main) +
    // Each lock is cut from its neighbours by a ground line, so the hair
    // reads as separate flowing strands, not one mass.
    locks
      .map(
        (d) =>
          `<path d="${coarse(d)}" fill="${main}" stroke="${ground}" stroke-width="1.6" paint-order="stroke"/>`,
      )
      .join("") +
    (lite ? "" : path("M33 36Q36 35 38 37Q36 38 33 36Z", ground) + line("M36 31Q39 30 41 32", ground, 1))
  );
}

// --- Frosinone: a lion rampant, facing left, tongue out ---------------------

function lionRampant({ main, accent, ground }: Ink, lite = false): string {
  const tail =
    limb([
      [66, 74, 5],
      [80, 70, 4],
      [88, 56, 3.5],
      [86, 40, 3],
      [80, 30, 2.6],
    ]) +
    outline([
      [80, 32],
      [74, 22],
      [80, 14],
      [86, 20],
      [90, 12],
      [92, 24],
      [84, 32],
    ]);
  const far =
    limb([
      [64, 72, 13],
      [74, 82, 10],
      [70, 94, 7],
    ]) +
    (lite ? "" : toes(68, 95, 175, 2.4)) +
    limb([
      [44, 42, 9],
      [36, 32, 7],
      [30, 22, 6],
    ]) +
    (lite ? "" : toes(30, 21, 250, 2.2));
  const body = limb([
    [38, 38, 22],
    [50, 54, 21],
    [62, 70, 19],
  ]);
  const near =
    limb([
      [58, 70, 16],
      [50, 82, 11],
      [54, 93, 8],
      [44, 96, 7],
    ]) +
    (lite ? "" : toes(42, 96, 180, 2.5)) +
    limb([
      [42, 48, 10],
      [30, 48, 8],
      [18, 42, 7],
    ]) +
    (lite ? "" : toes(17, 41, 200, 2.3));
  // Mane: flame-shaped locks round the back of the head and down the chest.
  let mane = "";
  for (let k = 0; k < 9; k++) {
    const a = ((-120 + k * 28) * Math.PI) / 180;
    const [cx, cy] = [32, 26];
    const [bx, by] = [cx + 9 * Math.cos(a), cy + 9 * Math.sin(a)];
    const [tx, ty] = [cx + 22 * Math.cos(a + 0.45), cy + 22 * Math.sin(a + 0.45)];
    const [sx, sy] = [cx + 9 * Math.cos(a + 0.5), cy + 9 * Math.sin(a + 0.5)];
    mane += `M${r1(bx)} ${r1(by)}Q${r1(cx + 18 * Math.cos(a))} ${r1(cy + 18 * Math.sin(a))} ${r1(tx)} ${r1(ty)}Q${r1(cx + 13 * Math.cos(a + 0.6))} ${r1(cy + 13 * Math.sin(a + 0.6))} ${r1(sx)} ${r1(sy)}Z`;
  }
  const head: OutlinePoint[] = [
    [34, 12],
    [26, 13],
    [20, 17],
    [14, 21, 1],
    [15, 25],
    [21, 26, 1],
    [15, 29, 1],
    [18, 34],
    [26, 36],
    [34, 35],
    [40, 28],
    [40, 18],
  ];
  return (
    path(tail, main) +
    path(far, main) +
    path(body, main) +
    `<path d="${coarse(mane)}" fill="${main}" stroke="${ground}" stroke-width="1.2" paint-order="stroke"/>` +
    path(near, main) +
    shape(head, main) +
    path("M15 26L22 26L18 31C14 32 11 30 15 26Z", accent) +
    circle(26, 19, 1.5, ground) +
    (lite ? "" : line("M22 16L29 15", ground, 1) + line("M48 52Q52 60 50 66M60 64Q66 70 64 76", ground, 1.2))
  );
}

// --- Genoa: the griffin, rampant, facing left ------------------------------

function griffin({ main, accent, ground }: Ink, lite = false): string {
  const wing: OutlinePoint[] = [
    [46, 40],
    [52, 22],
    [62, 9],
    [76, 3],
    [94, 4, 1],
    [88, 10],
    [97, 13, 1],
    [88, 18],
    [95, 23, 1],
    [85, 27],
    [91, 33, 1],
    [80, 35],
    [85, 42, 1],
    [72, 43],
    [62, 50],
  ];
  const tail = limb([
    [64, 76, 5],
    [80, 78, 4],
    [90, 68, 3.5],
    [92, 56, 3],
  ]);
  const tuft = outline([
    [92, 58],
    [88, 48],
    [94, 42],
    [97, 52],
    [100, 46],
    [99, 58],
  ]);
  const farLeg =
    limb([
      [64, 74, 12],
      [74, 84, 9],
      [70, 95, 7],
    ]) + (lite ? "" : toes(68, 96, 175, 2.4));
  const farTalon = limb([
    [42, 44, 7],
    [32, 36, 5.5],
    [26, 28, 5],
  ]);
  const body = limb([
    [36, 34, 18],
    [48, 52, 20],
    [62, 70, 18],
  ]);
  const nearLeg =
    limb([
      [58, 70, 15],
      [50, 82, 10],
      [54, 93, 7.5],
      [44, 96, 6.5],
    ]) + (lite ? "" : toes(42, 96, 180, 2.4));
  const nearTalon = limb([
    [40, 48, 8],
    [28, 50, 6],
    [18, 46, 5],
  ]);
  const head: OutlinePoint[] = [
    [36, 10],
    [30, 10],
    [24, 13],
    [18, 15, 1],
    [11, 20, 1],
    [15, 21],
    [20, 24, 1],
    [22, 27],
    [28, 30],
    [36, 34],
    [42, 26],
    [42, 16],
    [44, 8, 1],
    [40, 11],
  ];
  // Talons: three hooked claws at the end of each foreleg.
  const claws = (x: number, y: number, deg: number) => {
    let d = "";
    for (const off of [-35, 0, 35]) {
      const a = ((deg + off) * Math.PI) / 180;
      const [ex, ey] = [x + 7 * Math.cos(a), y + 7 * Math.sin(a)];
      const [hx, hy] = [ex + 2.5 * Math.cos(a + 1.6), ey + 2.5 * Math.sin(a + 1.6)];
      d += `M${r1(x)} ${r1(y)}L${r1(ex)} ${r1(ey)}L${r1(hx)} ${r1(hy)}`;
    }
    return line(d, main, 2);
  };
  return (
    path(tail, main) +
    path(tuft, main) +
    shape(wing, main) +
    (lite ? "" : line("M58 26Q70 20 86 12M60 32Q72 28 88 20M62 38Q74 36 84 30", ground, 1.3)) +
    path(farLeg + farTalon, main) +
    (lite ? "" : claws(25, 27, 235)) +
    path(body, main) +
    path(nearLeg + nearTalon, main) +
    (lite ? "" : claws(17, 45, 195)) +
    shape(head, main) +
    path("M11 20L18 16L16 21Z", accent) +
    circle(28, 17, 1.6, ground) +
    (lite ? "" : line("M36 30Q42 40 40 50M56 64Q62 70 62 78", ground, 1.2))
  );
}

// --- Lecce: the holm oak with the wolf passing beneath it -------------------

function wolfPassant(x: number, y: number, s: number, fill: string, ground: string): string {
  // A wolf walking left, in a 60 x 30 box placed at (x, y), scaled by s.
  const body = outline([
    [12, 8],
    [8, 4],
    [2, 6, 1],
    [6, 9],
    [8, 13],
    [14, 16],
    [22, 14],
    [40, 13],
    [50, 14],
    [58, 20, 1],
    [53, 18],
    [50, 20],
    [48, 28, 1],
    [45, 28],
    [44, 20],
    [36, 21],
    [34, 29, 1],
    [31, 29],
    [30, 21],
    [22, 21],
    [20, 29, 1],
    [17, 29],
    [16, 21],
    [13, 18],
    [12, 28, 1],
    [9, 28],
    [10, 17],
    [9, 13],
    [14, 6],
    [15, 1, 1],
  ]);
  return (
    `<g transform="translate(${x} ${y}) scale(${s})">` +
    path(body, fill) +
    circle(8.5, 7.5, 0.9, ground) +
    `</g>`
  );
}

function oakWolf({ main, ground }: Ink, lite = false): string {
  // Canopy: rounded clumps of leaves, cut apart by thin ground lines.
  const clumps: [number, number, number][] = [
    [50, 15, 11],
    [34, 20, 10],
    [66, 20, 10],
    [22, 32, 9],
    [78, 32, 9],
    [40, 32, 11],
    [60, 32, 11],
    [30, 44, 9],
    [70, 44, 9],
    [50, 42, 10],
  ];
  const canopy = lite
    ? path(
        clumps
          .map(([x, y, r]) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`)
          .join(""),
        main,
      )
    : clumps
        .map(
          ([x, y, r]) =>
            `<circle cx="${x}" cy="${y}" r="${r}" fill="${main}" stroke="${ground}" stroke-width="1.2"/>`,
        )
        .join("");
  const leaves = lite
    ? ""
    : clumps
        .map(([x, y, r]) =>
          line(`M${x - r * 0.4} ${y + r * 0.1}q${r * 0.4} -${r * 0.5} ${r * 0.8} 0`, ground, 0.9),
        )
        .join("");
  const trunk = outline(
    [
      [45, 46],
      [46, 60],
      [45, 72],
      [40, 82],
      [30, 88, 1],
      [44, 86],
      [50, 84],
      [56, 86],
      [70, 88, 1],
      [60, 82],
      [55, 72],
      [54, 60],
      [55, 46],
    ],
    0.8,
  );
  const branches = line("M48 50L38 40M52 52L64 40M50 48L50 36", main, 3.5);
  return (
    path(trunk, main) +
    branches +
    canopy +
    leaves +
    (lite ? "" : line("M30 92L70 92", main, 2)) +
    wolfPassant(20, 62, 1, main, ground)
  );
}

// --- Roma: the she-wolf with the twins --------------------------------------

function sheWolf({ main, ground }: Ink): string {
  const farLegs =
    limb([
      [30, 58, 8],
      [28, 76, 6],
      [26, 94, 5],
    ]) +
    limb([
      [74, 58, 10],
      [80, 76, 6.5],
      [78, 94, 5],
    ]);
  const body = outline([
    [26, 36],
    [40, 40],
    [60, 40],
    [80, 38],
    [86, 46],
    [84, 58],
    [72, 64],
    [56, 62],
    [40, 64],
    [28, 62],
    [22, 52],
  ]);
  const tail = limb([
    [84, 44, 6],
    [92, 54, 5],
    [94, 70, 4],
    [92, 82, 3],
  ]);
  const nearLegs =
    limb([
      [36, 58, 9],
      [36, 76, 6.5],
      [34, 94, 5.5],
    ]) +
    limb([
      [68, 58, 11],
      [70, 76, 7],
      [66, 94, 5.5],
    ]);
  // Head turned towards the viewer's left, muzzle down, ears pricked.
  const head = outline([
    [30, 24],
    [24, 18],
    [20, 10, 1],
    [18, 20],
    [12, 24],
    [6, 32],
    [2, 38, 1],
    [8, 40],
    [14, 38],
    [20, 40],
    [28, 42],
    [32, 34],
  ]);
  const twin = (x: number, flip: boolean) => {
    const f = flip ? -1 : 1;
    return (
      circle(x, 72, 4, main) +
      path(
        `M${x - 3 * f} 76Q${x + 2 * f} 74 ${x + 5 * f} 78L${x + 7 * f} 88L${x + 10 * f} 94L${x - 4 * f} 94L${x - 4 * f} 84Z`,
        main,
      )
    );
  };
  return (
    path(farLegs, main) +
    path(tail, main) +
    path(body, main) +
    path(nearLegs, main) +
    path(head, main) +
    path("M22 12L26 20L21 20Z", ground) +
    circle(13, 30, 1.3, ground) +
    // The shaggy mane of the bronze, in rows of curls down the neck.
    line("M26 28Q30 30 28 34M30 30Q34 32 32 36M24 34Q28 36 26 40M28 36Q32 38 30 42", ground, 1.1) +
    line("M42 62Q46 66 50 62Q54 66 58 62", ground, 1.2) +
    twin(46, false) +
    twin(58, true)
  );
}

// --- Lazio: the eagle, wings raised -----------------------------------------

function eagleRaised({ main, accent, ground }: Ink, lite = false): string {
  // Wings displayed and raised: primaries fanning up and out, secondaries
  // lower down, all ending in separate feather points.
  const wing: OutlinePoint[] = [
    [44, 42],
    [38, 30],
    [30, 18],
    [22, 6],
    [14, 2, 1],
    [16, 10],
    [6, 8, 1],
    [12, 16],
    [2, 18, 1],
    [10, 24],
    [2, 30, 1],
    [12, 33],
    [6, 41, 1],
    [17, 41],
    [14, 50, 1],
    [25, 48],
    [26, 56, 1],
    [36, 52],
    [44, 56],
  ];
  const body = outline([
    [50, 30],
    [57, 36],
    [60, 50],
    [57, 66],
    [50, 72],
    [43, 66],
    [40, 50],
    [43, 36],
  ]);
  const tail = outline([
    [44, 66],
    [38, 86, 1],
    [45, 80],
    [50, 92, 1],
    [55, 80],
    [62, 86, 1],
    [56, 66],
  ]);
  const head = outline([
    [53, 18],
    [46, 16],
    [40, 19],
    [35, 23, 1],
    [38, 25],
    [36, 29, 1],
    [42, 28],
    [46, 32],
    [54, 34],
    [57, 26],
  ]);
  return (
    shape(wing, main) +
    shape(mirror(wing), main) +
    (lite
      ? ""
      : line("M40 34Q28 22 18 10M38 40Q24 32 10 26M38 46Q26 42 16 44", ground, 1.3) +
        line("M60 34Q72 22 82 10M62 40Q76 32 90 26M62 46Q74 42 84 44", ground, 1.3)) +
    path(tail, main) +
    path(body, main) +
    path(head, main) +
    path("M35 23L40 22L38 26Z", accent) +
    circle(46, 22, 1.4, ground) +
    line("M45 68L40 78M55 68L60 78", main, 4) +
    (lite
      ? ""
      : line("M40 78L34 80M40 78L36 84M60 78L66 80M60 78L64 84", accent, 1.8) +
        line("M45 44Q50 48 55 44M45 52Q50 56 55 52M46 60Q50 63 54 60", ground, 1.1))
  );
}

// --- Torino: the bull, rampant, facing left ---------------------------------

function bullRampant({ main, ground }: Ink): string {
  const far =
    limb([
      [64, 74, 13],
      [74, 84, 10],
      [72, 94, 7],
    ]) +
    limb([
      [44, 48, 10],
      [34, 44, 8],
      [26, 36, 7],
    ]);
  const body = outline([
    [34, 30],
    [48, 30],
    [60, 44],
    [70, 62],
    [70, 76],
    [60, 80],
    [50, 72],
    [40, 58],
    [32, 44],
  ]);
  const near =
    limb([
      [58, 72, 16],
      [50, 84, 11],
      [56, 94, 8],
    ]) +
    limb([
      [40, 54, 11],
      [28, 60, 8.5],
      [20, 56, 7.5],
    ]);
  const tail =
    limb([
      [68, 74, 4],
      [82, 70, 3.5],
      [88, 56, 3],
      [86, 42, 2.6],
    ]) +
    outline([
      [86, 44],
      [82, 34],
      [88, 28],
      [92, 36],
      [90, 44],
    ]);
  // A long head, muzzle low and forward, a heavy dewlap under the jaw.
  const head: OutlinePoint[] = [
    [38, 14],
    [30, 15],
    [22, 22],
    [15, 32],
    [12, 38, 1],
    [16, 42],
    [22, 41],
    [28, 40],
    [34, 42],
    [40, 38],
    [44, 28],
    [44, 20],
  ];
  // Horns: crescents sweeping out and up from the poll.
  const horns =
    outline([
      [30, 17],
      [22, 14],
      [16, 6],
      [18, 2, 1],
      [22, 9],
      [32, 12],
    ]) +
    outline([
      [38, 13],
      [44, 9],
      [48, 2, 1],
      [50, 8],
      [44, 15],
    ]);
  const hooves =
    "M68 94L76 93L76 98L68 98ZM52 94L60 93L60 98L52 98ZM14 54L20 52L22 58L16 60ZM20 34L25 31L28 36L23 39Z";
  return (
    path(tail, main) +
    path(far, main) +
    path(body, main) +
    path(near, main) +
    shape(head, main) +
    path(horns, main) +
    path(hooves, ground) +
    circle(28, 25, 1.6, ground) +
    circle(16, 37, 1.1, ground) +
    path("M36 16L42 16L39 21Z", ground) +
    line("M36 34Q42 42 42 52M50 58Q56 66 56 74", ground, 1.2)
  );
}

// --- Cagliari: a Moor's head in profile, with the white headband ------------

function moorHeadV1({ main, accent }: Ink, lite = false): string {
  const simple: OutlinePoint[] = [
    [40, 14],
    [30, 28],
    [20, 50, 1],
    [28, 56],
    [30, 66],
    [42, 76],
    [42, 92, 1],
    [72, 92, 1],
    [82, 56],
    [74, 24],
  ];
  const head: OutlinePoint[] = [
    [40, 14],
    [32, 22],
    [30, 32],
    [26, 40],
    [20, 50, 1],
    [27, 52],
    [26, 57, 1],
    [30, 59],
    [28, 63, 1],
    [32, 66],
    [32, 72],
    [40, 76],
    [44, 78],
    [42, 92, 1],
    [72, 92, 1],
    [70, 80],
    [78, 66],
    [84, 50],
    [82, 30],
    [70, 16],
    [56, 10],
  ];
  return (
    shape(lite ? simple : head, main) +
    // Headband round the brow, knotted at the back with two loose ends.
    path("M28 30Q54 24 82 30L82 40Q54 34 30 40Z", accent) +
    path("M80 32L94 40L90 46L80 40Z", accent) +
    path("M80 38L90 52L84 56L78 42Z", accent)
  );
}

// The refined Moor's head (second round): a fuller profile with a brow,
// the bridge of the nose, lips and chin, curled hair at the back, and the
// headband on the brow, knotted behind with two loose ends.
function moorHead({ main, accent, ground }: Ink, lite = false): string {
  const profile: OutlinePoint[] = lite
    ? [
        [52, 8],
        [34, 18],
        [28, 36],
        [20, 54, 1],
        [27, 60],
        [26, 66],
        [28, 76],
        [42, 80],
        [42, 96, 1],
        [74, 96, 1],
        [86, 56],
        [76, 18],
      ]
    : [
        [52, 8],
        [38, 14],
        [31, 24],
        [29, 34],
        [27.5, 39],
        [29, 42],
        [26, 47],
        [20, 55, 1],
        [24, 57],
        [27, 58],
        [25, 61],
        [28, 63, 1],
        [25.5, 65],
        [28.5, 68],
        [27, 73],
        [32, 78],
        [41, 80],
        [44, 86],
        [42, 96, 1],
        [72, 96, 1],
        [70, 86],
        [76, 76],
        [84, 64],
        [86, 48],
        [82, 28],
        [70, 13],
      ];
  // Tight curls along the back of the head.
  const curls = lite
    ? ""
    : [
        [79, 72],
        [84, 61],
        [86, 49],
        [84, 37],
        [78, 25],
        [68, 15],
      ]
        .map(([x, y]) => `M${(x ?? 0) - 5.5} ${y}a5.5 5.5 0 1 0 11 0a5.5 5.5 0 1 0 -11 0`)
        .join("");
  return (
    shape(profile, main) +
    (curls ? path(curls, main) : "") +
    // The band across the brow, above the eye, following the skull.
    path("M30 24Q56 16 86 27L87 36Q57 26 29 33Z", accent) +
    // The knot behind and its two loose ends.
    circle(88, 31.5, lite ? 5 : 4.2, accent) +
    path("M88 33L99 46L94 49L85 36Z", accent) +
    path("M87 34L93 54L87 55L84 37Z", accent) +
    (lite ? "" : path("M30 41Q33 39.5 35.5 41Q33 42.5 30 41Z", ground))
  );
}

// --- Fiorentina: Florence's giglio, the lily with its stamens ----------------

function giglio({ main }: Ink): string {
  const centre: OutlinePoint[] = [
    [50, 2, 1],
    [56, 12],
    [59, 26],
    [57, 42],
    [53, 58, 1],
    [47, 58, 1],
    [43, 42],
    [41, 26],
    [44, 12],
  ];
  const right: OutlinePoint[] = [
    [54, 58, 1],
    [58, 44],
    [66, 32],
    [78, 26],
    [90, 28],
    [97, 38],
    [94, 50, 1],
    [90, 42],
    [83, 37],
    [74, 38],
    [66, 46],
    [61, 58, 1],
  ];
  const lowerRight: OutlinePoint[] = [
    [54, 66, 1],
    [64, 66],
    [74, 72],
    [78, 82],
    [72, 86, 1],
    [72, 78],
    [64, 74],
    [56, 74, 1],
  ];
  const stamen = (f: 1 | -1) =>
    line(`M${50 + f * 6} 56Q${50 + f * 14} 40 ${50 + f * 16} 22`, main, 3) +
    shape(
      [
        [50 + f * 16, 8, 1],
        [50 + f * 21, 16],
        [50 + f * 16, 24],
        [50 + f * 11, 16],
      ],
      main,
    ) +
    circle(50 + f * 23, 26, 2.6, main) +
    circle(50 + f * 9, 26, 2.6, main);
  return (
    shape(centre, main) +
    shape(right, main) +
    shape(mirror(right), main) +
    stamen(1) +
    stamen(-1) +
    path("M32 58L68 58Q70 61 68 64L32 64Q30 61 32 58Z", main) +
    shape(
      [
        [46, 66],
        [54, 66],
        [52, 78],
        [50, 86, 1],
        [48, 78],
      ],
      main,
    ) +
    shape(lowerRight, main) +
    shape(mirror(lowerRight), main)
  );
}

// --- Monza: the Iron Crown and the sword -----------------------------------

function ironCrown({ main, accent, ground }: Ink): string {
  // A band of hinged plates seen from the front, curving with perspective,
  // each plate set with a four-armed ornament.
  const band = "M6 34Q50 24 94 34L94 74Q50 64 6 74Z";
  const rim = "M6 30Q50 20 94 30L94 37Q50 27 6 37Z";
  const crenels = [14, 26, 38, 50, 62, 74, 86]
    .map((x) => {
      const y = 31 - 6 * (1 - ((x - 50) / 44) ** 2);
      return `M${x - 3} ${r1(y + 1)}L${x - 3} ${r1(y - 6)}L${x + 3} ${r1(y - 6)}L${x + 3} ${r1(y + 1)}Z`;
    })
    .join("");
  const ornament = (x: number, y: number) =>
    circle(x, y - 6, 3, accent) +
    circle(x, y + 6, 3, accent) +
    circle(x - 6, y, 3, accent) +
    circle(x + 6, y, 3, accent) +
    circle(x, y, 2.4, accent);
  return (
    path(band, main) +
    path(rim + crenels, main) +
    line("M30 30L30 70M70 30L70 70", ground, 1.6) +
    ornament(17, 54) +
    ornament(50, 48) +
    ornament(83, 54)
  );
}

function sword({ main, accent, ground }: Ink): string {
  return (
    // Ring pommel, grip, crossguard with ornamented ends, tapering blade.
    `<circle cx="50" cy="9" r="6" fill="none" stroke="${main}" stroke-width="3.2"/>` +
    path("M46.5 15L53.5 15L53 31L47 31Z", main) +
    path("M20 31L80 31Q84 34.5 80 38L20 38Q16 34.5 20 31Z", main) +
    circle(16, 34.5, 4.5, main) +
    circle(84, 34.5, 4.5, main) +
    circle(16, 34.5, 1.8, accent) +
    circle(84, 34.5, 1.8, accent) +
    circle(50, 34.5, 2, ground) +
    path("M43 40L57 40L56 84L50 98L44 84Z", main) +
    line("M50 44L50 84", ground, 1.6)
  );
}

// --- Udinese: a laurel wreath, open at the top -----------------------------

function laurelRing({ main }: Ink): string {
  // Two branches round a circle of radius 42, from the bottom up each side,
  // each leaf a pointed oval growing outwards and up the branch from a node.
  const R = 42;
  const leaf = (bx: number, by: number, deg: number, len: number) => {
    const a = (deg * Math.PI) / 180;
    const [tx, ty] = [bx + Math.cos(a) * len, by + Math.sin(a) * len];
    const [cx, cy] = [(bx + tx) / 2, (by + ty) / 2];
    const [nx, ny] = [-Math.sin(a) * len * 0.3, Math.cos(a) * len * 0.3];
    return `M${r1(bx)} ${r1(by)}Q${r1(cx + nx)} ${r1(cy + ny)} ${r1(tx)} ${r1(ty)}Q${r1(cx - nx)} ${r1(cy - ny)} ${r1(bx)} ${r1(by)}Z`;
  };
  let leaves = "";
  let stems = "";
  for (const side of [-1, 1]) {
    // Angles measured from the bottom of the circle, going up this side.
    const at = (t: number) => {
      const deg = 90 - side * t;
      const a = (deg * Math.PI) / 180;
      return [50 + R * Math.cos(a), 50 + R * Math.sin(a), deg] as const;
    };
    const [x0, y0] = at(12);
    const [x1, y1] = at(150);
    stems += `M${r1(x0)} ${r1(y0)}A${R} ${R} 0 0 ${side === 1 ? 0 : 1} ${r1(x1)} ${r1(y1)}`;
    for (let k = 0; k < 8; k++) {
      const t = 22 + k * 17;
      const [x, y, deg] = at(t);
      // Direction up the branch (the tangent), then turned out or in.
      const up = deg - side * 90;
      leaves += leaf(x, y, up - side * 38, 12 - k * 0.4);
      leaves += leaf(x, y, up + side * 32, 11 - k * 0.4);
    }
    const [ex, ey, edeg] = at(152);
    leaves += leaf(ex, ey, edeg - side * 90, 11);
  }
  return line(stems, main, 1.8) + path(leaves, main);
}

// --- Napoli: Vesuvius over the bay ------------------------------------------

function vesuvius({ main, accent }: Ink): string {
  return (
    // Twin summits (Somma and the cone), a plume, and the bay below.
    path("M4 74L30 44L38 48L48 32L54 32L66 48L96 74Z", main) +
    path("M46 32Q44 22 52 18Q50 10 60 8Q68 6 70 14Q78 14 76 22Q70 26 62 24Q58 30 54 32Z", accent) +
    line(
      "M8 84q5 -4 10 0t10 0t10 0t10 0t10 0t10 0t10 0t10 0t10 0M14 93q5 -4 10 0t10 0t10 0t10 0t10 0t10 0t10 0",
      main,
      3,
    )
  );
}

// --- Venezia: the ferro, the steel prow of a gondola ------------------------

function ferro({ main }: Ink): string {
  // The S-curved blade with six teeth forward (Venice's six sestieri) and
  // one behind, standing on the curve of the prow.
  const blade = outline(
    [
      [34, 6, 1],
      [70, 10],
      [72, 18],
      [62, 24],
      [62, 84],
      [52, 96, 1],
      [46, 86],
      [48, 24],
      [40, 18],
    ],
    0.6,
  );
  const teeth = [30, 38, 46, 54, 62, 70].map((y) => `M48 ${y}L26 ${y + 1}L26 ${y + 5}L48 ${y + 5}Z`).join("");
  return path(blade, main) + path(teeth, main) + path("M62 46L76 44L76 50L62 52Z", main);
}

export const SERIE_A_SYMBOLS = {
  /** Atalanta's huntress in profile, facing left, her hair streaming back. */
  goddess,
  /** A lion rampant facing left, tongue out (Frosinone). */
  "lion-rampant-left": lionRampant,
  /** Genoa's griffin, rampant, facing left, wing raised. */
  griffin,
  /** Lecce's holm oak with the wolf walking beneath it. */
  "oak-wolf": oakWolf,
  /** Rome's she-wolf with the twins (Roma). */
  "she-wolf": sheWolf,
  /** An eagle with its wings raised, head to the left (Lazio). */
  "eagle-raised": eagleRaised,
  /** A bull rampant facing left (Torino). */
  "bull-rampant": bullRampant,
  /** A Moor's head in profile with a white headband (Sardinia's arms, Cagliari). */
  "moor-head": moorHead,
  /** Florence's lily with its stamens (Fiorentina). */
  giglio,
  /** The Iron Crown of Lombardy, kept in Monza's cathedral. */
  "iron-crown": ironCrown,
  /** A sword with a ring pommel and an ornamented guard (Monza). */
  sword,
  /** A laurel wreath, open at the top (Udinese). */
  "laurel-ring": laurelRing,
  /** Vesuvius over the bay of Naples. */
  vesuvius,
  /** Lighter versions for small crests: the same figures without the fine
   *  detail (toes, claws, contour lines, leaf veins) that vanishes at 16 to
   *  24 px, so the small files stay within their budget. */
  "goddess-lite": (ink: Ink) => goddess(ink, true),
  "lion-rampant-left-lite": (ink: Ink) => lionRampant(ink, true),
  "griffin-lite": (ink: Ink) => griffin(ink, true),
  "oak-wolf-lite": (ink: Ink) => oakWolf(ink, true),
  "eagle-raised-lite": (ink: Ink) => eagleRaised(ink, true),
  "moor-head-lite": (ink: Ink) => moorHead(ink, true),
  /** The first-gallery Moor's head, kept for Cagliari's earlier design. */
  "moor-head-v1": (ink: Ink) => moorHeadV1(ink),
  "moor-head-v1-lite": (ink: Ink) => moorHeadV1(ink, true),
  /** The steel prow of a gondola, its six teeth Venice's six districts. */
  ferro,
} satisfies Record<string, Draw>;

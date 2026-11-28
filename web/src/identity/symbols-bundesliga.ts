// Symbols for the Bundesliga crests (28 Nov 2026): original drawings of each
// club's heritage (city arms, mascots, regional emblems), drawn like the rest
// of the collection: a 100 x 100 box, coloured by role (main, accent,
// ground), organic shapes as smooth outlines (outline.ts). None is traced
// from, or measured off, an official badge.
import { outline, type OutlinePoint } from "./outline.ts";
import type { Ink } from "./symbols.ts";

type Draw = (ink: Ink) => string;

const r1 = (v: number) => String(Math.round(v * 10) / 10);
const path = (d: string, fill: string) => `<path d="${d}" fill="${fill}"/>`;
const line = (d: string, stroke: string, width: number, cap = "round") =>
  `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="${cap}" stroke-linejoin="round"/>`;
const circle = (cx: number, cy: number, r: number, fill: string) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;
const mirror = (pts: readonly OutlinePoint[]): OutlinePoint[] =>
  pts.map((p) => (p.length === 3 ? ([100 - p[0], p[1], 1] as const) : ([100 - p[0], p[1]] as const)));

/** One wing of a displayed eagle (viewer's right): from the shoulder up to a
 *  high tip, then four long primary feathers stepping down to the body. */
const WING: OutlinePoint[] = [
  [56, 36],
  [64, 22],
  [78, 10],
  [97, 8, 1],
  [92, 18],
  [98, 24, 1],
  [89, 30],
  [95, 37, 1],
  [85, 41],
  [90, 49, 1],
  [79, 50],
  [82, 58, 1],
  [70, 56],
  [58, 54],
];

/** The tail of the eagle: a fan of three feathers. */
const TAIL: OutlinePoint[] = [
  [42, 64],
  [35, 85, 1],
  [44, 80],
  [50, 92, 1],
  [56, 80],
  [65, 85, 1],
  [58, 64],
];

/** A raptor's head in profile, facing left: hooked beak, flat crown and
 *  long neck feathers flaring back and down. */
const RAPTOR: OutlinePoint[] = [
  [6, 42, 1],
  [12, 30],
  [26, 20],
  [44, 15],
  [62, 18],
  [72, 26],
  [88, 22, 1],
  [80, 34],
  [96, 40, 1],
  [80, 46],
  [92, 58, 1],
  [75, 57],
  [82, 74, 1],
  [66, 66],
  [66, 86, 1],
  [55, 70],
  [46, 90, 1],
  [43, 68],
  [36, 56],
  [26, 50],
  [17, 48],
  [12, 44],
];

/** A billy goat standing left, Cologne's mascot: a long head with a beard,
 *  a deep chest, a level back, a short tail flicked up, and slender legs
 *  with the hind leg's hock angled back. The far legs are drawn separately. */
const GOAT: OutlinePoint[] = [
  [8, 30, 1],
  [11, 23],
  [17, 17],
  [24, 15],
  [29, 19],
  [34, 27],
  [42, 33],
  [58, 34],
  [74, 32],
  [82, 33],
  [86, 26, 1],
  [88, 33],
  [89, 42],
  [86, 52],
  [84, 62],
  [85, 80],
  [87, 86, 1],
  [80, 86, 1],
  [79, 66],
  [76, 56],
  [66, 55],
  [48, 55],
  [42, 58],
  [41, 80],
  [42, 86, 1],
  [35, 86, 1],
  [34, 64],
  [31, 52],
  [27, 44],
  [23, 39],
  [21, 48, 1],
  [17, 38],
  [12, 34],
];
const GOAT_FAR_LEGS = "M47 55L52 56L51 84L52 86L46 86L47 82ZM70 55L75 57L74 84L75 86L69 86L70 82Z";

/** A bear on its hind legs, facing left, forepaws raised: Berlin's bear. */
const BEAR: OutlinePoint[] = [
  [12, 22, 1],
  [18, 14],
  [25, 11],
  [27, 4, 1],
  [33, 9],
  [42, 15],
  [52, 26],
  [60, 40],
  [64, 54],
  [63, 64],
  [72, 64, 1],
  [65, 70],
  [63, 80],
  [68, 92],
  [71, 96, 1],
  [55, 96, 1],
  [54, 84],
  [49, 75],
  [43, 77],
  [41, 89],
  [43, 96, 1],
  [29, 96, 1],
  [32, 84],
  [32, 68],
  [31, 58],
  [12, 60],
  [4, 62, 1],
  [6, 54],
  [12, 52],
  [30, 48],
  [30, 40],
  [12, 38],
  [3, 36, 1],
  [7, 30],
  [12, 30],
  [26, 30],
  [19, 26],
];

/** A foal's head and neck, facing left, ears pricked. */
const FOAL: OutlinePoint[] = [
  [38, 4, 1],
  [44, 13],
  [50, 5, 1],
  [52, 16],
  [62, 24],
  [74, 42],
  [84, 66],
  [90, 96, 1],
  [54, 96, 1],
  [50, 76],
  [44, 64],
  [36, 60],
  [26, 66],
  [14, 66],
  [8, 60, 1],
  [12, 50],
  [22, 34],
  [32, 20],
];

/** A hare bounding left: a rounded head with two long ears raised up and
 *  back, an arched back, a round scut, a big folded hind leg and a short
 *  foreleg reaching forward. Compact, so it reads as a hare when small. */
const HARE: OutlinePoint[] = [
  [6, 50, 1],
  [9, 42],
  [17, 36],
  [22, 26],
  [28, 6, 1],
  [31, 26],
  [36, 12, 1],
  [36, 32],
  [50, 30],
  [68, 32],
  [82, 40],
  [88, 46],
  [96, 44, 1],
  [94, 54],
  [88, 58],
  [90, 70],
  [98, 76, 1],
  [76, 76, 1],
  [68, 66],
  [54, 64],
  [44, 66],
  [26, 72, 1],
  [30, 64],
  [26, 58],
  [16, 56],
];

/** A tall cathedral front with twin spires: two towers, each a stack of
 *  narrowing stages with a spire and finial, and the gabled nave between. */
function cathedral(main: string, ground: string): string {
  const tower = (x: number) =>
    `M${x} 92L${x} 40L${x + 2} 36L${x + 2} 26L${x + 5} 18L${x + 7} 4L${x + 9} 18L${x + 12} 26L${x + 12} 36L${x + 14} 40L${x + 14} 92Z`;
  const windows = (x: number) =>
    `M${x + 4} 86L${x + 4} 60Q${x + 7} 54 ${x + 10} 60L${x + 10} 86Z` +
    `M${x + 5} 48Q${x + 7} 43 ${x + 9} 48L${x + 9} 54L${x + 5} 54Z`;
  return (
    path(`${tower(24)}${tower(62)}M38 92L38 58L50 44L62 58L62 92ZM16 92L84 92L84 97L16 97Z`, main) +
    path(`${windows(24)}${windows(62)}M45 92L45 72Q50 64 55 72L55 92Z`, ground)
  );
}

/** A Württemberg stag's antler, lying across as in the arms: a beam that
 *  tapers from a knobbed burr on the left to a point curving up on the
 *  right, with four tines rising from its upper edge, each tapering to a
 *  point and leaning forward. Filled shapes, not strokes. */
function antler(main: string): string {
  const tine = (x: number, y: number, h: number, w: number, lean: number) =>
    `M${r1(x - w / 2)} ${r1(y + 2)}Q${r1(x - w / 2 + lean * 0.2)} ${r1(y - h * 0.6)} ${r1(x + lean)} ${r1(y - h)}` +
    `Q${r1(x + w / 2 + lean * 0.1)} ${r1(y - h * 0.45)} ${r1(x + w / 2)} ${r1(y + 2)}Z`;
  return (
    path(
      "M8 58Q48 68 88 40Q94 35 97 27Q101 40 92 47Q50 79 8 70Z" +
        tine(24, 61, 22, 8, 10) +
        tine(42, 61, 26, 7.5, 12) +
        tine(60, 56, 25, 7, 12) +
        tine(76, 48, 19, 6, 9),
      main,
    ) + `<ellipse cx="8" cy="64" rx="6" ry="9" fill="${main}"/>`
  );
}

/** Augsburg's pine cone (Zirbelnuss) on its column capital: a scaled cone
 *  over a gold capital with volutes. */
function pineCone(main: string, accent: string, ground: string): string {
  const cone = "M50 4C66 12 73 32 71 50C69 60 60 64 50 64C40 64 31 60 29 50C27 32 34 12 50 4Z";
  // Scales: a lattice of small diamonds wherever they fall well inside the cone.
  let scales = "";
  // No lattice when it would vanish into the cone (the small crests).
  for (let y = ground === main ? 99 : 14; y <= 58; y += 7) {
    const half = y < 34 ? 6 + (y - 14) * 0.55 : 17 - Math.max(0, y - 46) * 0.6;
    for (let x = 50 - 24; x <= 50 + 24; x += 9) {
      const cx = x + (((y - 14) / 7) % 2 ? 4.5 : 0);
      if (Math.abs(cx - 50) + 3 > half) continue;
      scales += `M${r1(cx)} ${r1(y - 3.6)}L${r1(cx + 4.5)} ${y}L${r1(cx)} ${r1(y + 3.6)}L${r1(cx - 4.5)} ${y}Z`;
    }
  }
  return (
    path(cone, main) +
    `<path d="${scales}" fill="none" stroke="${ground}" stroke-width="1.6" stroke-linejoin="round"/>` +
    path(
      "M45 63L55 63L55 70L45 70ZM28 70L72 70L66 82L34 82ZM36 82L64 82L60 96L40 96ZM32 96L68 96L68 99L32 99Z",
      accent,
    ) +
    circle(28, 75, 5, accent) +
    circle(72, 75, 5, accent) +
    circle(28, 75, 2, ground) +
    circle(72, 75, 2, ground)
  );
}

/** A six-spoked wheel: Mainz's city arms carry two. */
function wheel(main: string): string {
  let spokes = "";
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3 + Math.PI / 6;
    spokes += `M${r1(50 + 9 * Math.cos(a))} ${r1(50 + 9 * Math.sin(a))}L${r1(50 + 38 * Math.cos(a))} ${r1(50 + 38 * Math.sin(a))}`;
  }
  return (
    `<circle cx="50" cy="50" r="40" fill="none" stroke="${main}" stroke-width="10"/>` +
    line(spokes, main, 8, "butt") +
    circle(50, 50, 11, main)
  );
}

/** Mining's hammer and pick, crossed: Schlägel und Eisen. */
function hammers(main: string): string {
  const tool = (rot: number, head: string) =>
    `<g transform="rotate(${rot} 50 50)">${path(`M47 20L53 20L53 94L47 94Z${head}`, main)}</g>`;
  return (
    tool(-45, "M36 10L64 10L64 24L36 24Z") + tool(45, "M22 20C34 12 66 12 78 20L72 24C62 20 38 20 28 24Z")
  );
}

/** Bremen's key, upright: a ring bow, a shaft and a notched bit. */
function key(main: string, ground: string): string {
  return (
    circle(50, 20, 15, main) +
    circle(50, 20, 7, ground) +
    path("M45 32L55 32L55 94L45 94Z", main) +
    path("M55 66L74 66L74 74L67 74L67 80L74 80L74 90L55 90Z", main)
  );
}

/** A fir tree of the Black Forest: three stacked tiers and a trunk. */
function fir(main: string): string {
  return path(
    "M50 4L66 30L58 30L74 54L62 54L82 82L54 82L54 96L46 96L46 82L18 82L38 54L26 54L42 30L34 30Z",
    main,
  );
}

/** A heraldic lion rampant facing left: a maned head with an open mouth,
 *  locks of mane down the neck, both forepaws raised with the claws spread,
 *  one hind leg planted and the other stepping forward. */
const LION_HERALDIC: OutlinePoint[] = [
  [13, 22, 1],
  [16, 15],
  [22, 10],
  [25, 3, 1],
  [31, 6],
  [41, 4],
  [50, 9],
  [54, 17],
  [52, 24],
  [57, 30],
  [53, 37],
  [55, 45],
  [58, 54],
  [63, 60],
  [66, 70],
  [64, 80],
  [69, 90],
  [78, 95, 1],
  [60, 95, 1],
  [58, 86],
  [54, 77],
  [50, 73],
  [45, 77],
  [36, 84],
  [27, 84, 1],
  [29, 78],
  [40, 70],
  [44, 60],
  [38, 50],
  [27, 54],
  [13, 59, 1],
  [12, 54, 1],
  [25, 47],
  [32, 41],
  [24, 38],
  [9, 39, 1],
  [8, 34, 1],
  [24, 31],
  [24, 23],
  [17, 24, 1],
  [15, 23],
];

/** One wing of a heraldic eagle (viewer's right): a smooth upper edge
 *  rising from the shoulder, then six primaries with rounded tips and sharp
 *  notches between them, stepping back to the body. */
const EAGLE_WING: OutlinePoint[] = [
  [57, 36],
  [62, 26],
  [71, 17],
  [83, 11],
  [95, 9],
  [90, 18, 1],
  [98, 22],
  [90, 29, 1],
  [97, 35],
  [88, 40, 1],
  [93, 47],
  [83, 49, 1],
  [85, 57],
  [74, 55, 1],
  [73, 62],
  [58, 54],
];
const EAGLE_TAIL: OutlinePoint[] = [
  [43, 63],
  [37, 82],
  [45, 80, 1],
  [50, 91],
  [55, 80, 1],
  [63, 82],
  [57, 63],
];
const EAGLE_HEAD: OutlinePoint[] = [
  [57, 42],
  [58, 28],
  [54, 20],
  [46, 16],
  [38, 19],
  [42, 28],
  [44, 38],
];

export const BUNDESLIGA_SYMBOLS = {
  /** A displayed eagle, head turned left: wings raised with long primaries,
   *  a fanned tail and talons out (Frankfurt's eagle). */
  eagle: ({ main, accent, ground }) =>
    path(`${outline(WING)}${outline(mirror(WING))}`, main) +
    path(outline(TAIL), main) +
    `<ellipse cx="50" cy="52" rx="12" ry="17" fill="${main}"/>` +
    path("M40 24C44 14 58 14 60 26C61 34 57 40 54 44L44 44C46 38 44 32 40 30Z", main) +
    path("M41 21L27 25L33 28L29 33L42 31Z", accent) +
    circle(47, 24, 2.2, ground) +
    line("M44 62L36 72M56 62L64 72", main, 5) +
    line("M36 72L30 72M36 72L32 78M64 72L70 72M64 72L68 78", accent, 2.6),
  /** A raptor's head in profile, facing left, neck feathers flared. */
  "raptor-head": ({ main, ground }) =>
    path(outline(RAPTOR), main) +
    circle(34, 30, 4, ground) +
    circle(34, 30, 1.6, main) +
    line("M26 26L44 23", ground, 2.2) +
    line("M10 42L26 39", ground, 2.2),
  /** Cologne's cathedral front: twin spires and the nave. */
  cathedral: ({ main, ground }) => cathedral(main, ground),
  /** A goat with swept horns and a beard, standing left. */
  goat: ({ main, accent, ground }) =>
    path(GOAT_FAR_LEGS, main) +
    path(outline(GOAT), main) +
    line("M23 16C23 6 33 0 42 6C35 5 30 10 30 18", accent, 4) +
    path("M29 20L39 22L31 26Z", main) +
    circle(17, 22, 1.7, ground),
  /** One antler, lying across. */
  antler: ({ main }) => antler(main),
  /** A pine cone on a column capital. */
  "pine-cone": ({ main, accent, ground }) => pineCone(main, accent, ground),
  /** Berlin's bear, upright, tongue out. */
  "berlin-bear": ({ main, accent, ground }) =>
    path(outline(BEAR), main) + path("M12 25L6 27L9 30L14 28Z", accent) + circle(22, 17, 1.8, ground),
  /** A six-spoked wheel. */
  wheel: ({ main }) => wheel(main),
  /** Hammer and pick, crossed. */
  hammers: ({ main }) => hammers(main),
  /** Bremen's key. */
  key: ({ main, ground }) => key(main, ground),
  /** A foal's head and neck, with a mane. */
  foal: ({ main, accent, ground }) =>
    path(outline(FOAL), main) +
    line("M54 16C64 24 72 36 78 50C84 64 88 78 90 92", accent, 3) +
    circle(34, 28, 2.6, ground) +
    circle(13, 58, 1.8, ground) +
    line("M30 60C26 56 24 54 22 50", ground, 1.6),
  /** A hare running left. */
  hare: ({ main, ground }) => path(outline(HARE), main) + circle(14, 44, 1.8, ground),
  /** Three hares chasing each other round, after Paderborn Cathedral's
   *  window. All three stay upright (turned upside down, a hare reads as a
   *  bird when small): the top one runs left, the lower left one runs right,
   *  the lower right one runs left, round a triangle. */
  "three-hares": ({ main, ground }) =>
    (
      [
        [50, 26, false],
        [27, 70, true],
        [73, 70, false],
      ] as const
    )
      .map(
        ([x, y, flip]) =>
          `<g transform="translate(${x} ${y}) scale(${flip ? "-0.5 0.5" : "0.5"}) translate(-50 -50)">${path(outline(HARE), main)}${circle(14, 44, 3, ground)}</g>`,
      )
      .join(""),
  /** A heraldic lion rampant, facing left, tongue out, tail curled up. */
  "lion-heraldic": ({ main, accent, ground }) =>
    path(outline(LION_HERALDIC), main) +
    line("M62 62C78 66 86 54 82 42C80 34 84 28 90 26", main, 4) +
    path("M84 26C84 16 94 12 99 18C94 19 93 24 95 30C91 26 87 25 84 26Z", main) +
    path("M16 23L9 25L14 27Z", accent) +
    circle(21, 14, 1.6, ground),
  /** A heraldic eagle displayed, head turned left: rounded primaries,
   *  a three-feather tail, hooked beak and talons in the accent colour. */
  "eagle-heraldic": ({ main, accent, ground }) =>
    path(
      `${outline(EAGLE_WING)}${outline(mirror(EAGLE_WING))}${outline(EAGLE_TAIL)}${outline(EAGLE_HEAD)}`,
      main,
    ) +
    `<ellipse cx="50" cy="50" rx="11" ry="16" fill="${main}"/>` +
    path("M40 19L29 24L33 29L41 27Z", accent) +
    circle(46, 23, 2, ground) +
    line("M44 61L37 71M56 61L63 71", main, 5.5) +
    line("M37 71L30 70M37 71L32 77M37 71L38 78M63 71L70 70M63 71L68 77M63 71L62 78", accent, 2.4),
  /** A fir tree. */
  fir: ({ main }) => fir(main),
} satisfies Record<string, Draw>;

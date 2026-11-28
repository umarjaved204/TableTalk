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

/** A goat standing left, head up, short tail raised: Cologne's mascot. */
const GOAT: OutlinePoint[] = [
  [10, 37, 1],
  [15, 28],
  [24, 23],
  [32, 30],
  [38, 36],
  [52, 37],
  [72, 36],
  [84, 37],
  [90, 30, 1],
  [90, 40],
  [87, 52],
  [85, 72],
  [87, 88, 1],
  [80, 88, 1],
  [77, 66],
  [72, 60],
  [50, 61],
  [43, 64],
  [41, 88, 1],
  [34, 88, 1],
  [33, 64],
  [28, 52],
  [24, 47],
  [22, 57, 1],
  [18, 46],
  [12, 43],
];

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

/** A hare running left, ears laid back. */
const HARE: OutlinePoint[] = [
  [6, 44, 1],
  [12, 36],
  [22, 32],
  [34, 16],
  [50, 6, 1],
  [42, 20],
  [36, 30],
  [50, 30],
  [68, 32],
  [82, 38],
  [92, 46],
  [94, 54, 1],
  [87, 57],
  [84, 66],
  [96, 76, 1],
  [80, 75],
  [70, 64],
  [56, 62],
  [44, 66],
  [24, 74, 1],
  [32, 62],
  [26, 52],
  [14, 48],
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

/** A Württemberg stag's antler, lying across: a curved beam with four tines. */
function antler(main: string): string {
  return line(
    "M4 66C30 62 62 62 96 52M20 64C19 56 22 50 28 45M42 63C41 54 45 48 52 43M64 61C64 52 68 46 76 41M85 56C86 50 89 46 95 42",
    main,
    8,
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
    path(outline(GOAT), main) +
    line("M25 24C25 12 34 6 42 12C36 10 31 15 31 24", accent, 4) +
    circle(20, 29, 1.6, ground),
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
  hare: ({ main, ground }) => path(outline(HARE), main) + circle(20, 39, 1.8, ground),
  /** Three hares chasing round a circle, as in Paderborn Cathedral's window. */
  "three-hares": ({ main, ground }) =>
    [0, 120, 240]
      .map(
        (deg) =>
          `<g transform="rotate(${deg} 50 50) translate(50 27) scale(0.58) translate(-50 -50)">${path(outline(HARE), main)}${circle(20, 39, 2.6, ground)}</g>`,
      )
      .join(""),
  /** A fir tree. */
  fir: ({ main }) => fir(main),
} satisfies Record<string, Draw>;

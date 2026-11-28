// Club symbols: original drawings, each in its own 100 x 100 box, placed on
// a crest with place(). They are new interpretations of a club's heritage
// (Woolwich's artillery, Brentford's bees, Coventry's phoenix), drawn from
// simple shapes; none is traced from, or measured off, an official badge.
//
// Colours come in as roles, so one drawing serves the full crest, the small
// crest and an alternative design:
//   main    the symbol itself
//   accent  a second colour for detail (a flame, a bee's stripes)
//   ground  the colour behind the symbol, used to cut gaps between parts
//           (where a wheel crosses a barrel, say), so parts never merge.

import { BUNDESLIGA_SYMBOLS } from "./symbols-bundesliga.ts";
import { REFINED } from "./symbols-refined.ts";
import { LALIGA_SYMBOLS } from "./symbols-laliga.ts";
import { SILHOUETTES } from "./symbols-silhouettes.ts";

export interface Ink {
  main: string;
  accent: string;
  ground: string;
}

type Draw = (ink: Ink) => string;

const path = (d: string, fill: string) => `<path d="${d}" fill="${fill}"/>`;
const line = (d: string, stroke: string, width: number, cap = "round") =>
  `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="${cap}" stroke-linejoin="round"/>`;
const circle = (cx: number, cy: number, r: number, fill: string) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;
const ringAt = (cx: number, cy: number, r: number, stroke: string, width: number) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${stroke}" stroke-width="${width}"/>`;
const r1 = (v: number) => String(Math.round(v * 10) / 10);

/** A star with n points, as path data. */
function starD(cx: number, cy: number, outer: number, inner: number, n: number, turn = -90): string {
  const p: string[] = [];
  for (let k = 0; k < n * 2; k++) {
    const a = ((turn + (k * 180) / n) * Math.PI) / 180;
    const r = k % 2 === 0 ? outer : inner;
    p.push(`${r1(cx + r * Math.cos(a))} ${r1(cy + r * Math.sin(a))}`);
  }
  return `M${p.join("L")}Z`;
}

/** Spokes of a wheel, as path data. */
function spokes(cx: number, cy: number, from: number, to: number, n: number, turn = 0): string {
  let d = "";
  for (let k = 0; k < n; k++) {
    const a = ((turn + (k * 360) / n) * Math.PI) / 180;
    d += `M${r1(cx + from * Math.cos(a))} ${r1(cy + from * Math.sin(a))}L${r1(cx + to * Math.cos(a))} ${r1(cy + to * Math.sin(a))}`;
  }
  return d;
}

/** n lines fanning out from (cx, cy) between two angles (degrees), as path data. */
function fan(cx: number, cy: number, from: number, to: number, a0: number, a1: number, n: number): string {
  let d = "";
  for (let k = 0; k < n; k++) {
    const a = ((a0 + ((a1 - a0) * k) / (n - 1)) * Math.PI) / 180;
    d += `M${r1(cx + from * Math.cos(a))} ${r1(cy + from * Math.sin(a))}L${r1(cx + to * Math.cos(a))} ${r1(cy + to * Math.sin(a))}`;
  }
  return d;
}

function waves(y0: number, rows: number, stroke: string, width = 4, gap = 9, x0 = 6, x1 = 94): string {
  let d = "";
  for (let k = 0; k < rows; k++) {
    const y = y0 + k * gap;
    d += `M${x0} ${y}`;
    for (let x = x0; x < x1; x += 14) d += `q3.5 -4 7 0t7 0`;
  }
  return line(d, stroke, width);
}

const FIRST_ROUND = {
  /** A field gun side-on, facing left: Woolwich's Royal Arsenal, where the
   *  club was formed by munitions workers. A wheeled gun, not a bare barrel. */
  "field-gun": ({ main, ground }) =>
    path("M6 33L15 33L15 35.5L74 42Q85 43.5 85 50Q85 56.5 74 58L15 46.5L15 49L6 49Z", main) +
    path("M84 47L90 47.5L90 52.5L84 53Z", main) +
    circle(93, 50, 4.5, main) +
    path("M52 55L95 80L91 87L46 64Z", main) +
    ringAt(42, 68, 19, ground, 10) +
    ringAt(42, 68, 19, main, 5.5) +
    line(spokes(42, 68, 5, 17, 8, 22.5), main, 3) +
    circle(42, 68, 6, main) +
    circle(42, 68, 2.2, ground),

  /** A sundial: "Dial Square", the Woolwich workshop the club was first
   *  named after, for the sundial over its entrance. Hour lines fan out from
   *  the foot of the gnomon, the triangular blade that casts the shadow. */
  dial: ({ main, accent, ground }) =>
    circle(50, 50, 40, main) +
    circle(50, 50, 33, ground) +
    line(fan(50, 64, 12, 27, 180, 360, 7), main, 3, "butt") +
    path("M50 64L50 30L66 64Z", accent) +
    path("M22 64L78 64L78 70L22 70Z", main),

  /** A ship's anchor with its ring and stock: the Mersey's port. */
  anchor: ({ main }) =>
    ringAt(50, 15, 8, main, 6) +
    path("M46 22L54 22L54 82L46 82Z", main) +
    path("M28 32L72 32L72 40L28 40Z", main) +
    line("M18 60C20 78 34 88 50 88C66 88 80 78 82 60", main, 8) +
    path("M10 64L18 50L26 64Z", main) +
    path("M74 64L82 50L90 64Z", main),

  /** A gull gliding over the sea: Brighton's seafront. */
  gull: ({ main }) =>
    path(
      "M2 48C14 28 34 22 46 40L50 46L54 40C66 22 86 28 98 48C84 40 70 42 60 58" +
        "C56 66 44 66 40 58C30 42 16 40 2 48Z",
      main,
    ) +
    circle(50, 46, 7, main) +
    path("M46 64L50 74L54 64Z", main),

  /** A worker bee, seen from above: Brentford's nickname, and Manchester's
   *  symbol of its mills and workers. */
  bee: ({ main, accent, ground }) =>
    `<ellipse cx="32" cy="40" rx="17" ry="9" transform="rotate(-30 32 40)" fill="${ground}" stroke="${main}" stroke-width="3"/>` +
    `<ellipse cx="68" cy="40" rx="17" ry="9" transform="rotate(30 68 40)" fill="${ground}" stroke="${main}" stroke-width="3"/>` +
    line("M45 22C42 14 38 10 33 9M55 22C58 14 62 10 67 9", main, 2.5) +
    circle(50, 27, 8, main) +
    circle(50, 42, 10, main) +
    `<ellipse cx="50" cy="66" rx="15" ry="21" fill="${accent}" stroke="${main}" stroke-width="3"/>` +
    path("M36 58L64 58L65 64L35 64Z", main) +
    path("M36 70L64 70L62 76L38 76Z", main) +
    path("M40 81L60 81L56 86L44 86Z", main) +
    path("M47 87L53 87L50 95Z", main),

  /** Honeycomb cells: the Bees, without a bee. */
  honeycomb: ({ main, accent }) => {
    // Flat-topped hexagons: the centre cell and its six neighbours.
    const cells: [number, number][] = [
      [50, 50],
      [50, 26],
      [50, 74],
      [29, 38],
      [71, 38],
      [29, 62],
      [71, 62],
    ];
    const hex = (cx: number, cy: number, r: number) => starD(cx, cy, r, r, 3, 0);
    return cells.map(([x, y], k) => path(hex(x, y, 12.5), k === 0 ? accent : main)).join("");
  },

  /** A white rose with five petals and a seeded heart: Yorkshire. */
  rose: ({ main, accent, ground }) => {
    let petals = "";
    for (let k = 0; k < 5; k++) {
      const a = ((-90 + k * 72) * Math.PI) / 180;
      petals += `<circle cx="${r1(50 + 20 * Math.cos(a))}" cy="${r1(50 + 20 * Math.sin(a))}" r="16" fill="${main}" stroke="${ground}" stroke-width="2.5"/>`;
    }
    let sepals = "";
    for (let k = 0; k < 5; k++) sepals += path(sepal(-90 + 36 + k * 72), accent);
    return (
      sepals + petals + circle(50, 50, 13, main) + ringAt(50, 50, 13, ground, 2) + circle(50, 50, 7, accent)
    );
  },

  /** A castle keep with three towers: Newcastle's castle on the Tyne. */
  castle: ({ main, ground }) =>
    path(
      "M14 34L14 26L19 26L19 30L23 30L23 26L28 26L28 30L32 30L32 26L36 26L36 40L38 40L38 22L42 22L42 16L47 16L47 22" +
        "L53 22L53 16L58 16L58 22L62 22L62 40L64 40L64 26L68 26L68 30L72 30L72 26L77 26L77 30L81 30L81 26L86 26L86 34" +
        "L83 34L83 88L17 88L17 34Z",
      main,
    ) +
    path("M41 88L41 70C41 60 59 60 59 70L59 88Z", ground) +
    path("M47 30L53 30L53 42L47 42Z", ground) +
    path("M24 44L29 44L29 54L24 54Z", ground) +
    path("M71 44L76 44L76 54L71 54Z", ground) +
    line("M17 60L83 60", ground, 2),

  /** A twisted-wrapper toffee: the Toffees, after the sweet shop near the old ground. */
  toffee: ({ main, accent, ground }) =>
    path("M8 30L30 44L30 56L8 70L14 50Z", main) +
    path("M92 30L70 44L70 56L92 70L86 50Z", main) +
    `<ellipse cx="50" cy="50" rx="24" ry="17" fill="${accent}"/>` +
    line("M34 40C40 46 40 54 34 60M50 34C56 42 56 58 50 66M66 40C72 46 72 54 66 60", ground, 3),

  /** A rider's spur with its star-shaped rowel: Harry Hotspur, the
   *  fourteenth-century Percy knight the club is named after. */
  spur: ({ main, ground }) =>
    // The heel band: a crescent, thickest at the back of the heel.
    path("M8 30C6 72 60 80 66 46L58 45C54 66 18 64 16 30Z", main) +
    circle(12, 29, 7, main) +
    circle(12, 29, 2.5, ground) +
    // The neck, then the rowel: the star-shaped wheel at the end.
    path("M60 40L78 31L82 39L64 50Z", main) +
    path(starD(86, 33, 16, 6.5, 8, -90), main) +
    circle(86, 33, 3.2, ground),

  /** The spur's rowel alone: a bold eight-pointed star for the small crest. */
  rowel: ({ main, ground }) => path(starD(50, 50, 46, 18, 8, -90), main) + circle(50, 50, 9, ground),

  /** An open crown with three points: one of the three crowns in Hull's arms. */
  crown: ({ main, ground }) =>
    path("M14 72L10 34L32 52L50 24L68 52L90 34L86 72Z", main) +
    path("M14 76L86 76L86 88L14 88Z", main) +
    circle(10, 30, 5, main) +
    circle(50, 20, 5.5, main) +
    circle(90, 30, 5, main) +
    circle(32, 82, 2.5, ground) +
    circle(50, 82, 2.5, ground) +
    circle(68, 82, 2.5, ground),

  /** A chapel front with a cross: Villa Cross Wesleyan chapel, where the club began in 1874. */
  chapel: ({ main, accent, ground }) =>
    path("M48 4L52 4L52 12L58 12L58 16L52 16L52 26L48 26L48 16L42 16L42 12L48 12Z", accent) +
    path("M50 24L86 50L80 50L80 92L20 92L20 50L14 50Z", main) +
    circle(50, 52, 9, ground) +
    line("M50 44L50 60M42 52L58 52", main, 2) +
    path("M40 92L40 74C40 64 60 64 60 74L60 92Z", ground),

  /** A gabled riverside cottage: Craven Cottage, by the Thames. */
  cottage: ({ main, accent, ground }) =>
    path("M64 14L72 14L72 32L64 26Z", main) +
    path("M12 50L50 20L88 50L82 50L82 76L18 76L18 50Z", main) +
    path("M44 76L44 60L56 60L56 76Z", ground) +
    path("M26 56L36 56L36 66L26 66Z", ground) +
    path("M64 56L74 56L74 66L64 66Z", ground) +
    circle(50, 40, 4.5, ground) +
    waves(85, 2, accent, 4, 9),

  /** A sailing ship on the water: Ipswich, a port on the Orwell, with ships in its arms. */
  ship: ({ main, accent }) =>
    path("M48 8L60 12L48 15Z", accent) +
    path("M48 10L52 10L52 66L48 66Z", main) +
    path("M26 20Q36 18 46 20Q48 36 46 52Q36 50 26 52Q30 36 26 20Z", main) +
    path("M56 22Q68 20 78 24Q80 38 78 52Q68 50 56 52Q60 36 56 22Z", main) +
    path("M10 62L90 62L80 78L20 78Z", main) +
    waves(88, 1, accent, 4),

  /** A drawn longbow and arrow: Robin Hood and Sherwood Forest. */
  "bow-arrow": ({ main, accent }) =>
    line("M38 10Q74 50 38 90", main, 6) +
    line("M38 10L18 50L38 90", main, 2) +
    line("M14 50L82 50", main, 4, "butt") +
    path("M78 42L94 50L78 58Z", main) +
    path("M14 50L6 42L14 42L20 50L14 58L6 58Z", accent),

  /** A black cat sitting: Sunderland's Black Cats, after the cat battery on the Wear. */
  cat: ({ main, accent }) =>
    path("M31 41C22 57 20 77 26 91L62 91C67 81 65 62 53 45Z", main) +
    circle(41, 33, 14, main) +
    path("M28 27L29 11L39 22Z", main) +
    path("M43 22L53 11L54 27Z", main) +
    line("M61 89C81 89 88 76 81 63", main, 6) +
    `<ellipse cx="36" cy="32" rx="2.2" ry="3.2" fill="${accent}"/>` +
    `<ellipse cx="46" cy="32" rx="2.2" ry="3.2" fill="${accent}"/>`,

  /** A miner's safety lamp: Wearmouth Colliery, where the stadium now stands. */
  "miners-lamp": ({ main, accent, ground }) =>
    ringAt(50, 10, 6, main, 4) +
    path("M34 18L66 18L62 30L38 30Z", main) +
    path("M36 30L64 30L64 72L36 72Z", main) +
    path("M41 34L59 34L59 68L41 68Z", ground) +
    path("M50 40Q57 52 50 64Q43 52 50 40Z", accent) +
    line("M45 34L45 68M55 34L55 68", main, 1.5) +
    path("M30 72L70 72L74 84L26 84Z", main) +
    path("M28 84L72 84L72 90L28 90Z", main),

  /** The arched glass transept of the Crystal Palace, the 1851 exhibition hall. */
  "glass-palace": ({ main, ground }) =>
    path("M18 88L18 52A32 32 0 0 1 82 52L82 88Z", main) +
    path("M4 88L4 64L18 64L18 88Z", main) +
    path("M82 88L82 64L96 64L96 88Z", main) +
    line(
      "M50 20L50 88M34 26L34 88M66 26L66 88M18 64L82 64M22 40L78 40" +
        "M50 52L27 29M50 52L73 29M4 76L96 76M11 64L11 88M89 64L89 88",
      ground,
      2,
    ),

  /** Diamond panes of glass: the Glaziers, the club's first nickname. */
  lattice: ({ main, accent }) =>
    path("M50 6L94 50L50 94L6 50Z", main) +
    line("M28 28L72 72M39 17L83 61M17 39L61 83M72 28L28 72M83 39L39 83M61 17L17 61", accent, 2.5),

  /** A pair of cherries on one stalk: the Cherries. */
  cherries: ({ main, accent, ground }) =>
    line("M36 62C38 42 46 28 58 18M64 66C62 46 60 30 58 18", accent, 3.5) +
    path("M58 18C66 10 80 10 86 16C78 24 66 24 58 18Z", accent) +
    circle(34, 70, 16, main) +
    circle(66, 74, 16, main) +
    `<ellipse cx="28" cy="64" rx="3.5" ry="5" fill="${ground}" opacity="0.55"/>` +
    `<ellipse cx="60" cy="68" rx="3.5" ry="5" fill="${ground}" opacity="0.55"/>`,
} satisfies Record<string, Draw>;

/** Every symbol: the first round of drawings, with later rounds
 *  (symbols-refined.ts, then symbols-silhouettes.ts) replacing those they redraw. */
export const SYMBOLS = {
  ...FIRST_ROUND,
  ...REFINED,
  ...SILHOUETTES,
  ...LALIGA_SYMBOLS,
  ...BUNDESLIGA_SYMBOLS,
};

export type SymbolName = keyof typeof SYMBOLS;

/** One sepal of the rose: a small leaf between two outer petals. */
function sepal(deg: number): string {
  const a = (deg * Math.PI) / 180;
  // A point at `radius` from the rose's centre, turned `turn` tenths of a half-circle from the sepal's axis.
  const at = (radius: number, turn: number) => {
    const b = a + (turn * Math.PI) / 10;
    return `${r1(50 + radius * Math.cos(b))} ${r1(50 + radius * Math.sin(b))}`;
  };
  return `M${at(22, -1)}L${at(40, 0)}L${at(22, 1)}Z`;
}

export interface Placement {
  /** Centre of the symbol on the crest, and its size (the 100-unit box scaled to this). */
  x: number;
  y: number;
  size: number;
  rotate?: number;
  /** Mirror left to right. */
  flip?: boolean;
}

/** A symbol on a crest. */
export function place(name: SymbolName, at: Placement, ink: Ink): string {
  const s = at.size / 100;
  const parts = [`translate(${r1(at.x)} ${r1(at.y)})`];
  if (at.rotate) parts.push(`rotate(${at.rotate})`);
  parts.push(`scale(${at.flip ? -r1(s) : r1(s)} ${r1(s)})`, "translate(-50 -50)");
  return `<g transform="${parts.join(" ").replace(/scale\((-?[\d.]+) \1\)/, "scale($1)")}">${SYMBOLS[name](ink)}</g>`;
}

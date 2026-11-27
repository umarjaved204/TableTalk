// Symbols for the La Liga crests (27 Nov 2026): original drawings of each
// club's heritage, from royal titles and city emblems to nicknames, drawn in
// the same way as the rest of the collection: a 100 x 100 box, coloured by
// role (main, accent, ground), organic shapes as smooth outlines (outline.ts).
import { outline, type OutlinePoint } from "./outline.ts";
import { LION_PASSANT } from "./symbols-silhouettes.ts";
import { lock } from "./symbols-refined.ts";
import type { Ink } from "./symbols.ts";

type Draw = (ink: Ink) => string;

const r1 = (v: number) => String(Math.round(v * 10) / 10);
const path = (d: string, fill: string) => `<path d="${d}" fill="${fill}"/>`;
const line = (d: string, stroke: string, width: number) =>
  `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
const circle = (cx: number, cy: number, r: number, fill: string) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;

/** Rotate a path's points about (cx, cy): for drawings repeated round a centre. */
function turned(pts: readonly OutlinePoint[], deg: number, cx = 50, cy = 50): OutlinePoint[] {
  const a = (deg * Math.PI) / 180;
  const [c, s] = [Math.cos(a), Math.sin(a)];
  return pts.map((p) => {
    const x = cx + (p[0] - cx) * c - (p[1] - cy) * s;
    const y = cy + (p[0] - cx) * s + (p[1] - cy) * c;
    return p.length === 3 ? ([x, y, 1] as const) : ([x, y] as const);
  });
}

/** The bat's outline: wings spread, scalloped trailing edges, ears up. */
const BAT: OutlinePoint[] = [
  [50, 36],
  [46, 28, 1],
  [44, 36],
  [36, 32],
  [24, 24],
  [6, 26, 1],
  [12, 38],
  [10, 52, 1],
  [20, 48],
  [24, 60, 1],
  [32, 52],
  [40, 62, 1],
  [44, 54],
  [50, 66, 1],
  [56, 54],
  [60, 62, 1],
  [68, 52],
  [76, 60, 1],
  [80, 48],
  [90, 52, 1],
  [88, 38],
  [94, 26, 1],
  [76, 24],
  [64, 32],
  [56, 36],
  [54, 28, 1],
];

/** A lion walking left: small head, large rounded mane over the shoulders,
 *  deep chest, narrow waist, the near forepaw raised. */
const LION_WALKING: OutlinePoint[] = [
  [4, 40, 1],
  [6, 34],
  [10, 30],
  [14, 27],
  [18, 20],
  [26, 15],
  [35, 15],
  [43, 20],
  [48, 28],
  [58, 32],
  [70, 32],
  [80, 36],
  [86, 44],
  [87, 54],
  [86, 66],
  [88, 80],
  [91, 84],
  [84, 85, 1],
  [80, 82],
  [78, 68],
  [73, 60],
  [70, 70],
  [72, 82],
  [74, 85],
  [66, 85, 1],
  [64, 80],
  [64, 64],
  [54, 62],
  [44, 62],
  [42, 72],
  [43, 82],
  [46, 85],
  [38, 85, 1],
  [36, 80],
  [35, 68],
  [32, 64],
  [28, 60],
  [24, 62],
  [16, 64],
  [11, 63, 1],
  [12, 59, 1],
  [18, 57],
  [24, 54],
  [20, 52],
  [16, 50],
  [12, 48],
  [10, 46],
  [6, 44, 1],
  [9, 42, 1],
];
/** Fine lines in the ground colour: the face's edge and two locks of the mane. */
const LION_WALKING_LINES = "M15 28C12 36 13 44 17 50M28 18C25 30 27 44 32 56M40 20C38 30 40 42 44 52";

export const LALIGA_SYMBOLS = {
  /** A royal crown with closed arches, an orb and a cross: the "Real" (royal)
   *  title granted to Spanish clubs by the king. */
  "royal-crown": ({ main, accent, ground }) =>
    path("M16 80L16 64C16 42 32 30 50 30C68 30 84 42 84 64L84 80Z", main) +
    line("M30 64C30 48 38 38 50 34M70 64C70 48 62 38 50 34M50 34L50 64", ground, 2.2) +
    path("M12 64L88 64L88 80L12 80Z", main) +
    circle(28, 72, 3, accent) +
    circle(50, 72, 3.4, accent) +
    circle(72, 72, 3, accent) +
    circle(50, 24, 6.5, main) +
    path("M48 6L52 6L52 12L58 12L58 16L52 16L52 20L48 20L48 16L42 16L42 12L48 12Z", main) +
    path("M10 82L90 82L90 88L10 88Z", main),

  /** A laurel wreath: two branches of leaves rising from the foot and
   *  curving towards each other at the top. */
  laurel: ({ main }) => {
    let leaves = "";
    for (let k = 0; k < 7; k++) {
      const t = 105 + k * 17;
      const a = (t * Math.PI) / 180;
      const [x, y] = [50 + 36 * Math.cos(a), 52 + 36 * Math.sin(a)];
      const up = t + 90;
      leaves += lock(x, y, up - 30, 15, 7, 10) + lock(x, y, up + 25, 13, 6, -10);
      const mx = 100 - x;
      leaves += lock(mx, y, 180 - (up - 30), 15, 7, -10) + lock(mx, y, 180 - (up + 25), 13, 6, 10);
    }
    return line("M42 88C14 80 8 44 26 22M58 88C86 80 92 44 74 22", main, 3) + path(leaves, main);
  },

  /** The NO8DO skein: the figure-eight hank of wool in Seville's motto. */
  skein: ({ main }) =>
    line("M50 50C64 40 66 14 50 14C34 14 36 40 50 50C66 60 66 86 50 86C34 86 34 60 50 50Z", main, 7) +
    line("M42 47L58 53M42 53L58 47", main, 3),

  /** The Cantabrian stela: a stone disc with four curved arms turning round a
   *  centre, the emblem of Cantabria from its ancient carved stones. */
  estela: ({ main, ground }) => {
    const arm: OutlinePoint[] = [
      [48, 44],
      [56, 32],
      [68, 23],
      [84, 18, 1],
      [78, 31],
      [68, 42],
      [57, 53],
    ];
    let arms = "";
    for (let k = 0; k < 4; k++) arms += outline(turned(arm, k * 90));
    return (
      circle(50, 50, 46, main) +
      `<circle cx="50" cy="50" r="40" fill="none" stroke="${ground}" stroke-width="3"/>` +
      path(arms, ground) +
      circle(50, 50, 7, ground)
    );
  },

  /** A lion walking: the Lions (Lehoiak) of San Mamés, the saint thrown to the lions. */
  "lion-passant": ({ main, ground }) =>
    line("M84 48C96 44 98 30 92 22C89 18 91 13 95 12", main, 4.4) +
    circle(95, 12, 4.5, main) +
    path(outline(LION_PASSANT), main) +
    line("M25 27C22 34 22 41 25 47", ground, 1.6) +
    circle(14, 38, 1.6, ground),

  /** A parakeet perched on a branch in profile, facing left: a small round
   *  head with a short hooked beak, a slim body, a folded wing and a long,
   *  tapering tail. The Pericos. */
  parakeet: ({ main, accent, ground }) =>
    path(
      outline([
        [40, 16],
        [47, 15],
        [52, 19],
        [55, 27],
        [57, 38],
        [58, 50],
        [60, 60],
        [66, 74],
        [74, 96, 1],
        [62, 78],
        [52, 66],
        [46, 60],
        [41, 50],
        [39, 40],
        [36, 32],
        [34, 26],
        [30, 26, 1],
        [31, 22],
        [35, 18],
      ]),
      main,
    ) +
    path(
      outline([
        [45, 32],
        [53, 34],
        [57, 46],
        [59, 58],
        [55, 62],
        [49, 54],
        [45, 42],
      ]),
      accent,
    ) +
    path("M34 21Q29 21 28 25Q30 27 33 26Z", ground) +
    circle(41, 21, 1.8, ground) +
    line("M18 62L84 58", main, 3.2) +
    line("M47 60L45 65M53 61L53 66", main, 2.4),

  /** The Tower of Hercules, the Roman lighthouse at A Coruña: a square tower
   *  wrapped by the line of its old outer ramp, a lantern on top. */
  "hercules-tower": ({ main, ground }) =>
    path("M37 26L63 26L65 88L35 88Z", main) +
    line("M36 82L64 70M36 64L64 52M36 46L64 34", ground, 2.2) +
    path("M40 16L60 16L60 26L40 26Z", main) +
    path("M44 8L56 8L56 16L44 16Z", main) +
    path("M43 8Q50 0 57 8Z", main) +
    path("M46.5 18.5h3v5h-3ZM50.5 18.5h3v5h-3Z", ground) +
    path("M28 88L72 88L72 96L28 96Z", main),

  /** A submarine on the surface: the Yellow Submarine, Villarreal's
   *  nickname, from the Beatles song the fans sang. */
  submarine: ({ main, accent, ground }) =>
    path(
      "M14 58C14 50 22 46 32 46L74 46C84 46 92 52 92 58C92 64 84 70 74 70L32 70C22 70 14 66 14 58Z",
      main,
    ) +
    path("M42 46L44 32L62 32L66 46Z", main) +
    line("M52 32L52 18L60 18", main, 3) +
    path("M92 52L100 46L100 70L92 64Z", main) +
    circle(34, 58, 3.5, ground) +
    circle(48, 58, 3.5, ground) +
    circle(62, 58, 3.5, ground) +
    circle(76, 58, 3.5, ground) +
    line("M4 80q5 -5 10 0t10 0t10 0t10 0t10 0t10 0t10 0t10 0t10 0", accent, 3),

  /** A fighting bull charging left: a deep chest and heavy shoulder hump,
   *  head lowered with forward-curving horns, slim legs, tail swinging up. */
  bull: ({ main, ground }) =>
    path(
      outline([
        [8, 50, 1],
        [10, 43],
        [15, 39],
        [12, 30, 1],
        [19, 36],
        [26, 34],
        [34, 24],
        [44, 22],
        [54, 26],
        [66, 30],
        [78, 31],
        [86, 34],
        [92, 28],
        [97, 22, 1],
        [95, 32],
        [89, 42],
        [87, 54],
        [88, 68],
        [90, 80],
        [84, 80, 1],
        [81, 68],
        [76, 58],
        [72, 70],
        [74, 80],
        [67, 80, 1],
        [65, 64],
        [52, 62],
        [44, 64],
        [40, 72],
        [41, 80],
        [34, 80, 1],
        [34, 66],
        [30, 60],
        [26, 68],
        [21, 76],
        [15, 76, 1],
        [18, 68],
        [22, 58],
        [18, 54],
        [12, 54],
      ]),
      main,
    ) + circle(16, 44, 1.6, ground),

  /** A triskele: three spiralling arms turning from one centre, the Celtic
   *  sign of Galicia. */
  triskele: ({ main }) => {
    let d = "";
    for (let k = 0; k < 3; k++) {
      const a = (k * 120 * Math.PI) / 180;
      const pt = (x: number, y: number) => {
        const [dx, dy] = [x - 50, y - 50];
        return `${r1(50 + dx * Math.cos(a) - dy * Math.sin(a))} ${r1(50 + dx * Math.sin(a) + dy * Math.cos(a))}`;
      };
      d += `M${pt(50, 50)}C${pt(50, 30)} ${pt(78, 22)} ${pt(84, 40)}C${pt(88, 54)} ${pt(74, 62)} ${pt(66, 54)}C${pt(60, 48)} ${pt(66, 40)} ${pt(72, 44)}`;
    }
    return line(d, main, 8);
  },

  /** A bat with its wings spread, the rat penat on the arms of Valencia. */
  bat: ({ main, ground }) =>
    path(outline(BAT), main) + circle(46.5, 39, 1.4, ground) + circle(53.5, 39, 1.4, ground),

  /** A biplane climbing to the left: Getafe's airfield, the first in Spain (1911). */
  biplane: ({ main, ground }) =>
    `<g transform="rotate(-12 50 50)">` +
    path("M20 50C20 45 26 42 34 42L76 44L92 38L94 46L88 50L94 54L76 56L34 58C26 58 20 55 20 50Z", main) +
    path("M24 34L70 34L70 38L24 38Z", main) +
    path("M26 62L66 62L66 66L26 66Z", main) +
    line("M34 38L34 62M58 38L58 62", main, 2.4) +
    line("M16 40L16 60", main, 3) +
    circle(19, 50, 3, main) +
    circle(40, 50, 2.6, ground) +
    `</g>`,

  /** A lightning bolt: the "rayo" in Rayo Vallecano. */
  bolt: ({ main }) => path("M58 4L22 54L46 54L34 96L80 38L54 38L70 4Z", main),

  /** A frog sitting, seen from above: round body, wide head with two eyes
   *  on top, back legs folded at the sides and front feet splayed. The
   *  Granotes, after the marshes by Levante's first ground. */
  frog: ({ main, ground }) =>
    // Back legs, folded: thigh out, shin back in, webbed foot.
    line("M34 66L16 58L24 80L10 88M66 66L84 58L76 80L90 88", main, 7) +
    // Front legs.
    line("M38 46L24 40L18 30M62 46L76 40L82 30", main, 6) +
    `<ellipse cx="50" cy="60" rx="21" ry="25" fill="${main}"/>` +
    `<ellipse cx="50" cy="36" rx="18" ry="13" fill="${main}"/>` +
    circle(39, 27, 6.5, main) +
    circle(61, 27, 6.5, main) +
    circle(39, 26, 3, ground) +
    circle(61, 26, 3, ground),

  /** A date palm with drooping fronds and a cluster of dates: the Palmeral
   *  of Elche, the great palm grove around the city. */
  palm: ({ main, accent }) => {
    const fronds = [-170, -145, -120, -95, -70, -45, -15]
      .map((d) => lock(52, 26, d, 32, 7, d < -95 ? -40 : 40))
      .join("");
    return (
      path("M48 96C46 74 46 52 50 30L56 30C54 52 54 74 58 96Z", main) +
      path(fronds, main) +
      circle(46, 34, 3.2, accent) +
      circle(52, 36, 3.2, accent) +
      circle(58, 34, 3.2, accent)
    );
  },

  /** Two anchovies swimming: the Boquerones of Málaga. */
  anchovies: ({ main, ground }) => {
    const fish = (y: number) =>
      outline([
        [12, y],
        [24, y - 6],
        [50, y - 7],
        [74, y - 3],
        [84, y - 9, 1],
        [80, y],
        [84, y + 9, 1],
        [74, y + 3],
        [50, y + 6],
        [24, y + 6],
      ]);
    return path(fish(34) + fish(66), main) + circle(20, 33, 1.8, ground) + circle(20, 65, 1.8, ground);
  },

  /** La Concha bay at San Sebastián: the two hills on either side (Igueldo
   *  and Urgull), the island of Santa Clara in the bay, the waves, and the
   *  curve of the beach. */
  "concha-bay": ({ main, accent }) =>
    path("M0 62C6 42 22 34 38 56L38 62Z", main) +
    path("M100 60C94 42 78 36 62 56L62 60Z", main) +
    path("M42 62C44 53 56 53 58 62Z", main) +
    path("M0 62L100 62L100 65L0 65Z", main) +
    line("M18 72q4 -3 8 0t8 0t8 0t8 0t8 0t8 0t8 0t8 0M28 80q4 -3 8 0t8 0t8 0t8 0t8 0t8 0", main, 2.4) +
    path("M6 86C30 98 70 98 94 86C70 92 30 92 6 86Z", accent),

  /** A five-petalled orange blossom (azahar) on a sprig with two leaves:
   *  Valencia's orange groves. */
  "orange-blossom": ({ main, accent, ground }) => {
    let petals = "";
    for (let k = 0; k < 5; k++) {
      const a = ((-90 + k * 72) * Math.PI) / 180;
      petals += `<circle cx="${r1(50 + 17 * Math.cos(a))}" cy="${r1(44 + 17 * Math.sin(a))}" r="14" fill="${main}" stroke="${ground}" stroke-width="2"/>`;
    }
    return (
      path(lock(50, 70, 140, 30, 12, 10) + lock(50, 70, 40, 30, 12, -10), accent) +
      line("M50 60L50 92", accent, 3) +
      petals +
      circle(50, 44, 8, accent)
    );
  },
  /** St George's cross, red on a white disc: the cross of Barcelona's arms. */
  "cross-disc": ({ main, ground }) =>
    circle(50, 50, 46, ground) +
    path("M43 6L57 6L57 43L94 43L94 57L57 57L57 94L43 94L43 57L6 57L6 43L43 43Z", main),

  /** The seven stars of the Great Bear (the Plough), in its own shape: the
   *  stars on the arms of Madrid. */
  "great-bear": ({ main }) => {
    const star = (cx: number, cy: number, r: number) => {
      const p: string[] = [];
      for (let k = 0; k < 10; k++) {
        const a = ((-90 + k * 36) * Math.PI) / 180;
        const rr = k % 2 === 0 ? r : r * 0.42;
        p.push(`${r1(cx + rr * Math.cos(a))} ${r1(cy + rr * Math.sin(a))}`);
      }
      return `M${p.join("L")}Z`;
    };
    const stars: [number, number][] = [
      [8, 30],
      [24, 26],
      [38, 32],
      [52, 42],
      [56, 62],
      [80, 66],
      [88, 44],
    ];
    return path(stars.map(([x, y]) => star(x, y, 8)).join(""), main);
  },

  /** The lauburu, the Basque cross: four comma-shaped heads turning round a centre. */
  lauburu: ({ main }) => {
    const head: OutlinePoint[] = [
      [50, 50],
      [50, 28],
      [58, 14],
      [72, 14],
      [80, 24],
      [76, 36],
      [64, 40],
      [56, 46],
    ];
    let d = "";
    for (let k = 0; k < 4; k++) d += outline(turned(head, k * 90));
    return path(d, main);
  },

  /** The bat with a keyline in the ground colour, for a bat set across the
   *  top edge of a crest: the keyline keeps it clear on any background. */
  "bat-keyline": ({ main, ground }) =>
    `<path d="${outline(BAT)}" fill="${ground}" stroke="${ground}" stroke-width="7" stroke-linejoin="round"/>` +
    path(outline(BAT), main) +
    circle(46.5, 39, 1.4, ground) +
    circle(53.5, 39, 1.4, ground),

  /** A football: a central pentagon, five seams running out to the edge and
   *  the part-pentagons at the rim, as on a stitched leather ball. */
  football: ({ main, ground }) => {
    const ring = (r: number, turn: number) =>
      [0, 1, 2, 3, 4].map((k) => {
        const a = ((turn + k * 72) * Math.PI) / 180;
        return [50 + r * Math.cos(a), 50 + r * Math.sin(a)] as const;
      });
    const inner = ring(15, -90);
    const outer = ring(31, -90);
    const pent = `M${inner.map(([x, y]) => `${r1(x)} ${r1(y)}`).join("L")}Z`;
    let seams = "";
    let edges = "";
    for (let k = 0; k < 5; k++) {
      const [ix, iy] = inner[k] ?? [50, 50];
      const [ox, oy] = outer[k] ?? [50, 50];
      seams += `M${r1(ix)} ${r1(iy)}L${r1(ox)} ${r1(oy)}`;
      const a = ((-90 + k * 72) * Math.PI) / 180;
      const [ex, ey] = [50 + 46 * Math.cos(a), 50 + 46 * Math.sin(a)];
      edges += lock(ex, ey, -90 + k * 72 + 180, 12, 16, 0);
    }
    return (
      circle(50, 50, 44, ground) +
      path(edges, main) +
      path(pent, main) +
      line(seams, main, 3) +
      `<circle cx="50" cy="50" r="44" fill="none" stroke="${main}" stroke-width="4"/>`
    );
  },

  /** A pennant on a pole, flying: two horizontal stripes. */
  pennant: ({ main, accent }) =>
    line("M18 10L18 92", main, 4) +
    path("M18 14C40 10 60 18 86 22C62 30 40 36 18 40Z", accent) +
    path("M18 27C40 24 58 26 76 26C58 32 40 36 18 40Z", main),

  /** A lion walking left in heraldic style: a small head with the mouth open,
   *  a large rounded mane over the shoulders, a deep chest, a narrow waist,
   *  strong legs with the near forepaw raised, and the tail curving up over
   *  the back to a tuft. The Lions of San Mamés. */
  "lion-statant": ({ main, accent, ground }) =>
    line("M84 46C94 40 96 28 90 20C88 16 90 11 94 10", main, 4) +
    circle(94, 10, 4.2, main) +
    path(outline(LION_WALKING), main) +
    line(LION_WALKING_LINES, ground, 1.5) +
    circle(13, 33, 1.6, ground) +
    path("M6 41Q2 43 4 46Q7 44 10 43Z", accent),
} satisfies Record<string, Draw>;

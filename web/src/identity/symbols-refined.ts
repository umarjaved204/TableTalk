// The second round of symbol drawings (the refinement pass after the first
// gallery review, 27 Nov 2026): heraldic animals and birds drawn from shared
// parts (limbs, flame-shaped locks and feathers, claws) so they carry the
// same weight of line across the collection, and the new ship, tiger and
// cockerel. Same rules as symbols.ts: original drawings in a 100 x 100 box,
// coloured by role (main, accent, ground).
import type { Ink } from "./symbols.ts";

type Draw = (ink: Ink) => string;

const r1 = (v: number) => String(Math.round(v * 10) / 10);
const path = (d: string, fill: string) => `<path d="${d}" fill="${fill}"/>`;
const line = (d: string, stroke: string, width: number, cap = "round") =>
  `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="${cap}" stroke-linejoin="round"/>`;
const circle = (cx: number, cy: number, r: number, fill: string) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;

/** A limb: a tapered band from (x1, y1), w1 wide, to (x2, y2), w2 wide, with round ends. */
export function limb(x1: number, y1: number, x2: number, y2: number, w1: number, w2: number): string {
  const a = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2;
  const [cx, cy] = [Math.cos(a), Math.sin(a)];
  const p = (x: number, y: number, w: number, s: number) =>
    `${r1(x + (s * w * cx) / 2)} ${r1(y + (s * w * cy) / 2)}`;
  return (
    `M${p(x1, y1, w1, 1)}L${p(x2, y2, w2, 1)}A${r1(w2 / 2)} ${r1(w2 / 2)} 0 0 0 ${p(x2, y2, w2, -1)}` +
    `L${p(x1, y1, w1, -1)}A${r1(w1 / 2)} ${r1(w1 / 2)} 0 0 0 ${p(x1, y1, w1, 1)}Z`
  );
}

/** A flame-shaped lock (mane lock, feather, flame): a base `w` wide at (x, y),
 *  running `len` towards `deg` and curling `bend` degrees on the way to its point. */
export function lock(x: number, y: number, deg: number, len: number, w: number, bend = 25): string {
  const rad = (d: number) => (d * Math.PI) / 180;
  const a = rad(deg);
  const b = rad(deg + bend);
  const n = a + Math.PI / 2;
  const tx = x + len * Math.cos(b);
  const ty = y + len * Math.sin(b);
  const mx = x + 0.55 * len * Math.cos(a);
  const my = y + 0.55 * len * Math.sin(a);
  const hx = (w / 2) * Math.cos(n);
  const hy = (w / 2) * Math.sin(n);
  return (
    `M${r1(x + hx)} ${r1(y + hy)}Q${r1(mx + hx)} ${r1(my + hy)} ${r1(tx)} ${r1(ty)}` +
    `Q${r1(mx - hx)} ${r1(my - hy)} ${r1(x - hx)} ${r1(y - hy)}Z`
  );
}

/** Three claws at (x, y), pointing towards `deg`. */
function claws(x: number, y: number, deg: number, len = 5.5): string {
  return [-30, 0, 30].map((t) => lock(x, y, deg + t, len, 2.8, 0)).join("");
}

/** Locks set along an arc round (cx, cy), each pointing outwards and curling by `bend`. */
function mane(
  cx: number,
  cy: number,
  r: number,
  from: number,
  to: number,
  n: number,
  len: number,
  w: number,
  bend: number,
): string {
  let d = "";
  for (let k = 0; k < n; k++) {
    const deg = from + ((to - from) * k) / (n - 1);
    const a = (deg * Math.PI) / 180;
    d += lock(
      cx + r * Math.cos(a),
      cy + r * Math.sin(a),
      deg,
      len * (0.85 + 0.15 * Math.sin(k * 1.7)),
      w,
      bend,
    );
  }
  return d;
}

function waves(y0: number, rows: number, stroke: string, width = 3, gap = 8, x0 = 6, x1 = 94): string {
  let d = "";
  for (let k = 0; k < rows; k++) {
    const y = y0 + k * gap;
    d += `M${x0} ${y}`;
    for (let x = x0; x < x1; x += 14) d += `q3.5 -4 7 0t7 0`;
  }
  return line(d, stroke, width);
}

/** A lion rampant facing left, in heraldic proportions: the body on a
 *  diagonal from a round haunch up to a deep chest, head up with the mouth
 *  open, a curling mane drawn as rounded locks, both forepaws raised with
 *  claws out (the near one highest), one hind leg planted and the other
 *  stepping forward, the tail rising in an S to a curled tuft. Aston Villa's
 *  Scottish lion. */
function lionRampant({ main, accent, ground }: Ink, detail: boolean): string {
  const curls = (pts: [number, number, number][]) =>
    `<g fill="${main}">${pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join("")}</g>`;
  // Curls set along an arc, sharing one fill and one thin ground-coloured edge
  // (in a group, so the file carries the colours once).
  const mane = ([cx, cy]: [number, number], r: number, a0: number, a1: number, n: number, cr: number) => {
    let out = "";
    for (let k = 0; k < n; k++) {
      const a = ((a0 + ((a1 - a0) * k) / (n - 1)) * Math.PI) / 180;
      out += `<circle cx="${r1(cx + r * Math.cos(a))}" cy="${r1(cy + r * Math.sin(a))}" r="${cr}"/>`;
    }
    return `<g fill="${main}" stroke="${ground}" stroke-width="1.2">${out}</g>`;
  };
  return (
    line("M70 72C86 70 90 56 86 44C83 36 86 28 92 25", main, 4) +
    curls([
      [92, 22, 4.2],
      [97, 19, 3],
      [89, 17, 3],
      [96, 26, 2.8],
    ]) +
    // Hind legs: the far one stepping forward, the near one planted.
    path(limb(56, 76, 44, 84, 12, 8) + limb(44, 84, 34, 78, 8, 6.5), main) +
    (detail ? path(claws(31, 76, -150), main) : "") +
    path(limb(64, 76, 70, 86, 13, 9) + limb(70, 86, 64, 94, 9, 7) + limb(64, 95, 75, 95, 7, 5.5), main) +
    (detail ? path(claws(77, 95, 0), main) : "") +
    // Body on the diagonal: deep chest, narrow waist, round haunch.
    path(
      "M34 30C42 28 50 36 56 48C62 56 72 58 72 70C72 80 64 84 58 80C52 76 50 68 46 62C42 56 36 54 32 46C30 40 30 34 34 30Z",
      main,
    ) +
    // Forelegs: the near one raised to the head, the far one at the chest.
    path(limb(38, 40, 26, 32, 10, 7) + limb(26, 32, 16, 24, 7, 6), main) +
    (detail ? path(claws(13, 21, -130), main) : "") +
    path(limb(40, 50, 28, 48, 10, 7) + limb(28, 48, 18, 42, 7, 6), main) +
    (detail ? path(claws(15, 40, -155), main) : "") +
    // Mane: a mass behind the head, then two rows of curls, each edged in
    // the ground colour so the curls read separately.
    path("M27 11C40 6 52 17 52 30C52 42 43 48 31 44Z", main) +
    mane([36, 25], 16, -130, 105, 12, 4.6) +
    (detail ? mane([37, 27], 9.5, -70, 95, 8, 4.2) : "") +
    // Head in profile, mouth open.
    path(
      "M31 10C25 7 18 9 15 14L10 16L8 20L12 21L10 25L15 26L19 25C21 30 27 32 32 30C36 26 36 14 31 10Z",
      main,
    ) +
    path("M9 22Q5 24 7 27Q10 25 13 24Z", accent) +
    circle(22, 15, 1.7, ground)
  );
}

export const REFINED = {
  "lion-rampant": (ink) => lionRampant(ink, true),
  /** The same lion for the small crest: no claws and one row of curls,
   *  detail that can't be seen at 24 px and would only add to the file. */
  "lion-rampant-small": (ink) => lionRampant(ink, false),

  /** A lion's head in profile, broad brow and short muzzle, with a full mane
   *  of long locks sweeping back and curling down, cut off at the neck with a
   *  ragged edge (heraldry's "erased" head): Chelsea's lion, from the arms of
   *  the Cadogan family. A head, not a whole lion, so it never reads as Villa's. */
  "lion-head": ({ main, accent, ground }) =>
    // Mane: long locks from behind the head, pointing back and curling down,
    // then shorter locks hanging under the jaw for the ragged neck.
    path(
      [-50, -30, -10, 10, 30, 50, 70]
        .map((d, k) => lock(46 + k * 1.2, 22 + k * 6, d, 30 - Math.abs(d - 10) * 0.08, 12, 40))
        .join("") + [80, 95, 110].map((d, k) => lock(34 + k * 7, 52, d, 18, 10, 20)).join(""),
      main,
    ) +
    // The head: broad brow, short muzzle, open jaw.
    path(
      "M42 14C32 12 24 16 20 23L15 28C11 30 10 34 13 36L18 37L14 40L19 44C22 51 31 55 41 53" +
        "C50 51 56 43 56 33C56 23 50 16 42 14Z",
      main,
    ) +
    path(lock(44, 16, -70, 10, 7, 20), main) +
    path("M15 40Q9 42 11 47Q15 45 19 43Z", accent) +
    // Eye, brow line and the line of the muzzle, cut in the ground colour.
    path("M28 25Q32 22 36 25Q32 27 28 25Z", ground) +
    line("M26 21Q32 18 38 21M17 31Q22 32 26 30", ground, 1.5),

  /** A three-masted ship under full sail, heading right on the water:
   *  Manchester's Ship Canal, which made the inland city a port in 1894.
   *  Tall, stacked square sails and a raised stern, unlike Ipswich's single-masted ship. */
  galleon: ({ main, accent }) => {
    const sail = (x: number, y: number, w: number, h: number) =>
      `M${r1(x - w / 2)} ${r1(y)}Q${r1(x)} ${r1(y + 2)} ${r1(x + w / 2)} ${r1(y)}` +
      `Q${r1(x + w / 2 + 3)} ${r1(y + h / 2)} ${r1(x + w / 2)} ${r1(y + h)}` +
      `Q${r1(x)} ${r1(y + h + 3)} ${r1(x - w / 2)} ${r1(y + h)}Q${r1(x - w / 2 + 3)} ${r1(y + h / 2)} ${r1(x - w / 2)} ${r1(y)}Z`;
    const masts: [number, number, number][] = [
      [28, 14, 18],
      [52, 8, 22],
      [74, 16, 16],
    ];
    let sails = "";
    let tops = "";
    for (const [x, top, w] of masts) {
      const h = (60 - top - 6) / 3;
      for (let k = 0; k < 3; k++) sails += sail(x, top + 4 + k * h, w - k * -2 - 4, h - 2);
      tops += `M${x} ${top - 5}L${x + 8} ${top - 3}L${x} ${top - 1}Z`;
    }
    return (
      line(masts.map(([x, top]) => `M${x} ${top - 5}L${x} 62`).join("") + "M84 60L98 50", main, 2.2) +
      path(sails, accent) +
      line(sails, main, 1.4) +
      path(tops, main) +
      // Hull with a raised stern on the left and a rising bow.
      path("M6 60L18 60L18 52L30 54L30 60L90 58L82 74Q50 80 16 74Z", main) +
      waves(84, 2, main, 2.6, 7)
    );
  },

  /** A tiger prowling left, head low, tail lifted: Hull City's Tigers. The
   *  silhouette alone reads as a big cat; the stripes are cut in the accent. */
  tiger: ({ main, accent, ground }) =>
    path(
      // Tail, back, rump, hind legs, belly, forelegs, chest, head.
      "M84 50C90 46 92 38 90 30C89 26 92 24 95 26C98 34 96 46 90 54C88 57 87 58 86 60" +
        "L88 74L92 80L82 80L78 66L72 66L72 78L75 82L64 82L64 66L42 66L38 80L42 84L30 84L32 66" +
        "C28 66 26 64 25 62L24 78L28 82L17 82L18 62C14 60 12 58 10 56L4 56C2 54 2 50 4 48" +
        "L6 44C6 40 10 36 14 36L16 31L20 35L24 35L27 31L28 37C34 40 40 40 50 40C64 40 78 42 84 50Z",
      main,
    ) +
    // Stripes over the back and haunch, and across the face.
    path(
      lock(36, 40, 80, 13, 5, 10) +
        lock(46, 40, 85, 15, 5, 10) +
        lock(56, 40, 90, 15, 5, 8) +
        lock(66, 41, 95, 14, 5, 6) +
        lock(76, 44, 110, 13, 5, 0) +
        lock(83, 50, 130, 10, 4, 0) +
        lock(22, 37, 95, 8, 3, 0) +
        lock(28, 38, 100, 9, 3, 0),
      accent,
    ) +
    circle(13, 42, 1.6, ground) +
    path("M3 49L7 49L5 52Z", ground),

  /** A fighting cock standing tall, chest out, sickle tail feathers arching,
   *  with spurs on its legs: the spurred cockerels that tie Harry Hotspur's
   *  name to the club's bird. Standing on its own, with no ball. */
  cockerel: ({ main, accent, ground }) =>
    // Tail: sickle feathers arching up and over to the right.
    line("M60 48C64 26 80 14 92 20M62 52C70 34 86 28 94 38M62 56C74 46 88 46 90 58", main, 5.5) +
    path(lock(60, 60, 20, 22, 9, 30) + lock(58, 64, 40, 18, 8, 30), main) +
    // Body and breast.
    path("M30 32C24 40 24 54 32 62C40 70 56 70 64 60C68 54 66 46 60 42C52 46 42 44 38 36Z", main) +
    // Neck hackles and head.
    path(mane(32, 26, 4, 60, 200, 7, 14, 6, -20), main) +
    circle(30, 20, 8, main) +
    // Comb and wattle in the accent, beak in the main colour.
    path("M24 13C24 7 28 7 29 11C29 5 34 5 34 10C35 6 40 7 38 13Z", accent) +
    path("M23 25C21 31 25 33 27 28Z", accent) +
    path("M22 17L13 21L22 23Z", main) +
    circle(28, 18, 1.8, ground) +
    // Wing.
    path(lock(36, 46, 10, 26, 12, 20), ground) +
    path(lock(37, 46, 10, 23, 8, 20), main) +
    // Legs, toes and the spur on the back of each leg.
    path(limb(42, 66, 40, 86, 5, 3.5) + limb(52, 66, 54, 86, 5, 3.5), main) +
    path(claws(40, 87, 175, 7) + claws(54, 87, 175, 7), main) +
    path(lock(41, 78, 20, 6, 3, 0) + lock(53, 78, 20, 6, 3, 0), main),

  /** A phoenix rising from three tongues of flame, head turned to the left,
   *  wings raised high in broad pointed feathers. Coventry, rebuilt after the
   *  1940 Blitz. */
  phoenix: ({ main, accent, ground }) => {
    // One wing's feathers, fanning out from the shoulder, and the mirror image for the other wing.
    const wings = (x: number, y: number, degs: number[], lens: number[], w: number) => {
      let d = "";
      for (const [k, deg] of degs.entries()) {
        const len = lens[k] ?? 20;
        d += lock(x, y, deg, len, w, 12) + lock(100 - x, y, -180 - deg, len, w, -12);
      }
      return path(d, main);
    };
    return (
      path(
        lock(50, 70, 90, 28, 14, 0) + lock(44, 72, 112, 20, 10, -15) + lock(56, 72, 68, 20, 10, 15),
        accent,
      ) +
      wings(45, 50, [-172, -158, -144, -130, -116], [44, 48, 46, 38, 28], 9) +
      path("M50 28C56 30 58 40 58 50C58 62 54 70 50 76C46 70 42 62 42 50C42 40 44 30 50 28Z", main) +
      // Head, outlined in the ground colour so it stands clear of the wings.
      `<circle cx="47" cy="22" r="6.5" fill="${main}" stroke="${ground}" stroke-width="1.6"/>` +
      path(
        lock(48, 15.5, -100, 9, 3, -20) + lock(51, 16.5, -75, 8, 3, 10) + lock(45, 16, -125, 7, 3, -10),
        main,
      ) +
      path("M41 21L32 24L41 26Z", accent)
    );
  },

  /** The round lock-up on Everton Brow: a stone drum on a stepped plinth,
   *  a moulded cornice, a domed roof with ribs and a ball finial, two
   *  narrow windows and an arched door. */
  tower: ({ main, ground }) =>
    circle(50, 8, 3.2, main) +
    path("M49 10L51 10L51 16L49 16Z", main) +
    path("M34 36C34 24 41 16 50 16C59 16 66 24 66 36Z", main) +
    line("M42 35C42 26 45 19 50 17M58 35C58 26 55 19 50 17M50 17L50 35", ground, 1.3) +
    path("M30 36L70 36L70 39L68 41L32 41L30 39Z", main) +
    path("M34 41L66 41L66 84L34 84Z", main) +
    path("M31 84L69 84L69 89L31 89ZM27 89L73 89L73 95L27 95Z", main) +
    line("M34 53L66 53M34 65L66 65M34 75L66 75", ground, 1.1) +
    line("M39 41L39 84M61 41L61 84", ground, 0.8) +
    path("M44 84L44 74C44 68 56 68 56 74L56 84Z", ground) +
    path("M41 46L45 46L45 56C45 58 41 58 41 56ZM55 46L59 46L59 56C59 58 55 58 55 56Z", ground),

  /** A cormorant-like sea bird holding a sprig, standing with one wing raised
   *  in a solid sweep with three long flight feathers, long neck and hooked
   *  beak: Liverpool's port and its bird legend, drawn new. */
  "sea-bird": ({ main, accent, ground }) =>
    // The raised wing.
    path(
      "M50 46C54 32 62 20 78 9C77 15 76 19 74 23C81 19 86 18 91 18C86 25 81 29 77 32C84 32 89 34 93 37C83 43 74 47 63 51Z",
      main,
    ) +
    // Body and tail.
    path(
      "M36 46C38 40 46 38 52 42C60 48 64 58 64 66L82 90L72 91L60 80C52 82 44 78 40 72C36 64 34 54 36 46Z",
      main,
    ) +
    // Neck, head and hooked beak.
    path(
      "M38 50C33 42 31 34 32 26C33 18 38 13 44 13C49 13 51 18 49 22C47 26 43 28 42 33C41 39 43 44 46 47Z",
      main,
    ) +
    path("M34 18L17 21C14 22 14 25 17 25L33 24Z", main) +
    path(lock(44, 13, -110, 8, 3, -20), main) +
    circle(39, 18, 1.7, ground) +
    // Legs and webbed feet.
    line("M48 79L46 93M46 93L40 95M46 93L51 95M56 80L58 93M58 93L52 95M58 93L63 95", main, 2.6) +
    // The sprig in the beak.
    line("M16 25L8 33", accent, 2.2) +
    path(lock(12, 29, -140, 7, 3, 0) + lock(10, 31, 130, 7, 3, 0) + lock(8, 33, -170, 6, 3, 0), accent),

  /** A trident with barbed heads and a collar where the prongs meet the
   *  shaft: the Red Devils' pitchfork, without the devil. */
  trident: ({ main }) =>
    path("M48 30L52 30L52 92L48 92Z", main) +
    path("M44 92L56 92L54 96L46 96Z", main) +
    path("M44 28L56 28L56 34L44 34Z", main) +
    path("M50 4L57 20L52.5 18L52.5 30L47.5 30L47.5 18L43 20Z", main) +
    path("M27 33L45 33L45 31L30 31L30 19L34 21L28 8L22 21L26 19L26 33Z", main) +
    path("M73 33L55 33L55 31L70 31L70 19L66 21L72 8L78 21L74 19L74 33Z", main) +
    path("M26 33Q26 40 34 40L66 40Q74 40 74 33L70 33Q70 36 66 36L34 36Q30 36 30 33Z", main),

  /** A locomotive's driving wheel with a crank pin and a counterweight:
   *  Newton Heath LYR, the railway workers' team the club began as. */
  "rail-wheel": ({ main, ground }) => {
    let spokes = "";
    for (let k = 0; k < 14; k++) {
      const a = (k * 2 * Math.PI) / 14;
      spokes += `M${r1(50 + 9 * Math.cos(a))} ${r1(50 + 9 * Math.sin(a))}L${r1(50 + 37 * Math.cos(a))} ${r1(50 + 37 * Math.sin(a))}`;
    }
    return (
      `<circle cx="50" cy="50" r="40" fill="none" stroke="${main}" stroke-width="6"/>` +
      `<circle cx="50" cy="50" r="35.5" fill="none" stroke="${main}" stroke-width="1.5"/>` +
      line(spokes, main, 2.6) +
      path("M74.7 69.2A31 31 0 0 1 25.3 69.2L36 60.4A17 17 0 0 0 64 60.4Z", main) +
      circle(50, 50, 10, main) +
      circle(50, 50, 4, ground) +
      circle(50, 28, 4, main) +
      circle(50, 28, 1.6, ground)
    );
  },
} satisfies Record<string, Draw>;

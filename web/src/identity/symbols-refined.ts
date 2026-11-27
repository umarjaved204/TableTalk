// The second round of symbol drawings (the refinement pass after the first
// gallery review, 27 Nov 2026): Chelsea's lion's head, City's ship, and the
// redrawn phoenix, tower, trident and wheel, built from flame-shaped locks so
// they carry the same weight of line as the rest. The lion rampant, tiger,
// cockerel and sea bird of this round were redrawn again as smooth
// silhouettes (symbols-silhouettes.ts). Same rules as symbols.ts: original
// drawings in a 100 x 100 box, coloured by role (main, accent, ground).
import type { Ink } from "./symbols.ts";

type Draw = (ink: Ink) => string;

const r1 = (v: number) => String(Math.round(v * 10) / 10);
const path = (d: string, fill: string) => `<path d="${d}" fill="${fill}"/>`;
const line = (d: string, stroke: string, width: number, cap = "round") =>
  `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="${cap}" stroke-linejoin="round"/>`;
const circle = (cx: number, cy: number, r: number, fill: string) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;

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

function waves(y0: number, rows: number, stroke: string, width = 3, gap = 8, x0 = 6, x1 = 94): string {
  let d = "";
  for (let k = 0; k < rows; k++) {
    const y = y0 + k * gap;
    d += `M${x0} ${y}`;
    for (let x = x0; x < x1; x += 14) d += `q3.5 -4 7 0t7 0`;
  }
  return line(d, stroke, width);
}

export const REFINED = {
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

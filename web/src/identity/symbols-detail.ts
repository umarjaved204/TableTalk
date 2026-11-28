// Detailed, club-specific illustrations (28 Nov 2026), drawn for crests
// whose owner-supplied design references set a higher illustration standard
// than the shared symbols: Leverkusen's lions, Köln's goat, Union's bear,
// Leipzig's bulls and Frankfurt's eagle. Original drawings in a 100 x 100
// box, coloured by role like every other symbol (main, accent, ground);
// none is traced from a reference or an official badge.
//
// Each animal is built from overlapping parts, back to front (far limbs,
// body, near limbs, head), so that a crest can wrap the symbol in a stroked
// group (paint-order="stroke") and get an illustrated look: an outline round
// the whole animal and contour lines where one part overlaps another.
import { outline, type OutlinePoint } from "./outline.ts";
import type { Ink } from "./symbols.ts";

type Draw = (ink: Ink) => string;

const r1 = (v: number) => String(Math.round(v * 10) / 10);
/** Path data with every number rounded to a whole unit. These drawings are
 *  placed at about half size or less, so a whole unit here is half a crest
 *  unit at most: under half a pixel even at the largest 120 px display, for
 *  a file a quarter smaller. Arc flags (0 and 1) are whole already. */
const coarse = (d: string) => d.replace(/-?\d+\.\d+/g, (n) => String(Math.round(Number(n))));
const path = (d: string, fill: string) => `<path d="${coarse(d)}" fill="${fill}"/>`;
const line = (d: string, stroke: string, width: number) =>
  `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
const circle = (cx: number, cy: number, r: number, fill: string) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;

/**
 * A tapered limb along a centre line: [x, y, width] points, from the root to
 * the tip, smoothed into one closed outline (the tip and root rounded).
 */
type Spine = readonly [number, number, number];

function limb(spine: readonly [Spine, Spine, ...Spine[]]): string {
  const left: OutlinePoint[] = [];
  const right: OutlinePoint[] = [];
  spine.forEach(([x, y, w], k) => {
    const [px, py] = spine[Math.max(0, k - 1)] ?? spine[0];
    const [nx, ny] = spine[Math.min(spine.length - 1, k + 1)] ?? spine[0];
    const len = Math.hypot(nx - px, ny - py) || 1;
    const [ox, oy] = [(-(ny - py) / len) * (w / 2), ((nx - px) / len) * (w / 2)];
    left.push([x + ox, y + oy]);
    right.unshift([x - ox, y - oy]);
  });
  const [tx, ty, tw] = spine.at(-1) ?? spine[1];
  const [sx, sy] = spine.at(-2) ?? spine[0];
  const tl = Math.hypot(tx - sx, ty - sy) || 1;
  const tip: OutlinePoint = [tx + ((tx - sx) / tl) * (tw / 2) * 0.9, ty + ((ty - sy) / tl) * (tw / 2) * 0.9];
  return outline([...left, tip, ...right]);
}

/** Toes at the end of a paw: small round pads fanned across the tip. */
function toes(x: number, y: number, deg: number, r: number, n = 3): string {
  let d = "";
  for (let k = 0; k < n; k++) {
    const a = ((deg + (k - (n - 1) / 2) * 32) * Math.PI) / 180;
    const cx = x + Math.cos(a) * r * 1.2;
    const cy = y + Math.sin(a) * r * 1.2;
    d += `M${r1(cx - r)} ${r1(cy)}a${r} ${r} 0 1 0 ${r1(2 * r)} 0a${r} ${r} 0 1 0 ${r1(-2 * r)} 0`;
  }
  return d;
}

/** A mane of separate flame-shaped locks round (cx, cy), from angle `from`
 *  to `to` (degrees, 0 = right, 90 = down), each a teardrop whose tip sweeps
 *  back by `sweep` degrees. Separate paths, so an outlined crest draws each
 *  lock's edge. Listed outermost first. */
function mane(
  cx: number,
  cy: number,
  r0: number,
  r1v: number,
  from: number,
  to: number,
  n: number,
  sweep: number,
  fill: string,
): string {
  const at = (deg: number, r: number) => {
    const a = (deg * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  };
  const step = (to - from) / (n - 1);
  let out = "";
  for (let k = 0; k < n; k++) {
    const deg = from + step * k;
    const half = step * 0.75;
    const len = r1v * (0.88 + 0.12 * Math.sin(k * 2.1));
    const [ax, ay] = at(deg - half, r0);
    const [bx, by] = at(deg + half, r0);
    const [tx, ty] = at(deg + sweep, len);
    const [c1x, c1y] = at(deg - half * 0.6, (r0 + len) * 0.62);
    const [c2x, c2y] = at(deg + half * 1.4, (r0 + len) * 0.5);
    out += path(
      `M${r1(ax)} ${r1(ay)}Q${r1(c1x)} ${r1(c1y)} ${r1(tx)} ${r1(ty)}Q${r1(c2x)} ${r1(c2y)} ${r1(bx)} ${r1(by)}Z`,
      fill,
    );
  }
  return out;
}

// --- Leverkusen: a heraldic lion rampant, facing left -----------------------

function lionSupporter({ main, accent, ground }: Ink): string {
  const far =
    limb([
      [52, 70, 13],
      [42, 78, 10],
      [31, 82, 8],
    ]) +
    toes(30, 82, 180, 2.4) +
    limb([
      [38, 50, 10],
      [26, 54, 8],
      [14, 52, 7],
    ]) +
    toes(13, 52, 185, 2.2);
  const body = limb([
    [33, 34, 21],
    [42, 52, 20],
    [56, 68, 21],
  ]);
  const near =
    limb([
      [58, 66, 17],
      [63, 80, 12],
      [60, 90, 8],
      [52, 94, 7.5],
    ]) +
    toes(50, 94, 180, 2.5) +
    limb([
      [36, 40, 12],
      [24, 36, 9],
      [12, 31, 8],
    ]) +
    toes(11, 31, 200, 2.4);
  const head =
    "M30 10C24 9 18 12 14 16L8 19L11 23L16 24L10 27L13 30L20 30L17 34C24 36 32 34 37 28C41 20 37 11 30 10Z";
  return (
    path(
      limb([
        [60, 70, 5.5],
        [76, 77, 5],
        [89, 67, 4.5],
        [87, 50, 4],
        [83, 38, 3.5],
      ]),
      main,
    ) +
    path("M83 35C77 29 79 19 87 15C86 21 91 22 95 17C96 25 92 32 83 35Z", main) +
    path(far, main) +
    path(body, main) +
    path(near, main) +
    mane(34, 25, 6, 25, -140, 135, 8, 26, main) +
    mane(33, 23, 5, 18, -115, 110, 5, 22, main) +
    path(head, main) +
    path("M11 27L19 27L16 31Z", accent) +
    path("M10 23L16 24L11 26Z", ground) +
    circle(24, 17, 1.6, ground) +
    line("M19 14L27 13", ground, 1.1)
  );
}

// --- Union Berlin: Berlin's bear, upright, facing left -----------------------

function bearHeraldic({ main, accent, ground }: Ink): string {
  const farArm = limb([
    [32, 48, 11],
    [20, 52, 9],
    [8, 56, 8],
  ]);
  const farLeg = limb([
    [44, 74, 15],
    [40, 86, 11],
    [36, 95, 10],
  ]);
  const body = "M28 30C34 20 48 22 56 34C64 46 68 60 64 72C60 80 48 82 40 78C32 72 28 60 28 48Z";
  const nearLeg = limb([
    [58, 70, 17],
    [62, 84, 12],
    [66, 95, 11],
  ]);
  const nearArm = limb([
    [34, 36, 12],
    [22, 36, 9],
    [9, 37, 8],
  ]);
  const head =
    "M38 22C36 14 30 10 24 12L20 8L17 13C13 15 10 19 8 23L3 26L6 30L12 30L9 33C14 35 22 35 30 33C36 31 40 27 38 22Z";
  return (
    path(farArm + farLeg, main) +
    path(body, main) +
    path("M64 64L72 62L67 70Z", main) +
    path(nearLeg + nearArm, main) +
    path(head, main) +
    // Tongue, claws (red), eye and ear.
    path("M8 30C5 32 3 35 5 37C8 36 10 34 12 31Z", accent) +
    line(
      "M5 34L1 33M5 37L1 38M6 40L2 42M4 54L0 53M4 57L0 58M5 60L1 62M32 98L30 101M37 98L36 101M42 98L42 101M60 98L59 101M66 98L66 101M72 98L73 101",
      accent,
      1.5,
    ) +
    circle(18, 18, 1.6, ground) +
    path("M21 12L24 10L24 15Z", ground)
  );
}

// --- RB Leipzig: a charging bull, facing right -------------------------------

function bullCharging({ main, accent, ground }: Ink): string {
  const tail = limb([
    [21, 44, 3.4],
    [16, 32, 3],
    [16, 20, 2.6],
  ]);
  const farHind = limb([
    [26, 48, 10],
    [14, 52, 7],
    [2, 54, 5.5],
  ]);
  const farFore = limb([
    [66, 56, 9],
    [68, 66, 6],
    [78, 70, 5.5],
  ]);
  const body =
    "M20 46C22 38 30 34 40 34C52 34 60 26 72 26C82 26 86 34 86 42C86 52 80 58 72 60C62 62 54 58 46 58C38 58 30 58 24 54C20 52 19 50 20 46Z";
  const nearHind = limb([
    [30, 52, 12],
    [18, 60, 8],
    [6, 66, 6],
  ]);
  const nearFore = limb([
    [74, 56, 10],
    [80, 66, 7],
    [90, 66, 6],
  ]);
  const head = "M78 34C84 30 90 32 94 38L100 54C101 58 98 61 94 60L88 58C84 52 80 46 76 44Z";
  return (
    path(tail, main) +
    path("M16 22C10 19 9 12 13 7C15 13 21 13 21 19Z", main) +
    path(farHind + farFore, main) +
    path(body, main) +
    path(nearHind + nearFore, main) +
    path("M82 34C84 26 88 22 94 20C90 24 88 30 88 34Z", main) +
    path(head, main) +
    path("M86 36C90 28 96 24 104 24C98 28 94 32 92 38Z", main) +
    path("M80 38C74 36 70 38 68 42C72 42 76 42 80 42Z", main) +
    line("M62 30C70 38 70 50 64 58M36 38C32 46 33 52 37 56", ground, 1.3) +
    circle(88, 41, 1.6, ground) +
    path("M97 54L101 56L98 59Z", accent)
  );
}

// --- Frankfurt: a crowned eagle displayed, head turned left ------------------

/** One feather: a blade from a base point, tapering to a curved point. */
function feather(x: number, y: number, deg: number, len: number, w: number, curl: number): string {
  const a = (deg * Math.PI) / 180;
  const [dx, dy] = [Math.cos(a), Math.sin(a)];
  const [nx, ny] = [-dy, dx];
  const tip = [x + dx * len + nx * curl, y + dy * len + ny * curl] as const;
  const mid = [x + dx * len * 0.55, y + dy * len * 0.55] as const;
  return (
    `M${r1(x + (nx * w) / 2)} ${r1(y + (ny * w) / 2)}` +
    `Q${r1(mid[0] + (nx * w) / 2)} ${r1(mid[1] + (ny * w) / 2)} ${r1(tip[0])} ${r1(tip[1])}` +
    `Q${r1(mid[0] - (nx * w) / 3)} ${r1(mid[1] - (ny * w) / 3)} ${r1(x - (nx * w) / 2)} ${r1(y - (ny * w) / 2)}Z`
  );
}

/** A wing (viewer's right, or mirrored for the left): a strong arm rising
 *  from the shoulder, and seven long feathers fanning out and down along it,
 *  each its own path so mirroring never cuts holes. */
function wing(flip: boolean, fill: string): string {
  const X = (x: number) => (flip ? 100 - x : x);
  const bases: [number, number, number, number][] = [
    [58, 46, 84, 20],
    [63, 40, 72, 24],
    [69, 34, 60, 27],
    [75, 28, 48, 30],
    [81, 23, 37, 31],
    [87, 19, 27, 29],
    [92, 16, 16, 24],
  ];
  const parts = bases.map(([x, y, deg, len]) =>
    path(feather(X(x), y, flip ? 180 - deg : deg, len, 8, flip ? 3 : -3), fill),
  );
  const coverts =
    `M${X(50)} 54Q${X(60)} 26 ${X(96)} 10L${X(98)} 18Q${X(91)} 21 ${X(89)} 27Q${X(83)} 27 ${X(81)} 33` +
    `Q${X(75)} 33 ${X(73)} 39Q${X(67)} 39 ${X(65)} 45Q${X(59)} 47 ${X(59)} 56Z`;
  return parts.join("") + path(coverts, fill);
}

function eagleCrowned({ main, accent, ground }: Ink): string {
  const tail = [72, 81, 90, 99, 108].map((deg) => path(feather(50, 70, deg, 22, 7, 0), main)).join("");
  return (
    wing(false, main) +
    wing(true, main) +
    tail +
    `<ellipse cx="50" cy="52" rx="11" ry="18" fill="${main}"/>` +
    // Neck and head turned left, with a hooked beak.
    path("M44 40C41 32 42 25 46 21C50 17 56 19 57 25C58 31 56 37 56 41Z", main) +
    path("M46 22C42 20 37 21 34 24C37 25 40 25 42 27C40 28 38 30 38 32C42 30 46 29 48 27Z", main) +
    circle(49, 24, 1.6, ground) +
    // Crown above the head.
    path("M43 15L45 8L48 12L50 6L52 12L55 8L57 15Z", main) +
    // Legs and spread talons.
    path(
      limb([
        [44, 66, 7],
        [37, 75, 5],
      ]) +
        limb([
          [56, 66, 7],
          [63, 75, 5],
        ]),
      main,
    ) +
    line("M37 76L30 75M37 76L31 81M37 76L37 84M63 76L70 75M63 76L69 81M63 76L63 84", main, 2.2) +
    // The breast shield, ready for a letter.
    path("M42.5 45L57.5 45L57.5 55C57.5 61 54 64.5 50 66.5C46 64.5 42.5 61 42.5 55Z", ground) +
    path("M44.5 47L55.5 47L55.5 55C55.5 59.5 53 62.5 50 64.2C47 62.5 44.5 59.5 44.5 55Z", accent)
  );
}

// --- 1. FC Köln: the billy goat leaping onto the badge, facing left ---------

function goatLeaping({ main, accent }: Ink): string {
  const farFore = limb([
    [34, 52, 8],
    [28, 62, 6],
    [22, 70, 5],
  ]);
  const farHind = limb([
    [80, 58, 11],
    [86, 72, 7],
    [90, 86, 5],
  ]);
  const body =
    "M30 38C38 32 54 34 68 38C80 41 90 46 90 56C90 64 80 66 70 64C56 61 42 60 34 56C28 52 26 44 30 38Z";
  const nearFore = limb([
    [40, 54, 9],
    [36, 64, 7],
    [34, 76, 5.5],
  ]);
  const nearHind = limb([
    [84, 56, 13],
    [92, 70, 8],
    [97, 88, 5.5],
  ]);
  const neck = "M26 20C32 18 40 26 42 34C44 42 38 48 30 46C24 44 24 34 26 20Z";
  const head =
    "M34 18C30 12 24 12 20 16C17 20 14 26 12 30C12 34 16 36 20 34C24 32 28 30 30 28C34 26 36 22 34 18Z";
  return (
    path(farFore + farHind, main) +
    path(body, main) +
    path("M88 46L94 38L92 50Z", main) +
    path(nearFore + nearHind, main) +
    path(neck, main) +
    // Beard hanging from the chin.
    path("M16 34C16 40 18 46 22 48C22 42 22 38 22 34Z", main) +
    path(head, main) +
    // Two long ridged horns sweeping back and up, and an ear.
    path("M30 14C28 4 38 -2 52 1C46 2 38 6 35 15Z", main) +
    path("M33 15C34 6 44 0 58 4C52 5 44 9 39 17Z", main) +
    path("M34 21L44 21L37 25Z", main) +
    line("M31 9L35 10M34 5L38 7M39 2L41 5M44 1L45 4", accent, 0.9) +
    circle(24, 20, 1.5, accent) +
    line("M13 29L15 29M44 38C50 44 52 50 50 56M70 40C68 48 70 56 74 60M30 46C32 50 34 52 36 54", accent, 1) +
    // Hooves.
    path(
      "M32 79L37 78L37 82L32 82ZM20 72L25 70L25 74L20 75ZM95 91L100 89L100 93L95 94ZM88 88L93 87L93 91L88 91Z",
      accent,
    )
  );
}

export const DETAIL_SYMBOLS = {
  /** Leverkusen's supporter: a heraldic lion rampant facing left. */
  "lion-supporter": lionSupporter,
  /** Union's Berlin bear, upright, facing left, red tongue and claws. */
  "bear-heraldic": bearHeraldic,
  /** A charging bull facing right, head down and horns forward. */
  "bull-charging": bullCharging,
  /** A crowned eagle displayed with a breast shield. */
  "eagle-crowned": eagleCrowned,
  /** A billy goat leaping, facing left. */
  "goat-leaping": goatLeaping,
} satisfies Record<string, Draw>;

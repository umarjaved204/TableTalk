// Competition-inspired concepts for the five league marks (27 Nov 2026), for
// comparison with the cultural marks in leagues.ts. Each one draws on what
// supporters already connect with the competition (the Premier League's lion,
// La Liga's initials and circle, the Bundesliga's footballer, Serie A's
// letter A, Ligue 1's L1) in a new drawing with its own silhouette,
// typography and composition. None is traced from, or measured off, an
// official logo, but each is meant to be recognisable, so each carries a
// resemblance note: drawing a familiar idea anew is not permission to use it.
import type { Design } from "./crest.ts";
import { lineText } from "./lettering.ts";
import { outline, type OutlinePoint } from "./outline.ts";
import type { Resemblance } from "./types.ts";

export interface LeagueConcept {
  title: string;
  /** "competition": built on the competition's own recognisable idea;
   *  "cultural": built on the country's football culture;
   *  "brand": a modern brand mark in the competition's design language. */
  approach: "competition" | "cultural" | "brand";
  inspiration: string;
  looks: string;
  resemblance: { level: Resemblance; note: string };
  mark: Design;
}

const WHITE = "#fff";
const KEYLINE = `fill="${WHITE}" stroke="${WHITE}" stroke-width="5" stroke-linejoin="round"`;
const r1 = (v: number) => String(Math.round(v * 10) / 10);

function hexagon(r: number): string {
  const p: string[] = [];
  for (let k = 0; k < 6; k++) {
    const a = ((-90 + k * 60) * Math.PI) / 180;
    p.push(`${r1(60 + r * Math.cos(a))} ${r1(60 + r * Math.sin(a))}`);
  }
  return `M${p.join("L")}Z`;
}

/** Premier League: an original heraldic lion's head in profile, facing left,
 *  white on deep plum: a broad brow and short muzzle, the mouth slightly open,
 *  a mane of rounded scalloped lobes, and the neck cut off straight (couped).
 *  Unlike Chelsea's head, which has long flowing locks and a ragged neck, and
 *  unlike the competition's crowned, front-facing lion. Red line for England below. */
function premierLeagueLion(clip: string): string[] {
  const plum = "#2b1442";
  const tile = "M28 6L92 6Q114 6 114 28L114 92Q114 114 92 114L28 114Q6 114 6 92L6 28Q6 6 28 6Z";
  // The head and mane as one outline: the face on the left, then the mane's
  // rounded lobes sweeping back and down, then the straight-cut neck.
  const head: OutlinePoint[] = [
    [15, 52, 1],
    [19, 43],
    [26, 33],
    [36, 26],
    [42, 15],
    [53, 17],
    [62, 9],
    [70, 20],
    [83, 17],
    [84, 32],
    [96, 38],
    [89, 50],
    [98, 60],
    [86, 66],
    [90, 80],
    [76, 78],
    [72, 98, 1],
    [44, 98, 1],
    [43, 87],
    [37, 79],
    [30, 75],
    [25, 69, 1],
    [30, 65, 1],
    [19, 62],
    [16, 58],
  ];
  return [
    `<defs><clipPath id="${clip}"><path d="${tile}"/></clipPath></defs>`,
    `<path d="${tile}" ${KEYLINE}/>`,
    `<path d="${tile}" fill="${plum}"/>`,
    `<path d="${outline(head)}" fill="${WHITE}"/>`,
    `<path d="M40 30C47 42 48 60 42 76M56 24C63 36 66 52 62 66M70 26C76 38 80 52 78 66" fill="none" stroke="${plum}" stroke-width="2" stroke-linecap="round"/>`,
    `<path d="M24 35Q31 30 38 35M18 58Q23 61 28 59" fill="none" stroke="${plum}" stroke-width="1.8" stroke-linecap="round"/>`,
    `<path d="M27 40Q32 37 36 41Q32 43 27 40Z" fill="${plum}"/>`,
    `<path d="M17 53L22 54" stroke="${plum}" stroke-width="2" stroke-linecap="round"/>`,
    `<path d="M24 104L96 104L96 108L24 108Z" fill="#e4002b"/>`,
  ];
}

/** La Liga: interlocking L L initials in white over sun and shade, with a
 *  coral sweep round the disc for the circle and movement of a ball. */
function laLigaInitials(clip: string): string[] {
  const red = "#a3121f";
  const coral = "#ff6f59";
  const gold = "#ffc400";
  const disc = "M4 60A56 56 0 1 1 116 60A56 56 0 1 1 4 60Z";
  const first = lineText("L", { x: 48, baseline: 80, cap: 50, tracking: 0 }).d;
  const second = lineText("L", { x: 70, baseline: 92, cap: 50, tracking: 0 }).d;
  const letter = (d: string) =>
    `<path d="${d}" fill="${WHITE}" stroke="${red}" stroke-width="4" stroke-linejoin="round" paint-order="stroke"/>`;
  return [
    `<defs><clipPath id="${clip}"><path d="${disc}"/></clipPath></defs>`,
    `<path d="${disc}" ${KEYLINE}/>`,
    `<path d="${disc}" fill="${red}"/>`,
    `<g clip-path="url(#${clip})"><path d="M0 0L120 0L120 120Z" fill="${gold}"/></g>`,
    `<path d="M14 84A52 52 0 0 0 98 98" fill="none" stroke="${coral}" stroke-width="7" stroke-linecap="round"/>`,
    `<path d="M22 32A46 46 0 0 1 40 17" fill="none" stroke="${coral}" stroke-width="5" stroke-linecap="round"/>`,
    letter(first),
    letter(second),
  ];
}

/** Bundesliga: an upright footballer striking a volley, the kicking leg
 *  swung up in front at hip height, arms out for balance, the ball just
 *  leaving the foot. White on a black diamond, with red and gold below. */
function bundesligaPlayer(clip: string): string[] {
  const black = "#151515";
  const diamond = "M60 4L116 60L60 116L4 60Z";
  const limb = (d: string, w: number) =>
    `<path d="${d}" fill="none" stroke="${WHITE}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  return [
    `<defs><clipPath id="${clip}"><path d="${diamond}"/></clipPath></defs>`,
    `<path d="${diamond}" ${KEYLINE}/>`,
    `<path d="${diamond}" fill="${black}"/>`,
    `<g clip-path="url(#${clip})"><path d="M0 92L120 92L120 101L0 101Z" fill="#dd0000"/><path d="M0 101L120 101L120 120L0 120Z" fill="#ffce00"/></g>`,
    // Head, torso leaning back.
    `<circle cx="66" cy="27" r="7" fill="${WHITE}"/>`,
    limb("M64 36L60 58", 11),
    // Standing leg, slightly bent, and the kicking leg swung up in front.
    limb("M60 58L64 72L62 86", 8),
    limb("M60 58L46 62L32 56", 8),
    // Arms out for balance.
    limb("M64 40L78 36L86 42", 6),
    limb("M62 41L50 44L44 38", 6),
    // The ball, just off the foot.
    `<circle cx="22" cy="50" r="7.5" fill="#ffce00" stroke="${black}" stroke-width="1.5"/>`,
    `<path d="M22 45.5L26 48.5L24.5 53L19.5 53L18 48.5Z" fill="${black}"/>`,
  ];
}

/** Serie A: a tall classical letter A, cut like an inscription on a Roman
 *  monument (a thin left stroke, a heavy right stroke, flared feet), in white
 *  on a deep Italian blue shield with a gold rim, its crossbar in the tricolour. */
function serieALetter(clip: string): string[] {
  const blue = "#0b3c8c";
  const gold = "#e0b84c";
  const shieldD = "M12 6L108 6L108 54C108 86 86 104 60 116C34 104 12 86 12 54Z";
  const inner = "M18 12L102 12L102 54C102 82 82 98 60 109C38 98 18 82 18 54Z";
  // The A: outer outline with the crossbar's underside, and the counter (hole) above the crossbar.
  const a =
    "M55 22L65 22L84 84L89 86L89 90L70 90L70 86L74 85L70 72L49 72L45 85L50 86L50 90L33 90L33 86L37 85Z" +
    "M59.5 36L67 62L51 62Z";
  return [
    `<defs><clipPath id="${clip}"><path d="${inner}"/></clipPath><clipPath id="${clip}-a"><path d="${a}" fill-rule="evenodd"/></clipPath></defs>`,
    `<path d="${shieldD}" ${KEYLINE}/>`,
    `<path d="${shieldD}" fill="${gold}"/>`,
    `<path d="${inner}" fill="${blue}"/>`,
    `<path d="${a}" fill="${WHITE}" fill-rule="evenodd"/>`,
    `<g clip-path="url(#${clip}-a)"><path d="M40 62L53 62L53 72L40 72Z" fill="#009246"/><path d="M66 62L80 62L80 72L66 72Z" fill="#ce2b37"/></g>`,
  ];
}

/** Ligue 1: L1 in white inside the hexagon, over a line of blue, white and red. */
function ligue1Initials(clip: string): string[] {
  const navy = "#0d2a5c";
  const outer = hexagon(57);
  const inner = hexagon(46);
  const text = lineText("L1", { x: 60, baseline: 74, cap: 40, tracking: 0.06 }).d;
  return [
    `<defs><clipPath id="${clip}"><path d="${inner}"/></clipPath></defs>`,
    `<path d="${outer}" ${KEYLINE}/>`,
    `<path d="${outer}" fill="${navy}"/>`,
    `<path d="${inner}" fill="none" stroke="${WHITE}" stroke-width="2.5"/>`,
    `<path d="${text}" fill="${WHITE}"/>`,
    `<path d="M38 82h14v5h-14Z" fill="#2f6bdc"/><path d="M53 82h14v5h-14Z" fill="${WHITE}"/><path d="M68 82h14v5h-14Z" fill="#e4002b"/>`,
  ];
}

/** The competition-inspired concept for each league, by league id. */
export const COMPETITION_CONCEPTS: Readonly<Record<string, LeagueConcept>> = {
  premier_league: {
    title: "Lion's head",
    approach: "competition",
    inspiration:
      "The lion supporters already connect with the Premier League, drawn new as a heraldic lion's head in profile with a scalloped mane and a clean-cut neck, on the deep plum, with a red line for England.",
    looks:
      "A deep plum rounded tile. A white lion's head in profile faces left: broad brow, short muzzle, mouth slightly open, a plum eye, and a mane of rounded lobes round the back of the head, two fine plum lines marking the face and the mane. The neck is cut off straight. A red line runs along the bottom.",
    resemblance: {
      level: "high",
      note: "A lion on purple is the competition's best-known idea. This head is in profile with no crown, a scalloped mane and a straight-cut neck (the official lion is crowned and faces the viewer), and it differs from Chelsea's flowing-maned, ragged-necked head, but supporters will connect it with the Premier League. The floodlight pylon mark stays as the cultural option.",
    },
    mark: (k) => premierLeagueLion(k.clip),
  },
  la_liga: {
    title: "LL over sun and shade",
    approach: "competition",
    inspiration:
      "The competition's initials, drawn as two interlocking white Ls, over the sol y sombra disc, with a coral sweep for the circle and movement that run through the league's identity. Red, coral and gold.",
    looks:
      "A disc split diagonally, gold over the upper right and deep red below. Two large interlocking white letters L, outlined in red, fill the middle; a coral arc sweeps round the lower left edge and a short one round the upper left.",
    resemblance: {
      level: "medium",
      note: "Initials and a circle are general ideas, but together they point at the competition. The letters are Barlow Condensed, set as interlocking Ls; nothing is taken from the league's own lettering or ball symbol.",
    },
    mark: (k) => laLigaInitials(k.clip),
  },
  bundesliga: {
    title: "Volley",
    approach: "competition",
    inspiration:
      "A footballer in action, the idea supporters connect with the Bundesliga's mark, here upright and in a different pose: striking a volley with the kicking leg swung up in front, arms out for balance, on a black diamond with red and gold below.",
    looks:
      "A black diamond. A white footballer stands upright in the middle, leaning back slightly, the kicking leg swung up in front at hip height and arms spread for balance; a gold ball leaves the foot on the left. Red and gold bands cross the lower corner.",
    resemblance: {
      level: "high",
      note: "A white player silhouette is the official mark's idea, though there the player strikes a ball at their feet on a red rectangle. The pose (a volley at hip height), shape and colours here are different, but the idea is the same. The oak leaf mark stays as the cultural option.",
    },
    mark: (k) => bundesligaPlayer(k.clip),
  },
  serie_a: {
    title: "Inscribed A",
    approach: "competition",
    inspiration:
      "The letter A that stands for Serie A, cut like an inscription on a Roman monument, with the tricolour in its crossbar and the gold-rimmed shield of the scudetto tradition, in a deep Italian blue.",
    looks:
      "A shield with a gold rim and a deep blue field. A tall white classical letter A stands in the middle, with a thin left stroke, a heavy right stroke and flared feet; its crossbar shows green, white and red.",
    resemblance: {
      level: "medium",
      note: "A letter A is what the competition's mark is built on, but this is a classical serif A on a shield, not a geometric one. The tricolour shield with a star stays as the cultural option.",
    },
    mark: (k) => serieALetter(k.clip),
  },
  ligue_1: {
    title: "L1 in the hexagon",
    approach: "competition",
    inspiration:
      "The competition's short name, L1, set plainly in Barlow Condensed inside l'Hexagone, over a line of blue, white and red.",
    looks:
      "A navy hexagon with a white inner outline. Large white letters L1 stand in the middle, over a short bar of blue, white and red.",
    resemblance: {
      level: "medium",
      note: "L1 is the competition's own short name. The letters here are plain Barlow Condensed, side by side, with no shared strokes or cut-out shapes, unlike the official monogram.",
    },
    mark: (k) => ligue1Initials(k.clip),
  },
};

// Modern brand-inspired concepts (28 Nov 2026): a third direction, treating
// each league mark as a modern brand mark rather than a crest, built on the
// competition's design language (its colour, its kind of symbol, its use of
// lettering) without its geometry. Standalone marks with no container, a
// white keyline so each holds on dark themes. Serie A is not part of this
// round.

/** Premier League: a standalone lion's head, front on, in deep purple: a
 *  full mane of pointed locks (longer below, like a beard), a broad brow
 *  narrowing to the muzzle, and the face drawn in white angular cuts (brow,
 *  eyes, nose, mouth). Symmetrical and uncrowned. No container. */
function premierLeagueBrand(): string[] {
  const purple = "#3d185c";
  // The mane: locks round the right side from the top to the chin, each with
  // its point swept downwards and outwards like a falling mane, then mirrored.
  const right: OutlinePoint[] = [];
  for (let k = 0; k < 6; k++) {
    const base = -90 + k * 30;
    const at = (deg: number, r: number) => {
      const a = (deg * Math.PI) / 180;
      return [60 + r * Math.cos(a), 62 + r * 1.04 * Math.sin(a)] as const;
    };
    const [vx, vy] = at(base, 41);
    const [tx, ty] = at(base + 22, 58);
    right.push([vx, vy], [tx, ty, 1]);
  }
  const mane: OutlinePoint[] = [
    ...right,
    [60, 116, 1],
    ...right
      .slice()
      .reverse()
      .map((p): OutlinePoint => (p.length === 3 ? [120 - p[0], p[1], 1] : [120 - p[0], p[1]])),
  ];
  const d = outline(mane);
  return [
    // One path for the mane: the white keyline is its stroke, painted behind the fill.
    `<path d="${d}" fill="${purple}" stroke="${WHITE}" stroke-width="6" stroke-linejoin="round" paint-order="stroke"/>`,
    // The face, a little larger than the mane's centre, so it holds its own.
    `<g transform="translate(60 72) scale(1.14) translate(-60 -72)">`,
    // An M-shaped brow and slanted eyes.
    `<path d="M34 44L54 51L60 46L66 51L86 44" fill="none" stroke="${WHITE}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<path d="M39 56L53 58L45 63Z M81 56L67 58L75 63Z" fill="${WHITE}"/>`,
    // The bridge of the nose widening to a broad triangular nose.
    `<path d="M57 54L63 54L66 72L54 72Z M47 72L73 72L60 83Z" fill="${WHITE}"/>`,
    // Two rounded whisker pads either side of the mouth, and the chin.
    `<path d="M60 83L60 88" stroke="${WHITE}" stroke-width="2.4" stroke-linecap="round"/>`,
    `<path d="M60 88C56 95 44 96 42 88C42 84 46 82 50 84M60 88C64 95 76 96 78 88C78 84 74 82 70 84" fill="none" stroke="${WHITE}" stroke-width="2.6" stroke-linecap="round"/>`,
    `<path d="M54 99L66 99L60 105Z" fill="${WHITE}"/>`,
    `</g>`,
  ];
}

/** Bundesliga: a footballer striking a volley, drawn as one athletic
 *  silhouette in white on a red disc: torso leaning back, the kicking leg
 *  driven forward at hip height to a white ball, the standing leg bent, the
 *  back arm raised and the front arm out for balance. */
function bundesligaBrand(): string[] {
  const red = "#d20515";
  const player: OutlinePoint[] = [
    [79, 29],
    [85, 31],
    [96, 22],
    [102, 13, 1],
    [106, 17],
    [99, 29],
    [88, 39],
    [85, 48],
    [82, 60],
    [86, 68],
    [93, 78],
    [90, 90],
    [87, 99],
    [86, 103, 1],
    [72, 103, 1],
    [73, 99],
    [80, 95],
    [83, 82],
    [77, 72],
    [70, 68],
    [56, 68],
    [42, 64],
    [30, 60],
    [20, 59],
    [15, 57, 1],
    [18, 53],
    [30, 53],
    [41, 56],
    [55, 58],
    [66, 56],
    [66, 48],
    [64, 44],
    [54, 48],
    [43, 44, 1],
    [46, 39],
    [56, 40],
    [66, 34],
    [71, 30],
  ];
  return [
    `<circle cx="60" cy="60" r="56" fill="${WHITE}" stroke="${WHITE}" stroke-width="5"/>`,
    `<circle cx="60" cy="60" r="56" fill="${red}"/>`,
    `<path d="${outline(player)}" fill="${WHITE}"/>`,
    `<circle cx="76" cy="21" r="8" fill="${WHITE}"/>`,
    `<circle cx="12" cy="44" r="7.5" fill="${WHITE}"/>`,
  ];
}

/** La Liga: a standalone monogram of two italic, angular Ls stepped on a
 *  diagonal, the second rising behind the first, with a gap of white between
 *  them. Coral red. */
function laLigaBrand(): string[] {
  const coral = "#ff4b44";
  const first = "M20 26L40 26L32 82L66 82L62 104L6 104Z";
  const second = "M58 8L78 8L71 58L108 58L104 80L48 80Z";
  return [
    `<path d="${first + second}" fill="${WHITE}" stroke="${WHITE}" stroke-width="10" stroke-linejoin="round"/>`,
    `<path d="${second}" fill="${coral}"/>`,
    `<path d="${first}" fill="${coral}" stroke="${WHITE}" stroke-width="4" stroke-linejoin="round" paint-order="stroke"/>`,
  ];
}

/** Ligue 1: a standalone condensed monogram, an upright L with its foot cut
 *  at an angle, and a 1 standing close beside it with a sharp flag. Black, with a white
 *  keyline so it holds on dark themes. */
function ligue1Brand(): string[] {
  // The L, its foot angled up at the end, then the 1 standing apart with its flag.
  const d = "M18 8L36 8L36 92L58 92L62 110L18 110ZM70 32L62 38L62 22L74 8L90 8L90 110L70 110Z";
  return [
    `<path d="${d}" fill="${WHITE}" stroke="${WHITE}" stroke-width="6" stroke-linejoin="round"/>`,
    `<path d="${d}" fill="#111"/>`,
  ];
}

/** The modern brand-inspired concept for each league that has one, by league id. */
export const BRAND_CONCEPTS: Readonly<Record<string, LeagueConcept>> = {
  premier_league: {
    title: "Lion's head brand mark",
    approach: "brand",
    inspiration:
      "The Premier League's language as a modern brand: a single lion's head in deep purple standing on its own, no crown and no container, with the face drawn in white lines. Seen front on and symmetrical.",
    looks:
      "A deep purple lion's head seen front on, with no container, outlined in white. A full mane of large locks, each point swept down and outwards, frames the face; an M-shaped brow, slanted eyes, a nose bridge widening to a broad triangular nose, two rounded whisker pads and a small chin are drawn in white.",
    resemblance: {
      level: "high",
      note: "A purple lion's head with white facial features, standing alone, is the official mark's language. Ours is symmetrical and seen front on, with no crown and a swept mane of large locks, unlike the crowned official lion turned to one side, but it is deliberately close in spirit.",
    },
    mark: () => premierLeagueBrand(),
  },
  bundesliga: {
    title: "Volley on red",
    approach: "brand",
    inspiration:
      "The Bundesliga's language as a modern brand: red and white, a footballer in action, here an original volley on a red disc rather than a strike on a rectangle.",
    looks:
      "A red disc outlined in white. A white footballer, drawn as one athletic silhouette, leans back to strike a volley: the kicking leg driven forward at hip height towards a white ball on the left, the standing leg bent, the back arm raised and the front arm out for balance.",
    resemblance: {
      level: "high",
      note: "A white player silhouette on red is the official mark's idea. The pose (a volley at hip height, facing left), the disc and the drawing differ, but the language is the same.",
    },
    mark: () => bundesligaBrand(),
  },
  la_liga: {
    title: "Stepped LL",
    approach: "brand",
    inspiration:
      "La Liga's language as a modern brand: a bold, angular LL monogram in coral red, the two letters stepped on a diagonal for movement, with white space between them.",
    looks:
      "Two italic, angular coral-red letters L, the second set higher and to the right behind the first, separated by a white gap, standing alone with a white outline.",
    resemblance: {
      level: "high",
      note: "A coral-red angular LL monogram is the official mark's language. These letters are stepped on a diagonal, both upright Ls, rather than one turned against the other, but the idea is close. The sol y sombra disc and the LL disc stay as alternatives.",
    },
    mark: () => laLigaBrand(),
  },
  ligue_1: {
    title: "Condensed L1",
    approach: "brand",
    inspiration:
      "Ligue 1's language as a modern brand: a condensed, angular L1 monogram in black, here an upright, condensed pair with the L's foot cut at an angle beside the 1.",
    looks:
      "A black monogram outlined in white: a tall condensed L, its foot cut at an angle, and close beside it a tall 1 with a sharp flag at its top.",
    resemblance: {
      level: "high",
      note: "A black angular L1 monogram is the official mark's language. This one is upright, two separate condensed letters, not slanted with the official joined, negative-space construction, but the idea is close.",
    },
    mark: () => ligue1Brand(),
  },
};

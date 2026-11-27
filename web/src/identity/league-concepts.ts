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
   *  "cultural": built on the country's football culture. */
  approach: "competition" | "cultural";
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
    [51, 20],
    [59, 10],
    [65, 20],
    [77, 15],
    [78, 28],
    [91, 28],
    [86, 40],
    [97, 47],
    [87, 54],
    [95, 66],
    [83, 68],
    [88, 82],
    [74, 80],
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
    `<path d="M40 30C47 42 48 60 42 76M58 26C66 40 68 58 62 74" fill="none" stroke="${plum}" stroke-width="2"/>`,
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

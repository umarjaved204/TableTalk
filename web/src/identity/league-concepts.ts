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
import { outline } from "./outline.ts";
import { LION_PASSANT } from "./symbols-silhouettes.ts";
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

/** Premier League: an original lion, walking, in white on deep plum, with two
 *  banks of floodlights in the top corners and England's red line below. */
function premierLeagueLion(clip: string): string[] {
  const plum = "#2b1442";
  const tile = "M28 6L92 6Q114 6 114 28L114 92Q114 114 92 114L28 114Q6 114 6 92L6 28Q6 6 28 6Z";
  // A bank of floodlights.
  const lamps = (x: number) => `<path d="M${x} 14h18v10h-18Z" fill="#ffe9a8"/>`;
  return [
    `<defs><clipPath id="${clip}"><path d="${tile}"/></clipPath></defs>`,
    `<path d="${tile}" ${KEYLINE}/>`,
    `<path d="${tile}" fill="${plum}"/>`,
    lamps(14),
    lamps(88),
    `<g transform="translate(8 20) scale(1.02)">` +
      `<path d="M84 48C96 44 98 30 92 22C89 18 91 13 95 12" fill="none" stroke="${WHITE}" stroke-width="4.4" stroke-linecap="round"/>` +
      `<circle cx="95" cy="12" r="4.5" fill="${WHITE}"/>` +
      `<path d="${outline(LION_PASSANT)}" fill="${WHITE}"/>` +
      `<path d="M25 27C22 34 22 41 25 47" fill="none" stroke="${plum}" stroke-width="1.6"/>` +
      `<circle cx="14" cy="38" r="1.6" fill="${plum}"/></g>`,
    `<path d="M24 100L96 100L96 105L24 105Z" fill="#e4002b"/>`,
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

/** Bundesliga: a footballer in an overhead (bicycle) kick, in white on a black
 *  diamond, striking a gold ball, with red and gold across the lower corner. */
function bundesligaPlayer(clip: string): string[] {
  const black = "#151515";
  const diamond = "M60 4L116 60L60 116L4 60Z";
  const limb = (d: string, w: number) =>
    `<path d="${d}" fill="none" stroke="${WHITE}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  return [
    `<defs><clipPath id="${clip}"><path d="${diamond}"/></clipPath></defs>`,
    `<path d="${diamond}" ${KEYLINE}/>`,
    `<path d="${diamond}" fill="${black}"/>`,
    `<g clip-path="url(#${clip})"><path d="M0 88L120 88L120 98L0 98Z" fill="#dd0000"/><path d="M0 98L120 98L120 120L0 120Z" fill="#ffce00"/></g>`,
    // Torso from shoulders (low left) to hips (high right), head below the shoulders.
    limb("M42 70L57 53", 12),
    `<circle cx="35" cy="77" r="7.5" fill="${WHITE}"/>`,
    // Kicking leg up over the body, the other leg bent below.
    limb("M57 53L63 41L70 34", 7.5),
    limb("M57 53L70 57L78 67", 7),
    // Arms reaching back towards the ground.
    limb("M45 67L33 63L25 67", 6),
    limb("M47 71L43 81", 6),
    // The ball, just above the striking foot.
    `<circle cx="76" cy="29" r="7.5" fill="#ffce00" stroke="${black}" stroke-width="1.5"/>`,
    `<path d="M76 24.5L80 27.5L78.5 32L73.5 32L72 27.5Z" fill="${black}"/>`,
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
    title: "Lion and floodlights",
    approach: "competition",
    inspiration:
      "The lion supporters already connect with the Premier League, drawn new as a whole lion walking (heraldry's lion passant) rather than a crowned head, on the deep plum, with two banks of floodlights for English football at night.",
    looks:
      "A deep plum rounded tile. A white lion walks to the left across the middle, small head in a large mane, one forepaw raised, tail curving up to a tuft. Two small banks of floodlights sit in the top corners and a red line runs along the bottom.",
    resemblance: {
      level: "high",
      note: "A lion on purple is the competition's best-known idea. This lion is a different animal pose (whole, walking, no crown) and composition, but supporters will connect it with the Premier League's lion. The floodlight pylon mark stays as the cultural option.",
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
    title: "Overhead kick",
    approach: "competition",
    inspiration:
      "A footballer in mid-air, the idea supporters connect with the Bundesliga's mark, here in a different pose: an overhead kick, upside down, striking a gold ball, on a black diamond with red and gold below.",
    looks:
      "A black diamond. A white footballer is upside down in an overhead kick: head and arms towards the lower left, one leg reaching up to the right to strike a gold ball near the top corner. Red and gold bands cross the lower corner.",
    resemblance: {
      level: "high",
      note: "A white player silhouette is the official mark's idea, though there the player is upright and on a red rectangle. The pose, shape and colours here are different, but the idea is the same. The oak leaf mark stays as the cultural option.",
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

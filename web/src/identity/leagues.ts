// The five league identities: a band for league headers, a mark, and the
// alternative concepts to choose from (league-concepts.ts).
//
// These are TableTalk's own marks, not the competitions' logos. Each one
// takes an idea from its country's football culture, and each has its own
// outline (tile, disc, diamond, shield, hexagon), so the five stay apart at
// 16 px by shape as well as colour. They share the crests' construction: a
// white keyline round the outside, a ground colour, and one clear symbol.
import type { Design } from "./crest.ts";
import { COMPETITION_CONCEPTS, type LeagueConcept } from "./league-concepts.ts";
import type { BandColours, Resemblance } from "./types.ts";

export interface LeagueIdentity {
  leagueId: string;
  slug: string;
  /** Two letters for tight spaces and the gallery. Not drawn on the mark. */
  code: string;
  /** The mark's main colour (white is drawn on it). */
  ground: string;
  band: BandColours;
  /** The idea behind the mark, in a sentence or two. */
  inspiration: string;
  /** What the mark shows, in words (for the gallery, read as text). */
  looks: string;
  /** How close the mark may look to the competition's own logo (the cultural
   *  marks use national ideas, not the competition's, so all are low). */
  resemblance: { level: Resemblance; note: string };
  mark: Design;
  /** Other concepts to choose from, shown beside the mark in the gallery:
   *  the competition-inspired concept (league-concepts.ts). */
  alternatives: readonly LeagueConcept[];
}

const WHITE = "#fff";
const KEYLINE = `fill="${WHITE}" stroke="${WHITE}" stroke-width="5" stroke-linejoin="round"`;
const r1 = (v: number) => String(Math.round(v * 10) / 10);

/** Points of a regular polygon as path data. */
function polygon(cx: number, cy: number, r: number, n: number, turn: number): string {
  const p: string[] = [];
  for (let k = 0; k < n; k++) {
    const a = ((turn + (k * 360) / n) * Math.PI) / 180;
    p.push(`${r1(cx + r * Math.cos(a))} ${r1(cy + r * Math.sin(a))}`);
  }
  return `M${p.join("L")}Z`;
}

/** An oak leaf, upright, centred on (cx, cy), `h` tall: rounded lobes down
 *  both sides, a short stem, and the veins cut in `vein`. */
function oakLeaf(cx: number, cy: number, h: number, fill: string, vein: string): string {
  const s = h / 100;
  const X = (v: number) => r1(cx + (v - 50) * s);
  const Y = (v: number) => r1(cy + (v - 50) * s);
  const R = (v: number) => r1(v * s);
  const lobes: [number, number, number][] = [
    [50, 12, 8],
    [38, 24, 8.5],
    [62, 24, 8.5],
    [33, 39, 10],
    [67, 39, 10],
    [35, 54, 9.5],
    [65, 54, 9.5],
    [40, 67, 8],
    [60, 67, 8],
  ];
  const body = `<ellipse cx="${X(50)}" cy="${Y(44)}" rx="${R(14)}" ry="${R(32)}" fill="${fill}"/>`;
  const circles = lobes
    .map(([x, y, r]) => `<circle cx="${X(x)}" cy="${Y(y)}" r="${R(r)}" fill="${fill}"/>`)
    .join("");
  const stem = `<path d="M${X(47.5)} ${Y(72)}L${X(52.5)} ${Y(72)}L${X(53)} ${Y(92)}L${X(47)} ${Y(92)}Z" fill="${fill}"/>`;
  const veins =
    `M${X(50)} ${Y(10)}L${X(50)} ${Y(74)}` +
    [24, 39, 54]
      .map((y) => `M${X(50)} ${Y(y + 6)}L${X(36)} ${Y(y)}M${X(50)} ${Y(y + 6)}L${X(64)} ${Y(y)}`)
      .join("");
  return (
    body +
    circles +
    stem +
    `<path d="${veins}" fill="none" stroke="${vein}" stroke-width="${r1(2.4 * s)}" stroke-linecap="round"/>`
  );
}

/** Premier League: a floodlight pylon, the lattice tower and bank of lamps
 *  that stand over English grounds on winter nights, on deep plum, with a
 *  red line for England at its foot. A rounded tile. */
function premierLeague(clip: string): string[] {
  const plum = "#2b1442";
  const red = "#e4002b";
  const lamp = "#ffe9a8";
  const tile = "M28 6L92 6Q114 6 114 28L114 92Q114 114 92 114L28 114Q6 114 6 92L6 28Q6 6 28 6Z";
  let lamps = "";
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 5; col++) lamps += `M${41 + col * 8} ${22 + row * 7}h6v5h-6Z`;
  // Cross-bracing between the legs, narrowing as the tower rises.
  const xAt = (y: number, side: -1 | 1) => 60 + side * (15.5 - ((98 - y) / 54) * 11);
  let brace = "";
  for (const [y1, y2] of [
    [94, 82],
    [82, 70],
    [70, 58],
    [58, 47],
  ] as const) {
    brace += `M${r1(xAt(y1, -1))} ${y1}L${r1(xAt(y2, 1))} ${y2}M${r1(xAt(y1, 1))} ${y1}L${r1(xAt(y2, -1))} ${y2}`;
  }
  return [
    `<defs><clipPath id="${clip}"><path d="${tile}"/></clipPath></defs>`,
    `<path d="${tile}" ${KEYLINE}/>`,
    `<path d="${tile}" fill="${plum}"/>`,
    // Light falling from the lamps.
    `<path d="M38 44L82 44L104 114L16 114Z" fill="${WHITE}" fill-opacity="0.08" clip-path="url(#${clip})"/>`,
    // Legs, bracing, head frame and lamps.
    `<path d="M41 98L48 98L57 44L54 44ZM79 98L72 98L63 44L66 44Z" fill="${WHITE}"/>`,
    `<path d="${brace}" fill="none" stroke="${WHITE}" stroke-width="2.2" stroke-linecap="round"/>`,
    `<path d="M36 16L84 16L84 46L36 46Z" fill="${WHITE}"/>`,
    `<path d="${lamps}" fill="${lamp}" stroke="${plum}" stroke-width="1.2"/>`,
    `<path d="M24 98L96 98L96 104L24 104Z" fill="${red}"/>`,
  ];
}

/** La Liga: "sol y sombra", sun and shade, the two sides of a Spanish
 *  ground's stands in the afternoon. A disc split on the diagonal: the sunny
 *  side gold with a red sun, the shaded side deep red with the gold lines of
 *  the tiers. */
function laLiga(clip: string): string[] {
  const red = "#8b0f1c";
  const gold = "#ffc400";
  const disc = "M4 60A56 56 0 1 1 116 60A56 56 0 1 1 4 60Z";
  let rays = "";
  for (let k = 0; k < 12; k++) {
    const a = (k * 30 * Math.PI) / 180;
    const [c, s] = [Math.cos(a), Math.sin(a)];
    rays += `M${r1(82 + 15 * c)} ${r1(38 + 15 * s)}L${r1(82 + 22 * c)} ${r1(38 + 22 * s)}`;
  }
  return [
    `<defs><clipPath id="${clip}"><path d="${disc}"/></clipPath></defs>`,
    `<path d="${disc}" ${KEYLINE}/>`,
    `<path d="${disc}" fill="${red}"/>`,
    `<g clip-path="url(#${clip})">`,
    `<path d="M0 0L120 0L120 120Z" fill="${gold}"/>`,
    `<path d="M14 66A52 52 0 0 1 54 106M14 50A68 68 0 0 1 70 106M14 34A84 84 0 0 1 86 106" fill="none" stroke="${gold}" stroke-width="4"/>`,
    `<path d="M0 0L120 120" stroke="${WHITE}" stroke-width="4"/>`,
    `</g>`,
    `<circle cx="82" cy="38" r="11" fill="${red}"/>`,
    `<path d="${rays}" stroke="${red}" stroke-width="3.2" stroke-linecap="round"/>`,
  ];
}

/** Bundesliga: an oak leaf, Germany's tree in its songs and on its old
 *  coins, in gold on a black diamond whose lower corner carries red and
 *  gold, the three colours in their order. */
function bundesliga(clip: string): string[] {
  const black = "#151515";
  const red = "#dd0000";
  const gold = "#ffce00";
  const diamond = "M60 4L116 60L60 116L4 60Z";
  return [
    `<defs><clipPath id="${clip}"><path d="${diamond}"/></clipPath></defs>`,
    `<path d="${diamond}" ${KEYLINE}/>`,
    `<path d="${diamond}" fill="${black}"/>`,
    `<g clip-path="url(#${clip})"><path d="M0 80L120 80L120 93L0 93Z" fill="${red}"/><path d="M0 93L120 93L120 120L0 120Z" fill="${gold}"/></g>`,
    `<path d="M0 80L120 80" stroke="${WHITE}" stroke-width="2" clip-path="url(#${clip})"/>`,
    `<g transform="rotate(-18 60 44)">${oakLeaf(60, 44, 64, gold, black)}</g>`,
  ];
}

/** Serie A: an original take on the scudetto, the shield Italy's champions
 *  wear: an azzurro shield with a gold rim, the green, white and red running
 *  across it as a sash, and a gold star, la stella, the honour for ten titles. */
function serieA(clip: string): string[] {
  const azzurro = "#0a5ea8";
  const gold = "#e0b84c";
  const shieldD = "M12 6L108 6L108 54C108 86 86 104 60 116C34 104 12 86 12 54Z";
  const inner = "M18 12L102 12L102 54C102 82 82 98 60 109C38 98 18 82 18 54Z";
  // A strip along the diagonal x - y = o, 10 units wide.
  const band = (o: number) => `M${o - 27} -20L${o + 133} 140L${o + 147} 140L${o - 13} -20Z`;
  const star: string[] = [];
  for (let k = 0; k < 10; k++) {
    const a = ((-90 + k * 36) * Math.PI) / 180;
    const r = k % 2 === 0 ? 12 : 5;
    star.push(`${r1(80 + r * Math.cos(a))} ${r1(34 + r * Math.sin(a))}`);
  }
  return [
    `<defs><clipPath id="${clip}"><path d="${inner}"/></clipPath></defs>`,
    `<path d="${shieldD}" ${KEYLINE}/>`,
    `<path d="${shieldD}" fill="${gold}"/>`,
    `<path d="${inner}" fill="${azzurro}"/>`,
    `<g clip-path="url(#${clip})">`,
    `<path d="${band(-14)}" fill="#009246"/><path d="${band(0)}" fill="${WHITE}"/><path d="${band(14)}" fill="#ce2b37"/>`,
    `</g>`,
    `<path d="M${star.join("L")}Z" fill="${gold}"/>`,
  ];
}

/** Ligue 1: l'Hexagone, France's own name for its six-sided map, which is
 *  also a football's panel: a hexagon in navy with blue, white and red
 *  standing inside it. */
function ligue1(clip: string): string[] {
  const navy = "#0d2a5c";
  const outer = polygon(60, 60, 57, 6, -90);
  const inner = polygon(60, 60, 44, 6, -90);
  return [
    `<defs><clipPath id="${clip}"><path d="${inner}"/></clipPath></defs>`,
    `<path d="${outer}" ${KEYLINE}/>`,
    `<path d="${outer}" fill="${navy}"/>`,
    `<g clip-path="url(#${clip})"><path d="M0 0L47 0L47 120L0 120Z" fill="#2457c5"/><path d="M47 0L73 0L73 120L47 120Z" fill="${WHITE}"/><path d="M73 0L120 0L120 120L73 120Z" fill="#e4002b"/></g>`,
    `<path d="${inner}" fill="none" stroke="${WHITE}" stroke-width="2.5"/>`,
  ];
}

export const LEAGUE_IDENTITIES: readonly LeagueIdentity[] = [
  {
    leagueId: "premier_league",
    slug: "premier-league",
    code: "PL",
    ground: "#2b1442",
    band: { bg: "#2b1442", ink: WHITE, muted: "#ded3ea", accent: "#ff6b81" },
    inspiration:
      "English football under the lights: the floodlight pylon, a lattice tower with its bank of lamps, that stands over the corners of English grounds. Deep plum, with a red line for England.",
    looks:
      "A deep plum rounded tile. A white floodlight pylon stands in the middle: two legs with cross-bracing rising to a white frame holding fifteen pale-yellow lamps, a faint wedge of light falling below, and a red line at its foot.",
    resemblance: {
      level: "low",
      note: "A floodlight pylon belongs to English football in general, not to the competition's lion logo.",
    },
    mark: (k) => premierLeague(k.clip),
    alternatives: [COMPETITION_CONCEPTS["premier_league"]].filter((c): c is LeagueConcept => c !== undefined),
  },
  {
    leagueId: "bundesliga",
    slug: "bundesliga",
    code: "BL",
    ground: "#151515",
    band: { bg: "#151515", ink: WHITE, muted: "#dcdcdc", accent: "#ffce00" },
    inspiration:
      "The German oak, the tree of the country's songs and of its old coins, in gold on black, with red and gold below: the three colours in the flag's order.",
    looks:
      "A black diamond standing on its point. A large gold oak leaf with rounded lobes and black veins leans slightly left in the upper part; across the lower corner, a red band and then gold.",
    resemblance: {
      level: "low",
      note: "The oak leaf and the flag's colours are national ideas, not the competition's player logo.",
    },
    mark: (k) => bundesliga(k.clip),
    alternatives: [COMPETITION_CONCEPTS["bundesliga"]].filter((c): c is LeagueConcept => c !== undefined),
  },
  {
    leagueId: "la_liga",
    slug: "la-liga",
    code: "LL",
    ground: "#8b0f1c",
    band: { bg: "#8b0f1c", ink: WHITE, muted: "#f8dadd", accent: "#ffc400" },
    inspiration:
      "Sol y sombra, sun and shade: the two sides of a Spanish ground's stands, priced by which one the afternoon sun falls on. Gold and deep red, the colours of Spain.",
    looks:
      "A disc split by a white diagonal line from top left to bottom right. The upper-right half is gold with a deep red sun and its rays; the lower-left half is deep red with three gold curved lines, the tiers of a stand.",
    resemblance: {
      level: "low",
      note: "Sun and shade are a feature of Spanish grounds, not of the competition's logo.",
    },
    mark: (k) => laLiga(k.clip),
    alternatives: [COMPETITION_CONCEPTS["la_liga"]].filter((c): c is LeagueConcept => c !== undefined),
  },
  {
    leagueId: "serie_a",
    slug: "serie-a",
    code: "SA",
    ground: "#0a4f8f",
    band: { bg: "#0a4f8f", ink: WHITE, muted: "#d6e6f5", accent: "#7fe0a2" },
    inspiration:
      "Italian football's honours, drawn new: the shield of the scudetto, worn by the champions, here as an azzurro shield with the tricolour running across it as a sash, and the gold star a club earns for ten titles.",
    looks:
      "A shield with a gold rim and an azzurro field. A green, white and red sash runs diagonally from the top left to the bottom right, and a gold five-pointed star sits in the upper-right corner.",
    resemblance: {
      level: "low",
      note: "The shield takes the scudetto tradition, not the competition's letter A logo; the sash and star are drawn new.",
    },
    mark: (k) => serieA(k.clip),
    alternatives: [COMPETITION_CONCEPTS["serie_a"]].filter((c): c is LeagueConcept => c !== undefined),
  },
  {
    leagueId: "ligue_1",
    slug: "ligue-1",
    code: "L1",
    ground: "#0d2a5c",
    band: { bg: "#0d2a5c", ink: WHITE, muted: "#d8e0ef", accent: "#ff6b81" },
    inspiration:
      "L'Hexagone, the French name for France's six-sided shape, which is also the panel of a football: a navy hexagon holding the blue, white and red.",
    looks:
      "A navy hexagon standing on a point. Inside, a smaller hexagon outlined in white holds three upright bands: blue, white and red.",
    resemblance: {
      level: "low",
      note: "The hexagon and tricolour are national ideas, not the competition's L1 monogram.",
    },
    mark: (k) => ligue1(k.clip),
    alternatives: [COMPETITION_CONCEPTS["ligue_1"]].filter((c): c is LeagueConcept => c !== undefined),
  },
];

export function leagueIdentity(leagueId: string): LeagueIdentity | undefined {
  return LEAGUE_IDENTITIES.find((league) => league.leagueId === leagueId);
}

/** The league's mark. */
export function leagueMarkDesign(league: LeagueIdentity): Design {
  return league.mark;
}

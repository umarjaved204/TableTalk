// Bundesliga crests, 2026-27. Each design is an original interpretation of
// the club's heritage, not a copy of its badge: see `inspiration` for the
// idea and `resemblance` for how close it might look to the official badge.
// German club badges lean on lettering (BVB, S04, the W, the B, the 05) and
// on city arms (Cologne's cathedral, Augsburg's pine cone, Berlin's bear,
// Württemberg's antlers), and many are roundels or diamonds: each design
// keeps its club's traditional outline and the way colour and lettering sit
// in it, with its own arrangement (`composition`). No Red Bull marks appear
// on RB Leipzig's crest.
import { arcText, lineText, type ArcOptions, type LineOptions } from "../lettering.ts";
import { vfb } from "../blackletter.ts";
import { SHAPES } from "../primitives.ts";
import type { ClubIdentity } from "../types.ts";

const WHITE = "#fff";
const BLACK = "#111";

/** Lettering paths with the font's tiny corner curves (under 0.4 crest
 *  units, far below a pixel at any size a crest is shown) written as
 *  straight lines: the same letters in a much smaller file. The Premier
 *  League and La Liga crests, approved before this, keep the full curves. */
function slim(d: string): string {
  let out = "";
  // The last point actually written: a dropped point is never more than
  // 0.4 units from it, so the error never builds up.
  let [px, py] = [0, 0];
  for (const [, cmd, args] of d.matchAll(/([MLQCZ])([^MLQCZ]*)/g)) {
    if (cmd === "Z") {
      out += "Z";
      continue;
    }
    const n = (args ?? "").trim().split(/[ ,]+/).map(Number);
    const x = n.at(-2) ?? px;
    const y = n.at(-1) ?? py;
    const near = Math.abs(x - px) <= 0.4 && Math.abs(y - py) <= 0.4;
    if (cmd !== "M" && near) continue;
    out += cmd === "M" || !near ? `${cmd}${(args ?? "").trim()}` : "";
    [px, py] = [x, y];
  }
  return out;
}

/** Straight lettering, slimmed. */
function text(t: string, o: LineOptions & { fill: string }): string {
  return `<path d="${slim(lineText(t, o).d)}" fill="${o.fill}"/>`;
}

/** Lettering round a roundel's ring (centred on the crest), slimmed. */
function arc(t: string, o: Omit<ArcOptions, "cx" | "cy"> & { fill: string }): string {
  return `<path d="${slim(arcText(t, { ...o, cx: 60, cy: 60 }).d)}" fill="${o.fill}"/>`;
}

/** Lettering with an outline in another colour, for letters over a busy field. */
function outlined(t: string, o: LineOptions, fill: string, stroke: string, width: number): string {
  return `<path d="${slim(lineText(t, o).d)}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round" paint-order="stroke"/>`;
}

/** A path clipped to the field. */
const cut = (d: string, fill: string, clip: string) =>
  `<path d="${d}" fill="${fill}" clip-path="url(#${clip})"/>`;

/** Bavaria's lozenges: upright diamonds of `colour` in a chequer over the
 *  field (the white between them is the field), centred on the crest. */
function lozenges(clip: string, colour: string, w: number, h: number, reach: number): string {
  let d = "";
  for (let row = -5; row <= 5; row++) {
    const y = 60 + row * h;
    for (let col = -6; col <= 6; col++) {
      const x = 60 + col * w;
      // Skip diamonds wholly outside the circle that stays visible.
      if (Math.hypot(x - 60, y - 60) - Math.max(w, h) / 2 > reach) continue;
      d += `M${x} ${y - h / 2}l${w / 2} ${h / 2}l-${w / 2} ${h / 2}l-${w / 2} -${h / 2}z`;
    }
  }
  return cut(d, colour, clip);
}

/** Lettering slanted forward like italic type, pivoting on (cx, cy), the
 *  middle of the letters: VfB and Union's UNION. */
function italic(svg: string, cx: number, cy: number): string {
  return `<g transform="translate(${cx} ${cy}) skewX(-12) translate(${-cx} ${-cy})">${svg}</g>`;
}

/** Text turned about its centre (cx, cy): Hoffenheim's diagonal band. */
function turnedText(
  text: string,
  cx: number,
  cy: number,
  cap: number,
  deg: number,
  fill: string,
  maxWidth: number,
): string {
  const set = lineText(text, { x: 0, baseline: cap / 2, cap, maxWidth, tracking: 0.04 });
  return `<g transform="translate(${cx} ${cy}) rotate(${deg})"><path d="${slim(set.d)}" fill="${fill}"/></g>`;
}

/** A ribbon banner across the crest, its ends cut in. */
function banner(y: number, h: number, sag: number, fill: string, edge: string): string {
  return `<path d="M12 ${y}Q60 ${y + sag} 108 ${y}L102 ${y + h / 2}L108 ${y + h}Q60 ${y + h + sag} 12 ${y + h}L18 ${y + h / 2}Z" fill="${fill}" stroke="${edge}" stroke-width="1.6" stroke-linejoin="round"/>`;
}

/** A wedge of a roundel between two radii and two angles (degrees, 0 = right). */
function wedge(r0: number, r1: number, from: number, to: number, fill: string): string {
  const at = (r: number, deg: number) => {
    const a = (deg * Math.PI) / 180;
    return `${(60 + r * Math.cos(a)).toFixed(1)} ${(60 + r * Math.sin(a)).toFixed(1)}`;
  };
  return `<path d="M${at(r0, from)}L${at(r1, from)}A${r1} ${r1} 0 0 1 ${at(r1, to)}L${at(r0, to)}A${r0} ${r0} 0 0 0 ${at(r0, from)}Z" fill="${fill}"/>`;
}

const BAY = { red: "#dc052d", blue: "#0066b2" };
const BVB = { yellow: "#fde100" };
const RBL = { red: "#dd0741", navy: "#0c2043", gold: "#f2b500" };
const SVW = { green: "#1d9053", dark: "#0a4f2c" };
const HSV = { blue: "#0a5aa8" };
const KOE = { red: "#e2001a" };
const SGE = { red: "#e1000f" };
const VFB = { red: "#e32219", gold: "#f4c20d" };
const S04 = { blue: "#004d9d" };
const SCF = { red: "#e4002b" };
const B04 = { red: "#e32221", yellow: "#f7d117" };
const FCA = { red: "#ba3733", green: "#46714d", gold: "#e3b23c" };
const TSG = { blue: "#1961b5" };
const SCP = { blue: "#005ca9" };
const FCU = { red: "#d4011d", yellow: "#ffd500" };
const BMG = { green: "#12924a" };
const SVE = { gold: "#c8ae7d" };
const M05 = { red: "#c3141e" };

export const BUNDESLIGA: readonly ClubIdentity[] = [
  {
    slug: "bayern-munich",
    name: "Bayern Munich",
    leagueId: "bundesliga",
    nickname: "Die Roten",
    founded: 1900,
    short: "FCB",
    colours: [
      { name: "Red", hex: BAY.red },
      { name: "Bavarian blue", hex: BAY.blue },
      { name: "White", hex: WHITE },
    ],
    band: { bg: "#a8001e", ink: WHITE, muted: "#ffe1e6", accent: "#9fcbff" },
    inspiration:
      "Bayern's roundel: Bavaria's blue and white lozenges, the colours of the state's arms, held in a red ring carrying the club's name.",
    resemblance: {
      level: "high",
      note: "A red ring of lettering round a disc of blue and white lozenges is the arrangement of the official badge. Here the lettering is split in two around the ring with dots between, and the lozenges are larger and upright. The lozenge shield is the lower-resemblance alternative.",
    },
    composition: "ring of lettering round the lozenges",
    looks: {
      full: "A red roundel. A wide red ring carries FC BAYERN over the top and MÜNCHEN under the bottom in white, with a white dot at each side; inside a thin white ring, a disc of blue and white upright lozenges.",
      small: "A red ring round a disc of large blue and white lozenges, with no lettering.",
    },
    full: (k) => [
      k.shield("roundel", { rim: BAY.red, field: WHITE, rimWidth: 3 }),
      lozenges(k.clip, BAY.blue, 12, 17, 33),
      k.ring(44.5, 20, BAY.red),
      k.ring(34.2, 2, WHITE),
      arc("FC BAYERN", { r: 43.5, cap: 11, side: "top", fill: WHITE, maxSweep: 140 }),
      arc("MÜNCHEN", { r: 43.5, cap: 11, side: "bottom", fill: WHITE, maxSweep: 120 }),
      k.disc(16.5, 60, 2.2, WHITE),
      k.disc(103.5, 60, 2.2, WHITE),
    ],
    small: (k) => [
      k.shield("roundel", { rim: BAY.red, field: WHITE, rimWidth: 7 }),
      lozenges(k.clip, BAY.blue, 20, 28, 37),
      k.ring(44, 16, BAY.red),
      k.ring(36, 3, WHITE),
    ],
    alternatives: [
      {
        title: "Lozenge shield",
        note: "Bavaria's lozenges on a shield under a red chief with FCB: the club's colours and its region, away from the roundel of the official badge.",
        looks: {
          full: "A pointed shield with a red edge, filled with blue and white lozenges, under a red band with white FCB lettering.",
          small: "The pointed shield of blue and white lozenges under a plain red band.",
        },
        full: (k) => [
          k.shield("heater", { rim: BAY.red, field: WHITE }),
          lozenges(k.clip, BAY.blue, 14, 20, 60),
          k.pattern({ kind: "chief", colour: BAY.red, height: 36 }),
          text("FCB", { x: 60, baseline: 30, cap: 20, fill: WHITE, tracking: 0.08 }),
        ],
        small: (k) => [
          k.shield("heater", { rim: BAY.red, field: WHITE, rimWidth: 7 }),
          lozenges(k.clip, BAY.blue, 22, 30, 60),
          k.pattern({ kind: "chief", colour: BAY.red, height: 34 }),
        ],
      },
    ],
  },
  {
    slug: "borussia-dortmund",
    name: "Borussia Dortmund",
    leagueId: "bundesliga",
    nickname: "Die Schwarzgelben",
    founded: 1909,
    short: "BVB",
    colours: [
      { name: "Yellow", hex: BVB.yellow },
      { name: "Black", hex: BLACK },
    ],
    band: { bg: "#111111", ink: BVB.yellow, muted: "#f1e8a6", accent: BVB.yellow },
    inspiration:
      "Dortmund's black and yellow and the three letters every supporter knows: BVB set large across a yellow roundel, with the founding year 09 under them.",
    resemblance: {
      level: "high",
      note: "BVB in black across a yellow roundel is the official badge's arrangement. Here the letters are condensed capitals and 09 sits in a black band right across the roundel. The black chief tablet is the lower-resemblance alternative.",
    },
    composition: "monogram across a roundel, with a band of numerals",
    looks: {
      full: "A yellow roundel with a black edge and a thin black inner ring. Large black BVB across the middle; below, a black band across the roundel with 09 in yellow.",
      small: "A yellow roundel with a heavy black edge and large black BVB.",
    },
    full: (k) => [
      k.shield("roundel", { rim: BLACK, field: BVB.yellow, rimWidth: 5 }),
      k.ring(47, 2.5, BLACK),
      text("BVB", { x: 60, baseline: 63, cap: 31, fill: BLACK, tracking: 0.05, maxWidth: 78 }),
      k.band(71, 16, BLACK),
      text("09", { x: 60, baseline: 84.5, cap: 11, fill: BVB.yellow, tracking: 0.1 }),
    ],
    small: (k) => [
      k.shield("roundel", { rim: BLACK, field: BVB.yellow, rimWidth: 7 }),
      text("BVB", { x: 60, baseline: 76, cap: 34, fill: BLACK, tracking: 0.04, maxWidth: 90 }),
    ],
    alternatives: [
      {
        title: "Black chief tablet",
        note: "The colours and letters on a rounded tablet: BVB in yellow on a black chief, 09 large below. Keeps the identity without the roundel.",
        looks: {
          full: "A yellow rounded tablet with a black edge: a black band across the top with yellow BVB, and a large black 09 below.",
          small: "The yellow tablet with its black top band and yellow BVB.",
        },
        full: (k) => [
          k.shield("tablet", { rim: BLACK, field: BVB.yellow }),
          k.pattern({ kind: "chief", colour: BLACK, height: 40 }),
          text("BVB", { x: 60, baseline: 32, cap: 22, fill: BVB.yellow, tracking: 0.08 }),
          text("09", { x: 60, baseline: 98, cap: 40, fill: BLACK, tracking: 0.04 }),
        ],
        small: (k) => [
          k.shield("tablet", { rim: BLACK, field: BVB.yellow, rimWidth: 7 }),
          k.pattern({ kind: "chief", colour: BLACK, height: 54 }),
          text("BVB", { x: 60, baseline: 44, cap: 28, fill: BVB.yellow, tracking: 0.04, maxWidth: 84 }),
        ],
      },
    ],
  },
  {
    slug: "rb-leipzig",
    name: "RB Leipzig",
    leagueId: "bundesliga",
    nickname: "Die Roten Bullen",
    founded: 2009,
    short: "RBL",
    colours: [
      { name: "Red", hex: RBL.red },
      { name: "White", hex: WHITE },
      { name: "Navy", hex: RBL.navy },
      { name: "Gold", hex: RBL.gold },
    ],
    band: { bg: RBL.navy, ink: WHITE, muted: "#d9e0ee", accent: RBL.gold },
    inspiration:
      "The owner's direction for Leipzig: a white shield with a navy edge, two red bulls charging at a football from either side, strong navy RBL lettering and a red base reading LEIPZIG.",
    resemblance: {
      level: "high",
      note: "Very close, and a trademark question as much as an artistic one. Two red bulls charging at a central ball is the core of the Red Bull company's registered logo, which the official club badge uses. Here the bulls are drawn new, the ball is a football with red arcs and the lettering is TableTalk's own, but those differences don't change the idea, which is the protected part. Using this design publicly needs legal advice first. The heraldic lion and the municipal arms are the lower-resemblance alternatives.",
    },
    composition: "charging bulls and ball over lettering on a shield",
    reference:
      "Custom club-inspired artwork — user supplied, AI-generated design reference (28 Nov 2026). The image itself is the full crest in use (supplied/crests, described in supplied.ts); this TableTalk drawing is kept as its alternative and is the small crest. Not official, not licensed.",
    looks: {
      full: "A white pointed shield with a navy edge. Two red bulls, edged in white, leap in from either side with heads lowered and horns forward towards a navy and white football between red arcs. Below, large navy RBL in italic capitals, a thin gold line and a red base reading LEIPZIG in white italic capitals.",
      small:
        "The white navy-edged shield with large navy italic RBL over a red base. The bulls are left out at this size.",
    },
    full: (k) => [
      k.shield("heater", { rim: RBL.navy, field: WHITE }),
      `<path d="M45 21Q60 13 75 21M45 49Q60 57 75 49" fill="none" stroke="${RBL.red}" stroke-width="2" stroke-linecap="round"/>`,
      k.symbol("football", { x: 60, y: 35, size: 22 }, { main: RBL.navy, accent: RBL.navy, ground: WHITE }),
      `<g stroke="${WHITE}" stroke-width="3" stroke-linejoin="round" paint-order="stroke">${k.symbol("bull-charging", { x: 26, y: 37, size: 55 }, { main: RBL.red, accent: RBL.navy, ground: WHITE })}${k.symbol("bull-charging", { x: 94, y: 37, size: 55, flip: true }, { main: RBL.red, accent: RBL.navy, ground: WHITE })}</g>`,
      italic(text("RBL", { x: 60, baseline: 80, cap: 24, fill: RBL.navy, tracking: 0.02 }), 60, 68),
      k.rule(85, RBL.gold, 2.5),
      k.pattern({ kind: "base", colour: RBL.red, from: 88 }),
      italic(text("LEIPZIG", { x: 60, baseline: 100.5, cap: 8.5, fill: WHITE, tracking: 0.08 }), 60, 96),
    ],
    small: (k) => [
      k.shield("heater", { rim: RBL.navy, field: WHITE, rimWidth: 7 }),
      k.pattern({ kind: "base", colour: RBL.red, from: 76 }),
      italic(
        text("RBL", { x: 60, baseline: 64, cap: 30, fill: RBL.navy, tracking: 0.02, maxWidth: 88 }),
        60,
        49,
      ),
    ],
    alternatives: [
      {
        title: "Heraldic lion",
        note: "The refinement-round design, before the owner-supplied references: a red heraldic lion over navy RBL on a white shield. No bulls, so much further from the official badge and the sponsor's marks: the safer choice.",
        looks: {
          full: "A white round-bottomed shield with a navy edge. A red lion rampant stands at the top; below it, large navy RBL; a thin gold line, then a red base reading LEIPZIG in white.",
          small: "The white navy-edged shield with large navy RBL over a red base.",
        },
        full: (k) => [
          k.shield("english", { rim: RBL.navy, field: WHITE }),
          k.symbol(
            "lion-heraldic",
            { x: 60, y: 34, size: 44 },
            { main: RBL.red, accent: RBL.navy, ground: WHITE },
          ),
          text("RBL", { x: 60, baseline: 81, cap: 22, fill: RBL.navy, tracking: 0.1 }),
          k.pattern({ kind: "base", colour: RBL.red, from: 89 }),
          k.rule(88, RBL.gold, 2.5),
          text("LEIPZIG", { x: 60, baseline: 102, cap: 7, fill: WHITE, tracking: 0.16 }),
        ],
        small: (k) => [
          k.shield("english", { rim: RBL.navy, field: WHITE, rimWidth: 7 }),
          k.pattern({ kind: "base", colour: RBL.red, from: 76 }),
          text("RBL", { x: 60, baseline: 64, cap: 30, fill: RBL.navy, tracking: 0.04, maxWidth: 86 }),
        ],
      },
      {
        title: "Municipal arms",
        note: "The first Bundesliga design: Leipzig's city arms, the lion rampant and two blue pales on gold, under a white chief with RBL. Closer to a civic coat of arms than a club badge, so kept as the alternative.",
        looks: {
          full: "A round-bottomed shield with a navy edge. A white band across the top with red RBL; below, a gold field with a red lion rampant on the left and two navy vertical bands on the right.",
          small:
            "The navy-edged shield: a deep white top band with large red RB over a red rule, and two navy vertical bands on gold below.",
        },
        full: (k) => [
          k.shield("english", { rim: RBL.navy, field: RBL.gold }),
          cut("M70 0L79 0L79 120L70 120ZM88 0L97 0L97 120L88 120Z", RBL.navy, k.clip),
          k.pattern({ kind: "chief", colour: WHITE, height: 34 }),
          k.rule(34, RBL.red, 3),
          text("RBL", { x: 60, baseline: 28, cap: 19, fill: RBL.red, tracking: 0.1 }),
          k.symbol(
            "lion-rampant",
            { x: 42, y: 74, size: 50 },
            { main: RBL.red, accent: RBL.navy, ground: RBL.gold },
          ),
        ],
        small: (k) => [
          k.shield("english", { rim: RBL.navy, field: RBL.gold, rimWidth: 7 }),
          cut("M38 0L52 0L52 120L38 120ZM68 0L82 0L82 120L68 120Z", RBL.navy, k.clip),
          k.pattern({ kind: "chief", colour: WHITE, height: 50 }),
          k.rule(50, RBL.red, 4),
          text("RB", { x: 60, baseline: 42, cap: 30, fill: RBL.red, tracking: 0.04 }),
        ],
      },
    ],
  },
  {
    slug: "werder-bremen",
    name: "Werder Bremen",
    leagueId: "bundesliga",
    nickname: "Die Werderaner",
    founded: 1899,
    short: "SVW",
    colours: [
      { name: "Green", hex: SVW.green },
      { name: "White", hex: WHITE },
    ],
    band: { bg: SVW.dark, ink: WHITE, muted: "#d3ecdd", accent: "#8fdcb0" },
    inspiration: "Werder's green diamond and its white W, the shape the club has worn for a century.",
    resemblance: {
      level: "high",
      note: "A white W in a green diamond is the official badge. Here the diamond's corners are rounded more softly, a white inner outline frames it and the W is a condensed capital with a green outline. The Bremen key roundel is the lower-resemblance alternative.",
    },
    composition: "single letter in a diamond",
    looks: {
      full: "A green diamond with rounded corners and a dark green edge, a thin white diamond outline inside it, and a large white W in the middle.",
      small: "The rounded green diamond with a large white W.",
    },
    full: (k) => [
      k.shield("soft-diamond", { rim: SVW.dark, field: SVW.green }),
      `<path d="${SHAPES["soft-diamond"](10)}" fill="none" stroke="${WHITE}" stroke-width="2.5"/>`,
      outlined("W", { x: 60, baseline: 81, cap: 42, tracking: 0, maxWidth: 58 }, WHITE, SVW.dark, 3),
    ],
    small: (k) => [
      k.shield("soft-diamond", { rim: SVW.dark, field: SVW.green, rimWidth: 7 }),
      text("W", { x: 60, baseline: 84, cap: 48, fill: WHITE, tracking: 0, maxWidth: 64 }),
    ],
    alternatives: [
      {
        title: "Bremen key",
        note: "The key of Bremen's city arms, which the Hanseatic city has carried since the Middle Ages, in a green roundel. Further from the official badge.",
        looks: {
          full: "A green roundel with a dark green edge and a thin white ring, WERDER over the top in white, and a large white key tilted across the middle.",
          small: "A green roundel with a large white key tilted across it.",
        },
        full: (k) => [
          k.shield("roundel", { rim: SVW.dark, field: SVW.green }),
          k.ring(37, 2, WHITE),
          arc("WERDER", { r: 45, cap: 10, side: "top", fill: WHITE, maxSweep: 110 }),
          k.symbol(
            "key",
            { x: 60, y: 62, size: 58, rotate: 35 },
            { main: WHITE, accent: WHITE, ground: SVW.green },
          ),
        ],
        small: (k) => [
          k.shield("roundel", { rim: SVW.dark, field: SVW.green, rimWidth: 7 }),
          k.symbol(
            "key",
            { x: 60, y: 60, size: 84, rotate: 35 },
            { main: WHITE, accent: WHITE, ground: SVW.green },
          ),
        ],
      },
    ],
  },
  {
    slug: "hamburger-sv",
    name: "Hamburger SV",
    leagueId: "bundesliga",
    nickname: "Die Rothosen",
    founded: 1887,
    short: "HSV",
    colours: [
      { name: "Blue", hex: HSV.blue },
      { name: "White", hex: WHITE },
      { name: "Black", hex: BLACK },
    ],
    band: { bg: "#083d75", ink: WHITE, muted: "#d6e3f3", accent: "#9cc4f2" },
    inspiration:
      "HSV's Raute: a white and black diamond on a blue field in the proportions of a flag, as on the club's traditional emblem and Hamburg's harbour flags. Clean geometry, strong contrast, nothing else.",
    resemblance: {
      level: "high",
      note: "Very close. A blue landscape field with a white diamond holding a black diamond is the official emblem's whole design, and the owner's reference follows it closely. The differences are small: the black diamond here is solid, with no white diamond at its centre, the field has a thin white border and the proportions are drawn new. Because the official emblem is so simple, no faithful version can be far from it. The diamond on a blue block, the blue-edged diamond and the Hamburg gate are the lower-resemblance alternatives.",
    },
    composition: "diamond on a blue flag",
    reference:
      "Custom club-inspired artwork — user supplied, AI-generated design reference (28 Nov 2026). The image itself is the full crest in use (supplied/crests, described in supplied.ts); this TableTalk drawing is kept as its alternative and is the small crest. Not official, not licensed.",
    looks: {
      full: "A blue landscape rectangle, about 3:2, with a thin white border. A large white diamond stands in the middle with a solid black diamond inside it.",
      small: "The blue rectangle with its white diamond and solid black centre.",
    },
    full: (k) => [
      k.shield("flag", { rim: WHITE, field: "#0b3f9c", rimWidth: 3 }),
      `<path d="M60 26L94 60L60 94L26 60Z" fill="${WHITE}"/>`,
      `<path d="M60 40L80 60L60 80L40 60Z" fill="${BLACK}"/>`,
    ],
    small: (k) => [
      k.shield("flag", { rim: WHITE, field: "#0b3f9c", rimWidth: 3 }),
      `<path d="M60 25L95 60L60 95L25 60Z" fill="${WHITE}"/>`,
      `<path d="M60 38L82 60L60 82L38 60Z" fill="${BLACK}"/>`,
    ],
    alternatives: [
      {
        title: "Diamond on a blue block",
        note: "The refinement-round design, before the owner-supplied references: a square blue block with the diamond split along its diagonals into black and white triangles. Further from the official emblem than the main design.",
        looks: {
          full: "A blue square with slightly rounded corners. A large diamond fills the middle, edged in white and divided along its diagonals: the upper-left and lower-right triangles black, the other two white.",
          small: "The blue square with a large black and white diamond touching its edges.",
        },
        full: (k) => [
          k.shield("block", { rim: "#063a70", field: HSV.blue, rimWidth: 3 }),
          `<path d="M60 15L105 60L60 105L15 60Z" fill="${WHITE}"/>`,
          `<path d="M20 60L60 20L60 60ZM100 60L60 100L60 60Z" fill="${BLACK}"/>`,
        ],
        small: (k) => [
          k.shield("block", { rim: "#063a70", field: HSV.blue, rimWidth: 5 }),
          `<path d="M60 13L107 60L60 107L13 60Z" fill="${WHITE}"/>`,
          `<path d="M18 60L60 18L60 60ZM102 60L60 102L60 60Z" fill="${BLACK}"/>`,
        ],
      },
      {
        title: "Blue-edged diamond",
        note: "The first Bundesliga design: the diamond as the whole outline, blue-edged, with its left and right quarters black. Kept as an alternative.",
        looks: {
          full: "A diamond with a broad blue edge and a white field. A black-outlined inner diamond is divided into four smaller diamonds: the left and right ones black, the top and bottom ones white.",
          small: "The blue-edged diamond with its left and right quarters black.",
        },
        full: (k) => [
          k.shield("diamond", { rim: HSV.blue, field: WHITE, rimWidth: 7 }),
          `<path d="M22 60L41 41L60 60L41 79ZM98 60L79 41L60 60L79 79Z" fill="${BLACK}"/>`,
          `<path d="${SHAPES.diamond(13.5)}M41 41L79 79M79 41L41 79" fill="none" stroke="${BLACK}" stroke-width="2"/>`,
        ],
        small: (k) => [
          k.shield("diamond", { rim: HSV.blue, field: WHITE, rimWidth: 9 }),
          `<path d="M20 60L40 40L60 60L40 80ZM100 60L80 40L60 60L80 80Z" fill="${BLACK}"/>`,
        ],
      },
      {
        title: "Hamburg gate",
        note: "The towered gate of Hamburg's city arms in the club's blue, with HSV below: the city behind the club, away from the diamond.",
        looks: {
          full: "A blue roundel with a thin white ring, a white towered castle gate in the middle and HSV in white under it.",
          small: "A blue roundel with a large white towered gate.",
        },
        full: (k) => [
          k.shield("roundel", { rim: BLACK, field: HSV.blue }),
          k.ring(48, 2, WHITE),
          k.symbol("castle", { x: 60, y: 52, size: 56 }, { main: WHITE, accent: WHITE, ground: HSV.blue }),
          text("HSV", { x: 60, baseline: 96, cap: 15, fill: WHITE, tracking: 0.12 }),
        ],
        small: (k) => [
          k.shield("roundel", { rim: BLACK, field: HSV.blue, rimWidth: 7 }),
          k.symbol("castle", { x: 60, y: 60, size: 80 }, { main: WHITE, accent: WHITE, ground: HSV.blue }),
        ],
      },
    ],
  },
  {
    slug: "1-fc-koln",
    name: "1. FC Köln",
    leagueId: "bundesliga",
    nickname: "Die Geißböcke",
    founded: 1948,
    short: "KOE",
    colours: [
      { name: "Red", hex: KOE.red },
      { name: "White", hex: WHITE },
    ],
    band: { bg: "#b30015", ink: WHITE, muted: "#ffdfe2", accent: WHITE },
    inspiration:
      "Hennes, the billy goat the club has kept as its mascot since 1950, leaping onto a red roundel, his forelegs over its rim: 1.FC and KÖLN across the roundel on a slanting white band, and Cologne Cathedral's twin spires at its foot.",
    resemblance: {
      level: "high",
      note: "Close. A white goat on top of a red and white roundel lettered 1. FC KÖLN, with the cathedral, is the official badge's arrangement, and the owner's reference follows it. Here the goat is drawn new in a leaping pose with its forelegs over the rim, the name runs on a slanting white band and the cathedral is a small black silhouette. The goat on a lettered roundel, the cathedral shield and the three crowns designs are the alternatives.",
    },
    composition: "mascot leaping onto a lettered roundel",
    reference:
      "Custom club-inspired artwork — user supplied, AI-generated design reference (28 Nov 2026). The image itself is the full crest in use (supplied/crests, described in supplied.ts); this TableTalk drawing is kept as its alternative and is the small crest. Not official, not licensed.",
    looks: {
      full: "A white billy goat outlined in black, with long ridged horns and a beard, leaps onto the top of a red roundel, forelegs reaching over its rim and hind legs trailing down the right. The roundel has a black edge and a white ring; across it slants a white band reading KÖLN in black, with 1.FC in white above it and a small black twin-spired cathedral below.",
      small: "A red roundel with a large white goat outlined in black.",
    },
    full: (k) => [
      k.shield("crowned-roundel", { rim: BLACK, field: KOE.red, rimWidth: 2.5 }),
      `<circle cx="60" cy="71" r="40.5" fill="none" stroke="${WHITE}" stroke-width="2.5"/>`,
      cut("M-10.6 83.8L126.4 54.6L130.6 74.2L-6.4 103.4Z", WHITE, k.clip),
      turnedText("KÖLN", 60, 79, 15, -12, BLACK, 62),
      turnedText("1.FC", 56, 59, 14, -12, WHITE, 44),
      k.symbol("cathedral", { x: 60, y: 102, size: 22 }, { main: BLACK, accent: BLACK, ground: KOE.red }),
      `<g stroke="${BLACK}" stroke-width="2.6" stroke-linejoin="round" paint-order="stroke">${k.symbol("goat-leaping", { x: 64, y: 30, size: 60 }, { main: WHITE, accent: BLACK, ground: WHITE })}</g>`,
    ],
    small: (k) => [
      k.shield("roundel", { rim: BLACK, field: KOE.red, rimWidth: 4 }),
      `<g stroke="${BLACK}" stroke-width="3.4" stroke-linejoin="round" paint-order="stroke">${k.symbol("goat-leaping", { x: 57, y: 60, size: 90 }, { main: WHITE, accent: BLACK, ground: WHITE })}</g>`,
    ],
    alternatives: [
      {
        title: "Goat on a lettered roundel",
        note: "The refinement-round design, before the owner-supplied references: a red goat standing on a red-ringed roundel with the cathedral inside and the name round the ring.",
        looks: {
          full: "A red goat with curved horns and a beard stands on top of a roundel. The roundel has a red edge and a red ring lettered 1. FC KÖLN in white round the bottom; inside, on white, a small red cathedral front with two spires.",
          small: "A red roundel with a large white goat standing in profile.",
        },
        full: (k) => [
          k.shield("crowned-roundel", { rim: KOE.red, field: WHITE }),
          `<circle cx="60" cy="71" r="37" fill="none" stroke="${KOE.red}" stroke-width="9"/>`,
          `<path d="${slim(arcText("1. FC KÖLN", { cx: 60, cy: 71, r: 37, cap: 7.5, side: "bottom", maxSweep: 150 }).d)}" fill="${WHITE}"/>`,
          k.symbol(
            "cathedral",
            { x: 60, y: 73, size: 52 },
            { main: KOE.red, accent: KOE.red, ground: WHITE },
          ),
          `<g stroke="${WHITE}" stroke-width="5" stroke-linejoin="round" paint-order="stroke">${k.symbol("goat", { x: 58, y: 22, size: 44 }, { main: KOE.red, accent: KOE.red, ground: WHITE })}</g>`,
        ],
        small: (k) => [
          k.shield("roundel", { rim: "#8f0010", field: KOE.red, rimWidth: 6 }),
          k.symbol("goat", { x: 61, y: 61, size: 84 }, { main: WHITE, accent: WHITE, ground: KOE.red }),
        ],
      },
      {
        title: "Cathedral shield",
        note: "The first Bundesliga design: the cathedral full height on a white shield with the white goat in front and the name on a red chief.",
        looks: {
          full: "A white pointed shield with a red edge. A red band across the top reads 1. FC KÖLN in white; below, a red cathedral front with two tall spires, and a white goat outlined in red standing in front of it.",
          small: "The white pointed shield with a large red twin-spired cathedral.",
        },
        full: (k) => [
          k.shield("heater", { rim: KOE.red, field: WHITE }),
          k.pattern({ kind: "chief", colour: KOE.red, height: 27 }),
          text("1. FC KÖLN", { x: 60, baseline: 22, cap: 12, fill: WHITE, tracking: 0.06, maxWidth: 80 }),
          k.symbol(
            "cathedral",
            { x: 68, y: 62, size: 54 },
            { main: KOE.red, accent: KOE.red, ground: WHITE },
          ),
          `<g stroke="${KOE.red}" stroke-width="6" stroke-linejoin="round">${k.symbol("goat", { x: 42, y: 88, size: 46 }, { main: KOE.red, accent: KOE.red, ground: KOE.red })}</g>`,
          k.symbol("goat", { x: 42, y: 88, size: 46 }, { main: WHITE, accent: WHITE, ground: KOE.red }),
        ],
        small: (k) => [
          k.shield("heater", { rim: KOE.red, field: WHITE, rimWidth: 7 }),
          k.symbol(
            "cathedral",
            { x: 60, y: 58, size: 82 },
            { main: KOE.red, accent: KOE.red, ground: WHITE },
          ),
        ],
      },
      {
        title: "Three crowns",
        note: "The three crowns of the Magi from Cologne's city arms on a red chief, with Hennes the goat below: the city and the mascot, without the cathedral.",
        looks: {
          full: "A white pointed shield with a red edge: a red band across the top with three gold crowns, and a red goat standing below.",
          small: "The white shield with its red top band of three gold crowns and a red goat.",
        },
        full: (k) => [
          k.shield("heater", { rim: KOE.red, field: WHITE }),
          k.pattern({ kind: "chief", colour: KOE.red, height: 32 }),
          ...[34, 60, 86].map((x) =>
            k.symbol(
              "crown",
              { x, y: 19, size: 20 },
              { main: "#f2c230", accent: "#f2c230", ground: KOE.red },
            ),
          ),
          k.symbol("goat", { x: 58, y: 70, size: 58 }, { main: KOE.red, accent: KOE.red, ground: WHITE }),
        ],
        small: (k) => [
          k.shield("heater", { rim: KOE.red, field: WHITE, rimWidth: 7 }),
          k.pattern({ kind: "chief", colour: KOE.red, height: 34 }),
          k.symbol(
            "crown",
            { x: 60, y: 21, size: 30 },
            { main: "#f2c230", accent: "#f2c230", ground: KOE.red },
          ),
          k.symbol("goat", { x: 58, y: 72, size: 66 }, { main: KOE.red, accent: KOE.red, ground: WHITE }),
        ],
      },
    ],
  },
  {
    slug: "eintracht-frankfurt",
    name: "Eintracht Frankfurt",
    leagueId: "bundesliga",
    nickname: "Die Adler",
    founded: 1899,
    short: "SGE",
    colours: [
      { name: "Red", hex: SGE.red },
      { name: "Black", hex: BLACK },
      { name: "White", hex: WHITE },
    ],
    band: { bg: "#151515", ink: WHITE, muted: "#dcdcdc", accent: "#ff5a5a" },
    inspiration:
      "The eagle, Frankfurt's heraldic bird and the club's nickname, Die Adler: a crowned red eagle displayed with an E on its breast shield, in a red and white roundel lettered EINTRACHT FRANKFURT.",
    resemblance: {
      level: "high",
      note: "Close. A red eagle in a red and white roundel with the club's name round it is the official badge's idea, and the owner's reference follows it. Here the eagle is drawn new with separate feathers and scalloped wing coverts, a small crown and an E on a breast shield, and the lettering is TableTalk's own. The first red eagle, the black eagle roundel and the city eagle shield are the alternatives.",
    },
    composition: "crowned eagle in a lettered roundel",
    reference:
      "Custom club-inspired artwork — user supplied, AI-generated design reference (28 Nov 2026). The image itself is the full crest in use (supplied/crests, described in supplied.ts); this TableTalk drawing is kept as its alternative and is the small crest. Not official, not licensed.",
    looks: {
      full: "A white roundel with a red edge and a thin red ring, EINTRACHT over the top and FRANKFURT under the bottom in black. A red eagle fills the middle, wings spread with seven long feathers each under scalloped coverts, head turned left, a small crown above it, a white shield with a red E on its breast, a fanned tail and spread talons.",
      small:
        "The white roundel with a heavy red edge and a large, simplified red eagle without crown or shield.",
    },
    full: (k) => [
      k.shield("roundel", { rim: SGE.red, field: WHITE, rimWidth: 4.5 }),
      k.ring(49.8, 1.6, SGE.red),
      arc("EINTRACHT", { r: 42, cap: 9.5, side: "top", fill: BLACK, maxSweep: 140 }),
      arc("FRANKFURT", { r: 42, cap: 9.5, side: "bottom", fill: BLACK, maxSweep: 140 }),
      k.symbol("eagle-crowned", { x: 60, y: 60, size: 60 }, { main: SGE.red, accent: WHITE, ground: WHITE }),
      text("E", { x: 60, baseline: 66.3, cap: 6, fill: SGE.red, tracking: 0 }),
    ],
    small: (k) => [
      k.shield("roundel", { rim: SGE.red, field: WHITE, rimWidth: 7 }),
      k.symbol(
        "eagle-heraldic",
        { x: 60, y: 60, size: 92 },
        { main: SGE.red, accent: SGE.red, ground: WHITE },
      ),
    ],
    alternatives: [
      {
        title: "Red eagle, first refinement",
        note: "The refinement-round design, before the owner-supplied references: a red eagle with rounded feathers on a plain red-edged roundel, without crown, shield or lettering.",
        looks: {
          full: "A white roundel with a red edge and a thin red ring inside it. A red eagle fills the middle, wings raised with six rounded feathers each, head turned left with a black beak, a fanned three-feather tail and black talons.",
          small: "The white roundel with a heavy red edge and a large red eagle.",
        },
        full: (k) => [
          k.shield("roundel", { rim: SGE.red, field: WHITE }),
          k.ring(48.5, 2, SGE.red),
          k.symbol(
            "eagle-heraldic",
            { x: 60, y: 60, size: 84 },
            { main: SGE.red, accent: BLACK, ground: WHITE },
          ),
        ],
        small: (k) => [
          k.shield("roundel", { rim: SGE.red, field: WHITE, rimWidth: 7 }),
          k.symbol(
            "eagle-heraldic",
            { x: 60, y: 60, size: 92 },
            { main: SGE.red, accent: SGE.red, ground: WHITE },
          ),
        ],
      },
      {
        title: "Black eagle roundel",
        note: "The first Bundesliga design: a black eagle in a red and black ring, nearer the club's black eagle.",
        looks: {
          full: "A white roundel with a black edge and a red ring inside it. A black eagle fills the middle, wings raised with long feathers, head turned left with a red beak, red talons and a fanned tail.",
          small: "The white roundel in its red ring, with a large black eagle.",
        },
        full: (k) => [
          k.shield("roundel", { rim: BLACK, field: WHITE }),
          k.ring(49, 7, SGE.red),
          k.ring(44.8, 1.6, BLACK),
          k.symbol("eagle", { x: 60, y: 60, size: 80 }, { main: BLACK, accent: SGE.red, ground: WHITE }),
        ],
        small: (k) => [
          k.shield("roundel", { rim: BLACK, field: WHITE, rimWidth: 6 }),
          k.ring(47, 8, SGE.red),
          k.symbol("eagle", { x: 60, y: 60, size: 86 }, { main: BLACK, accent: SGE.red, ground: WHITE }),
        ],
      },
      {
        title: "City eagle shield",
        note: "Frankfurt's city arms reversed into the club's colours: a white eagle on a red shield, nearer the city than the club badge.",
        looks: {
          full: "A red pointed shield with a black edge and a large white eagle with gold beak and talons.",
          small: "The red pointed shield with a large white eagle.",
        },
        full: (k) => [
          k.shield("heater", { rim: BLACK, field: SGE.red }),
          k.symbol("eagle", { x: 60, y: 56, size: 84 }, { main: WHITE, accent: "#f2c230", ground: SGE.red }),
        ],
        small: (k) => [
          k.shield("heater", { rim: BLACK, field: SGE.red, rimWidth: 7 }),
          k.symbol("eagle", { x: 60, y: 56, size: 92 }, { main: WHITE, accent: WHITE, ground: SGE.red }),
        ],
      },
    ],
  },
  {
    slug: "vfb-stuttgart",
    name: "VfB Stuttgart",
    leagueId: "bundesliga",
    nickname: "Die Schwaben",
    founded: 1893,
    short: "VFB",
    colours: [
      { name: "Red", hex: VFB.red },
      { name: "White", hex: WHITE },
      { name: "Württemberg gold", hex: VFB.gold },
    ],
    band: { bg: "#b5150f", ink: WHITE, muted: "#ffe2dd", accent: "#ffd54a" },
    inspiration:
      "VfB in Gothic-inspired red letters over STUTTGART, with the Württemberg arms (three black stag's antlers on gold) on a small shield between the founding year, 18 and 93, all on a white shield edged in red.",
    resemblance: {
      level: "high",
      note: "Close. Gothic VfB over STUTTGART and a small gold shield of Württemberg antlers, with 1893 split either side, is the official badge's arrangement, and the owner's reference follows it. Here the Gothic letters are drawn new by hand, the antlers are TableTalk's own and the other lettering is condensed sans-serif. The first refinement and the antler roundel are the alternatives.",
    },
    composition: "Gothic letters over regional arms",
    reference:
      "Custom club-inspired artwork — user supplied, AI-generated design reference (28 Nov 2026). The image itself is the full crest in use (supplied/crests, described in supplied.ts); this TableTalk drawing is kept as its alternative and is the small crest. Not official, not licensed.",
    looks: {
      full: "A white pointed shield with a red edge and a thin red line inside it. Large red Gothic-style VfB across the top, STUTTGART in small spaced black capitals under it, and a small gold shield outlined in black with three black hooked antlers stacked on it, between a red 18 on the left and 93 on the right.",
      small:
        "The white red-edged shield with large red Gothic VfB over a small gold shield with one black antler.",
    },
    full: (k) => [
      k.shield("heater", { rim: VFB.red, field: WHITE }),
      `<path d="${SHAPES.heater(7)}" fill="none" stroke="${VFB.red}" stroke-width="1.6"/>`,
      `<path d="${vfb(60, 44, 28)}" fill="${VFB.red}" fill-rule="evenodd"/>`,
      text("STUTTGART", { x: 60, baseline: 55, cap: 6, fill: BLACK, tracking: 0.28 }),
      `<path d="M41 60L79 60L79 78C79 92 70 100 60 105C50 100 41 92 41 78Z" fill="${VFB.gold}" stroke="${BLACK}" stroke-width="1.4"/>`,
      k.symbol("antler", { x: 59, y: 70, size: 33 }, { main: BLACK, accent: BLACK, ground: VFB.gold }),
      k.symbol("antler", { x: 59, y: 81, size: 30 }, { main: BLACK, accent: BLACK, ground: VFB.gold }),
      k.symbol("antler", { x: 59, y: 91.5, size: 23 }, { main: BLACK, accent: BLACK, ground: VFB.gold }),
      text("18", { x: 30, baseline: 79, cap: 9.5, fill: VFB.red, tracking: 0.02 }),
      text("93", { x: 90, baseline: 79, cap: 9.5, fill: VFB.red, tracking: 0.02 }),
    ],
    small: (k) => [
      k.shield("heater", { rim: VFB.red, field: WHITE, rimWidth: 7 }),
      `<path d="${vfb(60, 49, 31)}" fill="${VFB.red}" fill-rule="evenodd"/>`,
      `<path d="M39 57L81 57L81 74C81 88 71 96 60 101C49 96 39 88 39 74Z" fill="${VFB.gold}" stroke="${BLACK}" stroke-width="2"/>`,
      k.symbol("antler", { x: 59, y: 73, size: 40 }, { main: BLACK, accent: BLACK, ground: VFB.gold }),
    ],
    alternatives: [
      {
        title: "Italic VfB, first refinement",
        note: "The refinement-round design, before the owner-supplied references: slanted condensed VfB over a red bar, with three antlers on the gold lower half of the shield.",
        looks: {
          full: "A pointed shield with a red edge. The top is white with large slanted red VfB; a red bar crosses the middle; the lower part is gold with three black heraldic antlers stacked one above the other, each an arched beam with four curving tines, narrowing towards the point.",
          small:
            "The red-edged shield: slanted red VfB on white over a gold base with one large black antler.",
        },
        full: (k) => [
          k.shield("heater", { rim: VFB.red, field: WHITE }),
          k.pattern({ kind: "base", colour: VFB.gold, from: 58 }),
          k.band(55, 7, VFB.red),
          italic(
            text("VfB", { keepCase: true, x: 60, baseline: 47, cap: 28, fill: VFB.red, tracking: 0.02 }),
            60,
            33,
          ),
          k.symbol("antler", { x: 58, y: 70, size: 48 }, { main: BLACK, accent: BLACK, ground: VFB.gold }),
          k.symbol("antler", { x: 58, y: 85, size: 40 }, { main: BLACK, accent: BLACK, ground: VFB.gold }),
          k.symbol("antler", { x: 58, y: 98.5, size: 28 }, { main: BLACK, accent: BLACK, ground: VFB.gold }),
        ],
        small: (k) => [
          k.shield("heater", { rim: VFB.red, field: WHITE, rimWidth: 7 }),
          k.pattern({ kind: "base", colour: VFB.gold, from: 58 }),
          k.band(54, 7, VFB.red),
          italic(
            text("VfB", {
              keepCase: true,
              x: 60,
              baseline: 48,
              cap: 30,
              fill: VFB.red,
              tracking: 0.02,
              maxWidth: 80,
            }),
            60,
            33,
          ),
          k.symbol("antler", { x: 58, y: 80, size: 62 }, { main: BLACK, accent: BLACK, ground: VFB.gold }),
        ],
      },
      {
        title: "Antler roundel",
        note: "The three Württemberg antlers on gold in a red ring lettered VFB STUTTGART: the region's arms as the whole badge.",
        looks: {
          full: "A gold roundel in a red ring lettered VFB STUTTGART in white, with three black antlers stacked in the middle.",
          small: "A gold roundel in a heavy red ring with three black antlers.",
        },
        full: (k) => [
          k.shield("roundel", { rim: VFB.red, field: VFB.gold, rimWidth: 3 }),
          k.ring(47, 15, VFB.red),
          arc("VFB STUTTGART", { r: 46.5, cap: 10, side: "top", fill: WHITE, maxSweep: 170 }),
          k.symbol("antler", { x: 58, y: 50, size: 50 }, { main: BLACK, accent: BLACK, ground: VFB.gold }),
          k.symbol("antler", { x: 58, y: 66, size: 50 }, { main: BLACK, accent: BLACK, ground: VFB.gold }),
          k.symbol("antler", { x: 58, y: 82, size: 50 }, { main: BLACK, accent: BLACK, ground: VFB.gold }),
        ],
        small: (k) => [
          k.shield("roundel", { rim: VFB.red, field: VFB.gold, rimWidth: 11 }),
          k.symbol("antler", { x: 58, y: 46, size: 68 }, { main: BLACK, accent: BLACK, ground: VFB.gold }),
          k.symbol("antler", { x: 58, y: 70, size: 68 }, { main: BLACK, accent: BLACK, ground: VFB.gold }),
        ],
      },
    ],
  },
  {
    slug: "schalke-04",
    name: "Schalke 04",
    leagueId: "bundesliga",
    nickname: "Die Knappen",
    founded: 1904,
    short: "SCH",
    colours: [
      { name: "Royal blue", hex: S04.blue },
      { name: "White", hex: WHITE },
    ],
    band: { bg: S04.blue, ink: WHITE, muted: "#dbe7f6", accent: "#a9cdf5" },
    inspiration:
      "Schalke's royal blue and white, and S04, the name supporters use for the club from Gelsenkirchen's coalfields.",
    resemblance: {
      level: "high",
      note: "White S04 on a royal blue roundel is the official badge's idea. Here the letters are condensed capitals in a row and a white ring runs inside the edge. The hammer and pick shield is the lower-resemblance alternative.",
    },
    composition: "monogram in a ringed roundel",
    looks: {
      full: "A royal blue roundel with a thin white ring inside its edge and large white S04 across the middle.",
      small: "The royal blue roundel with large white S04.",
    },
    full: (k) => [
      k.shield("roundel", { rim: "#003366", field: S04.blue }),
      k.ring(47, 3, WHITE),
      text("S04", { x: 60, baseline: 78, cap: 36, fill: WHITE, tracking: 0.04, maxWidth: 76 }),
    ],
    small: (k) => [
      k.shield("roundel", { rim: "#003366", field: S04.blue, rimWidth: 7 }),
      text("S04", { x: 60, baseline: 80, cap: 40, fill: WHITE, tracking: 0.02, maxWidth: 92 }),
    ],
    alternatives: [
      {
        title: "Hammer and pick",
        note: "The miners' crossed hammer and pick, for the Knappen (the pitmen) of the Ruhr, on a blue shield with S04 below.",
        looks: {
          full: "A royal blue pointed shield with a dark blue edge: a white hammer and pick crossed in the middle and white S04 below.",
          small: "The blue pointed shield with a large white crossed hammer and pick.",
        },
        full: (k) => [
          k.shield("heater", { rim: "#003366", field: S04.blue }),
          k.symbol("hammers", { x: 60, y: 46, size: 62 }, { main: WHITE, accent: WHITE, ground: S04.blue }),
          text("S04", { x: 60, baseline: 96, cap: 16, fill: WHITE, tracking: 0.1 }),
        ],
        small: (k) => [
          k.shield("heater", { rim: "#003366", field: S04.blue, rimWidth: 7 }),
          k.symbol("hammers", { x: 60, y: 54, size: 84 }, { main: WHITE, accent: WHITE, ground: S04.blue }),
        ],
      },
    ],
  },
  {
    slug: "sc-freiburg",
    name: "SC Freiburg",
    leagueId: "bundesliga",
    nickname: "Breisgau-Brasilianer",
    founded: 1904,
    short: "SCF",
    colours: [
      { name: "Black", hex: BLACK },
      { name: "White", hex: WHITE },
      { name: "Red", hex: SCF.red },
    ],
    band: { bg: "#141414", ink: WHITE, muted: "#dddddd", accent: "#ff4d5e" },
    inspiration:
      "Freiburg's upright oval, divided on the slant: a bird of prey's head on the white side and the club's letters in a ring on the black.",
    resemblance: {
      level: "high",
      note: "The divided oval with a bird's head on white and a monogram on black is the official badge's arrangement. Here the bird is a raptor with flared neck feathers and the letters are SCF in capitals inside a ring. The Black Forest firs design is the lower-resemblance alternative.",
    },
    composition: "divided oval with bird and monogram",
    looks: {
      full: "An upright oval with a black edge, divided by a slanting line: white upper left with a black raptor's head facing left, black lower right with a white ring holding SCF.",
      small: "The divided black and white oval with a large black raptor's head on the white side.",
    },
    full: (k) => [
      k.shield("oval", { rim: BLACK, field: WHITE }),
      cut("M86 0L120 0L120 120L30 120Z", BLACK, k.clip),
      k.symbol("raptor-head", { x: 42, y: 42, size: 52 }, { main: BLACK, accent: BLACK, ground: WHITE }),
      `<circle cx="78" cy="80" r="15" fill="none" stroke="${WHITE}" stroke-width="3"/>`,
      text("SCF", { x: 78, baseline: 85, cap: 10, fill: WHITE, tracking: 0.04, maxWidth: 22 }),
    ],
    small: (k) => [
      k.shield("oval", { rim: BLACK, field: WHITE, rimWidth: 7 }),
      cut("M92 0L120 0L120 120L40 120Z", BLACK, k.clip),
      k.symbol("raptor-head", { x: 44, y: 46, size: 66 }, { main: BLACK, accent: BLACK, ground: WHITE }),
    ],
    alternatives: [
      {
        title: "Black Forest firs",
        note: "Three firs of the Black Forest, the hills round Freiburg, over a black base with the club's name: the region, not the badge.",
        looks: {
          full: "An upright white oval with a black edge: three black fir trees, the middle one tallest, above a black base reading SC FREIBURG in white.",
          small: "The white oval with three black firs over a black base.",
        },
        full: (k) => [
          k.shield("oval", { rim: BLACK, field: WHITE }),
          k.symbol("fir", { x: 38, y: 52, size: 34 }, { main: BLACK, accent: BLACK, ground: WHITE }),
          k.symbol("fir", { x: 82, y: 52, size: 34 }, { main: BLACK, accent: BLACK, ground: WHITE }),
          k.symbol("fir", { x: 60, y: 44, size: 46 }, { main: BLACK, accent: BLACK, ground: WHITE }),
          k.pattern({ kind: "base", colour: BLACK, from: 74 }),
          k.rule(76, SCF.red, 3),
          text("SC FREIBURG", { x: 60, baseline: 93, cap: 10, fill: WHITE, tracking: 0.06, maxWidth: 66 }),
        ],
        small: (k) => [
          k.shield("oval", { rim: BLACK, field: WHITE, rimWidth: 7 }),
          k.symbol("fir", { x: 36, y: 50, size: 42 }, { main: BLACK, accent: BLACK, ground: WHITE }),
          k.symbol("fir", { x: 84, y: 50, size: 42 }, { main: BLACK, accent: BLACK, ground: WHITE }),
          k.symbol("fir", { x: 60, y: 42, size: 56 }, { main: BLACK, accent: BLACK, ground: WHITE }),
          k.pattern({ kind: "base", colour: BLACK, from: 76 }),
        ],
      },
    ],
  },
  {
    slug: "bayer-leverkusen",
    name: "Bayer Leverkusen",
    leagueId: "bundesliga",
    nickname: "Die Werkself",
    founded: 1904,
    short: "LEV",
    colours: [
      { name: "Red", hex: B04.red },
      { name: "Black", hex: BLACK },
      { name: "Yellow", hex: B04.yellow },
    ],
    band: { bg: "#151515", ink: WHITE, muted: "#dcdcdc", accent: "#ff5c5c" },
    inspiration:
      "Two red heraldic lions rampant, outlined in black, holding a white medallion between them with a large 04, the founding year on a yellow banner above and LEVERKUSEN on a yellow ribbon below: the club's supporters-and-banners arrangement, with 04 in place of the company cross.",
    resemblance: {
      level: "high",
      note: "Close. Red lions either side of a central medallion with yellow banners above and below is the official badge's arrangement, and the owner's reference follows it. Here the lions are drawn new, part by part, with flame-like locks of mane, the medallion carries 04 rather than the company's cross (a trademark we leave out) and the lettering is TableTalk's own. The first refinement, the white roundel supporters and the Werkself lion shield are the alternatives.",
    },
    composition: "supporters and banners round a disc of numerals",
    reference:
      "Custom club-inspired artwork — user supplied, AI-generated design reference (28 Nov 2026). The image itself is the full crest in use (supplied/crests, described in supplied.ts); this TableTalk drawing is kept as its alternative and is the small crest. Not official, not licensed.",
    looks: {
      full: "Two red lions rampant, outlined in black, face each other with manes of flame-like locks and open mouths, their raised forepaws holding a white medallion ringed in black from behind. The medallion carries a large black 04 outlined in red. A yellow banner above reads 1904, and a wide yellow ribbon below reads LEVERKUSEN, both in black.",
      small:
        "A white roundel with a black ring round a large red 04, over a yellow band. The lions are left out at this size.",
    },
    full: (k) => [
      `<g stroke="${BLACK}" stroke-width="2.6" stroke-linejoin="round" paint-order="stroke">${k.symbol("lion-supporter", { x: 25, y: 53, size: 58, flip: true }, { main: B04.red, accent: BLACK, ground: WHITE })}${k.symbol("lion-supporter", { x: 95, y: 53, size: 58 }, { main: B04.red, accent: BLACK, ground: WHITE })}</g>`,
      k.shield("medallion", { rim: BLACK, field: WHITE, rimWidth: 3.5 }),
      outlined("04", { x: 60, baseline: 65, cap: 20, tracking: 0.02 }, BLACK, B04.red, 2.4),
      `<path d="M38 10Q60 4 82 10L84 25Q60 19 36 25Z" fill="${B04.yellow}" stroke="${BLACK}" stroke-width="1.6" stroke-linejoin="round"/>`,
      text("1904", { x: 60, baseline: 20, cap: 8.5, fill: BLACK, tracking: 0.06 }),
      banner(83, 20, 9, B04.yellow, BLACK),
      text("LEVERKUSEN", { x: 60, baseline: 101.5, cap: 10.5, fill: BLACK, tracking: 0.03, maxWidth: 80 }),
    ],
    small: (k) => [
      k.shield("roundel", { rim: BLACK, field: WHITE, rimWidth: 6 }),
      k.band(84, 30, B04.yellow),
      k.disc(60, 52, 32, BLACK),
      k.disc(60, 52, 26, WHITE),
      text("04", { x: 60, baseline: 66, cap: 28, fill: B04.red, tracking: 0.02 }),
    ],
    alternatives: [
      {
        title: "Medallion supporters, first refinement",
        note: "The refinement-round design, before the owner-supplied references: the same free-standing arrangement with simpler, smaller lions and a red 04.",
        looks: {
          full: "Two red lions rampant, outlined in white, face each other with their forepaws on a white medallion ringed in black that carries a red 04 outlined in black. A yellow ribbon above reads 1904, and a wide yellow ribbon below, on which the lions stand, reads LEVERKUSEN, both in black. No enclosing roundel.",
          small:
            "A white roundel with a black ring round a large red 04, over a yellow band. The lions are left out at this size.",
        },
        full: (k) => [
          k.shield("medallion", { rim: BLACK, field: WHITE, rimWidth: 3.5 }),
          outlined("04", { x: 60, baseline: 64.5, cap: 19, tracking: 0.04 }, B04.red, BLACK, 2.2),
          banner(84, 18, 8, B04.yellow, BLACK),
          text("LEVERKUSEN", { x: 60, baseline: 100.5, cap: 9.5, fill: BLACK, tracking: 0.04, maxWidth: 74 }),
          `<g stroke="${WHITE}" stroke-width="4" stroke-linejoin="round" paint-order="stroke">${k.symbol("lion-heraldic", { x: 25, y: 57, size: 48, flip: true }, { main: B04.red, accent: BLACK, ground: WHITE })}${k.symbol("lion-heraldic", { x: 95, y: 57, size: 48 }, { main: B04.red, accent: BLACK, ground: WHITE })}</g>`,
          `<path d="M38 10Q60 4 82 10L84 24Q60 18 36 24Z" fill="${B04.yellow}" stroke="${BLACK}" stroke-width="1.4" stroke-linejoin="round"/>`,
          text("1904", { x: 60, baseline: 19.5, cap: 8, fill: BLACK, tracking: 0.08 }),
        ],
        small: (k) => [
          k.shield("roundel", { rim: BLACK, field: WHITE, rimWidth: 6 }),
          k.band(84, 30, B04.yellow),
          k.disc(60, 52, 32, BLACK),
          k.disc(60, 52, 26, WHITE),
          text("04", { x: 60, baseline: 66, cap: 28, fill: B04.red, tracking: 0.02 }),
        ],
      },
      {
        title: "White roundel supporters",
        note: "The first Bundesliga design: the same arrangement with simpler lions, all inside a white roundel.",
        looks: {
          full: "A white roundel with a black edge. Two red lions rampant face each other, holding a white disc ringed in black with a red 04 outlined in black. A yellow ribbon above reads 1904, and a yellow ribbon across the bottom reads LEVERKUSEN, both in black.",
          small: "A white roundel with a black ring round a large red 04, over a yellow band.",
        },
        full: (k) => [
          k.shield("roundel", { rim: BLACK, field: WHITE, rimWidth: 3 }),
          k.symbol(
            "lion-rampant-small",
            { x: 27, y: 56, size: 46, flip: true },
            { main: B04.red, accent: BLACK, ground: WHITE },
          ),
          k.symbol(
            "lion-rampant-small",
            { x: 93, y: 56, size: 46 },
            { main: B04.red, accent: BLACK, ground: WHITE },
          ),
          k.disc(60, 56, 21, BLACK),
          k.disc(60, 56, 18, WHITE),
          outlined("04", { x: 60, baseline: 64.5, cap: 17, tracking: 0.04 }, B04.red, BLACK, 2.2),
          `<path d="M38 12Q60 6 82 12L84 26Q60 20 36 26Z" fill="${B04.yellow}" stroke="${BLACK}" stroke-width="1.4" stroke-linejoin="round"/>`,
          text("1904", { x: 60, baseline: 21.5, cap: 8, fill: BLACK, tracking: 0.08 }),
          banner(84, 17, 8, B04.yellow, BLACK),
          text("LEVERKUSEN", { x: 60, baseline: 100, cap: 9, fill: BLACK, tracking: 0.04, maxWidth: 72 }),
        ],
        small: (k) => [
          k.shield("roundel", { rim: BLACK, field: WHITE, rimWidth: 6 }),
          k.band(84, 30, B04.yellow),
          k.disc(60, 52, 32, BLACK),
          k.disc(60, 52, 26, WHITE),
          text("04", { x: 60, baseline: 66, cap: 28, fill: B04.red, tracking: 0.02 }),
        ],
      },
      {
        title: "Werkself lion",
        note: "One black lion rampant on red under a black chief with B04: the club's red and black and its lions, away from the official arrangement.",
        looks: {
          full: "A red pointed shield with a black edge: a black band across the top with white B04, and a large black lion rampant below.",
          small: "The red pointed shield with a large black lion rampant under a black band.",
        },
        full: (k) => [
          k.shield("heater", { rim: BLACK, field: B04.red }),
          k.pattern({ kind: "chief", colour: BLACK, height: 32 }),
          text("B04", { x: 60, baseline: 26, cap: 17, fill: WHITE, tracking: 0.1 }),
          k.symbol(
            "lion-rampant",
            { x: 60, y: 72, size: 60 },
            { main: BLACK, accent: B04.yellow, ground: B04.red },
          ),
        ],
        small: (k) => [
          k.shield("heater", { rim: BLACK, field: B04.red, rimWidth: 7 }),
          k.pattern({ kind: "chief", colour: BLACK, height: 26 }),
          k.symbol(
            "lion-rampant",
            { x: 60, y: 70, size: 76 },
            { main: BLACK, accent: BLACK, ground: B04.red },
          ),
        ],
      },
    ],
  },
  {
    slug: "fc-augsburg",
    name: "FC Augsburg",
    leagueId: "bundesliga",
    nickname: "Die Fuggerstädter",
    founded: 1907,
    short: "FCA",
    colours: [
      { name: "Red", hex: FCA.red },
      { name: "Green", hex: FCA.green },
      { name: "White", hex: WHITE },
    ],
    band: { bg: "#8f2a27", ink: WHITE, muted: "#f8e0de", accent: FCA.gold },
    inspiration:
      "The Zirbelnuss, the pine cone on its column that has been Augsburg's emblem since Roman times, on the city's red and white, under FCA.",
    resemblance: {
      level: "high",
      note: "A green pine cone on a gold capital over red and white halves, under FCA, is the official badge's arrangement. Here the shield is round-bottomed with a gold edge line, the cone is drawn as a lattice and a green rule runs under the letters. The pine cone roundel is the lower-resemblance alternative.",
    },
    composition: "city emblem on divided shield under lettered chief",
    looks: {
      full: "A round-bottomed shield with a red edge. A white band across the top with red FCA and a green rule under it; below, the left half red and the right half white, with a green pine cone on a gold column capital in the middle and 1907 in gold at the foot.",
      small:
        "The round-bottomed shield: red FCA on white, red and white halves and a large green pine cone on gold.",
    },
    full: (k) => [
      k.shield("english", { rim: FCA.red, field: WHITE }),
      cut("M0 34L60 34L60 120L0 120Z", FCA.red, k.clip),
      k.pattern({ kind: "chief", colour: WHITE, height: 34 }),
      k.rule(34, FCA.green, 3.5),
      text("FCA", { x: 60, baseline: 28, cap: 20, fill: FCA.red, tracking: 0.08 }),
      k.symbol("pine-cone", { x: 60, y: 70, size: 50 }, { main: FCA.green, accent: FCA.gold, ground: WHITE }),
      text("1907", { x: 60, baseline: 104, cap: 7, fill: FCA.gold, tracking: 0.2 }),
    ],
    small: (k) => [
      k.shield("english", { rim: FCA.red, field: WHITE, rimWidth: 7 }),
      cut("M0 34L60 34L60 120L0 120Z", FCA.red, k.clip),
      k.pattern({ kind: "chief", colour: WHITE, height: 34 }),
      text("FCA", { x: 60, baseline: 29, cap: 20, fill: FCA.red, tracking: 0.04 }),
      k.symbol(
        "pine-cone",
        { x: 60, y: 76, size: 62 },
        { main: FCA.green, accent: FCA.gold, ground: FCA.green },
      ),
    ],
    alternatives: [
      {
        title: "Pine cone roundel",
        note: "The Zirbelnuss alone on a white disc in a red roundel lettered FC AUGSBURG: the city's emblem without the shield arrangement.",
        looks: {
          full: "A red roundel with FC AUGSBURG over the top in white and a white disc holding a green pine cone on a gold capital.",
          small: "A red roundel with a white disc and a large green pine cone.",
        },
        full: (k) => [
          k.shield("roundel", { rim: FCA.green, field: FCA.red }),
          k.disc(60, 62, 31, WHITE),
          arc("FC AUGSBURG", { r: 44, cap: 10, side: "top", fill: WHITE, maxSweep: 150 }),
          k.symbol(
            "pine-cone",
            { x: 60, y: 62, size: 52 },
            { main: FCA.green, accent: FCA.gold, ground: WHITE },
          ),
        ],
        small: (k) => [
          k.shield("roundel", { rim: FCA.green, field: FCA.red, rimWidth: 7 }),
          k.disc(60, 60, 40, WHITE),
          k.symbol(
            "pine-cone",
            { x: 60, y: 60, size: 68 },
            { main: FCA.green, accent: FCA.gold, ground: FCA.green },
          ),
        ],
      },
    ],
  },
  {
    slug: "tsg-hoffenheim",
    name: "TSG Hoffenheim",
    leagueId: "bundesliga",
    nickname: "Die Kraichgauer",
    founded: 1899,
    short: "TSG",
    colours: [
      { name: "Blue", hex: TSG.blue },
      { name: "White", hex: WHITE },
    ],
    band: { bg: "#154f94", ink: WHITE, muted: "#dce8f7", accent: "#a9cbf5" },
    inspiration:
      "Hoffenheim's peaked shield in blue and white, crossed by a white band carrying TSG 1899, the gymnastics and sports club's name and year.",
    resemblance: {
      level: "high",
      note: "A peaked blue shield crossed by a white diagonal band lettered with the club's name is the official badge's arrangement. Here the band carries one line, TSG 1899, without the village name, and a white line runs inside the edge. The TSG roundel is the lower-resemblance alternative.",
    },
    composition: "lettered band across a peaked shield",
    looks: {
      full: "A blue shield rising to a point at the top, with sloping shoulders and a point below, a thin white line inside its edge. A broad white band runs from upper right to lower left with TSG 1899 along it in blue.",
      small: "The blue peaked shield crossed by a broad white band with TSG in blue.",
    },
    full: (k) => [
      k.shield("peaked", { rim: TSG.blue, field: TSG.blue, rimWidth: 3 }),
      `<path d="${SHAPES.peaked(6)}" fill="none" stroke="${WHITE}" stroke-width="2"/>`,
      cut("M106 10L122 26L26 122L10 106Z", WHITE, k.clip),
      turnedText("TSG 1899", 64, 64, 12, -45, TSG.blue, 76),
    ],
    small: (k) => [
      k.shield("peaked", { rim: TSG.blue, field: TSG.blue, rimWidth: 7 }),
      cut("M104 6L124 26L26 124L6 104Z", WHITE, k.clip),
      turnedText("TSG", 64, 64, 18, -45, TSG.blue, 60),
    ],
    alternatives: [
      {
        title: "TSG roundel",
        note: "The club's letters and year in a blue roundel over the rolling hills of the Kraichgau, its home region: no band and no peaked shield.",
        looks: {
          full: "A blue roundel with a thin white ring: large white TSG, 1899 below it, and two white wavy lines for the Kraichgau hills at the foot.",
          small: "A blue roundel with large white TSG.",
        },
        full: (k) => [
          k.shield("roundel", { rim: "#0e3f7a", field: TSG.blue }),
          k.ring(48, 2, WHITE),
          text("TSG", { x: 60, baseline: 60, cap: 28, fill: WHITE, tracking: 0.08 }),
          text("1899", { x: 60, baseline: 77, cap: 11, fill: WHITE, tracking: 0.2 }),
          k.pattern({ kind: "waves", colour: WHITE, from: 88, count: 2, gap: 7, width: 2.5 }),
        ],
        small: (k) => [
          k.shield("roundel", { rim: "#0e3f7a", field: TSG.blue, rimWidth: 7 }),
          text("TSG", { x: 60, baseline: 77, cap: 34, fill: WHITE, tracking: 0.04, maxWidth: 88 }),
        ],
      },
    ],
  },
  {
    slug: "paderborn-07",
    name: "Paderborn 07",
    leagueId: "bundesliga",
    nickname: "Die Ostwestfalen",
    founded: 1907,
    short: "SCP",
    colours: [
      { name: "Blue", hex: SCP.blue },
      { name: "Black", hex: BLACK },
      { name: "White", hex: WHITE },
    ],
    band: { bg: "#004a8f", ink: WHITE, muted: "#d6e5f4", accent: "#9cc8f2" },
    inspiration:
      "Paderborn's roundel, white over blue with a black bar between: SC above, the town's name on the bar and 07 below.",
    resemblance: {
      level: "high",
      note: "A white and blue roundel split by a black bar, with SC, PADERBORN and 07, is the official badge's arrangement. Here the bar stays inside the roundel and the name sits on the white just above it. The three hares design is the lower-resemblance alternative.",
    },
    composition: "divided roundel with lettering in tiers",
    looks: {
      full: "A roundel with a blue edge, white above and blue below, divided by a black bar. Black SC at the top, PADERBORN in black just above the bar, and a large white 07 on the blue.",
      small: "The white over blue roundel with its black bar, black SC above and white 07 below.",
    },
    full: (k) => [
      k.shield("roundel", { rim: SCP.blue, field: WHITE }),
      k.pattern({ kind: "base", colour: SCP.blue, from: 66 }),
      k.band(58, 8, BLACK),
      text("SC", { x: 60, baseline: 36, cap: 19, fill: BLACK, tracking: 0.08 }),
      text("PADERBORN", { x: 60, baseline: 53, cap: 11, fill: BLACK, tracking: 0.02, maxWidth: 84 }),
      text("07", { x: 60, baseline: 100, cap: 25, fill: WHITE, tracking: 0.06 }),
    ],
    small: (k) => [
      k.shield("roundel", { rim: SCP.blue, field: WHITE, rimWidth: 7 }),
      k.pattern({ kind: "base", colour: SCP.blue, from: 62 }),
      k.band(54, 9, BLACK),
      text("SC", { x: 60, baseline: 46, cap: 24, fill: BLACK, tracking: 0.04 }),
      text("07", { x: 60, baseline: 98, cap: 26, fill: WHITE, tracking: 0.04 }),
    ],
    alternatives: [
      {
        title: "Three hares",
        note: "Three hares chasing each other, from the famous window in Paderborn Cathedral's cloister: the town's best-known emblem, in the club's blue. Kept upright so they read as hares even when small.",
        looks: {
          full: "A blue roundel with a thin white ring and three white hares with long raised ears, all upright: one at the top running left, two below running towards each other. SCP 07 below.",
          small: "A blue roundel with three upright white hares in a triangle.",
        },
        full: (k) => [
          k.shield("roundel", { rim: BLACK, field: SCP.blue }),
          k.ring(49, 2, WHITE),
          k.symbol(
            "three-hares",
            { x: 60, y: 54, size: 70 },
            { main: WHITE, accent: WHITE, ground: SCP.blue },
          ),
          text("SCP 07", { x: 60, baseline: 100, cap: 11, fill: WHITE, tracking: 0.1 }),
        ],
        small: (k) => [
          k.shield("roundel", { rim: BLACK, field: SCP.blue, rimWidth: 7 }),
          k.symbol(
            "three-hares",
            { x: 60, y: 60, size: 96 },
            { main: WHITE, accent: WHITE, ground: SCP.blue },
          ),
        ],
      },
    ],
  },
  {
    slug: "union-berlin",
    name: "Union Berlin",
    leagueId: "bundesliga",
    nickname: "Die Eisernen",
    founded: 1966,
    short: "FCU",
    colours: [
      { name: "Red", hex: FCU.red },
      { name: "Yellow", hex: FCU.yellow },
      { name: "White", hex: WHITE },
    ],
    band: { bg: "#b00018", ink: WHITE, muted: "#ffe9ad", accent: FCU.yellow },
    inspiration:
      "Union's emblem is lettering, not a shield: bold italic UNION in yellow on a slanted red plate, a separate 1.FC above it, and Berlin's bear walking upright in a round medallion over the plate's upper right corner.",
    resemblance: {
      level: "high",
      note: "Close. Yellow-edged red italic lettering read across, with Berlin's bear in a ringed medallion, is the official emblem's arrangement, and the owner's reference follows it. Here the name sits on a slanted plate rather than as free letters, the letters are condensed capitals and the bear is drawn new. The open ring and the Eisern bear shield are the lower-resemblance alternatives.",
    },
    composition: "horizontal lettering-led emblem with a bear medallion",
    reference:
      "Custom club-inspired artwork — user supplied, AI-generated design reference (28 Nov 2026). The image itself is the full crest in use (supplied/crests, described in supplied.ts); this TableTalk drawing is kept as its alternative and is the small crest. Not official, not licensed.",
    looks: {
      full: "A wide red plate slanted like italic type, edged in yellow, with UNION in large yellow italic capitals. Above it on the left, 1.FC in red italic capitals outlined in yellow; on the right, a round medallion ringed yellow and red, overlapping the plate's corner, holds a black Berlin bear walking upright with a red tongue and red claws.",
      small:
        "The slanted red plate with large yellow UNION under a yellow-ringed medallion with a black bear.",
    },
    full: (k) => [
      k.shield("plate", { rim: FCU.yellow, field: FCU.red, rimWidth: 3 }),
      italic(
        text("UNION", { x: 58, baseline: 97, cap: 31, fill: FCU.yellow, tracking: 0.02, maxWidth: 100 }),
        58,
        81,
      ),
      italic(
        outlined("1.FC", { x: 35, baseline: 52, cap: 27, tracking: 0.02 }, FCU.red, FCU.yellow, 4.5),
        35,
        38,
      ),
      k.disc(93, 37, 25, FCU.yellow),
      k.disc(93, 37, 22, FCU.red),
      k.disc(93, 37, 18.5, WHITE),
      k.symbol(
        "bear-heraldic",
        { x: 93, y: 37, size: 32, flip: true },
        { main: BLACK, accent: FCU.red, ground: WHITE },
      ),
    ],
    small: (k) => [
      k.shield("plate", { rim: FCU.yellow, field: FCU.red, rimWidth: 4 }),
      italic(
        text("UNION", { x: 60, baseline: 98, cap: 33, fill: FCU.yellow, tracking: 0.02, maxWidth: 104 }),
        60,
        82,
      ),
      k.disc(60, 31, 28, FCU.yellow),
      k.disc(60, 31, 24, WHITE),
      k.symbol(
        "berlin-bear",
        { x: 61, y: 31, size: 40, flip: true },
        { main: BLACK, accent: FCU.red, ground: WHITE },
      ),
    ],
    alternatives: [
      {
        title: "Slanted plate, first refinement",
        note: "The refinement-round design, before the owner-supplied references: the same horizontal plate with smaller 1.FC lettering and a simpler bear.",
        looks: {
          full: "A wide red plate, slanted like italic type and edged in yellow, fills the lower half with UNION in large yellow italic capitals. Above it on the left, 1.FC in red capitals outlined in yellow; on the right, a small disc ringed yellow and red holds a black Berlin bear on white, overlapping the plate's top corner.",
          small: "A slanted red plate with large yellow UNION, under a yellow-ringed disc with a black bear.",
        },
        full: (k) => [
          k.shield("plate", { rim: FCU.yellow, field: FCU.red, rimWidth: 3 }),
          italic(
            text("UNION", { x: 60, baseline: 94, cap: 27, fill: FCU.yellow, tracking: 0.04, maxWidth: 92 }),
            60,
            80,
          ),
          italic(
            outlined("1.FC", { x: 38, baseline: 50, cap: 22, tracking: 0.04 }, FCU.red, FCU.yellow, 4),
            38,
            39,
          ),
          k.disc(92, 40, 23, FCU.yellow),
          k.disc(92, 40, 20.5, FCU.red),
          k.disc(92, 40, 16, WHITE),
          k.symbol(
            "berlin-bear",
            { x: 91.5, y: 40, size: 27 },
            { main: BLACK, accent: FCU.red, ground: WHITE },
          ),
        ],
        small: (k) => [
          k.shield("plate", { rim: FCU.yellow, field: FCU.red, rimWidth: 4 }),
          italic(
            text("UNION", { x: 60, baseline: 96, cap: 30, fill: FCU.yellow, tracking: 0.02, maxWidth: 98 }),
            60,
            81,
          ),
          k.disc(60, 32, 27, FCU.yellow),
          k.disc(60, 32, 23, WHITE),
          k.symbol(
            "berlin-bear",
            { x: 59, y: 32, size: 38 },
            { main: BLACK, accent: FCU.red, ground: WHITE },
          ),
        ],
      },
      {
        title: "Open ring",
        note: "The first Bundesliga design: a red roundel opening like a C round the bear, with 1.FC and UNION round the ring.",
        looks: {
          full: "A red roundel with a yellow edge, opened on the right by a yellow gap so the red ring reads as a C. 1.FC over the top and UNION under the bottom in yellow; inside, a white disc with a black bear standing upright, red tongue out.",
          small: "The red ring opening to the right like a C, round a white disc with a black bear.",
        },
        full: (k) => [
          k.shield("roundel", { rim: FCU.yellow, field: FCU.red }),
          wedge(26, 54, -26, 26, FCU.yellow),
          k.disc(60, 60, 27, FCU.yellow),
          k.disc(60, 60, 24.5, WHITE),
          arc("1.FC", { r: 41, cap: 11, side: "top", fill: FCU.yellow, maxSweep: 70 }),
          arc("UNION", { r: 41, cap: 11, side: "bottom", fill: FCU.yellow, maxSweep: 80 }),
          k.symbol(
            "berlin-bear",
            { x: 59, y: 60, size: 40 },
            { main: BLACK, accent: FCU.red, ground: WHITE },
          ),
        ],
        small: (k) => [
          k.shield("roundel", { rim: FCU.yellow, field: FCU.red, rimWidth: 6 }),
          wedge(30, 56, -28, 28, FCU.yellow),
          k.disc(60, 60, 31, WHITE),
          k.symbol(
            "berlin-bear",
            { x: 59, y: 60, size: 52 },
            { main: BLACK, accent: FCU.red, ground: WHITE },
          ),
        ],
      },
      {
        title: "Eisern bear shield",
        note: "Berlin's bear in yellow on a red shield under FCU: the city and the club's colours without the great C.",
        looks: {
          full: "A red pointed shield with a yellow edge: FCU in yellow across the top and a large yellow bear standing upright below.",
          small: "The red pointed shield with a large yellow bear.",
        },
        full: (k) => [
          k.shield("heater", { rim: FCU.yellow, field: FCU.red }),
          text("FCU", { x: 60, baseline: 28, cap: 17, fill: FCU.yellow, tracking: 0.12 }),
          k.symbol(
            "berlin-bear",
            { x: 60, y: 70, size: 58 },
            { main: FCU.yellow, accent: WHITE, ground: FCU.red },
          ),
        ],
        small: (k) => [
          k.shield("heater", { rim: FCU.yellow, field: FCU.red, rimWidth: 7 }),
          k.symbol(
            "berlin-bear",
            { x: 60, y: 58, size: 80 },
            { main: FCU.yellow, accent: FCU.yellow, ground: FCU.red },
          ),
        ],
      },
    ],
  },
  {
    slug: "borussia-monchengladbach",
    name: "Borussia Mönchengladbach",
    leagueId: "bundesliga",
    nickname: "Die Fohlen",
    founded: 1900,
    short: "BMG",
    colours: [
      { name: "Black", hex: BLACK },
      { name: "White", hex: WHITE },
      { name: "Green", hex: BMG.green },
    ],
    band: { bg: "#141414", ink: WHITE, muted: "#dddddd", accent: "#3fd07c" },
    inspiration:
      "Gladbach's tall rhombus in black and white with a bold B, here crossed by a band of the club's green.",
    resemblance: {
      level: "high",
      note: "A tall black-edged rhombus with a B at its centre is the official badge's arrangement. Here a green band crosses the middle instead of black bars and the B is a plain condensed capital outlined in white. The foal roundel is the lower-resemblance alternative.",
    },
    composition: "single letter in a tall rhombus",
    looks: {
      full: "A tall white rhombus with a black edge and a thin black inner outline. A green band crosses the middle and a large black B outlined in white sits on it.",
      small: "The tall black-edged rhombus with a green band and a large black B.",
    },
    full: (k) => [
      k.shield("rhombus", { rim: BLACK, field: WHITE }),
      k.band(50, 20, BMG.green),
      `<path d="${SHAPES.rhombus(9)}" fill="none" stroke="${BLACK}" stroke-width="2.5"/>`,
      outlined("B", { x: 60, baseline: 78, cap: 36, tracking: 0 }, BLACK, WHITE, 4),
    ],
    small: (k) => [
      k.shield("rhombus", { rim: BLACK, field: WHITE, rimWidth: 7 }),
      k.band(48, 24, BMG.green),
      outlined("B", { x: 60, baseline: 82, cap: 44, tracking: 0 }, BLACK, WHITE, 4),
    ],
    alternatives: [
      {
        title: "Foal roundel",
        note: "The Fohlen, the foals, Gladbach's nickname since the young side of the 1960s and 70s: a white foal's head on green.",
        looks: {
          full: "A green roundel with a black edge and a thin white ring, a white foal's head and neck facing left, and BMG in white under it.",
          small: "A green roundel with a large white foal's head.",
        },
        full: (k) => [
          k.shield("roundel", { rim: BLACK, field: BMG.green }),
          k.ring(48, 2, WHITE),
          k.symbol("foal", { x: 58, y: 54, size: 58 }, { main: WHITE, accent: BLACK, ground: BMG.green }),
          text("BMG", { x: 60, baseline: 98, cap: 13, fill: WHITE, tracking: 0.12 }),
        ],
        small: (k) => [
          k.shield("roundel", { rim: BLACK, field: BMG.green, rimWidth: 7 }),
          k.symbol("foal", { x: 58, y: 60, size: 82 }, { main: WHITE, accent: WHITE, ground: BMG.green }),
        ],
      },
    ],
  },
  {
    slug: "sv-elversberg",
    name: "SV Elversberg",
    leagueId: "bundesliga",
    nickname: "Die SVE",
    founded: 1907,
    short: "SVE",
    colours: [
      { name: "Black", hex: BLACK },
      { name: "White", hex: WHITE },
      { name: "Gold", hex: SVE.gold },
    ],
    band: { bg: "#141414", ink: WHITE, muted: "#dddddd", accent: SVE.gold },
    inspiration:
      "Elversberg's roundel in black and white inside a gold edge, holding the club's letters SVE woven together.",
    resemblance: {
      level: "high",
      note: "Interlaced SVE in black on white, in a black ring with a gold edge, is the official badge's arrangement. Here the letters are condensed capitals overlapping in a row, not script. The chevron shield is the lower-resemblance alternative.",
    },
    composition: "interlaced monogram in a ringed roundel",
    looks: {
      full: "A roundel with a gold edge and a black ring round a white disc. Large black S, V and E overlap in a row across the middle, each outlined in white where they cross.",
      small: "The gold-edged roundel with its black ring and black SVE on white.",
    },
    full: (k) => [
      k.shield("roundel", { rim: SVE.gold, field: BLACK }),
      k.disc(60, 60, 44, WHITE),
      outlined("E", { x: 80, baseline: 76, cap: 34, tracking: 0 }, BLACK, WHITE, 3),
      outlined("V", { x: 61, baseline: 80, cap: 40, tracking: 0 }, BLACK, WHITE, 3),
      outlined("S", { x: 40, baseline: 84, cap: 46, tracking: 0 }, BLACK, WHITE, 3),
    ],
    small: (k) => [
      k.shield("roundel", { rim: SVE.gold, field: BLACK, rimWidth: 6 }),
      k.disc(60, 60, 42, WHITE),
      text("SVE", { x: 60, baseline: 76, cap: 32, fill: BLACK, tracking: -0.02, maxWidth: 72 }),
    ],
    alternatives: [
      {
        title: "Chevron shield",
        note: "The club's black and white with a gold edge on a pointed shield: a white chevron, SVE above and 1907 below. No monogram roundel.",
        looks: {
          full: "A black pointed shield with a gold edge: white SVE at the top, a white chevron across the middle and 1907 in gold below.",
          small: "The black pointed shield with a gold edge and a broad white chevron.",
        },
        full: (k) => [
          k.shield("heater", { rim: SVE.gold, field: BLACK }),
          k.pattern({ kind: "chevron", colour: WHITE, y: 52, width: 12, depth: 24 }),
          text("SVE", { x: 60, baseline: 36, cap: 20, fill: WHITE, tracking: 0.1 }),
          text("1907", { x: 60, baseline: 98, cap: 10, fill: SVE.gold, tracking: 0.16 }),
        ],
        small: (k) => [
          k.shield("heater", { rim: SVE.gold, field: BLACK, rimWidth: 7 }),
          k.pattern({ kind: "chevron", colour: WHITE, y: 50, width: 18, depth: 26 }),
        ],
      },
    ],
  },
  {
    slug: "mainz-05",
    name: "Mainz 05",
    leagueId: "bundesliga",
    nickname: "Die Nullfünfer",
    founded: 1905,
    short: "MAI",
    colours: [
      { name: "Red", hex: M05.red },
      { name: "White", hex: WHITE },
    ],
    band: { bg: "#a8101a", ink: WHITE, muted: "#ffdfe1", accent: WHITE },
    inspiration:
      "The Nullfünfer: Mainz's red roundel with a white 05, the year that gives the club its nickname, and the city's name above.",
    resemblance: {
      level: "high",
      note: "A large white 05 on a red roundel with a thin white ring is the official badge's idea. Here the numerals are plain condensed figures without the joined tops, and MAINZ runs over the top inside the ring. The Mainz wheel shield is the lower-resemblance alternative.",
    },
    composition: "numerals in a ringed roundel",
    looks: {
      full: "A red roundel with a thin white ring inside its edge, MAINZ in white over the top, and a large white 05 filling the middle.",
      small: "The red roundel with its white ring and a large white 05.",
    },
    full: (k) => [
      k.shield("roundel", { rim: "#8a0c14", field: M05.red, rimWidth: 3 }),
      k.ring(50, 2.4, WHITE),
      arc("MAINZ", { r: 41, cap: 10, side: "top", fill: WHITE, maxSweep: 90 }),
      text("05", { x: 60, baseline: 92, cap: 46, fill: WHITE, tracking: 0.04, maxWidth: 70 }),
    ],
    small: (k) => [
      k.shield("roundel", { rim: "#8a0c14", field: M05.red, rimWidth: 6 }),
      k.ring(46, 3, WHITE),
      text("05", { x: 60, baseline: 84, cap: 48, fill: WHITE, tracking: 0.02, maxWidth: 78 }),
    ],
    alternatives: [
      {
        title: "Mainz wheel",
        note: "The six-spoked wheel from Mainz's city arms in white on red, with M05 below: the city's emblem, not the club's numerals.",
        looks: {
          full: "A red pointed shield with a dark red edge: a large white six-spoked wheel and M05 in white below it.",
          small: "The red pointed shield with a large white six-spoked wheel.",
        },
        full: (k) => [
          k.shield("heater", { rim: "#8a0c14", field: M05.red }),
          k.symbol("wheel", { x: 60, y: 48, size: 62 }, { main: WHITE, accent: WHITE, ground: M05.red }),
          text("M05", { x: 60, baseline: 98, cap: 15, fill: WHITE, tracking: 0.12 }),
        ],
        small: (k) => [
          k.shield("heater", { rim: "#8a0c14", field: M05.red, rimWidth: 7 }),
          k.symbol("wheel", { x: 60, y: 54, size: 80 }, { main: WHITE, accent: WHITE, ground: M05.red }),
        ],
      },
    ],
  },
];

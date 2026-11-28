// Serie A crests, 2026-27. Each design is an original interpretation of the
// club's heritage, not a copy of its badge: see `inspiration` for the idea
// and `resemblance` for how close it might look to the official badge.
//
// Italian badges keep their cities' arms (the red cross of Milan, Bologna,
// Genoa and Parma, Florence's lily, Rome's she-wolf, Sardinia's four Moors,
// Lecce's oak and wolf) inside traditional outlines: ovals in Milan, Bergamo
// and Bologna, heater shields in Genoa, Parma and Turin, roundels in Naples
// and Udine. Each design keeps its club's outline, colour layout and
// lettering hierarchy with its own drawing (`composition`). Inter,
// Juventus, Fiorentina and Venezia keep their current, modern identities
// (the IM monogram, the standalone J, the diamond, the V) rather than their
// older badges, at the owner's request.
//
// The owner's official reference images (28 Nov 2026) were used for broad
// structure only and are not stored anywhere in the repository.
import { arcText, lineText, type ArcOptions, type LineOptions } from "../lettering.ts";
import { SHAPES } from "../primitives.ts";
import type { SymbolName, Placement, Ink } from "../symbols.ts";
import type { ClubIdentity } from "../types.ts";
import type { Kit } from "../crest.ts";
import { slim } from "./bundesliga.ts";

const WHITE = "#fff";
const BLACK = "#111";

/** Straight lettering, slimmed. */
function text(t: string, o: LineOptions & { fill: string }): string {
  return `<path d="${slim(lineText(t, o).d)}" fill="${o.fill}"/>`;
}

/** Lettering round a ring centred on the crest, slimmed. */
function arc(t: string, o: Omit<ArcOptions, "cx" | "cy"> & { fill: string }): string {
  return `<path d="${slim(arcText(t, { ...o, cx: 60, cy: 60 }).d)}" fill="${o.fill}"/>`;
}

/** A path clipped to the field. */
const cut = (d: string, fill: string, clip: string) =>
  `<path d="${d}" fill="${fill}" clip-path="url(#${clip})"/>`;

/** A second clip path for a crest (half of it, say), its id made from the crest's. */
const clipDef = (id: string, d: string) => `<defs><clipPath id="${id}"><path d="${d}"/></clipPath></defs>`;

/** An emblem with no enclosing outline (Juventus's J, Venezia's V): the
 *  shape drawn over the same white keyline every shield has, so it stays
 *  visible on dark themes. */
const keylined = (d: string, fill: string) =>
  `<path d="${d}" fill="#fff" stroke="#fff" stroke-width="5" stroke-linejoin="round"/><path d="${d}" fill="${fill}"/>`;

/** A symbol standing outside its shield (Monza's crown, Lazio's eagle): a
 *  white outline of `width` crest units behind it, then the symbol itself. */
function haloed(k: Kit, name: SymbolName, at: Placement, ink: Ink, width: number): string {
  const w = Math.round((width / (at.size / 100)) * 10) / 10;
  return `<g stroke="#fff" stroke-width="${w}" stroke-linejoin="round">${k.symbol(name, at, { main: WHITE, accent: WHITE, ground: WHITE })}</g>${k.symbol(name, at, ink)}`;
}

/** A light figure standing outside its shield (Lazio's white eagle): a
 *  white outline, then a thin contour in `edge`, then the figure, so it
 *  reads on light and dark themes alike. */
function contoured(k: Kit, name: SymbolName, at: Placement, ink: Ink, edge: string): string {
  const per = 100 / at.size;
  const plain = { main: WHITE, accent: WHITE, ground: WHITE };
  return (
    `<g stroke="#fff" stroke-width="${Math.round(9 * per * 10) / 10}" stroke-linejoin="round">${k.symbol(name, at, plain)}</g>` +
    `<g stroke="${edge}" stroke-width="${Math.round(3 * per * 10) / 10}" stroke-linejoin="round">${k.symbol(name, at, plain)}</g>` +
    k.symbol(name, at, ink)
  );
}

/** Vertical stripes of `fill` between x0 and x1 (each `w` wide, starting
 *  at x0), from y0 down, as path data. */
function stripes(x0: number, x1: number, w: number, y0: number, y1 = 120): string {
  let d = "";
  for (let x = x0; x < x1; x += 2 * w) d += `M${x} ${y0}H${Math.min(x + w, x1)}V${y1}H${x}Z`;
  return d;
}

const MIL = { red: "#d71920" };
const ATA = { blue: "#1e71b8" };
const BOL = { navy: "#1a2b45", red: "#a51f2d", grey: "#c9cdd3" };
const CAG = { red: "#b5121b", navy: "#0f2347" };
const COM = { navy: "#163f73" };
const FIO = { viola: "#5b2a86", red: "#e2231a" };
const FRO = { blue: "#0d4ea6", yellow: "#f7d117", pale: "#cdd9ee", sky: "#3fa4e0" };
const GEN = { red: "#b31b1b", navy: "#0b1f3a", gold: "#f5c518" };
const INT = { blue: "#0a2ea0" };
const LAZ = { sky: "#87c4ea", navy: "#0b2f52", gold: "#d9a92e" };
const LEC = { navy: "#14224a", gold: "#c9a95c", red: "#d81f26", yellow: "#f6c900" };
const MON = { red: "#e4002b" };
const NAP = { blue: "#0f74c0" };
const PAR = { yellow: "#ffd200", blue: "#1c3f94" };
const ROM = { red: "#8e1f2f", gold: "#f0bc42" };
const SAS = { green: "#00a650" };
const TOR = { red: "#7b1c2a", gold: "#e0b04a" };
const UDI = { gold: "#bfa25a" };
const VEN = { orange: "#f26a21", green: "#00803e" };

// Juventus's J: two strokes side by side, the black-and-white of the
// bianconeri, the left one with a short cap. In the 120 box.
const J_LEFT = "M36 8H62V78C62 92 54 100 42 104L36 96C44 92 48 86 48 76V20H36Z";
const J_RIGHT = "M68 8H82V80C82 100 66 112 44 114L42 106C60 102 68 94 68 80Z";

// Venezia's V: two black arms meeting at a point, with the city's orange
// and green on top; feathers of the winged lion cut into the right arm.
const V_ARMS = "M8 38H42L60 90L78 38H112L72 114H48Z";
const V_ORANGE = "M10 14H42L46 32H14Z";
const V_GREEN = "M78 14H110L106 32H74Z";
const V_FEATHERS = [52, 62, 72, 82]
  .map((y) => {
    // From just inside the right arm's inner edge out through its outer edge.
    const inner = 78 - ((y - 38) * 18) / 52 + 4;
    return `M${inner.toFixed(1)} ${y}H112V${y + 4}H${(inner - 1.4).toFixed(1)}Z`;
  })
  .join("");

// Inter's IM: an I between the two legs of an M whose diagonals meet low.
const IM = (w: number) =>
  `M${60 - w / 2} 24H${60 + w / 2}V96H${60 - w / 2}Z` +
  `M${30 - w / 2} 30H${30 + w / 2}L60 ${70 - w}L${90 - w / 2} 30H${90 + w / 2}V90H${90 - w / 2}V${48 + w}L60 ${80}L${30 + w / 2} ${48 + w}V90H${30 - w / 2}Z`;

export const SERIE_A: readonly ClubIdentity[] = [
  {
    slug: "ac-milan",
    name: "AC Milan",
    leagueId: "serie_a",
    nickname: "Rossoneri",
    founded: 1899,
    short: "MIL",
    colours: [
      { name: "Red", hex: MIL.red },
      { name: "Black", hex: BLACK },
      { name: "White", hex: WHITE },
    ],
    band: { bg: "#9e0f17", ink: WHITE, muted: "#ffe2e2", accent: "#ffb3b3" },
    inspiration:
      "Milan's broad oval: the red and black stripes the English founders chose (red for the devil's fire, black for fear) beside Milan's red cross of Saint Ambrose on white, under a black band with the club's initials and its founding year.",
    resemblance: {
      level: "high",
      note: "Red and black stripes beside the city's red cross in an oval, under a black band with lettering, is the arrangement of the official badge. Here the band carries ACM and 1899 rather than the club's wordmark. The striped shield with a cross in its corner is the lower-resemblance alternative.",
    },
    composition: "halved oval under a lettered band",
    looks: {
      full: "A broad white oval with a black edge. A black band across the top carries 1899 and ACM in white; below it the left half is red and black vertical stripes and the right half white with a red cross.",
      small:
        "The broad oval with a plain black band, red and black stripes on the left and a red cross on white on the right.",
    },
    full: (k) => [
      k.shield("broad-oval", { rim: BLACK, field: WHITE, rimWidth: 3 }),
      cut("M0 40H60V120H0Z", BLACK, k.clip),
      cut(stripes(14, 56, 8, 40), MIL.red, k.clip),
      cut("M80 40H90V120H80ZM60 70H120V80H60Z", MIL.red, k.clip),
      k.pattern({ kind: "chief", colour: BLACK, height: 40 }),
      text("1899", { x: 60, baseline: 16, cap: 6, fill: WHITE, tracking: 0.2 }),
      text("ACM", { x: 60, baseline: 34, cap: 15, fill: WHITE, tracking: 0.18 }),
    ],
    small: (k) => [
      k.shield("broad-oval", { rim: BLACK, field: WHITE, rimWidth: 7 }),
      cut("M0 40H60V120H0Z", BLACK, k.clip),
      cut(stripes(18, 54, 12, 40), MIL.red, k.clip),
      cut("M78 40H92V120H78ZM60 68H120V82H60Z", MIL.red, k.clip),
      k.pattern({ kind: "chief", colour: BLACK, height: 40 }),
    ],
    alternatives: [
      {
        title: "Striped shield with the cross",
        note: "The rossoneri stripes fill a pointed shield and Milan's cross sits in a white corner, with no oval or lettered band: the club's colours and city, away from the official layout.",
        looks: {
          full: "A pointed shield of red and black vertical stripes with a black edge, a white square in its upper left corner holding a red cross.",
          small: "The red and black striped shield with the white corner and its red cross.",
        },
        full: (k) => [
          k.shield("heater", { rim: BLACK, field: MIL.red }),
          k.pattern({ kind: "stripes", colour: BLACK, count: 7 }),
          cut("M0 0H56V50H0Z", WHITE, k.clip),
          cut("M30 0H38V50H30ZM0 24H56V32H0Z", MIL.red, k.clip),
        ],
        small: (k) => [
          k.shield("heater", { rim: BLACK, field: MIL.red, rimWidth: 7 }),
          k.pattern({ kind: "stripes", colour: BLACK, count: 5 }),
          cut("M0 0H56V52H0Z", WHITE, k.clip),
          cut("M28 0H40V52H28ZM0 22H56V34H0Z", MIL.red, k.clip),
        ],
      },
    ],
  },
  {
    slug: "atalanta",
    name: "Atalanta",
    leagueId: "serie_a",
    nickname: "La Dea",
    founded: 1907,
    short: "ATA",
    colours: [
      { name: "Blue", hex: ATA.blue },
      { name: "Black", hex: BLACK },
      { name: "White", hex: WHITE },
    ],
    band: { bg: "#0d4a86", ink: WHITE, muted: "#dceafa", accent: "#9cc9f0" },
    inspiration:
      "Named after Atalanta, the swift huntress of Greek myth, and called La Dea, the goddess: her head in profile, hair streaming as she runs, in a white ring on Bergamo's blue and black, in the club's upright oval.",
    resemblance: {
      level: "high",
      note: "A white profile of the huntress with streaming hair in a ring, on an oval halved blue and black with ATALANTA and 1907, is the official badge's arrangement. The drawing is TableTalk's own. The huntress's bow on a halved shield is the lower-resemblance alternative.",
    },
    composition: "profile in a ring on a halved oval",
    looks: {
      full: "An upright oval, blue on the left and black on the right, with ATALANTA curving over the top and 1907 under the bottom in white. In the middle, a white ring round the white head of a woman in profile facing left, her hair streaming back in long waves.",
      small: "The blue and black oval with a white ring round the white profile head and its streaming hair.",
    },
    full: (k) => [
      k.shield("oval", { rim: BLACK, field: ATA.blue, rimWidth: 3 }),
      k.pattern({ kind: "halves", colour: BLACK, side: "right" }),
      k.ring(31, 3, WHITE),
      arc("ATALANTA", { r: 42.5, cap: 9.5, side: "top", fill: WHITE, maxSweep: 100 }),
      arc("1907", { r: 42.5, cap: 9.5, side: "bottom", fill: WHITE, maxSweep: 50 }),
      k.symbol("goddess", { x: 61, y: 61, size: 56 }, { main: WHITE, accent: WHITE, ground: BLACK }),
    ],
    small: (k) => [
      k.shield("oval", { rim: BLACK, field: ATA.blue, rimWidth: 7 }),
      k.pattern({ kind: "halves", colour: BLACK, side: "right" }),
      k.ring(33, 5, WHITE),
      k.symbol("goddess-lite", { x: 61, y: 61, size: 62 }, { main: WHITE, accent: WHITE, ground: BLACK }),
    ],
    alternatives: [
      {
        title: "The huntress's bow",
        note: "Atalanta's bow and arrow, her attribute in the myth, on a pointed shield halved blue and black: the same heritage without the profile head or the oval.",
        looks: {
          full: "A pointed shield halved blue and black with a black edge and a white drawn bow with its arrow across the middle.",
          small: "The blue and black halved shield with the white bow.",
        },
        full: (k) => [
          k.shield("heater", { rim: BLACK, field: ATA.blue }),
          k.pattern({ kind: "halves", colour: BLACK, side: "right" }),
          k.symbol("bow-arrow", { x: 60, y: 56, size: 70 }, { main: WHITE, accent: WHITE, ground: ATA.blue }),
        ],
        small: (k) => [
          k.shield("heater", { rim: BLACK, field: ATA.blue, rimWidth: 7 }),
          k.pattern({ kind: "halves", colour: BLACK, side: "right" }),
          k.symbol("bow-arrow", { x: 60, y: 56, size: 80 }, { main: WHITE, accent: WHITE, ground: ATA.blue }),
        ],
      },
    ],
  },
  {
    slug: "bologna",
    name: "Bologna",
    leagueId: "serie_a",
    nickname: "Rossoblù",
    founded: 1909,
    short: "BOL",
    colours: [
      { name: "Red", hex: BOL.red },
      { name: "Navy", hex: BOL.navy },
      { name: "White", hex: WHITE },
    ],
    band: { bg: BOL.navy, ink: WHITE, muted: "#e3e9f0", accent: "#ec7d87" },
    inspiration:
      "Bologna's tall oval: the red and blue stripes the club has worn since 1909 beside the red cross of the city's arms, under a navy cap carrying BFC and the founding year.",
    resemblance: {
      level: "high",
      note: "A tall oval with a grey edge, red and navy stripes beside a red cross on white, under a navy cap with BFC and 1909, is the official badge's structure. The lettering here is upright capitals and the cap's edge is a shallow curve. The striped tablet is the lower-resemblance alternative.",
    },
    composition: "halved oval under a lettered cap",
    looks: {
      full: "A tall oval with a pale grey edge. A navy cap with a curved lower edge carries BFC and 1909 in white; below, the left half is red and navy stripes and the right half a red cross on white.",
      small:
        "The tall grey-edged oval with BFC on the navy cap, red and navy stripes on the left and the red cross on white on the right.",
    },
    full: (k) => [
      k.shield("oval", { rim: BOL.grey, field: BOL.navy, rimWidth: 4 }),
      cut(stripes(22, 60, 8, 30), BOL.red, k.clip),
      cut("M60 30H120V120H60Z", WHITE, k.clip),
      cut("M79 30H88V120H79ZM60 72H120V81H60Z", BOL.red, k.clip),
      cut("M0 0H120V40Q60 56 0 40Z", BOL.navy, k.clip),
      text("BFC", { x: 60, baseline: 33, cap: 18, fill: WHITE, tracking: 0.06 }),
      text("1909", { x: 60, baseline: 44, cap: 7, fill: WHITE, tracking: 0.14 }),
    ],
    small: (k) => [
      k.shield("oval", { rim: BOL.grey, field: BOL.navy, rimWidth: 7 }),
      cut(stripes(24, 60, 12, 30), BOL.red, k.clip),
      cut("M60 30H120V120H60Z", WHITE, k.clip),
      cut("M77 30H91V120H77ZM60 70H120V84H60Z", BOL.red, k.clip),
      cut("M0 0H120V40Q60 56 0 40Z", BOL.navy, k.clip),
      text("BFC", { x: 60, baseline: 38, cap: 22, fill: WHITE, tracking: 0.02 }),
    ],
    alternatives: [
      {
        title: "Striped tablet",
        note: "Bologna's red and blue stripes fill a rounded tablet under a white band with BFC in navy: the club's colours and initials without the oval or the city's cross.",
        looks: {
          full: "A rounded tablet of red and navy vertical stripes with a navy edge, under a white band with navy BFC.",
          small: "The striped tablet with the white band, no lettering.",
        },
        full: (k) => [
          k.shield("tablet", { rim: BOL.navy, field: BOL.red }),
          k.pattern({ kind: "stripes", colour: BOL.navy, count: 7 }),
          k.pattern({ kind: "chief", colour: WHITE, height: 38 }),
          text("BFC", { x: 60, baseline: 31, cap: 17, fill: BOL.navy }),
        ],
        small: (k) => [
          k.shield("tablet", { rim: BOL.navy, field: BOL.red, rimWidth: 7 }),
          k.pattern({ kind: "stripes", colour: BOL.navy, count: 5 }),
          k.pattern({ kind: "chief", colour: WHITE, height: 36 }),
        ],
      },
    ],
  },
  {
    slug: "cagliari",
    name: "Cagliari",
    leagueId: "serie_a",
    nickname: "Rossoblù",
    founded: 1920,
    short: "CAG",
    colours: [
      { name: "Red", hex: CAG.red },
      { name: "Navy", hex: CAG.navy },
      { name: "White", hex: WHITE },
    ],
    band: { bg: CAG.navy, ink: WHITE, muted: "#e2e8f4", accent: "#ff7d84" },
    inspiration:
      "Sardinia's flag, the four Moors' heads round a red cross, on a white shield with raised corners, edged in the club's red and blue (red on one side, blue on the other) with CAGLIARI across the top.",
    resemblance: {
      level: "high",
      note: "The four Moors and the red cross on white, in a shield edged red on one side and navy on the other with the name across the top, is the official badge's arrangement; the flag itself is Sardinia's. The heads are TableTalk's drawings. The single Moor in a roundel is the lower-resemblance alternative.",
    },
    composition: "regional flag in a split-edged shield",
    looks: {
      full: "A shield with raised top corners, its wide edge red on the left and navy on the right, CAGLIARI in white across the top. The white field holds a thin red cross with a navy Moor's head in each quarter, each in profile facing left with a white headband.",
      small: "The red and navy edged shield with the red cross and four navy heads on white.",
    },
    full: (k) => [
      clipDef(`${k.clip}-r`, "M60 0H120V120H60Z"),
      k.shield("horned", { rim: CAG.red, field: WHITE, rimWidth: 7 }),
      `<path d="${SHAPES.horned(0)}" fill="${CAG.navy}" clip-path="url(#${k.clip}-r)"/>`,
      `<path d="${SHAPES.horned(7)}" fill="${WHITE}"/>`,
      cut("M0 0H60V36H0Z", CAG.red, k.clip),
      cut("M60 0H120V36H60Z", CAG.navy, k.clip),
      text("CAGLIARI", { x: 60, baseline: 32, cap: 9.5, fill: WHITE, maxWidth: 80, tracking: 0.08 }),
      cut("M57 36H63V120H57ZM0 66H120V72H0Z", CAG.red, k.clip),
      ...[
        [36, 51, 29],
        [83, 51, 29],
        [39, 88, 26],
        [80, 88, 26],
      ].map(([x, y, size]) =>
        k.symbol(
          "moor-head",
          { x: x ?? 0, y: y ?? 0, size: size ?? 0 },
          { main: CAG.navy, accent: WHITE, ground: WHITE },
        ),
      ),
    ],
    small: (k) => [
      clipDef(`${k.clip}-r`, "M60 0H120V120H60Z"),
      k.shield("horned", { rim: CAG.red, field: WHITE, rimWidth: 10 }),
      `<path d="${SHAPES.horned(0)}" fill="${CAG.navy}" clip-path="url(#${k.clip}-r)"/>`,
      `<path d="${SHAPES.horned(10)}" fill="${WHITE}"/>`,
      cut("M55 0H65V120H55ZM0 62H120V72H0Z", CAG.red, k.clip),
      ...[
        [37, 45],
        [83, 45],
        [39, 88],
        [81, 88],
      ].map(([x, y]) =>
        k.symbol(
          "moor-head-lite",
          { x: x ?? 0, y: y ?? 0, size: 30 },
          { main: CAG.navy, accent: WHITE, ground: WHITE },
        ),
      ),
    ],
    alternatives: [
      {
        title: "One Moor in a roundel",
        note: "A single Moor's head from Sardinia's arms in a white disc, on a roundel halved red and navy: the island's heritage and the club's colours without the four-quartered flag or the shield.",
        looks: {
          full: "A roundel halved red and navy with a white disc in the middle holding a navy Moor's head with a white headband.",
          small: "The red and navy roundel with the white disc and the navy head.",
        },
        full: (k) => [
          k.shield("roundel", { rim: CAG.navy, field: CAG.red }),
          k.pattern({ kind: "halves", colour: CAG.navy, side: "right" }),
          k.disc(60, 60, 34, WHITE),
          k.symbol("moor-head", { x: 61, y: 60, size: 56 }, { main: CAG.navy, accent: WHITE, ground: WHITE }),
        ],
        small: (k) => [
          k.shield("roundel", { rim: CAG.navy, field: CAG.red, rimWidth: 7 }),
          k.pattern({ kind: "halves", colour: CAG.navy, side: "right" }),
          k.disc(60, 60, 36, WHITE),
          k.symbol(
            "moor-head-lite",
            { x: 61, y: 60, size: 62 },
            { main: CAG.navy, accent: WHITE, ground: WHITE },
          ),
        ],
      },
    ],
  },
  {
    slug: "como",
    name: "Como",
    leagueId: "serie_a",
    nickname: "Lariani",
    founded: 1907,
    short: "COM",
    colours: [
      { name: "Blue", hex: COM.navy },
      { name: "White", hex: WHITE },
    ],
    band: { bg: "#123a6b", ink: WHITE, muted: "#e1ebf7", accent: "#9fc3ec" },
    inspiration:
      "Como's white cross on red is the city's arms; the club's badge sets a blue cross behind a white shield, with the name, the founding year and the waves of Lake Como.",
    resemblance: {
      level: "high",
      note: "A blue cross standing out behind a white shield with 1907, COMO and waves is the official badge's structure. The lettering and the waves are TableTalk's own. The lake roundel is the lower-resemblance alternative.",
    },
    composition: "lettering on a shield before a cross",
    looks: {
      full: "A blue cross whose arms stand out at the top and both sides behind a white shield with a blue edge. On the shield, 1907 in small spaced figures, COMO in large blue capitals, and three blue wave lines near the point.",
      small: "The blue cross behind the white shield, with COMO and two heavy waves.",
    },
    full: (k) => [
      keylined("M48 2H72V30H117V54H3V30H48Z", COM.navy),
      k.shield("compact", { rim: COM.navy, field: WHITE }),
      text("1907", { x: 60, baseline: 44, cap: 8, fill: COM.navy, tracking: 0.5 }),
      text("COMO", { x: 60, baseline: 72, cap: 21, fill: COM.navy, maxWidth: 56, tracking: 0.04 }),
      k.pattern({ kind: "waves", colour: COM.navy, from: 83, count: 3, gap: 7.5, width: 3 }),
    ],
    small: (k) => [
      keylined("M46 1H74V28H119V56H1V28H46Z", COM.navy),
      k.shield("compact", { rim: COM.navy, field: WHITE, rimWidth: 6 }),
      text("COMO", { x: 60, baseline: 70, cap: 20, fill: COM.navy, maxWidth: 56, tracking: 0.02 }),
      k.pattern({ kind: "waves", colour: COM.navy, from: 84, count: 2, gap: 10, width: 5 }),
    ],
    alternatives: [
      {
        title: "Lake roundel",
        note: "The lake alone: a blue roundel with COMO above white waves, without the cross or the shield.",
        looks: {
          full: "A blue roundel with COMO in white capitals over four white wave lines.",
          small: "The blue roundel with heavy white waves.",
        },
        full: (k) => [
          k.shield("roundel", { rim: COM.navy, field: COM.navy }),
          text("COMO", { x: 60, baseline: 58, cap: 20, fill: WHITE }),
          k.pattern({ kind: "waves", colour: WHITE, from: 70, count: 4, gap: 8, width: 3 }),
        ],
        small: (k) => [
          k.shield("roundel", { rim: COM.navy, field: COM.navy, rimWidth: 7 }),
          k.pattern({ kind: "waves", colour: WHITE, from: 46, count: 4, gap: 12, width: 6 }),
        ],
      },
    ],
  },
  {
    slug: "fiorentina",
    name: "Fiorentina",
    leagueId: "serie_a",
    nickname: "La Viola",
    founded: 1926,
    short: "FIO",
    colours: [
      { name: "Viola", hex: FIO.viola },
      { name: "Red", hex: FIO.red },
      { name: "White", hex: WHITE },
    ],
    band: { bg: "#4b1f74", ink: WHITE, muted: "#efe3f9", accent: "#ff9a94" },
    inspiration:
      "Fiorentina's modern diamond: Florence's red lily, the giglio with its stamens, above a violet V, inside a violet diamond.",
    resemblance: {
      level: "high",
      note: "A red Florentine lily over a violet V in a violet-edged diamond is the club's current identity. The lily is TableTalk's drawing. The white lily on a violet roundel is the lower-resemblance alternative.",
    },
    composition: "city lily in a diamond",
    looks: {
      full: "A diamond standing on its point with a thick violet edge and a white field: a red Florentine lily with curling petals and two stamens above a violet V that fills the lower point.",
      small: "The violet diamond with a large red lily and the violet V below it.",
    },
    full: (k) => [
      k.shield("diamond", { rim: FIO.viola, field: WHITE, rimWidth: 8 }),
      cut("M18 68H102L60 110ZM40 68L60 88L80 68Z", FIO.viola, k.clip),
      `<path d="M40 68L60 88L80 68Z" fill="${WHITE}"/>`,
      k.symbol("giglio", { x: 60, y: 50, size: 46 }, { main: FIO.red, accent: FIO.red, ground: WHITE }),
    ],
    small: (k) => [
      k.shield("diamond", { rim: FIO.viola, field: WHITE, rimWidth: 9 }),
      cut("M18 70H102L60 112Z", FIO.viola, k.clip),
      k.symbol("giglio", { x: 60, y: 48, size: 48 }, { main: FIO.red, accent: FIO.red, ground: WHITE }),
    ],
    alternatives: [
      {
        title: "White lily on violet",
        note: "Florence's lily in white on a violet roundel with a thin white ring: the city and the colour without the diamond and the V.",
        looks: {
          full: "A violet roundel with a thin white ring and a large white Florentine lily.",
          small: "The violet roundel with the white lily.",
        },
        full: (k) => [
          k.shield("roundel", { rim: FIO.viola, field: FIO.viola }),
          k.ring(48, 2, WHITE),
          k.symbol("giglio", { x: 60, y: 58, size: 64 }, { main: WHITE, accent: WHITE, ground: FIO.viola }),
        ],
        small: (k) => [
          k.shield("roundel", { rim: FIO.viola, field: FIO.viola, rimWidth: 7 }),
          k.symbol("giglio", { x: 60, y: 58, size: 74 }, { main: WHITE, accent: WHITE, ground: FIO.viola }),
        ],
      },
    ],
  },
  {
    slug: "frosinone",
    name: "Frosinone",
    leagueId: "serie_a",
    nickname: "Canarini",
    founded: 1928,
    short: "FRO",
    colours: [
      { name: "Yellow", hex: FRO.yellow },
      { name: "Blue", hex: FRO.blue },
    ],
    band: { bg: "#0b3f86", ink: WHITE, muted: "#e2ecfa", accent: FRO.yellow },
    inspiration:
      "The rampant lion of Frosinone's civic arms on the club's blue, crossed by a yellow and sky-blue bend, under a yellow chief with the city's name; the yellow is the canaries' colour.",
    resemblance: {
      level: "high",
      note: "A pale lion rampant on blue, crossed by a rising yellow bend, under a yellow chief with the name, in a yellow-edged shield, is the official badge's arrangement. The lion is TableTalk's drawing. The roundel with a yellow lion is the lower-resemblance alternative.",
    },
    composition: "civic lion on a shield crossed by a bend",
    looks: {
      full: "A pointed shield with a yellow edge and a blue field: FROSINONE in blue on a yellow chief, a yellow bend with a sky-blue stripe rising from lower left to upper right, and a pale blue lion rampant facing left over it.",
      small: "The yellow-edged blue shield with a plain yellow chief, the bend and the pale lion.",
    },
    full: (k) => [
      k.shield("heater", { rim: FRO.yellow, field: FRO.blue, rimWidth: 5 }),
      cut("M-10 106L130 30L130 38L-10 114Z", FRO.sky, k.clip),
      cut("M-10 114L130 38L130 48L-10 124Z", FRO.yellow, k.clip),
      k.symbol(
        "lion-rampant-left",
        { x: 60, y: 73, size: 62 },
        { main: FRO.pale, accent: "#d22630", ground: FRO.blue },
      ),
      k.pattern({ kind: "chief", colour: FRO.yellow, height: 29 }),
      text("FROSINONE", { x: 60, baseline: 24, cap: 11, fill: FRO.blue, maxWidth: 82, tracking: 0.06 }),
    ],
    small: (k) => [
      k.shield("heater", { rim: FRO.yellow, field: FRO.blue, rimWidth: 7 }),
      cut("M-10 112L130 34L130 48L-10 126Z", FRO.yellow, k.clip),
      k.symbol(
        "lion-rampant-left-lite",
        { x: 60, y: 72, size: 68 },
        { main: FRO.pale, accent: FRO.pale, ground: FRO.blue },
      ),
      k.pattern({ kind: "chief", colour: FRO.yellow, height: 27 }),
    ],
    alternatives: [
      {
        title: "Yellow lion roundel",
        note: "The civic lion in the canaries' yellow on a blue roundel ringed with the name, without the shield, the chief or the bend.",
        looks: {
          full: "A blue roundel with a yellow ring lettered FROSINONE in blue over the top and a yellow lion rampant in the middle.",
          small: "The blue roundel with the yellow ring and the yellow lion.",
        },
        full: (k) => [
          k.shield("roundel", { rim: FRO.yellow, field: FRO.blue, rimWidth: 3 }),
          k.ring(47, 16, FRO.yellow),
          arc("FROSINONE", { r: 46.5, cap: 9, side: "top", fill: FRO.blue, maxSweep: 150 }),
          k.symbol(
            "lion-rampant-left",
            { x: 60, y: 64, size: 60 },
            { main: FRO.yellow, accent: FRO.yellow, ground: FRO.blue },
          ),
        ],
        small: (k) => [
          k.shield("roundel", { rim: FRO.yellow, field: FRO.blue, rimWidth: 9 }),
          k.symbol(
            "lion-rampant-left-lite",
            { x: 60, y: 62, size: 76 },
            { main: FRO.yellow, accent: FRO.yellow, ground: FRO.blue },
          ),
        ],
      },
    ],
  },
  {
    slug: "genoa",
    name: "Genoa",
    leagueId: "serie_a",
    nickname: "Grifone",
    founded: 1893,
    short: "GEN",
    colours: [
      { name: "Red", hex: GEN.red },
      { name: "Navy", hex: GEN.navy },
      { name: "Gold", hex: GEN.gold },
    ],
    band: { bg: GEN.navy, ink: WHITE, muted: "#e3e8f0", accent: GEN.gold },
    inspiration:
      "Italy's oldest club: the golden griffin of the Republic of Genoa, rampant on the club's red and blue halves, under a white chief with Saint George's red cross, Genoa's flag.",
    resemblance: {
      level: "high",
      note: "A gold griffin rampant on red and navy halves, under a white chief with a red cross, in a gold-edged shield, is the official badge's arrangement. The griffin is TableTalk's drawing. The cross shield without the griffin is the lower-resemblance alternative.",
    },
    composition: "heraldic beast under a chief",
    looks: {
      full: "A pointed shield with a gold edge: a white chief with Saint George's red cross, and below it red on the left and navy on the right with a gold griffin rampant facing left, wing raised behind it.",
      small:
        "The gold-edged shield with the white chief and red cross, red and navy halves and the gold griffin.",
    },
    full: (k) => [
      k.shield("heater", { rim: GEN.gold, field: GEN.red, rimWidth: 5 }),
      k.pattern({ kind: "halves", colour: GEN.navy, side: "right" }),
      k.pattern({ kind: "chief", colour: WHITE, height: 38 }),
      cut("M56 0H64V38H56ZM0 19H120V26H0Z", GEN.red, k.clip),
      k.rule(38, GEN.gold, 2.5),
      k.symbol("griffin", { x: 60, y: 76, size: 56 }, { main: GEN.gold, accent: GEN.gold, ground: GEN.navy }),
    ],
    small: (k) => [
      k.shield("heater", { rim: GEN.gold, field: GEN.red, rimWidth: 7 }),
      k.pattern({ kind: "halves", colour: GEN.navy, side: "right" }),
      k.pattern({ kind: "chief", colour: WHITE, height: 36 }),
      cut("M54 0H66V36H54ZM0 17H120V28H0Z", GEN.red, k.clip),
      k.symbol(
        "griffin-lite",
        { x: 60, y: 76, size: 62 },
        { main: GEN.gold, accent: GEN.gold, ground: GEN.navy },
      ),
    ],
    alternatives: [
      {
        title: "Saint George's shield",
        note: "Genoa's red cross on white over the club's red and blue, with 1893 and no griffin: the city's flag and the club's age, away from the official badge's beast.",
        looks: {
          full: "A pointed shield with a navy edge: a large red cross on white in the upper two thirds, red and navy halves below with 1893 in white.",
          small: "The navy-edged shield with the red cross on white over red and navy halves.",
        },
        full: (k) => [
          k.shield("heater", { rim: GEN.navy, field: WHITE }),
          cut("M52 0H68V76H52ZM0 32H120V46H0Z", GEN.red, k.clip),
          cut("M0 76H60V120H0Z", GEN.red, k.clip),
          cut("M60 76H120V120H60Z", GEN.navy, k.clip),
          text("1893", { x: 60, baseline: 96, cap: 11, fill: WHITE }),
        ],
        small: (k) => [
          k.shield("heater", { rim: GEN.navy, field: WHITE, rimWidth: 7 }),
          cut("M50 0H70V76H50ZM0 30H120V48H0Z", GEN.red, k.clip),
          cut("M0 76H60V120H0Z", GEN.red, k.clip),
          cut("M60 76H120V120H60Z", GEN.navy, k.clip),
        ],
      },
    ],
  },
  {
    slug: "inter-milan",
    name: "Inter Milan",
    leagueId: "serie_a",
    nickname: "Nerazzurri",
    founded: 1908,
    short: "INT",
    colours: [
      { name: "Blue", hex: INT.blue },
      { name: "Black", hex: BLACK },
      { name: "White", hex: WHITE },
    ],
    band: { bg: "#0a2580", ink: WHITE, muted: "#e0e7ff", accent: "#8fb0ff" },
    inspiration:
      "Inter's modern identity: the letters I and M (Internazionale Milano) drawn as one monogram in white on blue, inside a black ring: the nerazzurri's black and blue.",
    resemblance: {
      level: "high",
      note: "A white IM monogram in a blue disc inside a black ring is the club's current identity. The letters here are straight bars with the M's diagonals meeting low behind the I, not the official curved strokes. The striped roundel with a star is the lower-resemblance alternative.",
    },
    composition: "monogram in a ringed roundel",
    looks: {
      full: "A roundel with a wide black ring round a royal blue disc, and a white monogram: a tall I in the middle between the two legs of an M whose diagonals meet low behind it.",
      small: "The black-ringed blue roundel with a heavier white IM monogram.",
    },
    full: (k) => [
      k.shield("roundel", { rim: BLACK, field: INT.blue, rimWidth: 9 }),
      `<path d="${IM(9)}" fill="${WHITE}"/>`,
    ],
    small: (k) => [
      k.shield("roundel", { rim: BLACK, field: INT.blue, rimWidth: 11 }),
      `<path d="${IM(13)}" fill="${WHITE}"/>`,
    ],
    alternatives: [
      {
        title: "Nerazzurri stripes with a star",
        note: "Black and blue stripes in a roundel with a gold star (the club's league titles) and INTER on a black ring: the colours and the name without the IM monogram.",
        looks: {
          full: "A roundel of black and blue vertical stripes inside a black ring lettered INTER over the top and 1908 under it, with a gold star in the middle.",
          small: "The black and blue striped roundel with a gold star.",
        },
        full: (k) => [
          k.shield("roundel", { rim: BLACK, field: INT.blue, rimWidth: 3 }),
          k.pattern({ kind: "stripes", colour: BLACK, count: 9 }),
          k.ring(46, 18, BLACK),
          arc("INTER", { r: 46, cap: 10, side: "top", fill: WHITE, maxSweep: 90 }),
          arc("1908", { r: 46, cap: 9, side: "bottom", fill: WHITE, maxSweep: 60 }),
          k.star(60, 61, 16, "#f2c230"),
        ],
        small: (k) => [
          k.shield("roundel", { rim: BLACK, field: INT.blue, rimWidth: 8 }),
          k.pattern({ kind: "stripes", colour: BLACK, count: 5 }),
          k.star(60, 61, 26, "#f2c230"),
        ],
      },
    ],
  },
  {
    slug: "juventus",
    name: "Juventus",
    leagueId: "serie_a",
    nickname: "La Vecchia Signora",
    founded: 1897,
    short: "JUV",
    colours: [
      { name: "Black", hex: BLACK },
      { name: "White", hex: WHITE },
    ],
    band: { bg: "#141414", ink: WHITE, muted: "#e6e6e6", accent: "#b9b9b9" },
    inspiration:
      "Juventus's modern identity: a standalone J, drawn here as two black strokes side by side with white between them, the bianconeri's black and white stripes made into a letter.",
    resemblance: {
      level: "high",
      note: "A black J in two parts on no background is the idea of the club's current identity. TableTalk's J is two parallel strokes, the left one capped, not the official cut shape. The striped oval is the lower-resemblance alternative.",
    },
    composition: "standalone monogram",
    looks: {
      full: "No shield: a tall black J made of two parallel strokes with a white gap between them, the left one with a short cap at the top, both curving left at the foot. A white outline keeps it visible on dark themes.",
      small: "The same black two-stroke J, its gap a little wider, with the white outline.",
    },
    full: () => [keylined(J_LEFT, BLACK), keylined(J_RIGHT, BLACK)],
    small: () => [
      keylined("M34 8H62V78C62 92 54 100 42 104L34 94C44 90 48 86 48 76V22H34Z", BLACK),
      keylined("M70 8H86V80C86 100 68 113 44 115L42 106C62 102 70 94 70 80Z", BLACK),
    ],
    alternatives: [
      {
        title: "Striped oval with a star",
        note: "The bianconeri stripes in an upright oval under a white cap lettered JUVE, with a gold star: the colours and the name without the J.",
        looks: {
          full: "An upright oval of black and white vertical stripes with a black edge, under a white cap with black JUVE and a small gold star above it.",
          small: "The black and white striped oval with a white cap.",
        },
        full: (k) => [
          k.shield("oval", { rim: BLACK, field: WHITE }),
          k.pattern({ kind: "stripes", colour: BLACK, count: 9 }),
          k.pattern({ kind: "chief", colour: WHITE, height: 40 }),
          k.rule(40, BLACK, 2.5),
          k.star(60, 15, 6, "#d4a52b"),
          text("JUVE", { x: 60, baseline: 35, cap: 13, fill: BLACK, tracking: 0.16 }),
        ],
        small: (k) => [
          k.shield("oval", { rim: BLACK, field: WHITE, rimWidth: 7 }),
          k.pattern({ kind: "stripes", colour: BLACK, count: 5 }),
          k.pattern({ kind: "chief", colour: WHITE, height: 38 }),
        ],
      },
    ],
  },
  {
    slug: "lazio",
    name: "Lazio",
    leagueId: "serie_a",
    nickname: "Biancocelesti",
    founded: 1900,
    short: "LAZ",
    colours: [
      { name: "Sky blue", hex: LAZ.sky },
      { name: "White", hex: WHITE },
      { name: "Navy", hex: LAZ.navy },
    ],
    band: { bg: LAZ.navy, ink: WHITE, muted: "#dff0fb", accent: LAZ.sky },
    inspiration:
      "The eagle, Rome's imperial bird and the club's emblem since its early years, standing with raised wings over a small sky-blue and white shield lettered LAZIO, in the colours of Greece, home of the Olympic games the founders admired.",
    resemblance: {
      level: "high",
      note: "A large eagle with raised wings over a small sky-blue and white shield with the name is the official badge's arrangement. The eagle is TableTalk's drawing. The eagle in a roundel is the lower-resemblance alternative.",
    },
    composition: "eagle over a small shield",
    looks: {
      full: "A white eagle with navy contours, head to the left and wings raised wide, standing over a small pointed shield: sky blue with a navy edge and a white band carrying LAZIO in navy. A white outline round the eagle keeps it clear on dark themes.",
      small:
        "A navy eagle with raised wings, outlined in white, over the small sky-blue shield with its white band.",
    },
    full: (k) => [
      k.shield("escutcheon", { rim: LAZ.navy, field: LAZ.sky, rimWidth: 3 }),
      k.band(78, 14, WHITE),
      text("LAZIO", { x: 60, baseline: 89, cap: 9, fill: LAZ.navy, maxWidth: 44, tracking: 0.1 }),
      contoured(
        k,
        "eagle-raised",
        { x: 60, y: 38, size: 72 },
        { main: WHITE, accent: LAZ.gold, ground: LAZ.navy },
        LAZ.navy,
      ),
    ],
    small: (k) => [
      k.shield("escutcheon", { rim: LAZ.navy, field: LAZ.sky, rimWidth: 5 }),
      k.band(80, 14, WHITE),
      `<g stroke="#fff" stroke-width="7" stroke-linejoin="round" paint-order="stroke">${k.symbol("eagle-raised-lite", { x: 60, y: 40, size: 80 }, { main: LAZ.navy, accent: LAZ.navy, ground: LAZ.navy })}</g>`,
    ],
    alternatives: [
      {
        title: "Eagle in a roundel",
        note: "The eagle on a sky-blue roundel with a white ring lettered S.S. LAZIO and 1900, without the small shield: the emblem and colours in a different composition.",
        looks: {
          full: "A sky-blue roundel with a white ring lettered S.S. LAZIO over the top and 1900 under it in navy, and a white eagle with raised wings in the middle.",
          small: "The sky-blue roundel with a white eagle.",
        },
        full: (k) => [
          k.shield("roundel", { rim: LAZ.navy, field: LAZ.sky, rimWidth: 3 }),
          k.ring(46, 16, WHITE),
          arc("S.S. LAZIO", { r: 46, cap: 9, side: "top", fill: LAZ.navy, maxSweep: 120 }),
          arc("1900", { r: 46, cap: 8, side: "bottom", fill: LAZ.navy, maxSweep: 50 }),
          k.symbol(
            "eagle-raised",
            { x: 60, y: 60, size: 62 },
            { main: WHITE, accent: LAZ.gold, ground: LAZ.sky },
          ),
        ],
        small: (k) => [
          k.shield("roundel", { rim: LAZ.navy, field: LAZ.sky, rimWidth: 7 }),
          k.symbol(
            "eagle-raised-lite",
            { x: 60, y: 60, size: 82 },
            { main: WHITE, accent: WHITE, ground: LAZ.sky },
          ),
        ],
      },
    ],
  },
  {
    slug: "lecce",
    name: "Lecce",
    leagueId: "serie_a",
    nickname: "Giallorossi",
    founded: 1908,
    short: "LEC",
    colours: [
      { name: "Yellow", hex: LEC.yellow },
      { name: "Red", hex: LEC.red },
      { name: "Navy", hex: LEC.navy },
    ],
    band: { bg: LEC.navy, ink: WHITE, muted: "#f1e8cc", accent: LEC.yellow },
    inspiration:
      "Lecce's civic arms, a she-wolf passing beneath a holm oak (the city's name is linked to the holm oak, the leccio), drawn in gold on navy in a long tapering shield, with the club's yellow and red as a stripe under its name.",
    resemblance: {
      level: "high",
      note: "A gold oak with a wolf beneath it on navy, under U.S. LECCE and a yellow and red stripe with 1908, in a tall gold-edged shield, is the official badge's arrangement; the oak and wolf are the city's arms. The drawing is TableTalk's own. The striped shield with USL is the lower-resemblance alternative.",
    },
    composition: "civic arms under a lettered head",
    looks: {
      full: "A tall shield tapering to a low point, navy with a thin gold edge: U.S. and LECCE in gold, a yellow and red stripe broken by 1908, and a gold holm oak with a wolf walking left beneath it.",
      small: "The tall navy shield with the yellow and red stripe and the gold oak and wolf.",
    },
    full: (k) => [
      k.shield("lancet", { rim: LEC.gold, field: LEC.navy, rimWidth: 3 }),
      text("U.S.", { x: 60, baseline: 18, cap: 7, fill: LEC.gold, tracking: 0.1 }),
      text("LECCE", { x: 60, baseline: 37, cap: 15, fill: LEC.gold, maxWidth: 70, tracking: 0.1 }),
      cut("M18 41H48V43.5H18ZM72 41H102V43.5H72Z", LEC.yellow, k.clip),
      cut("M18 43.5H48V46H18ZM72 43.5H102V46H72Z", LEC.red, k.clip),
      text("1908", { x: 60, baseline: 46.5, cap: 6, fill: LEC.gold, tracking: 0.1 }),
      k.symbol(
        "oak-wolf",
        { x: 60, y: 79, size: 60 },
        { main: LEC.gold, accent: LEC.gold, ground: LEC.navy },
      ),
    ],
    small: (k) => [
      k.shield("lancet", { rim: LEC.gold, field: LEC.navy, rimWidth: 6 }),
      cut("M0 22H120V27H0Z", LEC.yellow, k.clip),
      cut("M0 27H120V32H0Z", LEC.red, k.clip),
      k.symbol(
        "oak-wolf-lite",
        { x: 60, y: 66, size: 60 },
        { main: LEC.gold, accent: LEC.gold, ground: LEC.navy },
      ),
    ],
    alternatives: [
      {
        title: "Yellow and red with USL",
        note: "The giallorossi stripes on a round-bottomed shield under a navy chief with USL in gold: the colours and the initials without the civic arms.",
        looks: {
          full: "A round-bottomed shield of yellow and red vertical stripes with a navy edge, under a navy chief with gold USL.",
          small: "The yellow and red striped shield under a plain navy chief.",
        },
        full: (k) => [
          k.shield("english", { rim: LEC.navy, field: LEC.yellow }),
          k.pattern({ kind: "stripes", colour: LEC.red, count: 7 }),
          k.pattern({ kind: "chief", colour: LEC.navy, height: 38 }),
          text("USL", { x: 60, baseline: 31, cap: 16, fill: LEC.gold, tracking: 0.14 }),
        ],
        small: (k) => [
          k.shield("english", { rim: LEC.navy, field: LEC.yellow, rimWidth: 7 }),
          k.pattern({ kind: "stripes", colour: LEC.red, count: 5 }),
          k.pattern({ kind: "chief", colour: LEC.navy, height: 36 }),
        ],
      },
    ],
  },
  {
    slug: "monza",
    name: "Monza",
    leagueId: "serie_a",
    nickname: "Biancorossi",
    founded: 1912,
    short: "MON",
    colours: [
      { name: "Red", hex: MON.red },
      { name: "White", hex: WHITE },
    ],
    band: { bg: "#b0001f", ink: WHITE, muted: "#ffe5ea", accent: "#ffc2cd" },
    inspiration:
      "The Iron Crown of Lombardy, kept in Monza's cathedral, set above a red shield with the club's name and a sword: the city's royal history in the club's red and white.",
    resemblance: {
      level: "high",
      note: "A red shield with a white inner line, AC MONZA and a downward sword, under a crown of hinged plates, is the official badge's arrangement. The crown and sword are TableTalk's drawings. The crown over a white shield is the lower-resemblance alternative.",
    },
    composition: "crowned shield with lettering and a sword",
    looks: {
      full: "A broad red shield tapering to a point, with a thin white line inside its edge: AC and MONZA in white, a white sword pointing down with a ring pommel. Above it, a red crown of three panels set with white ornaments, outlined in white.",
      small: "The red tapering shield with the white sword, under the red crown.",
    },
    full: (k) => [
      k.shield("tapered", { rim: MON.red, field: MON.red }),
      k.inset("tapered", 4, WHITE),
      k.inset("tapered", 6, MON.red),
      haloed(k, "iron-crown", { x: 60, y: 22, size: 46 }, { main: MON.red, accent: WHITE, ground: WHITE }, 3),
      text("AC", { x: 60, baseline: 50, cap: 8, fill: WHITE, tracking: 0.2 }),
      text("MONZA", { x: 60, baseline: 67, cap: 14, fill: WHITE, maxWidth: 70, tracking: 0.06 }),
      k.symbol("sword", { x: 60, y: 91, size: 40 }, { main: WHITE, accent: MON.red, ground: MON.red }),
    ],
    small: (k) => [
      k.shield("tapered", { rim: MON.red, field: MON.red, rimWidth: 7 }),
      `<g stroke="#fff" stroke-width="7" stroke-linejoin="round" paint-order="stroke">${k.symbol("iron-crown", { x: 60, y: 22, size: 52 }, { main: MON.red, accent: WHITE, ground: WHITE })}</g>`,
      k.symbol("sword", { x: 60, y: 74, size: 56 }, { main: WHITE, accent: MON.red, ground: MON.red }),
    ],
    alternatives: [
      {
        title: "Crown on a white shield",
        note: "The Iron Crown alone in red on a white shield with a red edge and a red base: the city's emblem without the lettering, the sword or the club's shield form.",
        looks: {
          full: "A white pointed shield with a red edge and a red base band, a large red Iron Crown in the middle.",
          small: "The white shield with the red crown.",
        },
        full: (k) => [
          k.shield("heater", { rim: MON.red, field: WHITE }),
          k.pattern({ kind: "base", colour: MON.red, from: 84 }),
          k.symbol("iron-crown", { x: 60, y: 50, size: 66 }, { main: MON.red, accent: WHITE, ground: WHITE }),
        ],
        small: (k) => [
          k.shield("heater", { rim: MON.red, field: WHITE, rimWidth: 7 }),
          k.symbol("iron-crown", { x: 60, y: 54, size: 80 }, { main: MON.red, accent: WHITE, ground: WHITE }),
        ],
      },
    ],
  },
  {
    slug: "napoli",
    name: "Napoli",
    leagueId: "serie_a",
    nickname: "Partenopei",
    founded: 1926,
    short: "NAP",
    colours: [
      { name: "Azzurro", hex: NAP.blue },
      { name: "White", hex: WHITE },
    ],
    band: { bg: "#0b5a96", ink: WHITE, muted: "#e1f2fc", accent: "#9fd6f5" },
    inspiration:
      "Napoli's roundel: a white N for Naples on the club's sky blue, the colour of the bay, inside a thin white ring.",
    resemblance: {
      level: "high",
      note: "A white N inside a white ring on a blue roundel is the official badge. The N here is set in the crests' own condensed capitals. Vesuvius over the bay is the lower-resemblance alternative.",
    },
    composition: "letter in a ringed roundel",
    looks: {
      full: "A blue roundel with a thin white ring inside its edge and a large white N in the middle.",
      small: "The blue roundel with the white ring and a heavy white N.",
    },
    full: (k) => [
      k.shield("roundel", { rim: NAP.blue, field: NAP.blue, rimWidth: 3 }),
      k.ring(47, 3.5, WHITE),
      text("N", { x: 60, baseline: 88, cap: 56, fill: WHITE, tracking: 0 }),
    ],
    small: (k) => [
      k.shield("roundel", { rim: NAP.blue, field: NAP.blue, rimWidth: 7 }),
      k.ring(44, 6, WHITE),
      text("N", { x: 60, baseline: 90, cap: 60, fill: WHITE, tracking: 0 }),
    ],
    alternatives: [
      {
        title: "Vesuvius over the bay",
        note: "The volcano that stands over Naples, smoking above the waves of the bay, on a blue roundel lettered NAPOLI: the city's landscape instead of the N.",
        looks: {
          full: "A blue roundel with NAPOLI in white over the top and a white Vesuvius with a sky-blue plume above white waves.",
          small: "The blue roundel with the white volcano and waves.",
        },
        full: (k) => [
          k.shield("roundel", { rim: NAP.blue, field: NAP.blue, rimWidth: 3 }),
          arc("NAPOLI", { r: 44, cap: 10, side: "top", fill: WHITE, maxSweep: 90 }),
          k.symbol(
            "vesuvius",
            { x: 60, y: 66, size: 70 },
            { main: WHITE, accent: "#9fd6f5", ground: NAP.blue },
          ),
        ],
        small: (k) => [
          k.shield("roundel", { rim: NAP.blue, field: NAP.blue, rimWidth: 7 }),
          k.symbol("vesuvius", { x: 60, y: 60, size: 86 }, { main: WHITE, accent: WHITE, ground: NAP.blue }),
        ],
      },
    ],
  },
  {
    slug: "parma",
    name: "Parma",
    leagueId: "serie_a",
    nickname: "Crociati",
    founded: 1913,
    short: "PAR",
    colours: [
      { name: "Yellow", hex: PAR.yellow },
      { name: "Blue", hex: PAR.blue },
      { name: "White", hex: WHITE },
      { name: "Black", hex: BLACK },
    ],
    band: { bg: PAR.blue, ink: WHITE, muted: "#e2e8f7", accent: PAR.yellow },
    inspiration:
      "The crusaders (crociati): the black cross on white the club has worn on its shirt since its early years, beside the yellow and blue of the city, under a yellow chief with the name.",
    resemblance: {
      level: "high",
      note: "A black cross on white beside yellow and blue stripes, under a yellow chief with the name, in a blue-edged shield, is the official badge's arrangement. The cross is set off-centre in its half and the name is PARMA alone. The cross roundel is the lower-resemblance alternative.",
    },
    composition: "halved shield under a lettered chief",
    looks: {
      full: "A pointed shield with a blue edge: PARMA in blue on a yellow chief, and below it a black cross on white on the left half and yellow and blue vertical stripes on the right.",
      small:
        "The blue-edged shield with a plain yellow chief, the black cross on white and the yellow and blue stripes.",
    },
    full: (k) => [
      k.shield("heater", { rim: PAR.blue, field: WHITE, rimWidth: 5 }),
      cut("M60 0H120V120H60Z", PAR.yellow, k.clip),
      cut(stripes(68, 120, 8, 0), PAR.blue, k.clip),
      cut("M30 30H39V120H30ZM0 60H60V69H0Z", BLACK, k.clip),
      k.pattern({ kind: "chief", colour: PAR.yellow, height: 30 }),
      k.rule(30, PAR.blue, 2.5),
      text("PARMA", { x: 60, baseline: 25, cap: 13, fill: PAR.blue, tracking: 0.12 }),
    ],
    small: (k) => [
      k.shield("heater", { rim: PAR.blue, field: WHITE, rimWidth: 7 }),
      cut("M60 0H120V120H60Z", PAR.yellow, k.clip),
      cut(stripes(70, 120, 12, 0), PAR.blue, k.clip),
      cut("M28 30H40V120H28ZM0 58H60V70H0Z", BLACK, k.clip),
      k.pattern({ kind: "chief", colour: PAR.yellow, height: 30 }),
    ],
    alternatives: [
      {
        title: "Crusader's roundel",
        note: "The crusaders' black cross on a white disc ringed in yellow and blue: the shirt's cross and the city's colours without the halved shield or the chief.",
        looks: {
          full: "A blue roundel with a yellow ring and a white disc holding a black cross.",
          small: "The blue and yellow ringed roundel with the black cross on white.",
        },
        full: (k) => [
          k.shield("roundel", { rim: PAR.blue, field: WHITE }),
          cut("M54 0H66V120H54ZM0 54H120V66H0Z", BLACK, k.clip),
          k.ring(46, 10, PAR.yellow),
        ],
        small: (k) => [
          k.shield("roundel", { rim: PAR.blue, field: WHITE, rimWidth: 8 }),
          cut("M52 0H68V120H52ZM0 52H120V68H0Z", BLACK, k.clip),
          k.ring(44, 10, PAR.yellow),
        ],
      },
    ],
  },
  {
    slug: "roma",
    name: "Roma",
    leagueId: "serie_a",
    nickname: "Giallorossi",
    founded: 1927,
    short: "ROM",
    colours: [
      { name: "Imperial red", hex: ROM.red },
      { name: "Gold", hex: ROM.gold },
    ],
    band: { bg: "#7a1a28", ink: WHITE, muted: "#fbe6c4", accent: ROM.gold },
    inspiration:
      "Rome's founding legend: the she-wolf that nursed Romulus and Remus, in gold on the imperial red of the city's colours, under ROMA, in a gold-edged shield.",
    resemblance: {
      level: "high",
      note: "The she-wolf with the twins in gold on red, under the name, in a gold-edged shield, is the official badge's idea. The drawing and the layout (a plain lettered chief over the figure) are TableTalk's own. The ASR roundel is the lower-resemblance alternative.",
    },
    composition: "civic legend under a lettered chief",
    looks: {
      full: "A square-shouldered shield with a gold edge and a deep red field: ROMA in gold across the top over a thin gold line, and the gold she-wolf standing left with the twins beneath her.",
      small: "The gold-edged red shield with the gold she-wolf and twins.",
    },
    full: (k) => [
      k.shield("french", { rim: ROM.gold, field: ROM.red, rimWidth: 4 }),
      text("ROMA", { x: 60, baseline: 28, cap: 15, fill: ROM.gold, tracking: 0.2 }),
      k.rule(34, ROM.gold, 2),
      k.symbol("she-wolf", { x: 60, y: 66, size: 56 }, { main: ROM.gold, accent: ROM.gold, ground: ROM.red }),
    ],
    small: (k) => [
      k.shield("french", { rim: ROM.gold, field: ROM.red, rimWidth: 7 }),
      k.symbol("she-wolf", { x: 60, y: 58, size: 76 }, { main: ROM.gold, accent: ROM.gold, ground: ROM.red }),
    ],
    alternatives: [
      {
        title: "ASR roundel",
        note: "The club's initials, Associazione Sportiva Roma, in gold on a roundel halved gold and red: the giallorossi colours and the name without the she-wolf.",
        looks: {
          full: "A roundel halved gold and deep red with a red ring and gold ASR across the middle on a red disc.",
          small: "The gold and red halved roundel with a red disc.",
        },
        full: (k) => [
          k.shield("roundel", { rim: ROM.red, field: ROM.gold }),
          k.pattern({ kind: "halves", colour: ROM.red, side: "right" }),
          k.disc(60, 60, 30, ROM.red, [ROM.gold, 2.5]),
          text("ASR", { x: 60, baseline: 68, cap: 16, fill: ROM.gold, tracking: 0.08 }),
        ],
        small: (k) => [
          k.shield("roundel", { rim: ROM.red, field: ROM.gold, rimWidth: 7 }),
          k.pattern({ kind: "halves", colour: ROM.red, side: "right" }),
          k.disc(60, 60, 26, ROM.red, [ROM.gold, 4]),
        ],
      },
    ],
  },
  {
    slug: "sassuolo",
    name: "Sassuolo",
    leagueId: "serie_a",
    nickname: "Neroverdi",
    founded: 1920,
    short: "SAS",
    colours: [
      { name: "Green", hex: SAS.green },
      { name: "Black", hex: BLACK },
    ],
    band: { bg: "#0c5b31", ink: WHITE, muted: "#def5e7", accent: "#7fe0a8" },
    inspiration:
      "Sassuolo's notched badge: the town's walls and trees in a white corner beside the neroverdi stripes, a band with the club's name, and a football below.",
    resemblance: {
      level: "high",
      note: "A notched black-edged badge with a white corner showing the town, green and black stripes, a name band and a football is the official badge's arrangement. The town scene and the ball are TableTalk's drawings. The striped roundel is the lower-resemblance alternative.",
    },
    composition: "quartered badge with a name band and a ball",
    looks: {
      full: "A badge with stepped top corners and a notch in each side, black-edged, filled with green and black stripes: a white corner at the upper left with a black wall of arches and two round trees, a green band edged in black with SASSUOLO in white, and a white disc with a football below.",
      small:
        "The notched black-edged badge of green and black stripes with the white corner and the white ball disc.",
    },
    full: (k) => [
      k.shield("notched", { rim: BLACK, field: SAS.green }),
      k.pattern({ kind: "stripes", colour: BLACK, count: 9 }),
      cut("M0 0H58V44H0Z", WHITE, k.clip),
      `<path d="M16 42V34Q16 30 20 30Q24 30 24 34V42H28V34Q28 30 32 30Q36 30 36 34V42H40V34Q40 30 44 30Q48 30 48 34V42H54V28H12V42Z" fill="${BLACK}"/>`,
      `<path d="M23 28V22M45 28V22" stroke="${BLACK}" stroke-width="2"/>`,
      k.disc(23, 19, 6, BLACK),
      k.disc(45, 19, 6, BLACK),
      k.band(46, 14, BLACK),
      k.band(48, 10, SAS.green),
      text("SASSUOLO", { x: 60, baseline: 57, cap: 7.5, fill: WHITE, maxWidth: 86, tracking: 0.12 }),
      k.disc(60, 84, 18, WHITE, [BLACK, 2]),
      k.symbol("football", { x: 60, y: 84, size: 30 }, { main: BLACK, accent: BLACK, ground: WHITE }),
    ],
    small: (k) => [
      k.shield("notched", { rim: BLACK, field: SAS.green, rimWidth: 7 }),
      k.pattern({ kind: "stripes", colour: BLACK, count: 7 }),
      cut("M0 0H58V48H0Z", WHITE, k.clip),
      k.disc(34, 34, 9, BLACK),
      k.disc(60, 82, 20, WHITE, [BLACK, 3]),
      k.symbol("football", { x: 60, y: 82, size: 34 }, { main: BLACK, accent: BLACK, ground: WHITE }),
    ],
    alternatives: [
      {
        title: "Neroverdi roundel",
        note: "Green and black stripes in a roundel with a white ball at the centre and SASSUOLO on a black ring: the colours and the football without the notched badge or the town scene.",
        looks: {
          full: "A roundel of green and black vertical stripes inside a black ring lettered SASSUOLO in white, with a white disc holding a black football.",
          small: "The green and black striped roundel with the white ball.",
        },
        full: (k) => [
          k.shield("roundel", { rim: BLACK, field: SAS.green, rimWidth: 3 }),
          k.pattern({ kind: "stripes", colour: BLACK, count: 9 }),
          k.ring(46, 16, BLACK),
          arc("SASSUOLO", { r: 46, cap: 9, side: "top", fill: WHITE, maxSweep: 120 }),
          k.disc(60, 62, 20, WHITE),
          k.symbol("football", { x: 60, y: 62, size: 34 }, { main: BLACK, accent: BLACK, ground: WHITE }),
        ],
        small: (k) => [
          k.shield("roundel", { rim: BLACK, field: SAS.green, rimWidth: 7 }),
          k.pattern({ kind: "stripes", colour: BLACK, count: 5 }),
          k.disc(60, 60, 24, WHITE),
          k.symbol("football", { x: 60, y: 60, size: 42 }, { main: BLACK, accent: BLACK, ground: WHITE }),
        ],
      },
    ],
  },
  {
    slug: "torino",
    name: "Torino",
    leagueId: "serie_a",
    nickname: "Il Toro",
    founded: 1906,
    short: "TOR",
    colours: [
      { name: "Granata", hex: TOR.red },
      { name: "Gold", hex: TOR.gold },
      { name: "White", hex: WHITE },
    ],
    band: { bg: "#6b1724", ink: WHITE, muted: "#f6e3e6", accent: TOR.gold },
    inspiration:
      "Turin's rampant bull, the city's emblem and the club's nickname, in gold on granata, the maroon the club has worn since 1906, under the city's name.",
    resemblance: {
      level: "high",
      note: "A gold bull rampant on granata under TORINO in a gold-edged shield is the official badge's idea. The bull is TableTalk's drawing. The TFC roundel is the lower-resemblance alternative.",
    },
    composition: "civic beast under a lettered chief",
    looks: {
      full: "A pointed shield with a gold edge and a granata field: TORINO in gold across the top over a thin gold line, and a gold bull rampant facing left, horns up, tail curling.",
      small: "The gold-edged granata shield with the gold rampant bull.",
    },
    full: (k) => [
      k.shield("heater", { rim: TOR.gold, field: TOR.red, rimWidth: 4 }),
      text("TORINO", { x: 60, baseline: 26, cap: 12, fill: TOR.gold, tracking: 0.18 }),
      k.rule(32, TOR.gold, 2),
      k.symbol(
        "bull-rampant",
        { x: 60, y: 70, size: 62 },
        { main: TOR.gold, accent: TOR.gold, ground: TOR.red },
      ),
    ],
    small: (k) => [
      k.shield("heater", { rim: TOR.gold, field: TOR.red, rimWidth: 7 }),
      k.symbol(
        "bull-rampant",
        { x: 60, y: 60, size: 80 },
        { main: TOR.gold, accent: TOR.gold, ground: TOR.red },
      ),
    ],
    alternatives: [
      {
        title: "TFC roundel",
        note: "The club's initials in gold on a granata roundel ringed with TORINO and 1906: the colours and name without the bull.",
        looks: {
          full: "A granata roundel with a gold ring, TORINO over the top and 1906 under it in gold, and gold TFC in the middle.",
          small: "The granata roundel with a gold ring and gold TFC.",
        },
        full: (k) => [
          k.shield("roundel", { rim: TOR.gold, field: TOR.red, rimWidth: 3 }),
          k.ring(36, 2, TOR.gold),
          arc("TORINO", { r: 45, cap: 10, side: "top", fill: TOR.gold, maxSweep: 100 }),
          arc("1906", { r: 45, cap: 9, side: "bottom", fill: TOR.gold, maxSweep: 50 }),
          text("TFC", { x: 60, baseline: 70, cap: 20, fill: TOR.gold, tracking: 0.06 }),
        ],
        small: (k) => [
          k.shield("roundel", { rim: TOR.gold, field: TOR.red, rimWidth: 8 }),
          text("TFC", { x: 60, baseline: 74, cap: 28, fill: TOR.gold, tracking: 0 }),
        ],
      },
    ],
  },
  {
    slug: "udinese",
    name: "Udinese",
    leagueId: "serie_a",
    nickname: "Zebrette",
    founded: 1896,
    short: "UDI",
    colours: [
      { name: "Black", hex: BLACK },
      { name: "White", hex: WHITE },
      { name: "Gold", hex: UDI.gold },
    ],
    band: { bg: "#161616", ink: WHITE, muted: "#e8e8e8", accent: UDI.gold },
    inspiration:
      "Udinese's black roundel: a gold laurel wreath round the club's name and founding year (1896, one of Italy's oldest), with a small black and white shield at the centre for the zebrette's stripes.",
    resemblance: {
      level: "high",
      note: "A black roundel with a gold laurel round UDINESE CALCIO, 1896 and a black and white shield at the centre is the official badge's arrangement. The laurel and shield are TableTalk's drawings. The striped shield is the lower-resemblance alternative.",
    },
    composition: "wreathed roundel with a central shield",
    looks: {
      full: "A black roundel with a gold laurel wreath round its edge, open at the top where 1896 sits in white; UDINESE over the top and CALCIO under the bottom in white on an inner ring; a thin white ring and a small white shield with a black chevron at the centre.",
      small: "The black roundel with the gold laurel and the white shield with its black chevron.",
    },
    full: (k) => [
      k.shield("roundel", { rim: BLACK, field: BLACK, rimWidth: 3 }),
      k.symbol(
        "laurel-ring",
        { x: 60, y: 61, size: 116 },
        { main: UDI.gold, accent: UDI.gold, ground: BLACK },
      ),
      text("1896", { x: 60, baseline: 17, cap: 7, fill: WHITE, tracking: 0.1 }),
      arc("UDINESE", { r: 34, cap: 7.5, side: "top", fill: WHITE, maxSweep: 120 }),
      arc("CALCIO", { r: 34, cap: 7.5, side: "bottom", fill: WHITE, maxSweep: 100 }),
      k.ring(26, 2, WHITE),
      `<path d="M47 46H73V64C73 72 67 77 60 80C53 77 47 72 47 64Z" fill="${WHITE}"/>`,
      `<path d="M47 66L60 52L73 66V74L60 60L47 74Z" fill="${BLACK}"/>`,
    ],
    small: (k) => [
      k.shield("roundel", { rim: BLACK, field: BLACK, rimWidth: 4 }),
      k.symbol(
        "laurel-ring",
        { x: 60, y: 61, size: 116 },
        { main: UDI.gold, accent: UDI.gold, ground: BLACK },
      ),
      `<path d="M40 36H80V62C80 76 70 84 60 88C50 84 40 76 40 62Z" fill="${WHITE}"/>`,
      `<path d="M40 66L60 46L80 66V80L60 60L40 80Z" fill="${BLACK}"/>`,
    ],
    alternatives: [
      {
        title: "Zebra-striped shield",
        note: "The zebrette's black and white stripes on a pointed shield under a black chief with UDINESE in white: the colours and name without the wreath or the roundel.",
        looks: {
          full: "A pointed shield of black and white vertical stripes with a black edge, under a black chief lettered UDINESE in white.",
          small: "The black and white striped shield under a plain black chief.",
        },
        full: (k) => [
          k.shield("heater", { rim: BLACK, field: WHITE }),
          k.pattern({ kind: "stripes", colour: BLACK, count: 9 }),
          k.pattern({ kind: "chief", colour: BLACK, height: 34 }),
          text("UDINESE", { x: 60, baseline: 27, cap: 11, fill: WHITE, maxWidth: 80, tracking: 0.1 }),
        ],
        small: (k) => [
          k.shield("heater", { rim: BLACK, field: WHITE, rimWidth: 7 }),
          k.pattern({ kind: "stripes", colour: BLACK, count: 5 }),
          k.pattern({ kind: "chief", colour: BLACK, height: 32 }),
        ],
      },
    ],
  },
  {
    slug: "venezia",
    name: "Venezia",
    leagueId: "serie_a",
    nickname: "Arancioneroverdi",
    founded: 1907,
    short: "VEN",
    colours: [
      { name: "Orange", hex: VEN.orange },
      { name: "Black", hex: BLACK },
      { name: "Green", hex: VEN.green },
    ],
    band: { bg: "#151515", ink: WHITE, muted: "#e8e8e8", accent: "#f58a4b" },
    inspiration:
      "Venezia's modern identity: a black V with an orange block over one arm and a green block over the other (the colours of the 1987 merger with Mestre), the feathers of Saint Mark's winged lion cut into its right arm.",
    resemblance: {
      level: "high",
      note: "A black V with an orange and a green block above its arms, a winged lion suggested in the letter, is the idea of the club's current identity. Here the lion is only its feathers, with no stepped head. The gondola prow shield is the lower-resemblance alternative.",
    },
    composition: "standalone letter emblem",
    looks: {
      full: "No shield: a heavy black V, an orange slanted block above its left arm and a green one above its right, four white slits cut across the right arm like feathers. A white outline keeps it visible on dark themes.",
      small: "The black V with the orange and green blocks and three wider feather slits.",
    },
    full: () => [
      keylined(V_ARMS, BLACK),
      keylined(V_ORANGE, VEN.orange),
      keylined(V_GREEN, VEN.green),
      `<path d="${V_FEATHERS}" fill="${WHITE}"/>`,
    ],
    small: () => [
      keylined(V_ARMS, BLACK),
      keylined("M8 10H44L48 32H12Z", VEN.orange),
      keylined("M76 10H112L108 32H72Z", VEN.green),
      `<path d="M78 52H112V58H76ZM73 66H112V72H71ZM68 80H112V86H66Z" fill="${WHITE}"/>`,
    ],
    alternatives: [
      {
        title: "Gondola prow",
        note: "The ferro, the steel prow of a gondola whose six teeth stand for Venice's six districts, in white on a shield of orange, black and green: the city's emblem without the V.",
        looks: {
          full: "A pointed shield with a black edge, divided orange, black and green from left to right, with a white gondola prow in the middle.",
          small: "The orange, black and green shield with the white prow.",
        },
        full: (k) => [
          k.shield("heater", { rim: BLACK, field: BLACK }),
          cut("M0 0H38V120H0Z", VEN.orange, k.clip),
          cut("M82 0H120V120H82Z", VEN.green, k.clip),
          k.symbol("ferro", { x: 60, y: 56, size: 70 }, { main: WHITE, accent: WHITE, ground: BLACK }),
        ],
        small: (k) => [
          k.shield("heater", { rim: BLACK, field: BLACK, rimWidth: 7 }),
          cut("M0 0H38V120H0Z", VEN.orange, k.clip),
          cut("M82 0H120V120H82Z", VEN.green, k.clip),
          k.symbol("ferro", { x: 60, y: 56, size: 84 }, { main: WHITE, accent: WHITE, ground: BLACK }),
        ],
      },
    ],
  },
];

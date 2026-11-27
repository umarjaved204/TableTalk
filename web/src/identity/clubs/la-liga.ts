// La Liga crests, 2026-27. Each design is an original interpretation of the
// club's heritage, not a copy of its badge: see `inspiration` for the idea and
// `resemblance` for how close it might look to the official badge. Spanish
// football's own traditions run through them (royal crowns, city arms and
// mottoes, regional emblems), but each club has its own outline and
// composition (`composition`), so no single template repeats.
import { arcText, lineText, type LineOptions } from "../lettering.ts";
import type { ClubIdentity } from "../types.ts";

const WHITE = "#fff";
const BLACK = "#111";

/** White lettering with a coloured outline, for letters set over stripes. */
function outlined(text: string, o: LineOptions, fill: string, stroke: string, width: number): string {
  return `<path d="${lineText(text, o).d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round" paint-order="stroke"/>`;
}

/** A vertical band across the field, clipped to it (a "pale" in heraldry). */
const pale = (x: number, w: number, fill: string, clip: string) =>
  `<rect x="${x}" y="0" width="${w}" height="120" fill="${fill}" clip-path="url(#${clip})"/>`;

/** Rivets round a roundel's rim: Villarreal's porthole. */
function rivets(r: number, n: number, fill: string, size: number): string {
  let out = "";
  for (let k = 0; k < n; k++) {
    const a = (k * 2 * Math.PI) / n;
    out += `<circle cx="${(60 + r * Math.cos(a)).toFixed(1)}" cy="${(60 + r * Math.sin(a)).toFixed(1)}" r="${size}"/>`;
  }
  return `<g fill="${fill}">${out}</g>`;
}

/** Lettering round the ring of a crowned roundel, which is centred lower than a plain roundel. */
function ringText(text: string, r: number, cap: number, side: "top" | "bottom", fill: string): string {
  return `<path d="${arcText(text, { cx: 60, cy: 71, r, cap, side, maxSweep: side === "top" ? 170 : 90 }).d}" fill="${fill}"/>`;
}

/** Rivets round a circle at (cx, cy). */
function rivetsAt(cx: number, cy: number, r: number, n: number, fill: string, size: number): string {
  let out = "";
  for (let k = 0; k < n; k++) {
    const a = (k * 2 * Math.PI) / n;
    out += `<circle cx="${(cx + r * Math.cos(a)).toFixed(1)}" cy="${(cy + r * Math.sin(a)).toFixed(1)}" r="${size}"/>`;
  }
  return `<g fill="${fill}">${out}</g>`;
}

/** A column of chain links down a line (the division of a shield). */
function chainColumn(x: number, y0: number, y1: number, step: number, colour: string): string {
  let d = "";
  let k = 0;
  for (let y = y0; y <= y1; y += step) {
    d += k++ % 2 === 0 ? `M${x} ${y - 3.4}a2.2 3.4 0 1 0 0 6.8a2.2 3.4 0 1 0 0 -6.8` : `M${x} ${y - 2.4}v4.8`;
  }
  return `<path d="${d}" fill="none" stroke="${colour}" stroke-width="1.8"/>`;
}

/** A row of chain links, alternately an oval link seen flat and one seen edge on. */
function chainRow(x0: number, x1: number, y: number, step: number, colour: string): string {
  let d = "";
  let k = 0;
  for (let x = x0; x <= x1; x += step) {
    d += k++ % 2 === 0 ? `M${x - 3.4} ${y}a3.4 2.2 0 1 0 6.8 0a3.4 2.2 0 1 0 -6.8 0` : `M${x - 2.4} ${y}h4.8`;
  }
  return `<path d="${d}" fill="none" stroke="${colour}" stroke-width="1.8"/>`;
}

/** Real Madrid's interlaced RM: the two letters overlap and weave, R over M
 *  in the upper half and M over R in the lower half, with thin white gaps.
 *  The small crest uses the plain overlap (weave false). */
function monogramRM(
  clip: string,
  x: number,
  baseline: number,
  cap: number,
  gap: number,
  weave = true,
): string {
  const navy = RMA.navy;
  const r = { x: x - cap * 0.25, baseline, cap, tracking: 0 };
  const m = { x: x + cap * 0.22, baseline, cap, tracking: 0 };
  const lower = `${clip}-w`;
  // The small crest skips the weave: at 24 px it can't be seen, and it would
  // add a third letter's outline to the file.
  if (!weave) return outlined("M", m, navy, WHITE, gap) + outlined("R", r, navy, WHITE, gap);
  return (
    `<defs><clipPath id="${lower}"><rect x="0" y="${baseline - cap / 2}" width="120" height="${cap}"/></clipPath></defs>` +
    outlined("M", m, navy, WHITE, gap) +
    outlined("R", r, navy, WHITE, gap) +
    `<g clip-path="url(#${lower})">${outlined("M", m, navy, WHITE, gap)}</g>`
  );
}

// Club colours ------------------------------------------------------------
const BAR = { blue: "#004d98", grana: "#a50044", gold: "#edbb00", red: "#d01f2e", navy: "#1d2d50" };
const RMA = { gold: "#c9a227", navy: "#1f3c88" };
const ATM = { red: "#cb3524", navy: "#272e61" };
const BET = { green: "#00954c", gold: "#d4a017" };
const RSO = { blue: "#0067b1", navy: "#003b73", sand: "#e8c872", gold: "#d4a017" };
const SEV = { red: "#d4021d" };
const RAC = { green: "#00894a" };
const ATH = { red: "#ee2523" };
const ALA = { blue: "#0761af", navy: "#002f6c" };
const ESP = { blue: "#007fc8", navy: "#003a70", yellow: "#f6d04d" };
const DEP = { blue: "#0058a3", navy: "#00315f" };
const VIL = { yellow: "#ffe114", navy: "#005187", red: "#d5232f", gold: "#e3b23c" };
const OSA = { red: "#d91a21", navy: "#0a346f", gold: "#f2c230", cream: "#f6ead0" };
const CEL = { sky: "#8ac3ee", navy: "#0b3a6b" };
const VAL = { orange: "#ee7f1b", gold: "#f5c400", red: "#da291c", blue: "#1e88c9" };
const GET = { blue: "#005999", navy: "#002b52" };
const RAY = { red: "#e53027" };
const LEV = { blue: "#165aa8", claret: "#8a1538", navy: "#0c2c5c" };
const ELC = { green: "#05642c", gold: "#d4a017" };
const MAL = { blue: "#0e5eac", navy: "#0a3a6e" };

export const LA_LIGA: readonly ClubIdentity[] = [
  {
    slug: "barcelona",
    name: "Barcelona",
    leagueId: "la_liga",
    nickname: "Blaugrana",
    founded: 1899,
    short: "BAR",
    colours: [
      { name: "Blue (blau)", hex: BAR.blue },
      { name: "Garnet (grana)", hex: BAR.grana },
      { name: "Gold", hex: BAR.gold },
      { name: "Red", hex: BAR.red },
    ],
    band: { bg: "#7a0d36", ink: WHITE, muted: "#f6dbe5", accent: BAR.gold },
    inspiration:
      "The club's traditional Catalan shield, with raised shoulders and a pointed base: the gold and red of the senyera across the top, St George's red cross from the city's arms in a medallion where the senyera meets the blue and garnet stripes, and bold FCB initials across the stripes.",
    resemblance: {
      level: "high",
      note: "The shield outline and the cross, senyera and blaugrana stripes together are the official badge's ingredients. Here the senyera runs right across the top, the cross sits in a central medallion and FCB is set large over the stripes, with no ball, but supporters will read it as Barcelona's badge. The senyera roundel design is the lower-resemblance alternative.",
    },
    composition: "senyera chief, cross medallion and monogram",
    looks: {
      full: "A Catalan-style shield with raised shoulders and a pointed base, navy edge. The top band is gold with four red vertical stripes; below, blue and garnet vertical stripes. A white medallion with a red cross, ringed in navy, sits on the line between them, and large white FCB initials outlined in navy cross the stripes.",
      small:
        "The Catalan shield: gold and red stripes on top, blue and garnet below, and the white medallion with the red cross in the middle.",
    },
    full: (k) => [
      k.shield("catalan", { rim: BAR.navy, field: BAR.blue }),
      k.pattern({ kind: "stripes", colour: BAR.grana, count: 7, from: 46 }),
      k.pattern({ kind: "chief", colour: BAR.gold, height: 46 }),
      k.pattern({ kind: "stripes", colour: BAR.red, count: 9, to: 46 }),
      k.rule(46, BAR.navy, 3),
      k.disc(60, 46, 15, BAR.navy),
      k.symbol("cross-disc", { x: 60, y: 46, size: 26 }, { main: BAR.red, accent: BAR.red, ground: WHITE }),
      outlined("FCB", { x: 60, baseline: 91, cap: 25, tracking: 0.06, maxWidth: 64 }, WHITE, BAR.navy, 3.5),
    ],
    small: (k) => [
      k.shield("catalan", { rim: BAR.navy, field: BAR.blue, rimWidth: 7 }),
      k.pattern({ kind: "stripes", colour: BAR.grana, count: 5, from: 46 }),
      k.pattern({ kind: "chief", colour: BAR.gold, height: 46 }),
      k.pattern({ kind: "stripes", colour: BAR.red, count: 7, to: 46 }),
      k.disc(60, 50, 22, BAR.navy),
      k.symbol("cross-disc", { x: 60, y: 50, size: 40 }, { main: BAR.red, accent: BAR.red, ground: WHITE }),
    ],
    alternatives: [
      {
        title: "Senyera roundel",
        note: "The first La Liga design: the blaugrana stripes in a roundel framed by the senyera as a ring, the cross above FCB. Further from the official badge's outline.",
        looks: {
          full: "A roundel of blue and garnet stripes inside a gold ring striped with four thin red rings (the senyera). A small white disc with a red cross sits above large white FCB initials outlined in navy.",
          small:
            "The striped roundel in its gold and red ring, with the white disc and red cross in the middle.",
        },
        full: (k) => [
          k.shield("roundel", { rim: BAR.navy, field: BAR.blue, rimWidth: 2 }),
          k.pattern({ kind: "stripes", colour: BAR.grana, count: 7 }),
          k.ring(49, 12, BAR.gold),
          ...[46, 48.67, 51.33, 54].map((r) => k.ring(r, 1.33, BAR.red)),
          k.symbol(
            "cross-disc",
            { x: 60, y: 31, size: 20 },
            { main: BAR.red, accent: BAR.red, ground: WHITE },
          ),
          outlined("FCB", { x: 60, baseline: 77, cap: 24, tracking: 0.06, maxWidth: 66 }, WHITE, BAR.navy, 3),
        ],
        small: (k) => [
          k.shield("roundel", { rim: BAR.navy, field: BAR.blue, rimWidth: 3 }),
          k.pattern({ kind: "stripes", colour: BAR.grana, count: 5 }),
          k.ring(48, 14, BAR.gold),
          ...[45, 50, 55].map((r) => k.ring(r, 2, BAR.red)),
          k.symbol(
            "cross-disc",
            { x: 60, y: 60, size: 46 },
            { main: BAR.red, accent: BAR.red, ground: WHITE },
          ),
        ],
      },
    ],
  },
  {
    slug: "real-madrid",
    name: "Real Madrid",
    leagueId: "la_liga",
    nickname: "Los Blancos",
    founded: 1902,
    short: "RMA",
    colours: [
      { name: "White", hex: WHITE },
      { name: "Gold", hex: RMA.gold },
      { name: "Navy", hex: RMA.navy },
    ],
    band: { bg: RMA.navy, ink: WHITE, muted: "#dbe4f5", accent: "#febe10" },
    inspiration:
      "Royal Madrid: the club took the title Real (royal) from King Alfonso XIII in 1920. A white roundel, the club's traditional circular form, with a gold rim and a fine navy inner line, an original interlaced RM monogram, and a gold royal crown resting on top.",
    resemblance: {
      level: "high",
      note: "A crowned roundel with an interlaced monogram on white is the official badge's form and idea. This monogram is RM (not MCF), set in Barlow Condensed, and the crown is our own drawing, but it will read as Real Madrid's badge. The laurel design is the lower-resemblance alternative.",
    },
    composition: "crowned roundel with interlaced monogram",
    looks: {
      full: "A white roundel set low, with a gold rim and a fine navy line inside it. A large navy R and M interlace in the middle, separated by thin white gaps. A gold royal crown with closed arches, an orb and a cross rests on top of the roundel.",
      small:
        "The white roundel with its gold rim, the interlaced navy RM filling it, and a small gold crown on top.",
    },
    full: (k) => [
      k.shield("crowned-roundel", { rim: RMA.gold, field: WHITE, rimWidth: 3 }),
      k.inset("crowned-roundel", 6, RMA.navy),
      k.inset("crowned-roundel", 8, WHITE),
      monogramRM(k.clip, 60, 90, 36, 3.5),
      k.symbol(
        "royal-crown",
        { x: 60, y: 19, size: 38 },
        { main: RMA.gold, accent: RMA.navy, ground: WHITE },
      ),
    ],
    small: (k) => [
      k.shield("crowned-roundel", { rim: RMA.gold, field: WHITE, rimWidth: 6 }),
      monogramRM(k.clip, 60, 93, 42, 4, false),
      k.symbol(
        "royal-crown",
        { x: 60, y: 17, size: 34 },
        { main: RMA.gold, accent: RMA.gold, ground: WHITE },
      ),
    ],
    alternatives: [
      {
        title: "Laurel",
        note: "Victory without the crown: a laurel wreath round the founding year, on white with gold. Low resemblance to the official badge.",
        looks: {
          full: "A white roundel with a gold edge. A gold laurel wreath encircles 1902 in navy.",
          small: "A white roundel with the gold laurel wreath.",
        },
        full: (k) => [
          k.shield("roundel", { rim: RMA.gold, field: WHITE }),
          k.symbol("laurel", { x: 60, y: 60, size: 92 }, { main: RMA.gold, accent: RMA.gold, ground: WHITE }),
          k.text("1902", { x: 60, baseline: 68, cap: 16, fill: RMA.navy }),
        ],
        small: (k) => [
          k.shield("roundel", { rim: RMA.gold, field: WHITE, rimWidth: 7 }),
          k.symbol(
            "laurel",
            { x: 60, y: 60, size: 100 },
            { main: RMA.gold, accent: RMA.gold, ground: WHITE },
          ),
        ],
      },
    ],
  },
  {
    slug: "atletico-madrid",
    name: "Atlético Madrid",
    leagueId: "la_liga",
    nickname: "Los Colchoneros",
    founded: 1903,
    short: "ATM",
    colours: [
      { name: "Red", hex: ATM.red },
      { name: "White", hex: WHITE },
      { name: "Navy", hex: ATM.navy },
    ],
    band: { bg: ATM.navy, ink: WHITE, muted: "#dfe4f3", accent: "#f36b5c" },
    inspiration:
      "The Colchoneros (mattress makers), after the red-and-white striped cloth of old Spanish mattresses, under the seven stars of the Great Bear from the arms of Madrid, set in their real constellation, on the club's traditional pointed shield.",
    resemblance: {
      level: "high",
      note: "Red-and-white stripes under a navy chief with seven stars is close to the official badge's layout, though there the chief holds a bear and a strawberry tree and the stars form a border. The ATM monogram is the alternative.",
    },
    composition: "constellation chief over stripes",
    looks: {
      full: "A pointed heater shield with a navy edge. The upper half is navy with seven white stars in the shape of the Great Bear; the lower half has red and white vertical stripes.",
      small: "The pointed shield: navy above with the seven white stars, red and white stripes below.",
    },
    full: (k) => [
      k.shield("heater", { rim: ATM.navy, field: WHITE }),
      k.pattern({ kind: "stripes", colour: ATM.red, count: 9, from: 52 }),
      k.pattern({ kind: "chief", colour: ATM.navy, height: 52 }),
      k.symbol("great-bear", { x: 60, y: 32, size: 54 }, { main: WHITE, accent: WHITE, ground: ATM.navy }),
    ],
    small: (k) => [
      k.shield("heater", { rim: ATM.navy, field: WHITE, rimWidth: 7 }),
      k.pattern({ kind: "stripes", colour: ATM.red, count: 7, from: 56 }),
      k.pattern({ kind: "chief", colour: ATM.navy, height: 56 }),
      k.symbol("great-bear", { x: 60, y: 34, size: 64 }, { main: WHITE, accent: WHITE, ground: ATM.navy }),
    ],
    alternatives: [
      {
        title: "ATM monogram",
        note: "The initials alone, large and white over the red-and-white stripes, with the stars reduced to one. Low resemblance to the official badge.",
        looks: {
          full: "An angular shield with a navy edge and red and white stripes. Large white ATM initials outlined in navy cross the middle, with one white star above.",
          small: "The striped angular shield with a white star on a navy disc.",
        },
        full: (k) => [
          k.shield("angular", { rim: ATM.navy, field: WHITE }),
          k.pattern({ kind: "stripes", colour: ATM.red, count: 9 }),
          outlined(
            "ATM",
            { x: 60, baseline: 72, cap: 26, tracking: 0.04, maxWidth: 76 },
            WHITE,
            ATM.navy,
            3.5,
          ),
          k.disc(60, 26, 10, ATM.navy),
          k.star(60, 26, 7, WHITE),
        ],
        small: (k) => [
          k.shield("angular", { rim: ATM.navy, field: WHITE, rimWidth: 7 }),
          k.pattern({ kind: "stripes", colour: ATM.red, count: 7 }),
          k.disc(60, 54, 28, ATM.navy),
          k.star(60, 54, 20, WHITE),
        ],
      },
    ],
  },
  {
    slug: "real-betis",
    name: "Real Betis",
    leagueId: "la_liga",
    nickname: "Verdiblancos",
    founded: 1907,
    short: "BET",
    colours: [
      { name: "Green", hex: BET.green },
      { name: "White", hex: WHITE },
      { name: "Gold", hex: BET.gold },
    ],
    band: { bg: "#005a2e", ink: WHITE, muted: "#e0f3e9", accent: "#a8e6c8" },
    inspiration:
      "The club's traditional inverted triangle, in the green and white of Andalusia, with the royal crown of its Real title above it and the name in bold capitals across a green band. Betis takes its name from Baetis, the Roman name of the Guadalquivir, Seville's river.",
    resemblance: {
      level: "high",
      note: "A green-and-white striped inverted triangle under a crown is the official badge's form. The lettering (BETIS in full, not RBB) and the crown are our own, but the outline and stripes will read as Betis's. The banded oval is the lower-resemblance alternative.",
    },
    composition: "crowned triangle with a lettered band",
    looks: {
      full: "An inverted triangle with gently curved sides and a green edge. A green band across the top reads BETIS in bold white capitals; below, green and white vertical stripes narrow to the point. A gold crown rests above the triangle.",
      small: "The green and white striped triangle with the gold crown above it.",
    },
    full: (k) => [
      k.shield("triangle", { rim: BET.green, field: WHITE }),
      k.pattern({ kind: "stripes", colour: BET.green, count: 9, from: 54 }),
      k.pattern({ kind: "chief", colour: BET.green, height: 54 }),
      k.text("Betis", { x: 60, baseline: 50, cap: 13, tracking: 0.12, maxWidth: 72, fill: WHITE }),
      k.symbol(
        "royal-crown",
        { x: 60, y: 17, size: 34 },
        { main: BET.gold, accent: BET.green, ground: WHITE },
      ),
    ],
    small: (k) => [
      k.shield("triangle", { rim: BET.green, field: WHITE, rimWidth: 6 }),
      k.pattern({ kind: "stripes", colour: BET.green, count: 7 }),
      k.symbol(
        "royal-crown",
        { x: 60, y: 17, size: 36 },
        { main: BET.gold, accent: BET.gold, ground: WHITE },
      ),
    ],
    alternatives: [
      {
        title: "Banded oval",
        note: "The first La Liga design: Andalusia's green, white and green bands in an oval, with the river Baetis and the name. Further from the official badge's outline.",
        looks: {
          full: "An upright oval with a green edge, in three bands: green, white, green. A gold crown sits in the top band, BETIS in green capitals fills the white band, and two white wavy lines run across the bottom band.",
          small: "The green oval with a white middle band and the gold crown over it.",
        },
        full: (k) => [
          k.shield("oval", { rim: BET.green, field: WHITE }),
          k.pattern({ kind: "chief", colour: BET.green, height: 44 }),
          k.pattern({ kind: "base", colour: BET.green, from: 78 }),
          k.symbol(
            "royal-crown",
            { x: 60, y: 25, size: 30 },
            { main: BET.gold, accent: BET.green, ground: BET.green },
          ),
          k.text("Betis", { x: 60, baseline: 68, cap: 16, tracking: 0.1, fill: BET.green }),
          k.pattern({ kind: "waves", colour: WHITE, from: 89, count: 2, gap: 7, width: 2.5 }),
        ],
        small: (k) => [
          k.shield("oval", { rim: BET.green, field: BET.green, rimWidth: 7 }),
          k.band(44, 32, WHITE),
          k.symbol(
            "royal-crown",
            { x: 60, y: 60, size: 60 },
            { main: BET.gold, accent: BET.green, ground: WHITE },
          ),
        ],
      },
    ],
  },
  {
    slug: "real-sociedad",
    name: "Real Sociedad",
    leagueId: "la_liga",
    nickname: "Txuri-urdin",
    founded: 1909,
    short: "RSO",
    colours: [
      { name: "Blue", hex: RSO.blue },
      { name: "White", hex: WHITE },
    ],
    band: { bg: "#00559a", ink: WHITE, muted: "#dce9f6", accent: "#8fc6f2" },
    inspiration:
      "Football and flag, as on the club's traditional circular badge: a football and a blue-and-white pennant on the txuri-urdin (white-blue) stripes, inside a blue ring with the club's name and year, under the royal crown of its Real title.",
    resemblance: {
      level: "high",
      note: "A crowned roundel with a ball, a flag and blue-and-white stripes follows the official badge's idea. The ball, pennant and lettering are our own drawings, but the combination will read as Real Sociedad's. The San Sebastián bay design is the lower-resemblance alternative.",
    },
    composition: "crowned roundel with ball and flag",
    looks: {
      full: "A roundel set low, with a blue ring carrying REAL SOCIEDAD round the top and 1909 round the bottom in white. Inside, blue and white vertical stripes hold a navy and white football with a pennant on a pole behind it, flying white over blue. A gold crown rests on top.",
      small:
        "The blue-ringed roundel with blue and white stripes, the football in the middle and a small gold crown on top.",
    },
    full: (k) => [
      k.shield("crowned-roundel", { rim: RSO.blue, field: WHITE, rimWidth: 3 }),
      k.pattern({ kind: "stripes", colour: RSO.blue, count: 9 }),
      `<circle cx="60" cy="71" r="36" fill="none" stroke="${RSO.blue}" stroke-width="12"/>`,
      k.symbol("pennant", { x: 52, y: 64, size: 34 }, { main: RSO.navy, accent: WHITE, ground: WHITE }),
      k.symbol("football", { x: 65, y: 78, size: 30 }, { main: RSO.navy, accent: RSO.navy, ground: WHITE }),
      ringText("Real Sociedad", 36, 7, "top", WHITE),
      ringText("1909", 36, 7, "bottom", WHITE),
      k.symbol(
        "royal-crown",
        { x: 60, y: 18, size: 34 },
        { main: RSO.gold, accent: RSO.blue, ground: WHITE },
      ),
    ],
    small: (k) => [
      k.shield("crowned-roundel", { rim: RSO.blue, field: WHITE, rimWidth: 6 }),
      k.pattern({ kind: "stripes", colour: RSO.blue, count: 7 }),
      k.symbol("football", { x: 60, y: 72, size: 52 }, { main: RSO.navy, accent: RSO.navy, ground: WHITE }),
      k.symbol(
        "royal-crown",
        { x: 60, y: 17, size: 34 },
        { main: RSO.gold, accent: RSO.gold, ground: WHITE },
      ),
    ],
    alternatives: [
      {
        title: "La Concha bay",
        note: "The first La Liga design: San Sebastián's bay drawn full width, with the name supporters use, La Real. Low resemblance to the official badge, but more scenery than football.",
        looks: {
          full: "A white rounded rectangle with a blue edge. The bay fills the upper part in blue: two hills at the sides, a small island in the middle, two wavy lines and a sand-coloured beach curve. A blue band across the foot reads LA REAL in white.",
          small: "The white rounded rectangle filled by the blue bay scene.",
        },
        full: (k) => [
          k.shield("tablet", { rim: RSO.blue, field: WHITE }),
          k.symbol(
            "concha-bay",
            { x: 60, y: 52, size: 82 },
            { main: RSO.blue, accent: RSO.sand, ground: WHITE },
          ),
          k.band(88, 24, RSO.blue),
          k.text("La Real", { x: 60, baseline: 103, cap: 10, tracking: 0.14, fill: WHITE }),
        ],
        small: (k) => [
          k.shield("tablet", { rim: RSO.blue, field: WHITE, rimWidth: 7 }),
          k.symbol(
            "concha-bay",
            { x: 60, y: 58, size: 96 },
            { main: RSO.blue, accent: RSO.sand, ground: WHITE },
          ),
        ],
      },
    ],
  },
  {
    slug: "sevilla",
    name: "Sevilla",
    leagueId: "la_liga",
    nickname: "Sevillistas",
    founded: 1890,
    short: "SEV",
    colours: [
      { name: "White", hex: WHITE },
      { name: "Red", hex: SEV.red },
    ],
    band: { bg: "#a4161a", ink: WHITE, muted: "#fbe0e1", accent: "#ffd166" },
    inspiration:
      "The club's traditional heart-like shield with two rounded lobes: Seville's own motto NO8DO, with its figure-eight skein of wool, in white across the red upper half, and a bold SFC monogram in red below.",
    resemblance: {
      level: "high",
      note: "The lobed outline and an SFC monogram are both features of the official badge, which also shows three saints and a ball. Here the upper half carries the city's NO8DO instead of the saints and the letters are our own setting, but the outline and monogram will read as Sevilla's. The NO8DO badge is the lower-resemblance alternative.",
    },
    composition: "lobed shield with motto and monogram",
    looks: {
      full: "A white heart-like shield with two rounded lobes at the top and a red edge. The upper half is red with NO, a figure-eight skein, and DO in white; the lower half is white with large red SFC initials.",
      small: "The lobed shield: red upper half with a white skein, white lower half with red SFC.",
    },
    full: (k) => [
      k.shield("lobed", { rim: SEV.red, field: WHITE }),
      k.pattern({ kind: "chief", colour: SEV.red, height: 54 }),
      k.text("NO", { x: 34, baseline: 46, cap: 17, tracking: 0.04, fill: WHITE }),
      k.symbol("skein", { x: 60, y: 38, size: 26 }, { main: WHITE, accent: WHITE, ground: SEV.red }),
      k.text("DO", { x: 86, baseline: 46, cap: 17, tracking: 0.04, fill: WHITE }),
      k.text("SFC", { x: 60, baseline: 90, cap: 25, tracking: 0.08, maxWidth: 58, fill: SEV.red }),
    ],
    small: (k) => [
      k.shield("lobed", { rim: SEV.red, field: WHITE, rimWidth: 6 }),
      k.pattern({ kind: "chief", colour: SEV.red, height: 54 }),
      k.symbol("skein", { x: 60, y: 36, size: 36 }, { main: WHITE, accent: WHITE, ground: SEV.red }),
      k.text("SFC", { x: 60, baseline: 94, cap: 30, tracking: 0.04, maxWidth: 66, fill: SEV.red }),
    ],
    alternatives: [
      {
        title: "NO8DO badge",
        note: "The first La Liga design: the motto alone as the crest, on a five-sided badge. Low resemblance to the official badge.",
        looks: {
          full: "A white five-sided badge with a red edge. A red band across the top reads SEVILLA in white. Below, large red letters spell NO, a red figure-eight skein of wool, then DO.",
          small: "The white badge with a red edge and a large red figure-eight skein.",
        },
        full: (k) => [
          k.shield("badge", { rim: SEV.red, field: WHITE }),
          k.pattern({ kind: "chief", colour: SEV.red, height: 30 }),
          k.text("Sevilla", { x: 60, baseline: 25, cap: 10, tracking: 0.16, fill: WHITE }),
          k.text("NO", { x: 32, baseline: 78, cap: 24, tracking: 0.04, fill: SEV.red }),
          k.symbol("skein", { x: 60, y: 66, size: 32 }, { main: SEV.red, accent: SEV.red, ground: WHITE }),
          k.text("DO", { x: 88, baseline: 78, cap: 24, tracking: 0.04, fill: SEV.red }),
        ],
        small: (k) => [
          k.shield("badge", { rim: SEV.red, field: WHITE, rimWidth: 7 }),
          k.symbol("skein", { x: 60, y: 56, size: 82 }, { main: SEV.red, accent: SEV.red, ground: WHITE }),
        ],
      },
    ],
  },
  {
    slug: "racing-santander",
    name: "Racing Santander",
    leagueId: "la_liga",
    nickname: "Racinguistas",
    founded: 1913,
    short: "RAC",
    colours: [
      { name: "Green", hex: RAC.green },
      { name: "White", hex: WHITE },
    ],
    band: { bg: "#005832", ink: WHITE, muted: "#dff3e8", accent: "#9be0b8" },
    inspiration:
      "The Cantabrian stela, the great carved stone discs of the region's ancient people, whose turning arms are Cantabria's emblem, in green and white inside a ring with the club's name and city.",
    resemblance: {
      level: "low",
      note: "The official badge is a shield with the club's letters. The stela is Cantabria's symbol, not the club's.",
    },
    composition: "ring of lettering",
    looks: {
      full: "A green roundel. RACING runs round the top of the ring and SANTANDER round the bottom, in white. The white inner disc holds the green stela: a disc with a white ring and four curved white arms turning round a centre.",
      small: "A green roundel filled by the stela's disc and four turning arms.",
    },
    full: (k) => [
      k.shield("roundel", { rim: RAC.green, field: RAC.green, rimWidth: 3 }),
      k.disc(60, 60, 38, WHITE),
      k.symbol(
        "estela",
        { x: 60, y: 60, size: 70, rotate: 45 },
        { main: RAC.green, accent: RAC.green, ground: WHITE },
      ),
      k.arc("Racing", { r: 46.5, cap: 9.5, side: "top", fill: WHITE }),
      k.arc("Santander", { r: 46.5, cap: 7, side: "bottom", fill: WHITE }),
    ],
    small: (k) => [
      k.shield("roundel", { rim: RAC.green, field: WHITE, rimWidth: 5 }),
      k.symbol(
        "estela",
        { x: 60, y: 60, size: 98, rotate: 45 },
        { main: RAC.green, accent: RAC.green, ground: WHITE },
      ),
    ],
  },
  {
    slug: "athletic-bilbao",
    name: "Athletic Bilbao",
    leagueId: "la_liga",
    nickname: "Lehoiak (The Lions)",
    founded: 1898,
    short: "ATH",
    colours: [
      { name: "Red", hex: ATH.red },
      { name: "White", hex: WHITE },
      { name: "Black", hex: BLACK },
    ],
    band: { bg: "#b0111c", ink: WHITE, muted: "#fde0e2", accent: "#ffd1d4" },
    inspiration:
      "The Lions (Lehoiak in Basque), after San Mamés, the saint thrown to the lions, whose name the ground carries: a heraldic red lion walking across the white upper half of the club's traditional round-bottomed shield, over the red-and-white stripes.",
    resemblance: {
      level: "medium",
      note: "A round-bottomed shield with red-and-white stripes is shared with the official badge, which shows the bridge and church of San Antón and the tree of Gernika. The lion is the nickname, not on the badge.",
    },
    composition: "symbol chief over stripes",
    looks: {
      full: "A round-bottomed shield with a black edge. The upper half is white with a red heraldic lion walking to the left: small head with the mouth open, a large rounded mane, one forepaw raised, tail curling over its back. A thin black line divides it from red and white stripes below.",
      small: "The round-bottomed shield with the red lion over the red and white stripes.",
    },
    full: (k) => [
      k.shield("english", { rim: BLACK, field: WHITE }),
      k.pattern({ kind: "stripes", colour: ATH.red, count: 7, from: 60 }),
      k.symbol("lion-statant", { x: 60, y: 36, size: 64 }, { main: ATH.red, accent: ATH.red, ground: WHITE }),
      k.rule(60, BLACK),
    ],
    small: (k) => [
      k.shield("english", { rim: BLACK, field: WHITE, rimWidth: 7 }),
      k.pattern({ kind: "stripes", colour: ATH.red, count: 5, from: 64 }),
      k.symbol("lion-statant", { x: 60, y: 38, size: 72 }, { main: ATH.red, accent: ATH.red, ground: WHITE }),
    ],
  },
  {
    slug: "alaves",
    name: "Alavés",
    leagueId: "la_liga",
    nickname: "Babazorros",
    founded: 1921,
    short: "ALA",
    colours: [
      { name: "Blue", hex: ALA.blue },
      { name: "White", hex: WHITE },
      { name: "Navy", hex: ALA.navy },
    ],
    band: { bg: ALA.navy, ink: WHITE, muted: "#d9e6f5", accent: "#8ec2ff" },
    inspiration:
      "A crest built on lettering: a single large A for Alavés over the blue-and-white stripes, with the lauburu, the Basque cross of four turning heads, set off to one side for the Basque Country's oldest top-flight club outside Bilbao and San Sebastián.",
    resemblance: {
      level: "low",
      note: "The official badge is a shield with the arms of Vitoria. A single initial and the lauburu are a different idea.",
    },
    composition: "single initial, asymmetric",
    looks: {
      full: "An angular shield with a navy edge and blue and white vertical stripes. A very large white letter A outlined in navy stands left of centre; a navy disc with a white lauburu (four comma-shaped heads turning round a centre) sits in the upper right.",
      small: "The striped angular shield with a large navy disc holding the white lauburu.",
    },
    full: (k) => [
      k.shield("angular", { rim: ALA.navy, field: WHITE }),
      k.pattern({ kind: "stripes", colour: ALA.blue, count: 9 }),
      outlined("A", { x: 52, baseline: 96, cap: 62, tracking: 0 }, WHITE, ALA.navy, 4),
      k.disc(86, 30, 14, ALA.navy),
      k.symbol("lauburu", { x: 86, y: 30, size: 24 }, { main: WHITE, accent: WHITE, ground: ALA.navy }),
    ],
    small: (k) => [
      k.shield("angular", { rim: ALA.navy, field: WHITE, rimWidth: 7 }),
      k.pattern({ kind: "stripes", colour: ALA.blue, count: 7 }),
      k.disc(60, 54, 32, ALA.navy),
      k.symbol("lauburu", { x: 60, y: 54, size: 54 }, { main: WHITE, accent: WHITE, ground: ALA.navy }),
    ],
  },
  {
    slug: "espanyol",
    name: "Espanyol",
    leagueId: "la_liga",
    nickname: "Pericos (Parakeets)",
    founded: 1900,
    short: "ESP",
    colours: [
      { name: "Blue", hex: ESP.blue },
      { name: "White", hex: WHITE },
    ],
    band: { bg: "#00539f", ink: WHITE, muted: "#dbe8f6", accent: "#9fd0ff" },
    inspiration:
      "The Pericos, the parakeets the club and its supporters have been named after for a century: a parakeet perched on a branch, set to one side over a blue sash, with the club's letters below.",
    resemblance: {
      level: "low",
      note: "The official badge is a crowned oval with blue-and-white stripes and the club's letters. The parakeet is the nickname only.",
    },
    composition: "asymmetric symbol over a sash",
    looks: {
      full: "A white upright oval with a blue edge. A blue sash runs from top left to bottom right; a slim navy parakeet with a yellow breast and folded wing perches in profile on a branch, set right of centre, its long tail tapering down. RCDE in small blue capitals at the foot.",
      small: "The white oval with a large navy parakeet with a yellow chest.",
    },
    full: (k) => [
      k.shield("oval", { rim: ESP.blue, field: WHITE }),
      k.pattern({ kind: "sash", colour: ESP.blue, width: 30 }),
      k.symbol("parakeet", { x: 66, y: 52, size: 68 }, { main: ESP.navy, accent: ESP.yellow, ground: WHITE }),
      k.text("RCDE", { x: 50, baseline: 102, cap: 8, tracking: 0.2, fill: ESP.blue }),
    ],
    small: (k) => [
      k.shield("oval", { rim: ESP.blue, field: WHITE, rimWidth: 7 }),
      k.symbol("parakeet", { x: 60, y: 58, size: 92 }, { main: ESP.navy, accent: ESP.yellow, ground: WHITE }),
    ],
  },
  {
    slug: "deportivo-la-coruna",
    name: "Deportivo La Coruña",
    leagueId: "la_liga",
    nickname: "Dépor",
    founded: 1906,
    short: "DEP",
    colours: [
      { name: "Blue", hex: DEP.blue },
      { name: "White", hex: WHITE },
    ],
    band: { bg: DEP.navy, ink: WHITE, muted: "#d9e6f5", accent: "#8ec2ff" },
    inspiration:
      "The Tower of Hercules, the Roman lighthouse that has stood over A Coruña for nearly two thousand years, rising the full height of the shield on a white band between the blue-and-white stripes.",
    resemblance: {
      level: "low",
      note: "The official badge is a crowned shield with the club's letters. The tower is the city's landmark, not part of the badge.",
    },
    composition: "central pale with a tall symbol",
    looks: {
      full: "A heater shield with a navy edge and blue and white vertical stripes. A broad white band runs down the middle, and on it a navy square tower rises the full height, wrapped by the diagonal line of its old ramp, with a small lantern on top.",
      small: "The striped shield with the navy tower on its white middle band.",
    },
    full: (k) => [
      k.shield("heater", { rim: DEP.navy, field: WHITE }),
      k.pattern({ kind: "stripes", colour: DEP.blue, count: 9 }),
      pale(42, 36, WHITE, k.clip),
      k.symbol(
        "hercules-tower",
        { x: 60, y: 58, size: 86 },
        { main: DEP.navy, accent: DEP.navy, ground: WHITE },
      ),
    ],
    small: (k) => [
      k.shield("heater", { rim: DEP.navy, field: WHITE, rimWidth: 7 }),
      k.pattern({ kind: "stripes", colour: DEP.blue, count: 7 }),
      pale(38, 44, WHITE, k.clip),
      k.symbol(
        "hercules-tower",
        { x: 60, y: 56, size: 92 },
        { main: DEP.navy, accent: DEP.navy, ground: WHITE },
      ),
    ],
  },
  {
    slug: "villarreal",
    name: "Villarreal",
    leagueId: "la_liga",
    nickname: "El Submarino Amarillo",
    founded: 1923,
    short: "VIL",
    colours: [
      { name: "Yellow", hex: VIL.yellow },
      { name: "Navy", hex: VIL.navy },
      { name: "Red", hex: VIL.red },
    ],
    band: { bg: VIL.navy, ink: WHITE, muted: "#dfe6f2", accent: VIL.yellow },
    inspiration:
      "The club's traditional structure, reinterpreted: a tall yellow diamond standing in front of a large navy circle, a small royal crown above its point for Vila-real, the royal town (vila reial) it is named after, and inside the diamond the Yellow Submarine, the nickname from the Beatles song the supporters took up. Red appears only as a fine edge.",
    resemblance: {
      level: "high",
      note: "A tall yellow diamond over a blue circle with a crown above is the official badge's structure. Here the diamond is plain yellow with a red edge (not red-and-yellow stripes), there are no CVF letters, and the submarine is the centrepiece, but the structure will read as Villarreal's badge. The porthole roundel and the porthole diamond are lower-resemblance alternatives.",
    },
    composition: "tall diamond before a circle, crowned",
    looks: {
      full: "A large navy circle with a white keyline. In front of it stands a tall, narrow yellow diamond with a fine red edge, its top and bottom points reaching past the circle. A navy submarine sits across the middle of the diamond on a navy wavy line, and a small gold crown with red jewels rests above the diamond's top point.",
      small: "The navy circle with the tall yellow diamond in front and the navy submarine across it.",
    },
    full: (k) => [
      `<circle cx="60" cy="70" r="37" fill="${WHITE}" stroke="${WHITE}" stroke-width="5"/>`,
      `<circle cx="60" cy="70" r="37" fill="${VIL.navy}"/>`,
      k.shield("tall-diamond", { rim: VIL.red, field: VIL.yellow, rimWidth: 2.5 }),
      k.symbol(
        "submarine",
        { x: 60, y: 71, size: 48 },
        { main: VIL.navy, accent: VIL.navy, ground: VIL.yellow },
      ),
      k.symbol(
        "royal-crown",
        { x: 60, y: 12, size: 24 },
        { main: VIL.gold, accent: VIL.red, ground: VIL.navy },
      ),
    ],
    small: (k) => [
      `<circle cx="60" cy="70" r="40" fill="${WHITE}" stroke="${WHITE}" stroke-width="5"/>`,
      `<circle cx="60" cy="70" r="40" fill="${VIL.navy}"/>`,
      k.shield("tall-diamond", { rim: VIL.red, field: VIL.yellow, rimWidth: 3 }),
      k.symbol(
        "submarine",
        { x: 60, y: 71, size: 54 },
        { main: VIL.navy, accent: VIL.navy, ground: VIL.yellow },
      ),
    ],
    alternatives: [
      {
        title: "Porthole roundel",
        note: "The first La Liga design: the porthole as the whole crest. Low resemblance to the official badge.",
        looks: {
          full: "A yellow roundel with a thick navy rim studded with white rivets, like a porthole. Inside, a navy submarine sits on the surface with its conning tower and periscope up, round portholes along its side, over a navy wavy line.",
          small: "The yellow porthole with its navy rim, filled by the navy submarine.",
        },
        full: (k) => [
          k.shield("roundel", { rim: VIL.navy, field: VIL.yellow, rimWidth: 8 }),
          rivets(53, 16, WHITE, 1.6),
          k.symbol(
            "submarine",
            { x: 60, y: 60, size: 76 },
            { main: VIL.navy, accent: VIL.navy, ground: VIL.yellow },
          ),
        ],
        small: (k) => [
          k.shield("roundel", { rim: VIL.navy, field: VIL.yellow, rimWidth: 9 }),
          k.symbol(
            "submarine",
            { x: 58, y: 58, size: 92 },
            { main: VIL.navy, accent: VIL.navy, ground: VIL.yellow },
          ),
        ],
      },
      {
        title: "Porthole diamond",
        note: "The second-round design: a square diamond with the porthole inside it. Medium resemblance.",
        looks: {
          full: "A yellow diamond standing on its point, with a navy edge. In the middle, a round porthole: a thick navy ring studded with white rivets around a yellow window, in which a navy submarine sits on the surface over a navy wavy line.",
          small: "The yellow diamond with a navy edge and the navy submarine across it.",
        },
        full: (k) => [
          k.shield("diamond", { rim: VIL.navy, field: VIL.yellow, rimWidth: 5 }),
          k.disc(60, 60, 34, VIL.navy),
          k.disc(60, 60, 27, VIL.yellow),
          rivetsAt(60, 60, 30.5, 12, WHITE, 1.4),
          k.symbol(
            "submarine",
            { x: 60, y: 61, size: 50 },
            { main: VIL.navy, accent: VIL.navy, ground: VIL.yellow },
          ),
        ],
        small: (k) => [
          k.shield("diamond", { rim: VIL.navy, field: VIL.yellow, rimWidth: 7 }),
          k.symbol(
            "submarine",
            { x: 58, y: 61, size: 74 },
            { main: VIL.navy, accent: VIL.navy, ground: VIL.yellow },
          ),
        ],
      },
    ],
  },
  {
    slug: "osasuna",
    name: "Osasuna",
    leagueId: "la_liga",
    nickname: "Los Rojillos",
    founded: 1920,
    short: "OSA",
    colours: [
      { name: "Red", hex: OSA.red },
      { name: "Navy", hex: OSA.navy },
      { name: "Gold", hex: OSA.gold },
    ],
    band: { bg: OSA.navy, ink: WHITE, muted: "#dbe3f2", accent: "#ff7b7b" },
    inspiration:
      "The club's broad, tapering shield, divided red and navy, with a gold border and a royal crown above for the Kingdom of Navarre. A gold chain runs down the line between the halves (the chains of Navarre's arms), and a crowned gold lion walks across it. The club's name runs across the top.",
    resemblance: {
      level: "high",
      note: "A red-and-navy tapered shield with a gold border, a crown and a crowned lion is the official badge's structure. Here there is no white inner shield and no CAO letters: the chain runs down the division and the lion straddles both halves, in our own drawing. Still, the whole will read as Osasuna's badge. The charging bull design is the lower-resemblance alternative.",
    },
    composition: "divided shield with a chain on the division",
    looks: {
      full: "A broad shield with a gold border, tapering to a point, red on the left half and navy on the right. OSASUNA in white capitals runs across the top. A gold chain runs down the line between the halves, and a crowned gold lion with a spiky heraldic mane walks to the left across the middle, over the chain. A gold crown rests above the shield.",
      small: "The broad red and navy shield with a gold border and the gold lion across it.",
    },
    full: (k) => [
      k.shield("tapered", { rim: OSA.gold, field: OSA.red, rimWidth: 3 }),
      k.pattern({ kind: "halves", colour: OSA.navy, side: "right" }),
      chainColumn(60, 46, 108, 7, OSA.gold),
      k.text("Osasuna", { x: 60, baseline: 44, cap: 8, tracking: 0.2, maxWidth: 80, fill: WHITE }),
      k.symbol(
        "lion-crowned",
        { x: 60, y: 72, size: 56 },
        { main: OSA.gold, accent: OSA.gold, ground: OSA.navy },
      ),
      k.symbol(
        "royal-crown",
        { x: 60, y: 15, size: 30 },
        { main: OSA.gold, accent: OSA.red, ground: OSA.navy },
      ),
    ],
    small: (k) => [
      k.shield("tapered", { rim: OSA.gold, field: OSA.red, rimWidth: 5 }),
      k.pattern({ kind: "halves", colour: OSA.navy, side: "right" }),
      k.symbol(
        "lion-crowned",
        { x: 60, y: 66, size: 76 },
        { main: OSA.gold, accent: OSA.gold, ground: OSA.navy },
      ),
    ],
    alternatives: [
      {
        title: "Charging bull",
        note: "The second-round design: San Fermín's charging bull in cream under a navy chief of chains. Medium resemblance.",
        looks: {
          full: "A red French shield with square shoulders and a navy edge. A navy band across the top carries a row of gold chain links. Below, a cream bull charges to the left, head down and horns forward.",
          small: "The red French shield with the cream charging bull filling it.",
        },
        full: (k) => [
          k.shield("french", { rim: OSA.navy, field: OSA.red }),
          k.pattern({ kind: "chief", colour: OSA.navy, height: 30 }),
          chainRow(22, 98, 20, 7, OSA.gold),
          k.symbol(
            "bull",
            { x: 60, y: 66, size: 70 },
            { main: OSA.cream, accent: OSA.cream, ground: OSA.red },
          ),
        ],
        small: (k) => [
          k.shield("french", { rim: OSA.navy, field: OSA.red, rimWidth: 7 }),
          k.symbol(
            "bull",
            { x: 60, y: 58, size: 96 },
            { main: OSA.cream, accent: OSA.cream, ground: OSA.red },
          ),
        ],
      },
    ],
  },
  {
    slug: "celta-vigo",
    name: "Celta Vigo",
    leagueId: "la_liga",
    nickname: "Os Celestes",
    founded: 1923,
    short: "CEL",
    colours: [
      { name: "Sky blue (celeste)", hex: CEL.sky },
      { name: "White", hex: WHITE },
      { name: "Navy", hex: CEL.navy },
    ],
    band: { bg: CEL.navy, ink: WHITE, muted: "#d7e8f6", accent: CEL.sky },
    inspiration:
      "Celtic Galicia, which gave the club its name: a triskele of three spiralling arms, one bold symbol in white on the sky blue (celeste) the team wears.",
    resemblance: {
      level: "low",
      note: "The official badge is a shield with the red cross of St James and a crown. The triskele is a Celtic symbol of Galicia, not on the badge.",
    },
    composition: "single bold symbol",
    looks: {
      full: "A sky-blue round-bottomed shield with a navy edge. A large white triskele (three spiralling arms turning round a centre) fills it, with CELTA in navy capitals at the foot.",
      small: "The sky-blue shield filled by the white triskele.",
    },
    full: (k) => [
      k.shield("english", { rim: CEL.navy, field: CEL.sky }),
      k.symbol("triskele", { x: 60, y: 54, size: 74 }, { main: WHITE, accent: WHITE, ground: CEL.sky }),
      k.text("Celta", { x: 60, baseline: 102, cap: 10, tracking: 0.16, fill: CEL.navy }),
    ],
    small: (k) => [
      k.shield("english", { rim: CEL.navy, field: CEL.sky, rimWidth: 7 }),
      k.symbol("triskele", { x: 60, y: 58, size: 92 }, { main: WHITE, accent: WHITE, ground: CEL.sky }),
    ],
  },
  {
    slug: "valencia",
    name: "Valencia",
    leagueId: "la_liga",
    nickname: "Los Che",
    founded: 1919,
    short: "VAL",
    colours: [
      { name: "Gold and red (senyera)", hex: VAL.gold },
      { name: "Black", hex: BLACK },
      { name: "Blue", hex: VAL.blue },
    ],
    band: { bg: BLACK, ink: WHITE, muted: "#e6e6e6", accent: "#ff9a5c" },
    inspiration:
      "The club's tall, tapering shield with the bat (rat penat) of Valencia's arms spreading its wings as its top edge, and the gold and red stripes of the Valencian senyera filling the shield, as on the traditional badge. A blue medallion with VCF, in the blue of the senyera's crowned band, sits low in the stripes.",
    resemblance: {
      level: "high",
      note: "A tall shield under a bat, filled with senyera stripes, is the official badge's structure. Here there is no white and blue name band under the bat and no ball; the letters VCF sit in a blue medallion in our own setting. It will still read as Valencia's badge. The bat roundel and the orange blossom are lower-resemblance alternatives.",
    },
    composition: "symbol forming the top edge",
    looks: {
      full: "A tall, egg-shaped shield with a black edge, tapering to a point, filled with gold and red vertical stripes. A black bat outlined in white spreads its wings across the top, forming the upper edge. Low in the stripes, a blue medallion with a white ring holds VCF in white.",
      small: "The tall gold and red striped shield with the black bat across its top.",
    },
    full: (k) => [
      k.shield("egg", { rim: BLACK, field: VAL.gold }),
      k.pattern({ kind: "stripes", colour: VAL.red, count: 9 }),
      k.disc(60, 82, 14, VAL.blue, [WHITE, 2]),
      k.text("VCF", { x: 60, baseline: 86.5, cap: 9, tracking: 0.08, fill: WHITE }),
      k.symbol("bat-keyline", { x: 60, y: 24, size: 92 }, { main: BLACK, accent: BLACK, ground: WHITE }),
    ],
    small: (k) => [
      k.shield("egg", { rim: BLACK, field: VAL.gold, rimWidth: 6 }),
      k.pattern({ kind: "stripes", colour: VAL.red, count: 7 }),
      k.symbol("bat-keyline", { x: 60, y: 24, size: 96 }, { main: BLACK, accent: BLACK, ground: WHITE }),
    ],
    alternatives: [
      {
        title: "Bat roundel",
        note: "The first La Liga design: the bat alone in a roundel with the city's name, no shield or senyera. Lower resemblance to the official badge.",
        looks: {
          full: "A black roundel. VALENCIA runs round the top of the ring and 1919 round the bottom, in white. A white inner disc edged in orange holds a black bat with its wings spread.",
          small: "A white roundel with a black edge, filled by the black bat.",
        },
        full: (k) => [
          k.shield("roundel", { rim: BLACK, field: BLACK, rimWidth: 3 }),
          k.disc(60, 60, 38, WHITE, [VAL.orange, 2.5]),
          k.symbol("bat", { x: 60, y: 62, size: 68 }, { main: BLACK, accent: BLACK, ground: WHITE }),
          k.arc("Valencia", { r: 46.5, cap: 9.5, side: "top", fill: WHITE }),
          k.arc("1919", { r: 46.5, cap: 8, side: "bottom", fill: WHITE }),
        ],
        small: (k) => [
          k.shield("roundel", { rim: BLACK, field: WHITE, rimWidth: 7 }),
          k.symbol("bat", { x: 60, y: 64, size: 98 }, { main: BLACK, accent: BLACK, ground: WHITE }),
        ],
      },
      {
        title: "Orange blossom",
        note: "Valencia's orange groves instead of the bat: an orange blossom (azahar) on a sprig, white on orange. Low resemblance to the official badge.",
        looks: {
          full: "The same black ring with VALENCIA and 1919, around an orange disc holding a white five-petalled orange blossom with green-gold leaves.",
          small: "A black-edged orange roundel with the white blossom.",
        },
        full: (k) => [
          k.shield("roundel", { rim: BLACK, field: BLACK, rimWidth: 3 }),
          k.disc(60, 60, 38, VAL.orange),
          k.symbol(
            "orange-blossom",
            { x: 60, y: 62, size: 66 },
            { main: WHITE, accent: "#2f7d32", ground: VAL.orange },
          ),
          k.arc("Valencia", { r: 46.5, cap: 9.5, side: "top", fill: WHITE }),
          k.arc("1919", { r: 46.5, cap: 8, side: "bottom", fill: WHITE }),
        ],
        small: (k) => [
          k.shield("roundel", { rim: BLACK, field: VAL.orange, rimWidth: 7 }),
          k.symbol(
            "orange-blossom",
            { x: 60, y: 62, size: 90 },
            { main: WHITE, accent: "#2f7d32", ground: VAL.orange },
          ),
        ],
      },
    ],
  },
  {
    slug: "getafe",
    name: "Getafe",
    leagueId: "la_liga",
    nickname: "Azulones",
    founded: 1983,
    short: "GET",
    colours: [
      { name: "Blue", hex: GET.blue },
      { name: "White", hex: WHITE },
    ],
    band: { bg: "#00477f", ink: WHITE, muted: "#d8e6f4", accent: "#8ec2ff" },
    inspiration:
      "Getafe's place in the air: Spain's first military airfield opened here in 1911, and aircraft have been built in the town ever since. A biplane climbing along a white sash on the Azulones' blue.",
    resemblance: {
      level: "low",
      note: "The official badge is a shield with the club's letters and a ball. The aircraft is the town's history, not on the badge.",
    },
    composition: "diagonal with a climbing symbol",
    looks: {
      full: "A blue French shield with a navy edge. A broad white sash rises from bottom left to top right, and a navy biplane climbs along it to the left, propeller at its nose. GETAFE in small white capitals in the upper left.",
      small: "The blue French shield with a large white biplane climbing.",
    },
    full: (k) => [
      k.shield("french", { rim: GET.navy, field: GET.blue }),
      k.pattern({ kind: "sash", colour: WHITE, width: 34, direction: "down-left" }),
      k.symbol("biplane", { x: 60, y: 56, size: 74 }, { main: GET.navy, accent: GET.navy, ground: WHITE }),
      k.text("Getafe", { x: 40, baseline: 32, cap: 8, tracking: 0.2, fill: WHITE }),
    ],
    small: (k) => [
      k.shield("french", { rim: GET.navy, field: GET.blue, rimWidth: 7 }),
      k.symbol("biplane", { x: 60, y: 56, size: 96 }, { main: WHITE, accent: WHITE, ground: GET.blue }),
    ],
  },
  {
    slug: "rayo-vallecano",
    name: "Rayo Vallecano",
    leagueId: "la_liga",
    nickname: "Franjirrojos",
    founded: 1924,
    short: "RAY",
    colours: [
      { name: "White", hex: WHITE },
      { name: "Red", hex: RAY.red },
      { name: "Black", hex: BLACK },
    ],
    band: { bg: "#a8151d", ink: WHITE, muted: "#fde0e1", accent: "#ffd1d3" },
    inspiration:
      "The Franjirrojos of Vallecas, Madrid's working-class neighbourhood: the red sash (franja) across the white, and the lightning bolt (rayo) that gives the club its name.",
    resemblance: {
      level: "high",
      note: "A white crest with a red sash and a lightning bolt brings together the club's shirt and the official badge's bolt. The drawing is new, but the combination will read as Rayo's. The sash-and-initials design is the alternative.",
    },
    composition: "diagonal with a bold symbol",
    looks: {
      full: "A white angular shield with a red edge. A red sash runs from top left to bottom right, and a large black lightning bolt strikes down across it.",
      small: "The white angular shield with the red sash and the black lightning bolt.",
    },
    full: (k) => [
      k.shield("angular", { rim: RAY.red, field: WHITE }),
      k.pattern({ kind: "sash", colour: RAY.red, width: 26 }),
      k.symbol("bolt", { x: 60, y: 66, size: 62 }, { main: BLACK, accent: BLACK, ground: WHITE }),
    ],
    small: (k) => [
      k.shield("angular", { rim: RAY.red, field: WHITE, rimWidth: 7 }),
      k.pattern({ kind: "sash", colour: RAY.red, width: 28 }),
      k.symbol("bolt", { x: 60, y: 56, size: 86 }, { main: BLACK, accent: BLACK, ground: WHITE }),
    ],
    alternatives: [
      {
        title: "Franja and initials",
        note: "The shirt's red sash with RV, without the bolt. Lower resemblance to the official badge.",
        looks: {
          full: "The white angular shield with the red sash and large black RV initials outlined in white.",
          small: "The white angular shield with the red sash.",
        },
        full: (k) => [
          k.shield("angular", { rim: RAY.red, field: WHITE }),
          k.pattern({ kind: "sash", colour: RAY.red, width: 30 }),
          outlined("RV", { x: 60, baseline: 74, cap: 34, tracking: 0.04 }, BLACK, WHITE, 3.5),
        ],
        small: (k) => [
          k.shield("angular", { rim: RAY.red, field: WHITE, rimWidth: 7 }),
          k.pattern({ kind: "sash", colour: RAY.red, width: 34 }),
        ],
      },
    ],
  },
  {
    slug: "levante",
    name: "Levante",
    leagueId: "la_liga",
    nickname: "Granotes (Frogs)",
    founded: 1909,
    short: "LEV",
    colours: [
      { name: "Blue", hex: LEV.blue },
      { name: "Claret", hex: LEV.claret },
      { name: "White", hex: WHITE },
    ],
    band: { bg: "#6b1230", ink: WHITE, muted: "#f6dbe4", accent: "#8cb8ff" },
    inspiration:
      "The Granotes (frogs), the nickname from the marshes beside the club's first ground in Valencia: a white frog on the blue and claret halves, under a white chief with the club's name.",
    resemblance: {
      level: "low",
      note: "The official badge is a blue-and-claret shield with the club's letters and a bat. The frog is the nickname only.",
    },
    composition: "halves with a chief",
    looks: {
      full: "A heater shield with a navy edge, blue on the left half and claret on the right. A white band across the top reads LEVANTE in claret. Below, a white frog sits facing up, seen from above, with its legs folded.",
      small: "The blue and claret shield with a large white frog.",
    },
    full: (k) => [
      k.shield("heater", { rim: LEV.navy, field: LEV.blue }),
      k.pattern({ kind: "halves", colour: LEV.claret, side: "right" }),
      k.pattern({ kind: "chief", colour: WHITE, height: 29 }),
      k.text("Levante", { x: 60, baseline: 24.5, cap: 10, tracking: 0.14, fill: LEV.claret }),
      k.symbol("frog", { x: 60, y: 66, size: 58 }, { main: WHITE, accent: WHITE, ground: LEV.claret }),
    ],
    small: (k) => [
      k.shield("heater", { rim: LEV.navy, field: LEV.blue, rimWidth: 7 }),
      k.pattern({ kind: "halves", colour: LEV.claret, side: "right" }),
      k.symbol("frog", { x: 60, y: 56, size: 84 }, { main: WHITE, accent: WHITE, ground: LEV.claret }),
    ],
  },
  {
    slug: "elche",
    name: "Elche",
    leagueId: "la_liga",
    nickname: "Franjiverdes",
    founded: 1923,
    short: "ELC",
    colours: [
      { name: "White", hex: WHITE },
      { name: "Green", hex: ELC.green },
    ],
    band: { bg: "#045c2a", ink: WHITE, muted: "#d8efe0", accent: "#a6e3bc" },
    inspiration:
      "The Palmeral of Elche, the great grove of date palms around the city, one palm rising tall through the green band (franja) the Franjiverdes wear across their white shirts.",
    resemblance: {
      level: "medium",
      note: "The green band and a palm both appear in the club's tradition and on its badge. Here the palm stands alone on a round-topped arch with no letters.",
    },
    composition: "horizontal band with a tall symbol",
    looks: {
      full: "A white round-topped arch with a green edge and a green horizontal band across the middle. A green date palm rises through the band, its fronds spreading at the top, with a cluster of gold dates.",
      small: "The white arch with the green band and the green palm.",
    },
    full: (k) => [
      k.shield("arch", { rim: ELC.green, field: WHITE }),
      k.band(62, 14, ELC.green),
      k.symbol("palm", { x: 60, y: 58, size: 88 }, { main: ELC.green, accent: ELC.gold, ground: WHITE }),
    ],
    small: (k) => [
      k.shield("arch", { rim: ELC.green, field: WHITE, rimWidth: 7 }),
      k.band(62, 16, ELC.green),
      k.symbol("palm", { x: 60, y: 58, size: 96 }, { main: ELC.green, accent: ELC.gold, ground: WHITE }),
    ],
  },
  {
    slug: "malaga",
    name: "Málaga",
    leagueId: "la_liga",
    nickname: "Boquerones (Anchovies)",
    founded: 1904,
    short: "MAL",
    colours: [
      { name: "Blue", hex: MAL.blue },
      { name: "White", hex: WHITE },
    ],
    band: { bg: MAL.navy, ink: WHITE, muted: "#dbe8f6", accent: "#8ec2ff" },
    inspiration:
      "The Boquerones, the anchovies Málaga's fishermen have landed for centuries and the club's nickname: two silver-white anchovies on a navy disc over the blue-and-white stripes, under the city's name.",
    resemblance: {
      level: "low",
      note: "The official badge is a crowned shield with the city's arms and the club's letters. The anchovies are the nickname only.",
    },
    composition: "chief with a central disc",
    looks: {
      full: "A round-bottomed shield with a blue edge and blue and white vertical stripes. A blue band across the top reads MÁLAGA in white. In the middle, a navy disc with a white ring holds two white anchovies swimming left.",
      small: "The striped shield with a large navy disc holding the two white anchovies.",
    },
    full: (k) => [
      k.shield("english", { rim: MAL.blue, field: WHITE }),
      k.pattern({ kind: "stripes", colour: MAL.blue, count: 9 }),
      k.pattern({ kind: "chief", colour: MAL.blue, height: 28 }),
      k.text("Málaga", { x: 60, baseline: 24, cap: 10, tracking: 0.14, fill: WHITE }),
      k.disc(60, 66, 26, MAL.navy, [WHITE, 3]),
      k.symbol("anchovies", { x: 60, y: 66, size: 44 }, { main: WHITE, accent: WHITE, ground: MAL.navy }),
    ],
    small: (k) => [
      k.shield("english", { rim: MAL.blue, field: WHITE, rimWidth: 7 }),
      k.pattern({ kind: "stripes", colour: MAL.blue, count: 7 }),
      k.disc(60, 58, 34, MAL.navy, [WHITE, 4]),
      k.symbol("anchovies", { x: 60, y: 58, size: 58 }, { main: WHITE, accent: WHITE, ground: MAL.navy }),
    ],
  },
];

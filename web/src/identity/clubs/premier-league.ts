// Premier League crests, 2026-27. Each design is an original interpretation
// of the club's heritage, not a copy of its badge: see `inspiration` for the
// idea and `resemblance` for how close it might look to the official badge.
import type { ClubIdentity } from "../types.ts";

const WHITE = "#fff";
const BLACK = "#111";

// Arsenal ----------------------------------------------------------------
const ARS = { red: "#db0007", navy: "#063672", gold: "#c8a24a" };

// Brighton ---------------------------------------------------------------
const BHA = { blue: "#0057b8", navy: "#00285e" };

// Manchester City --------------------------------------------------------
const MCI = { sky: "#6cabdd", navy: "#1c2c5b", gold: "#f2b705" };

// Liverpool --------------------------------------------------------------
const LIV = { red: "#c8102e", deep: "#8c0a1f", gold: "#e8c547" };

// Bournemouth ------------------------------------------------------------
const BOU = { red: "#da291c", leaf: "#3b8a3e" };

// Brentford --------------------------------------------------------------
const BRE = { red: "#e30613", gold: "#f2b705" };

// Leeds United -----------------------------------------------------------
const LEE = { blue: "#1d428a", yellow: "#ffcd00" };

// Chelsea ----------------------------------------------------------------
const CHE = { blue: "#034694", gold: "#d1a33b", red: "#dc2828" };

// Everton ----------------------------------------------------------------
const EVE = { blue: "#003399", gold: "#d4a93c" };

// Tottenham Hotspur ------------------------------------------------------
const TOT = { navy: "#132257" };

// Hull City --------------------------------------------------------------
const HUL = { amber: "#f5a12d" };

// Aston Villa ------------------------------------------------------------
const AVL = { claret: "#670e36", sky: "#95bfe5", gold: "#fee505" };

// Newcastle United -------------------------------------------------------
const NEW = { gold: "#b8975a" };

// Coventry City ----------------------------------------------------------
const COV = { sky: "#59b4e5", navy: "#0b2240", flame: "#f28c28" };

// Fulham -----------------------------------------------------------------
const FUL = { red: "#cc0000" };

// Ipswich Town -----------------------------------------------------------
const IPS = { blue: "#0044a9", navy: "#002d72", red: "#d52b1e" };

// Nottingham Forest ------------------------------------------------------
const NFO = { red: "#dd0000", deep: "#8e0000" };

// Sunderland -------------------------------------------------------------
const SUN = { red: "#eb172b", gold: "#f2c94c" };

// Manchester United ------------------------------------------------------
const MUN = { red: "#da291c", gold: "#fbe122" };

// Crystal Palace ---------------------------------------------------------
const CRY = { red: "#c4122e", blue: "#1b458f", navy: "#0e2a5c" };

export const PREMIER_LEAGUE: readonly ClubIdentity[] = [
  {
    slug: "arsenal",
    name: "Arsenal",
    leagueId: "premier_league",
    nickname: "The Gunners",
    founded: 1886,
    short: "ARS",
    colours: [
      { name: "Red", hex: ARS.red },
      { name: "White", hex: WHITE },
      { name: "Navy", hex: ARS.navy },
      { name: "Gold", hex: ARS.gold },
    ],
    band: { bg: "#a5000c", ink: WHITE, muted: "#fbdcde", accent: "#f0cf7a" },
    inspiration:
      "Formed in 1886 by workers at the Royal Arsenal in Woolwich, the army's munitions works. A wheeled field gun of the kind made there, inside a ring carrying the name and the founding year.",
    resemblance: {
      level: "high",
      note: "A gun is the club's long-standing symbol. This one is a wheeled field gun facing left on a roundel, where the official badge has a bare cannon facing right on a shield, but the symbol and the red-and-white colours will still read as Arsenal's.",
    },
    looks: {
      full: "A red roundel with a navy edge. A white inner disc, edged in gold, holds a red wheeled field gun facing left. ARSENAL runs round the top of the red ring and 1886 round the bottom, with a small gold star on each side.",
      small: "A red roundel with a navy edge and a white field gun filling it.",
    },
    full: (k) => [
      k.shield("roundel", { rim: ARS.navy, field: ARS.red, rimWidth: 3 }),
      k.disc(60, 60, 38, WHITE, [ARS.gold, 2.5]),
      k.symbol("field-gun", { x: 61, y: 61, size: 62 }, { main: ARS.red, accent: ARS.gold, ground: WHITE }),
      k.arc("Arsenal", { r: 46.5, cap: 9.5, side: "top", fill: WHITE }),
      k.arc("1886", { r: 46.5, cap: 8, side: "bottom", fill: WHITE }),
      k.star(14, 60, 4, ARS.gold),
      k.star(106, 60, 4, ARS.gold),
    ],
    small: (k) => [
      k.shield("roundel", { rim: ARS.navy, field: ARS.red, rimWidth: 7 }),
      k.symbol("field-gun", { x: 61, y: 62, size: 86 }, { main: WHITE, accent: WHITE, ground: ARS.red }),
    ],
    alternatives: [
      {
        title: "Dial Square",
        note: "The club's first name, after the Woolwich workshop named for the sundial over its entrance. Keeps the Woolwich story without the gun.",
        looks: {
          full: "The same red ring and white disc, with a red sundial in place of the gun: hour lines fanning out from a navy triangular blade on a red base. ARSENAL round the top and DIAL SQUARE round the bottom.",
          small: "A red roundel with a white sundial.",
        },
        full: (k) => [
          k.shield("roundel", { rim: ARS.navy, field: ARS.red, rimWidth: 3 }),
          k.disc(60, 60, 38, WHITE, [ARS.gold, 2.5]),
          k.symbol("dial", { x: 60, y: 60, size: 62 }, { main: ARS.red, accent: ARS.navy, ground: WHITE }),
          k.arc("Arsenal", { r: 46.5, cap: 9.5, side: "top", fill: WHITE }),
          k.arc("Dial Square", { r: 46.5, cap: 7, side: "bottom", fill: WHITE }),
        ],
        small: (k) => [
          k.shield("roundel", { rim: ARS.navy, field: ARS.red, rimWidth: 7 }),
          k.symbol("dial", { x: 60, y: 60, size: 84 }, { main: WHITE, accent: WHITE, ground: ARS.red }),
        ],
      },
    ],
  },
  {
    slug: "brighton-and-hove-albion",
    name: "Brighton & Hove Albion",
    leagueId: "premier_league",
    nickname: "The Seagulls",
    founded: 1901,
    short: "BHA",
    colours: [
      { name: "Blue", hex: BHA.blue },
      { name: "White", hex: WHITE },
    ],
    band: { bg: "#004a9f", ink: WHITE, muted: "#e3edfa", accent: "#9fd0ff" },
    inspiration:
      "A seaside club: a gull gliding over the blue-and-white stripes the team has worn since the early 1900s, under a sky-blue chief like the sea front.",
    resemblance: {
      level: "medium",
      note: "The gull is the club's symbol. The official badge is a gull in a circle; this is a striped heater shield with the gull in its chief.",
    },
    looks: {
      full: "A heater shield with a navy edge. The top third is blue with a white gull gliding across it; under it a white band reads BRIGHTON in blue, between two navy rules; the lower part has blue and white vertical stripes.",
      small: "A blue heater shield with a large white gull, and short blue and white stripes at the point.",
    },
    full: (k) => [
      k.shield("heater", { rim: BHA.navy, field: WHITE }),
      k.pattern({ kind: "stripes", colour: BHA.blue, count: 7, from: 56 }),
      k.pattern({ kind: "chief", colour: BHA.blue, height: 41 }),
      k.symbol("gull", { x: 60, y: 24, size: 54 }, { main: WHITE, accent: WHITE, ground: BHA.blue }),
      k.rule(41, BHA.navy),
      k.text("Brighton", { x: 60, baseline: 53, cap: 8.5, maxWidth: 76, fill: BHA.blue }),
      k.rule(56, BHA.navy),
    ],
    small: (k) => [
      k.shield("heater", { rim: BHA.navy, field: BHA.blue, rimWidth: 7 }),
      k.pattern({ kind: "stripes", colour: WHITE, count: 7, from: 74 }),
      k.symbol("gull", { x: 60, y: 46, size: 84 }, { main: WHITE, accent: WHITE, ground: BHA.blue }),
    ],
  },
  {
    slug: "manchester-city",
    name: "Manchester City",
    leagueId: "premier_league",
    nickname: "City",
    founded: 1880,
    short: "MCI",
    colours: [
      { name: "Sky blue", hex: MCI.sky },
      { name: "Navy", hex: MCI.navy },
      { name: "Gold", hex: MCI.gold },
    ],
    band: { bg: MCI.navy, ink: WHITE, muted: "#d3e6f5", accent: MCI.sky },
    inspiration:
      "Industrial Manchester: the worker bee, the city's emblem of its mills and the people who worked them, over three gold bands for the rivers Irwell, Irk and Medlock from the city's arms.",
    resemblance: {
      level: "low",
      note: "The official badge is a roundel with a ship. The rivers appeared on an older club badge, but the bee and the French shield make this a new design.",
    },
    looks: {
      full: "A sky-blue French shield with a navy edge. A navy band across the top reads CITY in white. Below, three thin gold diagonal bands rise to the right behind a navy and gold bee with white wings.",
      small: "A sky-blue French shield with a large navy and gold bee.",
    },
    full: (k) => [
      k.shield("french", { rim: MCI.navy, field: MCI.sky }),
      k.pattern({ kind: "bends", colour: MCI.gold, count: 3, width: 4, gap: 5, offset: 26 }),
      k.pattern({ kind: "chief", colour: MCI.navy, height: 33 }),
      k.text("City", { x: 60, baseline: 28.5, cap: 13, fill: WHITE }),
      k.symbol("bee", { x: 60, y: 66, size: 50 }, { main: MCI.navy, accent: MCI.gold, ground: WHITE }),
    ],
    small: (k) => [
      k.shield("french", { rim: MCI.navy, field: MCI.sky, rimWidth: 7 }),
      k.symbol("bee", { x: 60, y: 58, size: 82 }, { main: MCI.navy, accent: MCI.gold, ground: WHITE }),
    ],
  },
  {
    slug: "liverpool",
    name: "Liverpool",
    leagueId: "premier_league",
    nickname: "The Reds",
    founded: 1892,
    short: "LIV",
    colours: [
      { name: "Red", hex: LIV.red },
      { name: "White", hex: WHITE },
      { name: "Gold", hex: LIV.gold },
    ],
    band: { bg: "#a50d26", ink: WHITE, muted: "#fbdde2", accent: LIV.gold },
    inspiration:
      "A port city's club: a cormorant-like sea bird with a sprig in its beak, from the bird legend the city has used since the Middle Ages, on a round-bottomed shield.",
    resemblance: {
      level: "high",
      note: "The bird is shared by the city and the club's official badge. This bird stands with one wing raised, with no gates, flames or motto, but it is still the same idea.",
    },
    looks: {
      full: "A red round-bottomed shield with a dark red edge. A dark red band across the top reads LIVERPOOL in white. Below, a white sea bird stands with one wing raised and a gold sprig in its beak; 1892 in small gold figures at the foot.",
      small: "A red round-bottomed shield with the white bird filling it.",
    },
    full: (k) => [
      k.shield("english", { rim: LIV.deep, field: LIV.red }),
      k.band(11, 16, LIV.deep),
      k.text("Liverpool", { x: 60, baseline: 23.5, cap: 8.5, maxWidth: 74, fill: WHITE }),
      k.symbol("sea-bird", { x: 60, y: 63, size: 64 }, { main: WHITE, accent: LIV.gold, ground: LIV.red }),
      k.text("1892", { x: 60, baseline: 106, cap: 6.5, fill: LIV.gold }),
    ],
    small: (k) => [
      k.shield("english", { rim: LIV.deep, field: LIV.red, rimWidth: 7 }),
      k.symbol("sea-bird", { x: 60, y: 59, size: 86 }, { main: WHITE, accent: LIV.gold, ground: LIV.red }),
    ],
    alternatives: [
      {
        title: "Anchor",
        note: "The docks without the bird: a ship's anchor for the port that built the city.",
        looks: {
          full: "The same red shield and LIVERPOOL band, with a white ship's anchor in place of the bird, and 1892 at the foot.",
          small: "A red round-bottomed shield with a white anchor.",
        },
        full: (k) => [
          k.shield("english", { rim: LIV.deep, field: LIV.red }),
          k.band(11, 16, LIV.deep),
          k.text("Liverpool", { x: 60, baseline: 23.5, cap: 8.5, maxWidth: 74, fill: WHITE }),
          k.symbol("anchor", { x: 60, y: 64, size: 58 }, { main: WHITE, accent: LIV.gold, ground: LIV.red }),
          k.text("1892", { x: 60, baseline: 106, cap: 6.5, fill: LIV.gold }),
        ],
        small: (k) => [
          k.shield("english", { rim: LIV.deep, field: LIV.red, rimWidth: 7 }),
          k.symbol("anchor", { x: 60, y: 60, size: 80 }, { main: WHITE, accent: WHITE, ground: LIV.red }),
        ],
      },
    ],
  },
  {
    slug: "bournemouth",
    name: "Bournemouth",
    leagueId: "premier_league",
    nickname: "The Cherries",
    founded: 1899,
    short: "BOU",
    colours: [
      { name: "Red", hex: BOU.red },
      { name: "Black", hex: BLACK },
    ],
    band: { bg: "#a3190f", ink: WHITE, muted: "#fde6e3", accent: "#ffb3aa" },
    inspiration:
      "The Cherries, after the cherry-red stripes and the cherry orchards that once stood by the ground at Dean Court: a pair of cherries on the red-and-black stripes.",
    resemblance: {
      level: "low",
      note: "The official badge is a player heading a ball. Cherries are only the nickname.",
    },
    looks: {
      full: "A round-bottomed shield with a black edge and red and black vertical stripes. A black band across the top reads AFCB in white. In the middle, a white disc with a black ring holds two red cherries on green stalks with a leaf.",
      small: "The striped shield with a large white disc holding the cherries.",
    },
    full: (k) => [
      k.shield("english", { rim: BLACK, field: BOU.red }),
      k.pattern({ kind: "stripes", colour: BLACK, count: 9 }),
      k.pattern({ kind: "chief", colour: BLACK, height: 30 }),
      k.text("AFCB", { x: 60, baseline: 25.5, cap: 12, fill: WHITE }),
      k.disc(60, 66, 24, WHITE, [BLACK, 3]),
      k.symbol("cherries", { x: 59, y: 63, size: 42 }, { main: BOU.red, accent: BOU.leaf, ground: WHITE }),
    ],
    small: (k) => [
      k.shield("english", { rim: BLACK, field: BOU.red, rimWidth: 7 }),
      k.pattern({ kind: "stripes", colour: BLACK, count: 7 }),
      k.disc(60, 60, 33, WHITE, [BLACK, 4]),
      k.symbol("cherries", { x: 59, y: 57, size: 58 }, { main: BOU.red, accent: BOU.leaf, ground: WHITE }),
    ],
  },
  {
    slug: "brentford",
    name: "Brentford",
    leagueId: "premier_league",
    nickname: "The Bees",
    founded: 1889,
    short: "BRE",
    colours: [
      { name: "Red", hex: BRE.red },
      { name: "White", hex: WHITE },
      { name: "Black", hex: BLACK },
    ],
    band: { bg: "#b8000d", ink: WHITE, muted: "#fde1e3", accent: BRE.gold },
    inspiration:
      "The Bees, from the students who cheered 'Buck up, Bs!' in the club's early years: a bee on a white roundel over the red-and-white stripes.",
    resemblance: {
      level: "high",
      note: "The official badge is a bee in a red-and-white roundel. This is a striped shield with the bee in a white disc, but bee and colours together will read as Brentford's badge.",
    },
    looks: {
      full: "A heater shield with a black edge and red and white vertical stripes. A black band across the top reads BRENTFORD in white. Lower down, a white disc with a black ring holds a black and gold bee with white wings.",
      small: "The striped shield with a large white disc holding the bee.",
    },
    full: (k) => [
      k.shield("heater", { rim: BLACK, field: WHITE }),
      k.pattern({ kind: "stripes", colour: BRE.red, count: 9 }),
      k.pattern({ kind: "chief", colour: BLACK, height: 31 }),
      k.text("Brentford", { x: 60, baseline: 25.5, cap: 9, maxWidth: 76, fill: WHITE }),
      k.disc(60, 68, 25, WHITE, [BLACK, 3]),
      k.symbol("bee", { x: 60, y: 68, size: 42 }, { main: BLACK, accent: BRE.gold, ground: WHITE }),
    ],
    small: (k) => [
      k.shield("heater", { rim: BLACK, field: WHITE, rimWidth: 7 }),
      k.pattern({ kind: "stripes", colour: BRE.red, count: 7 }),
      k.disc(60, 56, 33, WHITE, [BLACK, 4]),
      k.symbol("bee", { x: 60, y: 56, size: 58 }, { main: BLACK, accent: BRE.gold, ground: WHITE }),
    ],
    alternatives: [
      {
        title: "Honeycomb",
        note: "The Bees without a bee: seven honeycomb cells, one in gold, on the red field.",
        looks: {
          full: "A red heater shield with a black edge and the BRENTFORD band. Below, seven white honeycomb cells, the middle one gold.",
          small: "A red heater shield with the seven honeycomb cells.",
        },
        full: (k) => [
          k.shield("heater", { rim: BLACK, field: BRE.red }),
          k.pattern({ kind: "chief", colour: BLACK, height: 31 }),
          k.text("Brentford", { x: 60, baseline: 25.5, cap: 9, maxWidth: 76, fill: WHITE }),
          k.symbol(
            "honeycomb",
            { x: 60, y: 69, size: 56 },
            { main: WHITE, accent: BRE.gold, ground: BRE.red },
          ),
        ],
        small: (k) => [
          k.shield("heater", { rim: BLACK, field: BRE.red, rimWidth: 7 }),
          k.symbol(
            "honeycomb",
            { x: 60, y: 56, size: 76 },
            { main: WHITE, accent: BRE.gold, ground: BRE.red },
          ),
        ],
      },
    ],
  },
  {
    slug: "leeds-united",
    name: "Leeds United",
    leagueId: "premier_league",
    nickname: "The Whites",
    founded: 1919,
    short: "LEE",
    colours: [
      { name: "White", hex: WHITE },
      { name: "Blue", hex: LEE.blue },
      { name: "Yellow", hex: LEE.yellow },
    ],
    band: { bg: LEE.blue, ink: WHITE, muted: "#dbe3f3", accent: LEE.yellow },
    inspiration:
      "Yorkshire's white rose on a blue disc, above a yellow chevron, on the all-white the club has worn since the 1960s.",
    resemblance: {
      level: "low",
      note: "The official badge is a shield with the letters LUFC. The rose has been on older club badges, as it is the county's emblem.",
    },
    looks: {
      full: "A white angular shield with cut top corners and a blue edge. A blue band across the top reads LEEDS in white. In the middle, a blue disc holds a white five-petalled rose with a yellow heart; a yellow chevron crosses the lower part.",
      small: "A blue angular shield with a large white rose and a yellow chevron near the point.",
    },
    full: (k) => [
      k.shield("angular", { rim: LEE.blue, field: WHITE }),
      k.pattern({ kind: "chief", colour: LEE.blue, height: 29 }),
      k.text("Leeds", { x: 60, baseline: 24.5, cap: 11, fill: WHITE }),
      k.pattern({ kind: "chevron", colour: LEE.yellow, y: 82, width: 8, depth: 22 }),
      k.disc(60, 56, 22, LEE.blue),
      k.symbol("rose", { x: 60, y: 56, size: 38 }, { main: WHITE, accent: LEE.yellow, ground: LEE.blue }),
    ],
    small: (k) => [
      k.shield("angular", { rim: LEE.blue, field: LEE.blue, rimWidth: 7 }),
      k.pattern({ kind: "chevron", colour: LEE.yellow, y: 84, width: 8, depth: 26 }),
      k.symbol("rose", { x: 60, y: 48, size: 72 }, { main: WHITE, accent: LEE.yellow, ground: LEE.blue }),
    ],
  },
  {
    slug: "chelsea",
    name: "Chelsea",
    leagueId: "premier_league",
    nickname: "The Blues",
    founded: 1905,
    short: "CHE",
    colours: [
      { name: "Royal blue", hex: CHE.blue },
      { name: "White", hex: WHITE },
      { name: "Gold", hex: CHE.gold },
    ],
    band: { bg: CHE.blue, ink: WHITE, muted: "#d8e5f5", accent: CHE.gold },
    inspiration:
      "The lion of the Cadogan family, Viscounts Chelsea and lords of the manor, drawn as a lion's head with a pointed gold mane, inside a royal-blue ring.",
    resemblance: {
      level: "medium",
      note: "The official badge has a whole lion holding a staff. This is a lion's head, front on, in a ring: same animal, different drawing.",
    },
    looks: {
      full: "A royal-blue roundel with a gold edge. A white inner disc, edged in gold, holds a blue lion's head, front on, with a pointed gold mane. CHELSEA runs round the top of the ring and 1905 round the bottom, with a small red star on each side.",
      small: "A blue roundel with a gold edge, filled by a white lion's head with a gold mane.",
    },
    full: (k) => [
      k.shield("roundel", { rim: CHE.gold, field: CHE.blue, rimWidth: 3 }),
      k.disc(60, 60, 38, WHITE, [CHE.gold, 2.5]),
      k.symbol("lion-head", { x: 60, y: 60, size: 64 }, { main: CHE.blue, accent: CHE.gold, ground: WHITE }),
      k.arc("Chelsea", { r: 46.5, cap: 9.5, side: "top", fill: WHITE }),
      k.arc("1905", { r: 46.5, cap: 8, side: "bottom", fill: WHITE }),
      k.star(14, 60, 3.5, CHE.red),
      k.star(106, 60, 3.5, CHE.red),
    ],
    small: (k) => [
      k.shield("roundel", { rim: CHE.gold, field: CHE.blue, rimWidth: 7 }),
      k.symbol("lion-head", { x: 60, y: 60, size: 90 }, { main: WHITE, accent: CHE.gold, ground: CHE.blue }),
    ],
  },
  {
    slug: "everton",
    name: "Everton",
    leagueId: "premier_league",
    nickname: "The Toffees",
    founded: 1878,
    short: "EVE",
    colours: [
      { name: "Royal blue", hex: EVE.blue },
      { name: "White", hex: WHITE },
    ],
    band: { bg: EVE.blue, ink: WHITE, muted: "#dbe2f7", accent: "#f2cf73" },
    inspiration:
      "The round lock-up on Everton Brow, the old village tower that stood near where the club began as St Domingo's church team in 1878.",
    resemblance: {
      level: "high",
      note: "The tower is the centre of the official badge. This one is simpler and on a plain shield with no wreaths or motto, but it is clearly the same tower.",
    },
    looks: {
      full: "A white heater shield with a blue edge. A blue band across the top reads EVERTON in white. Below, a blue round tower with a domed roof, a band of stone, two windows and an arched door.",
      small: "A blue heater shield with the tower in white.",
    },
    full: (k) => [
      k.shield("heater", { rim: EVE.blue, field: WHITE }),
      k.pattern({ kind: "chief", colour: EVE.blue, height: 33 }),
      k.text("Everton", { x: 60, baseline: 27.5, cap: 10, maxWidth: 76, fill: WHITE }),
      k.symbol("tower", { x: 60, y: 70, size: 58 }, { main: EVE.blue, accent: EVE.gold, ground: WHITE }),
    ],
    small: (k) => [
      k.shield("heater", { rim: EVE.blue, field: EVE.blue, rimWidth: 7 }),
      k.symbol("tower", { x: 60, y: 54, size: 80 }, { main: WHITE, accent: WHITE, ground: EVE.blue }),
    ],
    alternatives: [
      {
        title: "The Toffees",
        note: "The nickname, after the toffee shop near the club's first grounds: a wrapped toffee in gold, no tower.",
        looks: {
          full: "A blue heater shield. EVERTON in white across the top, a wrapped toffee with white twisted ends and a gold middle, and 1878 below.",
          small: "A blue heater shield with the wrapped toffee.",
        },
        full: (k) => [
          k.shield("heater", { rim: EVE.blue, field: EVE.blue }),
          k.text("Everton", { x: 60, baseline: 32, cap: 12, maxWidth: 76, fill: WHITE }),
          k.symbol("toffee", { x: 60, y: 66, size: 60 }, { main: WHITE, accent: EVE.gold, ground: EVE.blue }),
          k.text("1878", { x: 60, baseline: 96, cap: 7, fill: WHITE }),
        ],
        small: (k) => [
          k.shield("heater", { rim: EVE.blue, field: EVE.blue, rimWidth: 7 }),
          k.symbol("toffee", { x: 60, y: 54, size: 84 }, { main: WHITE, accent: EVE.gold, ground: EVE.blue }),
        ],
      },
    ],
  },
  {
    slug: "tottenham-hotspur",
    name: "Tottenham Hotspur",
    leagueId: "premier_league",
    nickname: "Spurs",
    founded: 1882,
    short: "TOT",
    colours: [
      { name: "White", hex: WHITE },
      { name: "Navy", hex: TOT.navy },
    ],
    band: { bg: TOT.navy, ink: WHITE, muted: "#d9def0", accent: "#a9b8ee" },
    inspiration:
      "Named after Harry Hotspur, Sir Henry Percy, the fourteenth-century knight whose family held land in Tottenham: a rider's spur, with its star-shaped rowel, under his name.",
    resemblance: {
      level: "low",
      note: "The official badge is a cockerel on a ball. Spurs are only in the name.",
    },
    looks: {
      full: "A navy French shield. A white band across the top reads HOTSPUR in navy. Below, one large white rider's spur lies across the shield, its heel band curving down on the left and its star-shaped rowel on the right.",
      small: "A navy French shield with one large white eight-pointed rowel.",
    },
    full: (k) => [
      k.shield("french", { rim: TOT.navy, field: TOT.navy }),
      k.pattern({ kind: "chief", colour: WHITE, height: 32 }),
      k.text("Hotspur", { x: 60, baseline: 27, cap: 10, maxWidth: 78, fill: TOT.navy }),
      k.symbol(
        "spur",
        { x: 58, y: 68, size: 72, rotate: -6 },
        { main: WHITE, accent: WHITE, ground: TOT.navy },
      ),
    ],
    small: (k) => [
      k.shield("french", { rim: TOT.navy, field: TOT.navy, rimWidth: 7 }),
      k.symbol("rowel", { x: 60, y: 57, size: 70 }, { main: WHITE, accent: WHITE, ground: TOT.navy }),
    ],
  },
  {
    slug: "hull-city",
    name: "Hull City",
    leagueId: "premier_league",
    nickname: "The Tigers",
    founded: 1904,
    short: "HUL",
    colours: [
      { name: "Amber", hex: HUL.amber },
      { name: "Black", hex: BLACK },
    ],
    band: { bg: BLACK, ink: WHITE, muted: "#e6e0d2", accent: HUL.amber },
    inspiration:
      "The Tigers, in amber and black: tiger stripes at the edges of the shield, and the three crowns from the arms of the city of Hull down the middle.",
    resemblance: {
      level: "low",
      note: "The official badge is a tiger's head. Stripes and crowns are a different idea.",
    },
    looks: {
      full: "An amber round-bottomed shield with a black edge. A black band across the top reads HULL CITY in amber. Black tapering tiger stripes come in from both sides, and three black crowns stand one above the other down the middle.",
      small: "The amber shield with tiger stripes at the sides and three black crowns down the middle.",
    },
    full: (k) => [
      k.shield("english", { rim: BLACK, field: HUL.amber }),
      k.pattern({ kind: "tiger", colour: BLACK }),
      k.pattern({ kind: "chief", colour: BLACK, height: 28 }),
      k.text("Hull City", { x: 60, baseline: 23.5, cap: 8.5, maxWidth: 76, fill: HUL.amber }),
      k.symbol("crown", { x: 60, y: 44, size: 24 }, { main: BLACK, accent: BLACK, ground: HUL.amber }),
      k.symbol("crown", { x: 60, y: 66, size: 24 }, { main: BLACK, accent: BLACK, ground: HUL.amber }),
      k.symbol("crown", { x: 60, y: 88, size: 24 }, { main: BLACK, accent: BLACK, ground: HUL.amber }),
    ],
    small: (k) => [
      k.shield("english", { rim: BLACK, field: HUL.amber, rimWidth: 7 }),
      k.pattern({ kind: "tiger", colour: BLACK }),
      k.symbol("crown", { x: 60, y: 30, size: 32 }, { main: BLACK, accent: BLACK, ground: HUL.amber }),
      k.symbol("crown", { x: 60, y: 59, size: 32 }, { main: BLACK, accent: BLACK, ground: HUL.amber }),
      k.symbol("crown", { x: 60, y: 88, size: 32 }, { main: BLACK, accent: BLACK, ground: HUL.amber }),
    ],
  },
  {
    slug: "aston-villa",
    name: "Aston Villa",
    leagueId: "premier_league",
    nickname: "The Villans",
    founded: 1874,
    short: "AVL",
    colours: [
      { name: "Claret", hex: AVL.claret },
      { name: "Sky blue", hex: AVL.sky },
      { name: "Yellow", hex: AVL.gold },
    ],
    band: { bg: AVL.claret, ink: WHITE, muted: "#f3d9e4", accent: AVL.sky },
    inspiration: "A Scottish lion rampant, for the Scots among the club's founders, in sky blue on claret.",
    resemblance: {
      level: "high",
      note: "A lion rampant in claret and blue is the official badge's main idea. This lion is a new drawing on a heater shield with a named chief, but it will still read as Villa's lion.",
    },
    looks: {
      full: "A claret heater shield with a sky-blue edge. A sky-blue band across the top reads VILLA in claret. Below, a sky-blue lion rampant faces left, forepaws raised, with a curling tail.",
      small: "A claret heater shield filled by the sky-blue lion.",
    },
    full: (k) => [
      k.shield("heater", { rim: AVL.sky, field: AVL.claret }),
      k.pattern({ kind: "chief", colour: AVL.sky, height: 29 }),
      k.text("Villa", { x: 60, baseline: 24.5, cap: 11, fill: AVL.claret }),
      k.symbol(
        "lion-rampant",
        { x: 58, y: 69, size: 64 },
        { main: AVL.sky, accent: AVL.gold, ground: AVL.claret },
      ),
    ],
    small: (k) => [
      k.shield("heater", { rim: AVL.sky, field: AVL.claret, rimWidth: 7 }),
      k.symbol(
        "lion-rampant",
        { x: 58, y: 56, size: 84 },
        { main: AVL.sky, accent: AVL.gold, ground: AVL.claret },
      ),
    ],
    alternatives: [
      {
        title: "Villa Cross chapel",
        note: "Where it began: the club was formed in 1874 by members of the Villa Cross Wesleyan chapel's cricket team.",
        looks: {
          full: "The same claret shield and VILLA band, with a sky-blue chapel front with a round window, an arched door and a gold cross, and 1874 below.",
          small: "A claret heater shield with the sky-blue chapel.",
        },
        full: (k) => [
          k.shield("heater", { rim: AVL.sky, field: AVL.claret }),
          k.pattern({ kind: "chief", colour: AVL.sky, height: 29 }),
          k.text("Villa", { x: 60, baseline: 24.5, cap: 11, fill: AVL.claret }),
          k.symbol(
            "chapel",
            { x: 60, y: 64, size: 48 },
            { main: AVL.sky, accent: AVL.gold, ground: AVL.claret },
          ),
          k.text("1874", { x: 60, baseline: 99, cap: 7, fill: AVL.sky }),
        ],
        small: (k) => [
          k.shield("heater", { rim: AVL.sky, field: AVL.claret, rimWidth: 7 }),
          k.symbol(
            "chapel",
            { x: 60, y: 54, size: 74 },
            { main: AVL.sky, accent: AVL.gold, ground: AVL.claret },
          ),
        ],
      },
    ],
  },
  {
    slug: "newcastle-united",
    name: "Newcastle United",
    leagueId: "premier_league",
    nickname: "The Magpies",
    founded: 1892,
    short: "NEW",
    colours: [
      { name: "Black", hex: BLACK },
      { name: "White", hex: WHITE },
    ],
    band: { bg: BLACK, ink: WHITE, muted: "#e2e2e2", accent: "#d9bd86" },
    inspiration:
      "The castle keep that gave the city its name, in white on a black disc, over the black-and-white stripes of the Magpies.",
    resemblance: {
      level: "medium",
      note: "A castle appears on the official badge, taken from the city's arms. Here it sits alone in a disc on a striped shield, with no seahorses or lion.",
    },
    looks: {
      full: "A heater shield with a gold edge and black and white vertical stripes. A black band across the top reads NEWCASTLE in white. Below, a black disc with a gold ring holds a white castle with three towers.",
      small: "The striped shield with a large black disc holding the white castle.",
    },
    full: (k) => [
      k.shield("heater", { rim: NEW.gold, field: WHITE }),
      k.pattern({ kind: "stripes", colour: BLACK, count: 7 }),
      k.pattern({ kind: "chief", colour: BLACK, height: 29 }),
      k.text("Newcastle", { x: 60, baseline: 24, cap: 8.5, maxWidth: 76, fill: WHITE }),
      k.disc(60, 66, 26, BLACK, [NEW.gold, 3]),
      k.symbol("castle", { x: 60, y: 64, size: 40 }, { main: WHITE, accent: WHITE, ground: BLACK }),
    ],
    small: (k) => [
      k.shield("heater", { rim: BLACK, field: WHITE, rimWidth: 7 }),
      k.pattern({ kind: "stripes", colour: BLACK, count: 7 }),
      k.disc(60, 56, 33, BLACK, [NEW.gold, 4]),
      k.symbol("castle", { x: 60, y: 55, size: 52 }, { main: WHITE, accent: WHITE, ground: BLACK }),
    ],
  },
  {
    slug: "coventry-city",
    name: "Coventry City",
    leagueId: "premier_league",
    nickname: "The Sky Blues",
    founded: 1883,
    short: "COV",
    colours: [
      { name: "Sky blue", hex: COV.sky },
      { name: "White", hex: WHITE },
      { name: "Navy", hex: COV.navy },
    ],
    band: { bg: COV.navy, ink: WHITE, muted: "#d5e9f6", accent: COV.sky },
    inspiration:
      "The phoenix, Coventry's sign of rebirth after the city centre was destroyed in the Blitz of 1940, rising in white and flame over a navy disc in a sky-blue ring.",
    resemblance: {
      level: "low",
      note: "The official badge is an elephant and castle. The phoenix is from the city's later arms, not the club's badge.",
    },
    looks: {
      full: "A sky-blue roundel with a navy edge. A navy inner disc, edged in white, holds a white phoenix with raised wings rising from orange flames. COVENTRY runs round the top of the ring in navy and 1883 round the bottom.",
      small: "A sky-blue roundel filled by the white phoenix and its orange flames.",
    },
    full: (k) => [
      k.shield("roundel", { rim: COV.navy, field: COV.sky, rimWidth: 3 }),
      k.disc(60, 60, 38, COV.navy, [WHITE, 2.5]),
      k.symbol("phoenix", { x: 60, y: 60, size: 62 }, { main: WHITE, accent: COV.flame, ground: COV.navy }),
      k.arc("Coventry", { r: 46.5, cap: 9.5, side: "top", fill: COV.navy }),
      k.arc("1883", { r: 46.5, cap: 8, side: "bottom", fill: COV.navy }),
    ],
    small: (k) => [
      k.shield("roundel", { rim: COV.navy, field: COV.sky, rimWidth: 7 }),
      k.symbol("phoenix", { x: 60, y: 59, size: 88 }, { main: WHITE, accent: COV.flame, ground: COV.sky }),
    ],
  },
  {
    slug: "fulham",
    name: "Fulham",
    leagueId: "premier_league",
    nickname: "The Cottagers",
    founded: 1879,
    short: "FUL",
    colours: [
      { name: "White", hex: WHITE },
      { name: "Black", hex: BLACK },
      { name: "Red", hex: FUL.red },
    ],
    band: { bg: BLACK, ink: WHITE, muted: "#e2e2e2", accent: "#ff6b6b" },
    inspiration:
      "Craven Cottage, the riverside ground on the Thames the club has played at since 1896: a gabled cottage over the river, in a black ring.",
    resemblance: {
      level: "low",
      note: "The official badge is the letters FFC on a shield. The cottage is the ground's name.",
    },
    looks: {
      full: "A black roundel. A white inner disc, edged in red, holds a black gabled cottage with a chimney, above two black wavy lines for the Thames. FULHAM runs round the top of the black ring in white and 1879 round the bottom.",
      small: "A white roundel with a black edge and a large black cottage over the river.",
    },
    full: (k) => [
      k.shield("roundel", { rim: BLACK, field: BLACK, rimWidth: 3 }),
      k.disc(60, 60, 38, WHITE, [FUL.red, 2.5]),
      k.symbol("cottage", { x: 60, y: 61, size: 56 }, { main: BLACK, accent: BLACK, ground: WHITE }),
      k.arc("Fulham", { r: 46.5, cap: 9.5, side: "top", fill: WHITE }),
      k.arc("1879", { r: 46.5, cap: 8, side: "bottom", fill: WHITE }),
    ],
    small: (k) => [
      k.shield("roundel", { rim: BLACK, field: WHITE, rimWidth: 7 }),
      k.symbol("cottage", { x: 60, y: 59, size: 80 }, { main: BLACK, accent: BLACK, ground: WHITE }),
    ],
  },
  {
    slug: "ipswich-town",
    name: "Ipswich Town",
    leagueId: "premier_league",
    nickname: "The Tractor Boys",
    founded: 1878,
    short: "IPS",
    colours: [
      { name: "Blue", hex: IPS.blue },
      { name: "White", hex: WHITE },
      { name: "Red", hex: IPS.red },
    ],
    band: { bg: IPS.blue, ink: WHITE, muted: "#d9e4f6", accent: "#9cc0ff" },
    inspiration:
      "Ipswich is a port on the River Orwell, and the town's arms carry ships: a sailing ship in white on blue, on an upright oval.",
    resemblance: {
      level: "low",
      note: "The official badge is a Suffolk Punch horse. The ship comes from the town's arms instead.",
    },
    looks: {
      full: "A blue upright oval with a navy edge. A white sailing ship with two sails and a red pennant sits on a red wavy line. IPSWICH in white below.",
      small: "The blue oval with a large white ship.",
    },
    full: (k) => [
      k.shield("oval", { rim: IPS.navy, field: IPS.blue }),
      k.symbol("ship", { x: 60, y: 54, size: 64 }, { main: WHITE, accent: IPS.red, ground: IPS.blue }),
      k.text("Ipswich", { x: 60, baseline: 100, cap: 8.5, maxWidth: 48, fill: WHITE }),
    ],
    small: (k) => [
      k.shield("oval", { rim: IPS.navy, field: IPS.blue, rimWidth: 7 }),
      k.symbol("ship", { x: 60, y: 60, size: 84 }, { main: WHITE, accent: WHITE, ground: IPS.blue }),
    ],
  },
  {
    slug: "nottingham-forest",
    name: "Nottingham Forest",
    leagueId: "premier_league",
    nickname: "Forest",
    founded: 1865,
    short: "NFO",
    colours: [
      { name: "Red", hex: NFO.red },
      { name: "White", hex: WHITE },
    ],
    band: { bg: "#b30000", ink: WHITE, muted: "#ffdede", accent: "#ffb3b3" },
    inspiration:
      "Robin Hood's longbow and arrow, for Sherwood Forest, over the waters of the Trent beside the City Ground.",
    resemblance: {
      level: "low",
      note: "The official badge is a stylised tree over wavy lines. The waves are shared (the Trent), the bow is new.",
    },
    looks: {
      full: "A red French shield with a dark red edge. A white band across the top reads FOREST in red. Below, a white longbow drawn with an arrow pointing right, over two white wavy lines for the Trent at the point.",
      small: "A red French shield with a large white bow and arrow.",
    },
    full: (k) => [
      k.shield("french", { rim: NFO.deep, field: NFO.red }),
      k.pattern({ kind: "chief", colour: WHITE, height: 31 }),
      k.text("Forest", { x: 60, baseline: 26.5, cap: 11, fill: NFO.red }),
      k.symbol("bow-arrow", { x: 60, y: 63, size: 50 }, { main: WHITE, accent: WHITE, ground: NFO.red }),
      k.pattern({ kind: "waves", colour: WHITE, from: 95, count: 2, gap: 7, width: 2.5 }),
    ],
    small: (k) => [
      k.shield("french", { rim: NFO.deep, field: NFO.red, rimWidth: 7 }),
      k.symbol("bow-arrow", { x: 60, y: 57, size: 80 }, { main: WHITE, accent: WHITE, ground: NFO.red }),
    ],
  },
  {
    slug: "sunderland",
    name: "Sunderland",
    leagueId: "premier_league",
    nickname: "The Black Cats",
    founded: 1879,
    short: "SUN",
    colours: [
      { name: "Red", hex: SUN.red },
      { name: "White", hex: WHITE },
      { name: "Black", hex: BLACK },
    ],
    band: { bg: "#b5101f", ink: WHITE, muted: "#fde0e3", accent: SUN.gold },
    inspiration:
      "The Black Cats, after the Black Cat gun battery on the River Wear: a black cat on a white disc over the red-and-white stripes.",
    resemblance: {
      level: "medium",
      note: "Black cats feature on the official badge too, beside the Penshaw Monument and the bridge. Here the cat sits alone on an angular striped shield.",
    },
    looks: {
      full: "An angular shield with a black edge and red and white vertical stripes. A black band across the top reads SUNDERLAND in white. In the middle, a white disc with a black ring holds a sitting black cat with gold eyes.",
      small: "The striped angular shield with a large white disc holding the black cat.",
    },
    full: (k) => [
      k.shield("angular", { rim: BLACK, field: WHITE }),
      k.pattern({ kind: "stripes", colour: SUN.red, count: 9 }),
      k.pattern({ kind: "chief", colour: BLACK, height: 28 }),
      k.text("Sunderland", { x: 60, baseline: 23, cap: 8, maxWidth: 72, fill: WHITE }),
      k.disc(60, 58, 24, WHITE, [BLACK, 3]),
      k.symbol("cat", { x: 61, y: 57, size: 40 }, { main: BLACK, accent: SUN.gold, ground: WHITE }),
    ],
    small: (k) => [
      k.shield("angular", { rim: BLACK, field: WHITE, rimWidth: 7 }),
      k.pattern({ kind: "stripes", colour: SUN.red, count: 7 }),
      k.disc(60, 52, 32, WHITE, [BLACK, 4]),
      k.symbol("cat", { x: 61, y: 51, size: 54 }, { main: BLACK, accent: SUN.gold, ground: WHITE }),
    ],
    alternatives: [
      {
        title: "Miner's lamp",
        note: "The Stadium of Light stands on the old Wearmouth Colliery. A miner's safety lamp, glowing, in place of the cat.",
        looks: {
          full: "The same striped angular shield and SUNDERLAND band, with a black disc holding a white miner's safety lamp and a gold flame.",
          small: "The striped angular shield with a black disc holding the lamp.",
        },
        full: (k) => [
          k.shield("angular", { rim: BLACK, field: WHITE }),
          k.pattern({ kind: "stripes", colour: SUN.red, count: 9 }),
          k.pattern({ kind: "chief", colour: BLACK, height: 28 }),
          k.text("Sunderland", { x: 60, baseline: 23, cap: 8, maxWidth: 72, fill: WHITE }),
          k.disc(60, 60, 25, BLACK, [WHITE, 3]),
          k.symbol(
            "miners-lamp",
            { x: 60, y: 60, size: 40 },
            { main: WHITE, accent: SUN.gold, ground: BLACK },
          ),
        ],
        small: (k) => [
          k.shield("angular", { rim: BLACK, field: WHITE, rimWidth: 7 }),
          k.pattern({ kind: "stripes", colour: SUN.red, count: 7 }),
          k.disc(60, 52, 32, BLACK, [WHITE, 4]),
          k.symbol(
            "miners-lamp",
            { x: 60, y: 52, size: 54 },
            { main: WHITE, accent: SUN.gold, ground: BLACK },
          ),
        ],
      },
    ],
  },
  {
    slug: "manchester-united",
    name: "Manchester United",
    leagueId: "premier_league",
    nickname: "The Red Devils",
    founded: 1878,
    short: "MUN",
    colours: [
      { name: "Red", hex: MUN.red },
      { name: "Black", hex: BLACK },
      { name: "Gold", hex: MUN.gold },
    ],
    band: { bg: "#b01e12", ink: WHITE, muted: "#fde0dc", accent: MUN.gold },
    inspiration:
      "Founded in 1878 as Newton Heath LYR, the railway workers' team: a locomotive's driving wheel behind a gold trident for the Red Devils.",
    resemblance: {
      level: "low",
      note: "The official badge has a devil holding a trident, over a ship. The trident alone, with the railway wheel, is a different picture.",
    },
    looks: {
      full: "A red heater shield with a black edge. A black band across the top reads UNITED in white. Below, a gold trident stands upright in front of a black locomotive driving wheel with spokes and a counterweight.",
      small: "A red heater shield with a large gold trident.",
    },
    full: (k) => [
      k.shield("heater", { rim: BLACK, field: MUN.red }),
      k.pattern({ kind: "chief", colour: BLACK, height: 28 }),
      k.text("United", { x: 60, baseline: 23.5, cap: 10, fill: WHITE }),
      k.symbol("rail-wheel", { x: 60, y: 66, size: 60 }, { main: BLACK, accent: BLACK, ground: MUN.red }),
      k.symbol("trident", { x: 60, y: 67, size: 66 }, { main: MUN.gold, accent: MUN.gold, ground: MUN.red }),
    ],
    small: (k) => [
      k.shield("heater", { rim: BLACK, field: MUN.red, rimWidth: 7 }),
      k.symbol("trident", { x: 60, y: 56, size: 86 }, { main: MUN.gold, accent: MUN.gold, ground: MUN.red }),
    ],
  },
  {
    slug: "crystal-palace",
    name: "Crystal Palace",
    leagueId: "premier_league",
    nickname: "The Eagles",
    founded: 1905,
    short: "CRY",
    colours: [
      { name: "Red", hex: CRY.red },
      { name: "Blue", hex: CRY.blue },
    ],
    band: { bg: CRY.blue, ink: WHITE, muted: "#dbe3f3", accent: "#ff8a9a" },
    inspiration:
      "Named after the Crystal Palace, the glass exhibition hall of 1851 rebuilt at Sydenham, where the club was formed: its arched glass transept in white, on red and blue halves.",
    resemblance: {
      level: "medium",
      note: "The palace's front sits under an eagle on the official badge. Here the arched transept stands alone, with no eagle, on a halved French shield.",
    },
    looks: {
      full: "A French shield with a navy edge, red on the left half and blue on the right. A navy band across the top reads PALACE in white. Below, the white arched glass transept of the palace with its two low wings, its glazing bars in navy.",
      small: "The red and blue shield with the white glass palace filling it.",
    },
    full: (k) => [
      k.shield("french", { rim: CRY.navy, field: CRY.red }),
      k.pattern({ kind: "halves", colour: CRY.blue, side: "right" }),
      k.pattern({ kind: "chief", colour: CRY.navy, height: 28 }),
      k.text("Palace", { x: 60, baseline: 23.5, cap: 10, fill: WHITE }),
      k.symbol("glass-palace", { x: 60, y: 66, size: 62 }, { main: WHITE, accent: WHITE, ground: CRY.navy }),
    ],
    small: (k) => [
      k.shield("french", { rim: CRY.navy, field: CRY.red, rimWidth: 7 }),
      k.pattern({ kind: "halves", colour: CRY.blue, side: "right" }),
      k.symbol("glass-palace", { x: 60, y: 58, size: 84 }, { main: WHITE, accent: WHITE, ground: CRY.navy }),
    ],
  },
];

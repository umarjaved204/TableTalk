// The five league identities: a colour pair, a band for league headers, and
// a mark (a tile with a slanted double stripe and the league's initials).
//
// These are TableTalk's own marks, not the competitions' logos. Each tile
// takes its stripes from the colours of the country's flag, on a ground
// colour chosen so the five tiles stay apart from each other at 16 px.
import type { Design } from "./crest.ts";
import type { BandColours } from "./types.ts";

export interface LeagueIdentity {
  leagueId: string;
  slug: string;
  /** The initials on the mark. */
  code: string;
  ground: string;
  /** The two stripes, front then back. */
  stripes: readonly [string, string];
  band: BandColours;
  /** Why these colours, in a sentence. */
  inspiration: string;
}

const WHITE = "#fff";

export const LEAGUE_IDENTITIES: readonly LeagueIdentity[] = [
  {
    leagueId: "premier_league",
    slug: "premier-league",
    code: "PL",
    ground: "#2b1442",
    stripes: ["#e4002b", WHITE],
    band: { bg: "#2b1442", ink: WHITE, muted: "#ded3ea", accent: "#ff6b81" },
    inspiration: "England's red and white, on a deep plum ground.",
  },
  {
    leagueId: "bundesliga",
    slug: "bundesliga",
    code: "BL",
    ground: "#151515",
    stripes: ["#e30613", "#ffcc00"],
    band: { bg: "#151515", ink: WHITE, muted: "#dcdcdc", accent: "#ffcc00" },
    inspiration: "Germany's black, red and gold.",
  },
  {
    leagueId: "la_liga",
    slug: "la-liga",
    code: "LL",
    ground: "#8b0f1c",
    stripes: ["#ffc400", WHITE],
    band: { bg: "#8b0f1c", ink: WHITE, muted: "#f8dadd", accent: "#ffc400" },
    inspiration: "Spain's red and gold: a gold stripe on a deep red ground.",
  },
  {
    leagueId: "serie_a",
    slug: "serie-a",
    code: "SA",
    ground: "#0a5ea8",
    stripes: ["#3ec46d", WHITE],
    band: { bg: "#0a4f8f", ink: WHITE, muted: "#d6e6f5", accent: "#7fe0a2" },
    inspiration: "Italy's azzurro, the national team's blue, with the flag's green and white.",
  },
  {
    leagueId: "ligue_1",
    slug: "ligue-1",
    code: "L1",
    ground: "#0d2a5c",
    stripes: ["#e4002b", WHITE],
    band: { bg: "#0d2a5c", ink: WHITE, muted: "#d8e0ef", accent: "#ff6b81" },
    inspiration: "France's blue, white and red: the stripes on a navy ground.",
  },
];

export function leagueIdentity(leagueId: string): LeagueIdentity | undefined {
  return LEAGUE_IDENTITIES.find((league) => league.leagueId === leagueId);
}

/** The league's mark: a rounded tile, two slanted stripes and the initials. */
export function leagueMarkDesign(league: LeagueIdentity): Design {
  const [front, back] = league.stripes;
  return (k) => [
    `<rect x="2" y="2" width="116" height="116" rx="20" fill="#fff"/>`,
    `<rect x="5" y="5" width="110" height="110" rx="17" fill="${league.ground}"/>`,
    `<path d="M30 96L50 24L62 24L42 96Z" fill="${back}"/>`,
    `<path d="M14 96L34 24L46 24L26 96Z" fill="${front}"/>`,
    k.text(league.code, { x: 82, baseline: 79, cap: 38, maxWidth: 52, tracking: 0.04, fill: WHITE }),
  ];
}

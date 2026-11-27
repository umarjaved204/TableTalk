// What the registry knows about each club. Keyed by the site's team slug
// (src/data/teams.ts), the same key favourites and team pages use, so a crest
// can never attach to the wrong club. Permanent team ids would be better
// (contract request R14); until then a renamed club simply gets the fallback
// crest and a build warning, never a broken build.
import type { Design } from "./crest.ts";

export interface BandColours {
  /** The hero band's background and its text. Text pairs are contrast-tested
   *  (tests/unit/identity.test.ts) like the theme colours. */
  bg: string;
  ink: string;
  muted: string;
  /** Rules and small marks on the band: at least 3:1 against bg. */
  accent: string;
}

/**
 * How close a design might look to the club's official badge:
 *   low     different symbol and composition;
 *   medium  the same heritage symbol, in a clearly different composition;
 *   high    a symbol and colours a supporter would connect with the official
 *           badge. Needs at least one alternative design (a test checks).
 */
export type Resemblance = "low" | "medium" | "high";

/** What a crest shows, in words: for the review gallery (read as text by
 *  people who can't see it) and for anyone checking a design without
 *  rendering it. */
export interface Looks {
  full: string;
  small: string;
}

export interface CrestAlternative {
  title: string;
  /** Why this is a good second option. */
  note: string;
  looks: Looks;
  full: Design;
  small: Design;
}

export interface ClubIdentity {
  slug: string;
  /** The data's canonical name. */
  name: string;
  leagueId: string;
  nickname: string;
  founded: number;
  /** Three letters, unique in the league: for tight spaces and the gallery's clash checks. */
  short: string;
  /** Traditional colours, named, for the gallery and the inspiration notes. */
  colours: readonly { name: string; hex: string }[];
  band: BandColours;
  /** The heritage behind the design, in a sentence or two. */
  inspiration: string;
  resemblance: { level: Resemblance; note: string };
  looks: Looks;
  /** The crest at 28 px and up. */
  full: Design;
  /** The crest up to 24 px: fewer, bolder parts, still with one identifying element. */
  small: Design;
  alternatives?: readonly CrestAlternative[];
}

// League artwork supplied by the site's owner, as distinct from TableTalk's
// generated marks (leagues.ts, league-concepts.ts) and from genuinely official
// or licensed files (src/identity/licensed/, empty today).
//
// The four images below are custom designs the owner made with an AI image
// tool in separate design work. They are inspired by the competitions' visual
// identities and look close to them, but they are not the official logo
// files and are not licensed. Approval of the artwork is not legal clearance:
// their resemblance is recorded here so it can be reviewed.
//
// Files: src/identity/supplied/marks/<league-slug>.webp, plus
// <league-slug>-dark.webp where the artwork has a variant for dark themes.
// assets.ts picks a licensed file first, then a supplied one, then
// TableTalk's own mark.
import type { Resemblance } from "./types.ts";

/** How every supplied file is described wherever it is shown or listed. */
export const SUPPLIED_LABEL = "Custom competition-inspired artwork — user supplied";

/** Most a supplied raster league file may weigh. TableTalk's own SVG marks
 *  keep their 2 KB budget (tests/unit/identity.test.ts); raster artwork can't
 *  meet it without visible loss, so it has its own. The files are 192 px
 *  (the largest mark, 96 px, on a 2x screen) at WebP quality 80: 3.7 to
 *  7.8 KB on 28 Nov 2026, against 7 to 16 KB at 256 px quality 90, with no
 *  visible difference at 96 px. */
export const SUPPLIED_RASTER_BUDGET = 10 * 1024;

export interface SuppliedArtwork {
  label: typeof SUPPLIED_LABEL;
  /** Where the artwork came from. */
  provenance: string;
  /** What TableTalk did to the supplied image, if anything. */
  changes: string;
  /** How close it looks to the competition's official logo. */
  resemblance: { level: Resemblance; note: string };
  /** Whether a <slug>-dark file exists, shown on dark themes instead. */
  darkVariant: boolean;
}

const PROVENANCE =
  "Made by the site's owner with an AI image tool (ChatGPT) in separate design work and supplied on 28 Nov 2026. Not an official or licensed file.";
const CROP = "Cropped to the mark, centred on a transparent square and saved as a 192 px WebP.";
const CAUTION = "Its use is not automatically legally cleared.";

/** The supplied artwork in use, by league slug. */
export const SUPPLIED_MARKS: Readonly<Record<string, SuppliedArtwork>> = {
  "premier-league": {
    label: SUPPLIED_LABEL,
    provenance: PROVENANCE,
    changes: `${CROP} A white outline was added so the purple stays visible on dark themes, with the closed cut-outs (eyes, nose) filled white so it looks the same on every theme.`,
    resemblance: {
      level: "high",
      note: `A crowned purple lion's head in profile with a swept mane, filling a round silhouette: the same idea, colour and composition as the Premier League's logo. ${CAUTION}`,
    },
    darkVariant: false,
  },
  bundesliga: {
    label: SUPPLIED_LABEL,
    provenance: PROVENANCE,
    changes: `${CROP} The dark glow around the red panel in the supplied image was left off.`,
    resemblance: {
      level: "high",
      note: `A white player striking a volley at a ball on a red rectangle: the same idea, colours and layout as the Bundesliga's logo. ${CAUTION}`,
    },
    darkVariant: false,
  },
  "la-liga": {
    label: SUPPLIED_LABEL,
    provenance: PROVENANCE,
    changes: CROP,
    resemblance: {
      level: "high",
      note: `Two slanted coral-red L shapes, one stepped behind the other: the same idea, colour and construction as LaLiga's logo. ${CAUTION}`,
    },
    darkVariant: false,
  },
  "ligue-1": {
    label: SUPPLIED_LABEL,
    provenance: PROVENANCE,
    changes: `${CROP} The Ligue 1 wording under the mark was left off (unreadable at 24 px). Recoloured from its own alpha mask, with nothing redrawn: solid black for light themes, solid white for dark themes (ligue-1-dark).`,
    resemblance: {
      level: "high",
      note: `A slanted L and 1 monogram cut by a diagonal: the same idea and construction as Ligue 1's logo. ${CAUTION}`,
    },
    darkVariant: true,
  },
};

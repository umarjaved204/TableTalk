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
//
// The supplied image files are private: ignored by git and never committed to
// the public repository until a legal basis for publishing them exists. This
// metadata is public; without the files, the site uses TableTalk's own art.
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

// --- Club crests --------------------------------------------------------

/** How every supplied crest is described wherever it is shown or listed. */
export const SUPPLIED_CREST_LABEL =
  "Custom club-inspired artwork — user supplied, AI-generated design reference";

/** Most a supplied crest file may weigh. TableTalk's own crests keep their
 *  10 KB (full) and 3 KB (small) SVG budgets; detailed raster artwork can't
 *  meet them, so it has its own. The files are 240 px (the largest crest,
 *  120 px, on a 2x screen) at WebP quality 75: 7.0 to 17.1 KB on
 *  28 Nov 2026, with no visible difference from quality 90 at 120 px. */
export const SUPPLIED_CREST_BUDGET = 20 * 1024;

export interface SuppliedCrest {
  label: typeof SUPPLIED_CREST_LABEL;
  provenance: string;
  changes: string;
  /** How close the image looks to the club's official badge. */
  resemblance: { level: Resemblance; note: string };
}

const CREST_PROVENANCE =
  "Made by the site's owner with an AI image tool (ChatGPT), building on TableTalk's refined crest, and chosen on 28 Nov 2026 as the club's full crest. Not an official or licensed file.";
const SERIE_A_PROVENANCE =
  "Made by the site's owner with an AI image tool (ChatGPT), building on TableTalk's first Serie A drawing for the club, and chosen on 28 Nov 2026 as the club's full crest. Not an official or licensed file.";
const SERIE_A_CHANGES =
  "Faint haze and stray specks outside the crest cleared (alpha below 48 of 255, or not joined to the crest), cropped to the crest, centred on a transparent square without stretching, downscaled with premultiplied alpha so no dark fringe forms, and saved as a 240 px WebP at quality 75. Used above 24 px; the club's own small SVG crest is used at 24 px and below.";
const CREST_CHANGES =
  "Faint edge haze cleared, cropped to the crest, centred on a transparent square without stretching and saved as a 240 px WebP. Used above 24 px; the club's own small SVG crest is used at 24 px and below.";

/** The supplied full crests in use, by club slug: seven Bundesliga clubs,
 *  then seven Serie A clubs (28 Nov 2026). */
export const SUPPLIED_CRESTS: Readonly<Record<string, SuppliedCrest>> = {
  "bayer-leverkusen": {
    label: SUPPLIED_CREST_LABEL,
    provenance: CREST_PROVENANCE,
    changes: CREST_CHANGES,
    resemblance: {
      level: "high",
      note: `Very close: two red lions holding a central medallion between a 1904 banner and a LEVERKUSEN ribbon is the official badge's arrangement and style. The medallion carries 04, not the company's cross. ${CAUTION}`,
    },
  },
  "1-fc-koln": {
    label: SUPPLIED_CREST_LABEL,
    provenance: CREST_PROVENANCE,
    changes: CREST_CHANGES,
    resemblance: {
      level: "high",
      note: `Very close: a white goat on top of a red roundel lettered 1.FC KÖLN on a slanting band, with the cathedral, is the official badge's arrangement and style. ${CAUTION}`,
    },
  },
  "union-berlin": {
    label: SUPPLIED_CREST_LABEL,
    provenance: CREST_PROVENANCE,
    changes: CREST_CHANGES,
    resemblance: {
      level: "high",
      note: `Very close: red and yellow 1.FC UNION lettering with Berlin's bear in a medallion is the official emblem's arrangement and style. ${CAUTION}`,
    },
  },
  "rb-leipzig": {
    label: SUPPLIED_CREST_LABEL,
    provenance: CREST_PROVENANCE,
    changes: CREST_CHANGES,
    resemblance: {
      level: "high",
      note: `Very close, and a trademark question: two red bulls charging at a central ball is the core of the Red Bull company's registered logo, which the official badge uses, and RBL with LEIPZIG follows the badge too. Needs legal advice before public use. ${CAUTION}`,
    },
  },
  "eintracht-frankfurt": {
    label: SUPPLIED_CREST_LABEL,
    provenance: CREST_PROVENANCE,
    changes: CREST_CHANGES,
    resemblance: {
      level: "high",
      note: `Close: a crowned red eagle with an E shield in a red and white roundel lettered EINTRACHT FRANKFURT follows the club's traditional eagle badges. ${CAUTION}`,
    },
  },
  "vfb-stuttgart": {
    label: SUPPLIED_CREST_LABEL,
    provenance: CREST_PROVENANCE,
    changes: CREST_CHANGES,
    resemblance: {
      level: "high",
      note: `Very close: Gothic VfB over STUTTGART and a gold shield of Württemberg antlers between 18 and 93 is the official badge's arrangement and style. ${CAUTION}`,
    },
  },
  "hamburger-sv": {
    label: SUPPLIED_CREST_LABEL,
    provenance: CREST_PROVENANCE,
    changes: CREST_CHANGES,
    resemblance: {
      level: "high",
      note: `Practically the official emblem: a blue field with a white diamond, a black diamond and a white centre. Needs legal advice before public use. ${CAUTION}`,
    },
  },
  atalanta: {
    label: SUPPLIED_CREST_LABEL,
    provenance: SERIE_A_PROVENANCE,
    changes: SERIE_A_CHANGES,
    resemblance: {
      level: "high",
      note: `Very close: an upright oval halved blue and black, ATALANTA over the top, 1907 below and a white ring round the huntress's profile with her hair streaming back is the official badge's arrangement and style. ${CAUTION}`,
    },
  },
  frosinone: {
    label: SUPPLIED_CREST_LABEL,
    provenance: SERIE_A_PROVENANCE,
    changes: SERIE_A_CHANGES,
    resemblance: {
      level: "high",
      note: `Very close: FROSINONE on a yellow chief over a blue shield with a pale lion rampant and a rising yellow bend, in a yellow edge, is the official badge's arrangement and style. ${CAUTION}`,
    },
  },
  genoa: {
    label: SUPPLIED_CREST_LABEL,
    provenance: SERIE_A_PROVENANCE,
    changes: SERIE_A_CHANGES,
    resemblance: {
      level: "high",
      note: `Very close: a gold griffin rampant on red and navy halves under a white chief with Saint George's red cross, in a gold edge, is the official badge's arrangement and style. ${CAUTION}`,
    },
  },
  lecce: {
    label: SUPPLIED_CREST_LABEL,
    provenance: SERIE_A_PROVENANCE,
    changes: SERIE_A_CHANGES,
    resemblance: {
      level: "high",
      note: `Close: a gold oak with a wolf beside it on a tall navy shield, LECCE in gold with a yellow and red rule and 1908, follows the official badge; the howling wolf and the small striped shield at the point are the image's own. ${CAUTION}`,
    },
  },
  roma: {
    label: SUPPLIED_CREST_LABEL,
    provenance: SERIE_A_PROVENANCE,
    changes: SERIE_A_CHANGES,
    resemblance: {
      level: "high",
      note: `Very close: ROMA in gold serif capitals over a rule and the she-wolf with Romulus and Remus in gold on deep red, in a gold-edged shield, is the official badge's arrangement and style. ${CAUTION}`,
    },
  },
  torino: {
    label: SUPPLIED_CREST_LABEL,
    provenance: SERIE_A_PROVENANCE,
    changes: SERIE_A_CHANGES,
    resemblance: {
      level: "high",
      note: `Close: a white bull rampant on granata under a white chief lettered TORINO, in a gold edge, follows the official badge; 1906 and FC beside the bull are the image's own. ${CAUTION}`,
    },
  },
  lazio: {
    label: SUPPLIED_CREST_LABEL,
    provenance: SERIE_A_PROVENANCE,
    changes: SERIE_A_CHANGES,
    resemblance: {
      level: "high",
      note: `Very close: a gold eagle with spread wings perched on a small sky-blue shield lettered LAZIO on a white band is the official badge's arrangement and style. ${CAUTION}`,
    },
  },
};

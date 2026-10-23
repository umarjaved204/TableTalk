// The share images (the picture a chat or social app shows for a link):
// drawn by scripts/make-share-images.mjs into public/share/, and named in each
// page's <head> by src/layouts/Base.astro. The words on the images and their
// alt text come from here, so the two can't disagree.
import type { LeagueInfo } from "./leagues.ts";

export const SHARE_IMAGE = {
  width: 1200,
  height: 630,
  siteLine: "Five European leagues: title, top places and relegation chances, updated every night.",
  leagueLine: "Title, top places and relegation chances, updated every night.",
} as const;

/** The image for a page: its league's, or the site's for every other page. Path and alt text. */
export function shareImage(league?: LeagueInfo): { path: string; alt: string } {
  return league
    ? {
        path: `/share/${league.slug}.png`,
        alt: `TableTalk: ${league.name}. ${SHARE_IMAGE.leagueLine} Model probabilities, not betting advice.`,
      }
    : {
        path: "/share/tabletalk.png",
        alt: `TableTalk: season forecasts. ${SHARE_IMAGE.siteLine} Model probabilities, not betting advice.`,
      };
}

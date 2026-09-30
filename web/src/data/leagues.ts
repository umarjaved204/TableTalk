// The five leagues, in switcher order, and how their zones are displayed.

export interface LeagueInfo {
  /** The pipeline's config id, as used in file names (premier_league.json). */
  id: string;
  /** The URL segment. Kept separate from the id so a config rename can't break links. */
  slug: string;
  name: string;
}

export const LEAGUES: readonly LeagueInfo[] = [
  { id: "premier_league", slug: "premier-league", name: "Premier League" },
  { id: "bundesliga", slug: "bundesliga", name: "Bundesliga" },
  { id: "la_liga", slug: "la-liga", name: "La Liga" },
  { id: "serie_a", slug: "serie-a", name: "Serie A" },
  { id: "ligue_1", slug: "ligue-1", name: "Ligue 1" },
];

export function leagueBySlug(slug: string): LeagueInfo | undefined {
  return LEAGUES.find((league) => league.slug === slug);
}

/** How a zone's rows are marked at the left edge of the table. Each marker
 *  differs in SHAPE, not just colour: solid, lighter solid, outline, dashed. */
export type ZoneMarker = "solid" | "light" | "outline" | "dashed";

export interface ZoneDisplay {
  /** Column header, e.g. "Top 4". The data's own label is a sentence. */
  short: string;
  /** Which end of the table the zone is at: sets the colour (blue top, red bottom). */
  end: "top" | "bottom";
  /** Row edge marker, or null for zones that get a chance column only. */
  marker: ZoneMarker | null;
}

// TEMPORARY until contract request R4 (zones[].short_label and zones[].end).
// Keyed by the zone ids the pipeline uses. If a league's data has a zone id
// that is not listed here, the build fails (see zoneDisplay below and
// tests/unit/leagues.test.ts), so a new zone can't appear unlabelled.
export const ZONE_DISPLAY: Readonly<Record<string, ZoneDisplay>> = {
  title: { short: "Title", end: "top", marker: "solid" },
  top_four: { short: "Top 4", end: "top", marker: "light" },
  top_five: { short: "Top 5", end: "top", marker: "outline" },
  top_half: { short: "Top half", end: "top", marker: null },
  relegation_playoff: { short: "Play-off", end: "bottom", marker: "outline" },
  relegation: { short: "Down", end: "bottom", marker: "dashed" },
};

export class UnknownZoneError extends Error {
  override name = "UnknownZoneError";
}

export function zoneDisplay(zoneId: string, leagueId: string): ZoneDisplay {
  const display = ZONE_DISPLAY[zoneId];
  if (!display) {
    throw new UnknownZoneError(
      `${leagueId}: zone "${zoneId}" is not in ZONE_DISPLAY (src/data/leagues.ts). Add a short label, end and marker for it.`,
    );
  }
  return display;
}

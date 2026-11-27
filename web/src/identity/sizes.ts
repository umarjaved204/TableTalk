// The one size rule for crests, shared by the site (assets.ts, ClubCrest)
// and the review gallery (scripts/crest-gallery.mjs): the small crest at
// SMALL_MAX px and below, the full crest above it.

/** At or below this size (CSS px) the small crest is used. */
export const SMALL_MAX = 24;

export type CrestVariant = "full" | "small";

export function variantFor(size: number): CrestVariant {
  return size <= SMALL_MAX ? "small" : "full";
}

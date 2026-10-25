// The Your team picker's logic with no access to the page, so the unit tests
// can import it (tests/unit/team-picker-core.test.ts).

/**
 * The league the picker opens on, in this order:
 *   1. the one asked for (a league button on the home page's prompt);
 *   2. the current page's league, read from the address (/bundesliga/...);
 *   3. the favourite's league (pages without a league: home, about...);
 *   4. the first league in the picker.
 * Only leagues the picker has teams for count, so an unknown or empty league
 * is skipped rather than opened.
 */
export function openingLeague(
  asked: string | null,
  pathname: string,
  favourite: string | null,
  leagues: readonly { id: string; slug: string }[],
): string | null {
  const known = (id: string | null): id is string => id !== null && leagues.some((l) => l.id === id);
  if (known(asked)) return asked;
  const slug = pathname.split("/")[1] ?? "";
  const page = leagues.find((l) => l.slug === slug);
  if (page) return page.id;
  if (known(favourite)) return favourite;
  return leagues[0]?.id ?? null;
}

/** A league's teams A to Z, as the picker lists them ("1. FC Köln" first). */
export function byName(teams: readonly [string, string][]): [string, string][] {
  return [...teams].sort((a, b) => a[1].localeCompare(b[1], "en"));
}

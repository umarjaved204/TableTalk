// The Your team picker's logic with no access to the page, so the unit tests
// can import it (tests/unit/team-picker-core.test.ts): which league it opens
// on, the order of the teams, and how the "Find a team" filter matches.

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

/** Text as the filter compares it: lower case, no accents, "&" as "and",
 *  single spaces ("Brighton & Hove" -> "brighton and hove", "Köln" -> "koln"). */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replaceAll("&", " and ")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Does a team's name (already normalised) contain what was typed, anywhere?
 *  Nothing typed matches nothing: the picker then shows one league again. */
export function matches(searchName: string, typed: string): boolean {
  const query = normalise(typed);
  return query !== "" && searchName.includes(query);
}

/** What the filter's live region says. */
export function countMessage(count: number): string {
  if (count === 0) return "No teams match. Try fewer letters.";
  return count === 1 ? "1 team matches" : `${count} teams match`;
}

/** A league's teams A to Z, as the picker lists them ("1. FC Köln" first). */
export function byName(teams: readonly [string, string][]): [string, string][] {
  return [...teams].sort((a, b) => a[1].localeCompare(b[1], "en"));
}

// Favourite team: the pure logic, with no access to the page or to storage.
//
// One source, two uses:
//   - src/scripts/theme-script.ts copies these functions into the early
//     script that runs before the page paints (with the `export` keywords
//     removed, so it stays one plain inline script);
//   - tests/unit/favourite-core.test.ts imports them directly.
// So the code the tests check is the code that runs.
//
// What is stored (localStorage["tabletalk-favourite"]):
//   { "v": 1, "team": "arsenal" | null, "name": "Arsenal", "league": "premier_league", "prompt": "dismissed" }
// Nothing read from storage or from the address bar is ever written into the
// page as HTML: slugs are only compared with the site's own team list, and
// names are shown with textContent.

export var FAV_VERSION = 1;
export var SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export var SLUG_MAX = 60;
export var NAME_MAX = 60;
var LEAGUE_RE = /^[a-z0-9_]{1,40}$/;

/** A string that can be a slug: short enough, then the pattern (length first,
 *  so a huge value never reaches the regular expression). */
export function isSlug(value) {
  return typeof value === "string" && value.length > 0 && value.length <= SLUG_MAX && SLUG_RE.test(value);
}

/**
 * The site's team list in a form that is safe to look things up in. Built
 * from the compact list in the early script:
 *   { leagues: [[leagueId, leagueName, [[slug, name], ...]], ...],
 *     unavailable: [leagueId, ...], renames: { oldSlug: newSlug } }
 * Maps, not plain objects, so a slug like "__proto__" or "constructor" can
 * never find something it shouldn't.
 */
export function makeIndex(data) {
  // data.names: [[leagueId, "the Premier League"], ...] for every league.
  var teams = new Map();
  var leagueNames = new Map();
  var renames = new Map();
  (data.leagues || []).forEach(function (league) {
    (league[2] || []).forEach(function (team) {
      teams.set(team[0], { slug: team[0], name: team[1], league: league[0] });
    });
  });
  // League names as they read mid-sentence ("the Premier League", "La Liga").
  (data.names || []).forEach(function (pair) {
    leagueNames.set(pair[0], pair[1]);
  });
  Object.keys(data.renames || {}).forEach(function (from) {
    renames.set(from, data.renames[from]);
  });
  return {
    teams: teams,
    leagueNames: leagueNames,
    unavailable: new Set(data.unavailable || []),
    renames: renames,
  };
}

/** A team in this build's list, following a rename if there is one. */
export function findTeam(index, slug) {
  if (!isSlug(slug)) return null;
  var renamed = index.renames.has(slug) ? index.renames.get(slug) : slug;
  return index.teams.has(renamed) ? index.teams.get(renamed) : null;
}

/**
 * Read the stored value. Returns one of:
 *   { kind: "none" }                        nothing usable stored
 *   { kind: "newer" }                       written by a newer version of the site: leave it alone
 *   { kind: "saved", team, name, league, dismissed }
 * A stored value that isn't JSON, isn't an object, or has no valid version
 * counts as nothing. A bad slug, name or league is dropped on its own.
 */
export function parseStored(raw) {
  if (typeof raw !== "string" || raw === "") return { kind: "none" };
  var value;
  try {
    value = JSON.parse(raw);
  } catch {
    return { kind: "none" };
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) return { kind: "none" };
  var v = value.v;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1) return { kind: "none" };
  if (v > FAV_VERSION) return { kind: "newer" };
  return {
    kind: "saved",
    team: isSlug(value.team) ? value.team : null,
    name:
      typeof value.name === "string" && value.name.length > 0 && value.name.length <= NAME_MAX
        ? value.name
        : null,
    league: typeof value.league === "string" && LEAGUE_RE.test(value.league) ? value.league : null,
    dismissed: value.prompt === "dismissed",
  };
}

/**
 * Where the visitor stands, given what's stored and this build's team list:
 *   none       no favourite; the home page shows "Pick your team"
 *   dismissed  no favourite, and "Not now" was chosen: no prompt
 *   newer      stored by a newer site version: no prompt, nothing changed
 *   chosen     a team in this season's data
 *   paused     a team whose league has no readable data in this build: kept, not "gone"
 *   gone       a team not in any of this season's leagues (e.g. relegated)
 */
export function resolveFavourite(saved, index) {
  if (saved.kind === "newer") return { state: "newer" };
  if (saved.kind !== "saved" || saved.team === null) {
    return { state: saved.kind === "saved" && saved.dismissed ? "dismissed" : "none" };
  }
  var team = findTeam(index, saved.team);
  if (team) return { state: "chosen", team: team.slug, name: team.name, league: team.league };
  var where = saved.league;
  if (where !== null && index.unavailable.has(where)) {
    return { state: "paused", team: saved.team, name: saved.name, league: where };
  }
  return { state: "gone", team: saved.team, name: saved.name, league: where };
}

/** The value to store. `dismissed` keeps "Not now" remembered across changes. */
export function serialize(team, dismissed) {
  var value = { v: FAV_VERSION, team: team ? team.slug : null };
  if (team) {
    value.name = team.name;
    value.league = team.league;
  }
  if (dismissed) value.prompt = "dismissed";
  return JSON.stringify(value);
}

/**
 * The personal link's team parameter, from a query string ("?team=arsenal").
 *   null              no team parameter
 *   { slug: "x" }     exactly one value that looks like a slug
 *   { slug: null }    anything else (bad characters, too long, repeated)
 */
export function readLink(search) {
  var values;
  try {
    values = new URLSearchParams(search).getAll("team");
  } catch {
    return { slug: null };
  }
  if (values.length === 0) return null;
  if (values.length > 1) return { slug: null };
  return { slug: isSlug(values[0]) ? values[0] : null };
}

/**
 * What to ask when a personal link is opened:
 *   { kind: "offer",   team, name }              no favourite yet (or one no longer covered)
 *   { kind: "replace", team, name, replacing }   a different favourite is set
 *   { kind: "same",    team, name }              already the favourite: nothing to ask
 *   { kind: "unknown" }                          not a team we cover (the link text is never shown)
 */
export function linkOffer(link, current, index) {
  if (link === null) return null;
  var team = link.slug === null ? null : findTeam(index, link.slug);
  if (!team) return { kind: "unknown" };
  if (current.state === "chosen" && current.team === team.slug) {
    return { kind: "same", team: team.slug, name: team.name };
  }
  if (current.state === "chosen" || current.state === "paused") {
    return { kind: "replace", team: team.slug, name: team.name, replacing: current.name };
  }
  return { kind: "offer", team: team.slug, name: team.name };
}

/** The address without the team parameter (other parameters and #hash kept),
 *  for history.replaceState. */
export function withoutTeamParam(href) {
  var url = new URL(href);
  url.searchParams.delete("team");
  return url.pathname + url.search + url.hash;
}

/**
 * The CSS for the current favourite: one rule for its team, and the rules
 * for its league (first on the home page, outlined, starred in the switcher).
 * The early script puts this in a constructed stylesheet before the page
 * paints, so the site's CSS doesn't need a rule for every team.
 *
 * The home page's card grid gives cards different widths by position (3 + 2
 * at 1024px, a full-width fifth card at 640px), so after the favourite's
 * league moves first, every card is told its new width (--fav-span-lg,
 * --fav-col-md; see the .cards rules in src/pages/index.astro).
 *
 * `team` and `league` are only ever a slug and a league id from the site's
 * own list (never text from storage or the address bar), so they are safe in
 * a selector; they are checked again here anyway.
 */
export function favouriteCss(team, league, leagueIds) {
  var rules = [];
  if (team !== null && isSlug(team)) {
    rules.push(
      ':root[data-fav="' +
        team +
        '"] [data-team="' +
        team +
        '"]' +
        "{--fav-mark:inline-block;--fav-bg:var(--fav-tint);--fav-ring:var(--fav-edge)}",
      ':root[data-fav="' + team + '"] [data-teams~="' + team + '"]{--fav-card-bg:var(--fav-tint)}',
    );
  }
  if (league !== null && LEAGUE_RE.test(league) && leagueIds.indexOf(league) !== -1) {
    var visual = [league].concat(
      leagueIds.filter(function (id) {
        return id !== league;
      }),
    );
    visual.forEach(function (id, i) {
      var props = [
        "--fav-span-lg:" + (i < 3 ? 2 : 3),
        "--fav-col-md:" + (i === visual.length - 1 ? "1/-1" : "auto"),
      ];
      if (id === league)
        props.push("--fav-order:-1", "--fav-league-ring:var(--fav-edge)", "--fav-league-mark:inline-block");
      rules.push('[data-fav-league-item="' + id + '"]{' + props.join(";") + "}");
    });
  }
  return rules.join("\n");
}

// ---------------------------------------------------------------------------
// Out-of-date numbers. Not about favourites, but it runs in the same early
// script for the same reason: to be decided before the page paints, so the
// warning is there from the first frame instead of appearing later and
// pushing the page down (a layout shift).
// ---------------------------------------------------------------------------

/** Numbers older than this are flagged (the same as STALE_AFTER_HOURS in src/format/time.ts). */
export var STALE_HOURS = 30;
var ISO_RE = /^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:?\d{2})$/;

/** "31 hours ago", "2 days ago" (as formatAge in src/format/time.ts). */
export function ageText(hours) {
  var rtf = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });
  return hours < 48 ? rtf.format(-Math.round(hours), "hour") : rtf.format(-Math.floor(hours / 24), "day");
}

/**
 * One CSS rule per update time (UTC) older than STALE_HOURS at `now` (ms),
 * for every element carrying it as data-generated (UpdatedStamp, the home
 * page's "Last update"). The rule only sets custom properties; the
 * components' CSS uses them to style the line as a warning and to add
 * " (2 days ago): these numbers may be out of date" after it.
 */
export function staleCss(updated, now) {
  return (updated || [])
    .filter(function (iso) {
      return typeof iso === "string" && ISO_RE.test(iso);
    })
    .map(function (iso) {
      var hours = (now - Date.parse(iso)) / 3600000;
      if (!(hours > STALE_HOURS)) return "";
      return (
        '[data-generated="' +
        iso +
        '"]{--stale-show:block;--stale-bg:var(--warn-bg);--stale-fg:var(--warn-text);' +
        "--stale-weight:600;--stale-pad:var(--space-2);" +
        '--stale-note:" (' +
        ageText(hours) +
        '): these numbers may be out of date"}'
      );
    })
    .filter(Boolean)
    .join("\n");
}

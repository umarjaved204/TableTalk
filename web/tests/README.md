# Tests

Two kinds:

| Kind                       | Command                 | What it runs against                                                                |
| -------------------------- | ----------------------- | ----------------------------------------------------------------------------------- |
| Unit (Vitest)              | `npm test`              | The data layer, formatting helpers and theme files, directly                        |
| Browser (Playwright + axe) | `npm run test:e2e`      | A **built** test site, served as plain files                                        |
| Season rollover            | `npm run test:rollover` | A second built site, from a simulated next season (`playwright.rollover.config.ts`) |

## Fixtures

`fixtures/data-16a5512/` holds real published files, copied unchanged from the
`data` branch at commit `16a5512` (the 29 Sep 2026 run). Edge cases (a newer
MAJOR version, a missing file, a league that failed, a lock log that
contradicts the summary) are made by copying these into a temporary folder and
editing one thing (`unit/helpers.ts`), so every edge case starts from real data.

`fixtures/illustrated.ts` adds **ILLUSTRATED** data on top of those real files:
a lock log with one example of every match status (played, locked, voided,
postponed and re-locked, invalid, missed, and a real upcoming match shown as
postponed earlier), a matching `summary.json`, and five earlier history runs
for the race chart. The history runs blend the real 29 Sep numbers with
"every team equal", so the lines move towards today's real values. None of
this is a real prediction or result. No real lock existed when Step 3 was
built (the first kick-off after the pipeline went live is 9 Oct 2026), so a
real locked match still has to be checked against its `predicted_at` later.

## The browser tests' own site

The real data changes every night, so the browser tests don't use it.
`npm run test:e2e` first runs `fixtures/make-e2e-data.ts`, which writes
`.e2e-data/` (the real 29 Sep files plus the illustrated data above), builds
the site from it into `dist-e2e/`, runs the build check on it, and serves it
on port 4322 with `e2e/serve.mjs`, a small static file server. (Not `astro
preview`: Astro allows one preview server per project, so the tests couldn't
start while the real site was being previewed.) Both folders
are git-ignored. Each league shows one data state, so every state is built
and checked by axe:

| League         | State in the test site                                                           |
| -------------- | -------------------------------------------------------------------------------- |
| Premier League | Ready: every match status, race charts drawn                                     |
| Bundesliga     | Ready, six zones: race charts drawn, relegation play-off place                   |
| La Liga        | Unavailable: its file breaks the contract (team pages from one history run)      |
| Serie A        | Numbers hidden: a newer MAJOR contract version (team pages from one history run) |
| Ligue 1        | Older numbers kept (`kept_previous`), provisional with a notice, race too early  |

The visitor's clock is fixed (`e2e/test.ts`) at 30 Sep 2026 09:00 UTC, 15
hours after the snapshot, so nothing is stale and nothing has kicked off.
Tests for stale data and kick-offs move the clock on.

## Every data state and where it is tested

| State                                           | Unit test                                  | Browser test (`e2e/pages.spec.ts`)          |
| ----------------------------------------------- | ------------------------------------------ | ------------------------------------------- |
| Unavailable: no snapshot, missing, invalid file | `league.test.ts`                           | La Liga page and home card                  |
| `kept_previous`                                 | `league.test.ts`                           | Ligue 1                                     |
| Newer MAJOR version (numbers hidden)            | `league.test.ts`, `matches.test.ts`        | Serie A                                     |
| Provisional, with notices                       | `league.test.ts`                           | Ligue 1                                     |
| Stale (older than 30 hours)                     | `time.test.ts`                             | home page with the clock 36 hours later     |
| Kicked off, not yet locked                      | `matches.test.ts`, `match-status.test.ts`  | matches page with the clock at 10 Oct 12:00 |
| Locked, played, voided, invalid, missed         | `match-records.test.ts`, `matches.test.ts` | Premier League matches page                 |
| Postponed and re-locked                         | `match-records.test.ts`                    | Premier League matches page (Hull City)     |
| `locks.jsonl` missing, zero locks (fine)        | `matches.test.ts`, `track-record.test.ts`  | (the real data, every build until 9 Oct)    |
| `locks.jsonl` missing, locks counted (fails)    | `matches.test.ts`, `track-record.test.ts`  |                                             |
| Team page in each state above                   | `team-page.test.ts`                        | `team-pages.spec.ts` (one page per state)   |

## Unit tests (what they guard)

- `probability.test.ts`: never 0% or 100% without certainty; the largest
  remainder method (sets that plain rounding gets wrong, and 1,000 random sets
  that must add up to exactly 100).
- `time.test.ts`: UTC to local time (including half-hour offsets and the UK
  clock change on 25 Oct 2026), grouping by the visitor's local date (a 23:30
  UTC kick-off is the next day in Asia), plain
  dates never shifted, the 30-hour stale threshold.
- `version-and-load.test.ts`: MAJOR/MINOR handling, unknown fields from a newer
  MINOR accepted, a different MAJOR reported as "unsupported" (numbers hidden),
  a broken file stops the build.
- `league.test.ts`: all five real leagues build, and the temporary zone map
  covers every zone id (a new zone id fails the build). Also league states
  (a broken league file makes only that league unavailable; a broken
  `index.json` still stops the build) and zone markers.
- `track-record.test.ts`: a missing `locks.jsonl` is "no locks yet" only when
  `summary.json` counts zero locks; otherwise the build stops.
- `match-records.test.ts`: status from replaying the lock log (every status; a
  postponed match that is re-locked; invalid then void on a suspended match;
  postponed twice); files that contradict each other stop the build.
- `matches.test.ts`: what goes in Upcoming and Recent (newest first, this
  league only, the 4-week windows), predicted_at always from the data, a
  snapshot made after kick-off, and loading the track record in every state.
- `match-status.test.ts`: the exact words for every status.
- `race.test.ts`: the chart's data extraction (fields kept, runs skipped with
  a reason), one point per day, the team-selection rule, six-zone leagues, the
  "too early" rule, and the SVG geometry.
- `home.test.ts`: the home cards' values for every real league (including the
  play-off place), ties, never 0%/100%, and the one-line track record wording
  (difference ± 95% interval; "no detectable difference" when it includes zero).
- `track-record-view.test.ts`: the track record page's model in each state
  (empty, a few matches, mature), when the calibration chart shows, the 50
  latest scored matches, and the comparison wording (difference ± interval,
  "no detectable difference" when it includes zero, "too few to judge").
- `backtests.test.ts`: the methodology page's backtest numbers, copied by hand,
  still match the project README's five-leagues table.
- `sources.test.ts`: the About page's data sources, from the real snapshots; an
  unknown source fails the build.
- `fonts.test.ts`: the font subsets (Latin and Latin Extended) cover every
  team name in the real data and names like Mönchengladbach, Alavés and
  Ołeksandr; no other subsets or .woff files are declared.
- `check-build.test.ts`: the build check catches a local address in a page,
  a .woff file, and a Cyrillic, Greek or Vietnamese subset.
- `themes.test.ts`: every theme defines every token; each theme is in exactly
  one data-colour set; the full WCAG 2.2 AA contrast report, recomputed from
  the CSS files (a failing theme fails the run); the inline theme script is
  complete and valid.

## Favourite team: where it is tested

| What                                                                | Unit test                  | Browser test                       |
| ------------------------------------------------------------------- | -------------------------- | ---------------------------------- |
| Slug rule (all 327 canonical names), clashes, reserved names        | `teams.test.ts`            |                                    |
| Stored value: missing, corrupted, newer version, bad fields         | `favourite-core.test.ts`   | `favourites.spec.ts`               |
| States: chosen, paused (league without data), gone (not covered)    | `favourite-core.test.ts`   | `favourites.spec.ts`               |
| Personal link: offer, replace, same, unknown, parameter removed     | `favourite-core.test.ts`   | `favourites.spec.ts`               |
| Injection attempts through the link and through a stored name       | `favourite-core.test.ts`   | `favourites.spec.ts`               |
| Storage blocked (private window)                                    |                            | `favourites.spec.ts`               |
| Early script: ASCII, LF line endings, CSP hash, `</script>` safety  | `themes.test.ts`           | `csp.spec.ts`                      |
| Row tint contrast in all eight themes                               | `themes.test.ts`           |                                    |
| Generated CSS, card data, QR codes, race extras                     | `favourites-build.test.ts` |                                    |
| No layout shift in every state; header height the same in any font  |                            | `favourites.spec.ts`               |
| Keyboard, axe (light and dark, 360 and 1280px)                      |                            | `favourites.spec.ts`               |
| Every team's card complete and within the screen (320, 768, 1280px) |                            | `favourites.spec.ts`               |
| Without JavaScript: nothing shown or reserved                       |                            | `no-js.spec.ts`                    |
| Without `:has()` or `showModal()`: graceful fallback                |                            | `favourites.spec.ts`               |
| Elements per page type, with and without a favourite (budgets)      |                            | `dom-budget.spec.ts`               |
| A new season: relegated and promoted favourites, links, the picker  |                            | `rollover.spec.ts` (test:rollover) |

QR codes were also decoded once with OpenCV (all 96, rendered at the dialog's
148px on a dark page, all correct); that check isn't automated, because it
would need a QR decoder as a dependency. A real phone scan is still to do
once `SITE_URL` exists.

## Team pages: where they are tested

| What                                                                            | Unit test           | Browser test                        |
| ------------------------------------------------------------------------------- | ------------------- | ----------------------------------- |
| Which pages exist (table, or newest history run when the league has none)       | `team-page.test.ts` | `team-pages.spec.ts`                |
| Slug clashes and reserved names, including history-built pages and stubs        | `team-page.test.ts` |                                     |
| Record, chances, finishing bars and zone bands, "Most likely", the table        | `team-page.test.ts` | `team-pages.spec.ts`                |
| Chances over time: "too early", one point per day, this season only             | `team-page.test.ts` | `team-pages.spec.ts`                |
| Title, description, Open Graph, breadcrumb (`aria-current`)                     |                     | `team-pages.spec.ts`                |
| Team names link to their pages (table, heatmap, race, cards, Your team, dialog) | `team-page.test.ts` | `team-pages.spec.ts`                |
| Every page reachable from `/` and can be left with the site's own links         |                     | `navigation.spec.ts`                |
| Stub pages for last season's teams: wording, noindex, links out, axe            | `team-page.test.ts` | `rollover.spec.ts` (test:rollover)  |
| sitemap.xml (no stubs) and robots.txt                                           | `team-page.test.ts` |                                     |
| Elements per team page (budget)                                                 |                     | `dom-budget.spec.ts`                |
| Accessibility, keyboard, phones: one team page per data state (`TEAM_PAGES`)    |                     | `a11y-matrix`, `keyboard`, `mobile` |

## Browser tests: accessibility coverage

The full record, with the manual keyboard and NVDA checklists still to do, is
in `../docs/accessibility-review.md`.

axe-core checks every rule tagged WCAG 2.0/2.1/2.2 A and AA. Each run also
checks that the page never scrolls sideways and that there are no console
errors, which includes any Content Security Policy violation.

**Two overlapping matrices** (`e2e/a11y-matrix.spec.ts`), so that every page
and every theme is covered without running every combination. Widths: 360,
390, 768, 1024 and 1440 px. Each run opens every "Show the numbers" table
first, so axe checks those too.

| Matrix         | Pages                                                                   | Themes                                  | Runs | Why                                                                                  |
| -------------- | ----------------------------------------------------------------------- | --------------------------------------- | ---- | ------------------------------------------------------------------------------------ |
| A: every theme | 3 representative pages: a league page, a matches page, the track record | all 7 colour themes                     | 105  | Colour problems are per theme; these three pages contain every component             |
| B: every page  | the other 16 pages (every page type; team pages by one per data state)  | Matchday (light) and Floodlights (dark) | 160  | Structure problems (headings, labels, landmarks, reflow) are per page, not per theme |

The picker's 8th choice, System, is not a theme of its own: it shows Matchday,
Floodlights or High Contrast, all in matrix A.

**Keyboard walk** (`e2e/keyboard.spec.ts`): every page at 1440 and 390 px,
Tab from the top until focus comes back round. The skip link is first and
works; every stop is visible, on screen and has a focus ring; every control is
reached; no tabindex above 0; no trap. The Appearance dialog on every page:
Enter opens it, focus moves in, Escape closes it and focus returns.

**No JavaScript** (`e2e/no-js.spec.ts`): every section and number is shown,
and the controls that need JavaScript are not.

**What these cannot check** (and what the manual passes are for): whether the
reading order makes sense, whether link and button names are clear out of
context, and whether screen-reader announcements are useful. The manual
keyboard and NVDA checklists are in `../docs/accessibility-review.md`, with a
results table to fill in.

`e2e/review-fixes.spec.ts`: the home cards never leave one card alone on a
row (5 in a row from 1280px, 3 + 2 from 1024px, 2 + 2 + 1 from 640px), every
league page's phone tabs are Table / Next matches / Positions, only Latin and
Latin Extended WOFF2 fonts are requested, and ö, é and ł load the site's own
fonts.

Other browser tests: Barlow Condensed's digits measured as equal width when
rendered (and every element showing digits uses tabular figures), kick-off
times in the visitor's time zone, the theme picker by keyboard (arrows,
Escape, saved across a reload, script first in `<body>` so there's no flash),
System following the device (dark, light, more contrast), the table's Short
and Full views (the "Chance shown" picker appears only in Short, since Full
shows every chance), the table caption's wording, the phone tabs by keyboard.

## Phones (`e2e/mobile.spec.ts`)

Runs on seven emulated phones, each with its real screen size, pixel density,
touch input and mobile user agent. iPhones run in WebKit (Safari's engine),
Android phones in Chromium:

| Project             | Engine   | Screen (CSS px)                    |
| ------------------- | -------- | ---------------------------------- |
| iphone-se           | WebKit   | 320 x 568 (narrowest common phone) |
| iphone-13           | WebKit   | 390 x 664                          |
| iphone-15-pro-max   | WebKit   | 430 x 739                          |
| iphone-13-landscape | WebKit   | 750 x 342                          |
| galaxy-s8           | Chromium | 360 x 740                          |
| pixel-7             | Chromium | 412 x 839                          |
| pixel-7-landscape   | Chromium | 863 x 360                          |

Every page in `mobile.spec.ts` (home, 404, two league pages, a matches page,
and every phone tab of each) is measured by `e2e/layout-audit.ts`:

- the page never scrolls sideways, and nothing sticks out past the screen edge;
- no clipped content;
- no text under 12px; body text and form fields at least 16px (below that, iOS zooms in on focus);
- every tap target at least 24 x 24 (WCAG 2.2 AA); main controls (league chips, tabs, Appearance, table controls) at least 44px;
- no two tap targets overlap;
- pinch-zoom is never blocked;
- layout shift during load at most 0.1 (Chromium only: WebKit can't measure it, so those 4 runs are skipped);
- text enlarged to 200% (WCAG 1.4.4) and wider text spacing (WCAG 1.4.12) still fit;
- the browser bar colour matches the theme, and a home-screen icon exists;
- touch: the Appearance dialog fits the screen and a tap changes the theme; the league chips swipe; tabs and Short/Full respond to taps.

**Limits of emulation.** These are real browser engines at real sizes, but not
real devices: the WebKit build is Playwright's Windows port, which renders
fonts differently from an iPhone.

- **Resolved (1 Oct 2026):** text looked lighter in emulated WebKit. The site
  was checked on real phones with no issues and the text weight looked normal,
  so this was the emulator only, not the site.
- Re-check on at least one real iPhone and one real Android phone before
  deployment, and after any change to fonts or layout.

## Content Security Policy (`e2e/csp.spec.ts`)

The policy allows a script only if its sha256 hash is listed, and the theme
script is inline. If its text in the built page ever differs from the text
that was hashed, the browser blocks it silently and themes stop working. So
for every page in `dist/`, the test:

- rebuilds the theme script from `src/scripts/theme-head.js` itself, checks
  that exactly that text is in the page, and that its hash is in the policy;
- hashes every other inline script Astro wrote into the page and checks each
  one is allowed.

It reads files only (no browser), so it runs once, in the desktop project.
Checked by hand: adding one space to the theme script in a built page makes
both tests fail.

## When a browser test fails

Playwright keeps a **trace** of every failed test (`trace: "retain-on-failure"`):
screenshots of each step, the page's DOM, console and network. Open it with
`npx playwright show-trace test-results/<test folder>/trace.zip`. There are
**no retries** on purpose: a test that fails once and passes on a retry is
still reported as failed, so an intermittent problem (such as the one seen once
on the Pixel 7 landscape profile) is never hidden.

`unit/encoding.test.ts` checks that every source file is clean UTF-8 (no
byte-order mark, no garbled characters).

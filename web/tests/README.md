# Tests

Two kinds:

| Kind                       | Command            | What it runs against                                         |
| -------------------------- | ------------------ | ------------------------------------------------------------ |
| Unit (Vitest)              | `npm test`         | The data layer, formatting helpers and theme files, directly |
| Browser (Playwright + axe) | `npm run test:e2e` | A **built** test site, served by `astro preview`             |

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
the site from it into `dist-e2e/`, and serves it on port 4322. Both folders
are git-ignored. Each league shows one data state, so every state is built
and checked by axe:

| League         | State in the test site                                                          |
| -------------- | ------------------------------------------------------------------------------- |
| Premier League | Ready: every match status, race charts drawn                                    |
| Bundesliga     | Ready, six zones: race charts drawn, relegation play-off place                  |
| La Liga        | Unavailable: its file breaks the contract                                       |
| Serie A        | Numbers hidden: a newer MAJOR contract version                                  |
| Ligue 1        | Older numbers kept (`kept_previous`), provisional with a notice, race too early |

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
- `themes.test.ts`: every theme defines every token; each theme is in exactly
  one data-colour set; the full WCAG 2.2 AA contrast report, recomputed from
  the CSS files (a failing theme fails the run); the inline theme script is
  complete and valid.

## Browser tests: accessibility coverage

axe-core checks every rule tagged WCAG 2.0/2.1/2.2 A and AA. Each run also
checks that the page never scrolls sideways and that there are no console
errors, which includes any Content Security Policy violation.

**Now (Step 3):** the league page (`/premier-league/`) in all **8 themes × 5
widths** (360, 390, 768, 1024, 1440 px) = 40 runs, plus every new page and
every data state (10 pages: home, two league pages with race charts, three
matches pages, the three broken-league states, the track record placeholder)
in **Matchday (light) and Floodlights (dark) × 5 widths** = 100 runs. Each run
opens every "Show the numbers" table first, so axe checks those too.

**Step 5 (all pages): two overlapping matrices**, so that every page and every
theme is covered without running every combination:

| Matrix         | Pages                                                                   | Themes                                  | Widths | Why                                                                                  |
| -------------- | ----------------------------------------------------------------------- | --------------------------------------- | ------ | ------------------------------------------------------------------------------------ |
| A: every theme | 3 representative pages: a league page, a matches page, the track record | all 8                                   | all 5  | Colour problems are per theme; these three pages contain every component             |
| B: every page  | every page                                                              | Matchday (light) and Floodlights (dark) | all 5  | Structure problems (headings, labels, landmarks, reflow) are per page, not per theme |

**What axe cannot check** (and what the manual passes are for): whether the
reading order makes sense, whether link and button names are clear out of
context, and whether screen-reader announcements (theme picker, tabs, table
views) are actually useful. Step 5 adds a manual keyboard-only pass and an
NVDA screen-reader pass on Windows, with the results written up.

Other browser tests: Barlow Condensed's digits measured as equal width when
rendered (and every element showing digits uses tabular figures), kick-off
times in the visitor's time zone, the theme picker by keyboard (arrows,
Escape, saved across a reload, script first in `<body>` so there's no flash),
System following the device (dark, light, more contrast), the table's Short
and Full views, the phone tabs by keyboard.

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

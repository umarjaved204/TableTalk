# Tests

Two kinds:

| Kind                       | Command                             | What it runs against                                         |
| -------------------------- | ----------------------------------- | ------------------------------------------------------------ |
| Unit (Vitest)              | `npm test`                          | The data layer, formatting helpers and theme files, directly |
| Browser (Playwright + axe) | `npm run build && npm run test:e2e` | The **built** site, served by `astro preview`, in Chromium   |

## Fixtures

`fixtures/data-16a5512/` holds real published files, copied unchanged from the
`data` branch at commit `16a5512` (the 29 Sep 2026 run). Edge cases (a newer
MAJOR version, a missing file, a league that failed, a lock log that
contradicts the summary) are made by copying these into a temporary folder and
editing one thing (`unit/helpers.ts`), so every edge case starts from real data.

## Unit tests (what they guard)

- `probability.test.ts`: never 0% or 100% without certainty; the largest
  remainder method (sets that plain rounding gets wrong, and 1,000 random sets
  that must add up to exactly 100).
- `time.test.ts`: UTC to local time (including half-hour offsets and the UK
  clock change on 25 Oct 2026), grouping by the visitor's local date, plain
  dates never shifted, the 30-hour stale threshold.
- `version-and-load.test.ts`: MAJOR/MINOR handling, unknown fields from a newer
  MINOR accepted, a different MAJOR reported as "unsupported" (numbers hidden),
  a broken file stops the build.
- `league.test.ts`: all five real leagues build, and the temporary zone map
  covers every zone id (a new zone id fails the build). Also league states and
  zone markers.
- `track-record.test.ts`: a missing `locks.jsonl` is "no locks yet" only when
  `summary.json` counts zero locks; otherwise the build stops.
- `themes.test.ts`: every theme defines every token; each theme is in exactly
  one data-colour set; the full WCAG 2.2 AA contrast report, recomputed from
  the CSS files (a failing theme fails the run); the inline theme script is
  complete and valid.

## Browser tests: accessibility coverage

axe-core checks every rule tagged WCAG 2.0/2.1/2.2 A and AA. Each run also
checks that the page never scrolls sideways and that there are no console
errors, which includes any Content Security Policy violation.

**Now (Step 2): one real page, full matrix.** The league page
(`/premier-league/`) in all **8 themes × 5 widths** (360, 390, 768, 1024,
1440 px) = 40 runs.

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

Every page (and every phone tab of the league page) is measured by
`e2e/layout-audit.ts`:

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

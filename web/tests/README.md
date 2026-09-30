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

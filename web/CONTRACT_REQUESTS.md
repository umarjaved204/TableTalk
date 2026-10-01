# Contract requests

Things the website needs that the published files (contract 1.1.0) don't
contain yet. The website never changes the contract; these are for after the
pipeline trial. None needs a MAJOR change.

Each entry says what, why, the version change, and what the site does in the
meantime. Numbers (R1, R2, ...) are stable ids; the list below is in
**priority order**.

| Priority | Id  | What                                                         | Type             | Meanwhile                                                                            |
| -------- | --- | ------------------------------------------------------------ | ---------------- | ------------------------------------------------------------------------------------ |
| 1        | R11 | Readers must ignore unknown fields (wording)                 | PATCH            | The site validates against relaxed schema copies                                     |
| 2        | R8  | Pipeline fingerprint next to `code_commit`                   | MINOR            | Not needed until `web/` merges into `main`. **Must be done before that.**            |
| 3        | R2  | Compact history series + run index                           | MINOR            | The build reads the `history/` folders                                               |
| 4        | R3  | Short team names                                             | MINOR            | Full names, wrapping onto two lines                                                  |
| 5        | R4  | Zone short labels and which end of the table                 | MINOR            | Temporary `ZONE_DISPLAY` map in `src/data/leagues.ts` (build fails on a new zone id) |
| 6        | R1  | Mark mathematically certain outcomes (**investigate first**) | MINOR            | Never show 0% or 100%                                                                |
| 7        | R5  | Recent results in each snapshot                              | MINOR            | "Recent" shows locked matches only                                                   |
| 8        | R6  | Identify awarded matches in the track record                 | MINOR            | Show the count only                                                                  |
| 9        | R7  | `contract_version` on each new lock-log line                 | MINOR            | Read the log under `summary.json`'s version                                          |
| 10       | R12 | A JSON Schema for lock-log lines                             | PATCH (new file) | Hand-written types in `src/data/track-record.ts`                                     |
| 11       | R10 | Backtest summary file for the methodology page               | MINOR            | Copied into `src/data/backtests.ts` with the README commit; a test checks them       |
| 12       | R9  | Whether a kick-off time is confirmed (investigate)           | MINOR            | A general "kick-off times can still change" note                                     |
| 13       | R13 | Can `upcoming_matches` include a match already kicked off?   | PATCH (wording)  | The site handles both: such a match shows as "kicked off", not upcoming              |

R12 was added in Step 2 (the lock log is the only published file without a
schema). It sits next to R7 because both are about the lock log. R13 was added
in Step 3, at the end so the existing order is unchanged.

---

## R11. Readers ignore unknown fields (PATCH)

**What.** One paragraph in `contracts/README.md`: consumers must ignore fields
they don't know, and the schemas' `additionalProperties: false` describes what
the pipeline writes, not what a reader may assume.

**Why.** "MINOR = new fields added" only works if readers accept new fields.
A reader that validates against the schemas as published would reject every
file after the first MINOR change.

## R8. Pipeline fingerprint (MINOR)

**What.** In every snapshot's `run` and every lock's `model`, add
`pipeline_hash`: a sha256 over the files that can change the numbers
(`src/tabletalk/`, `configs/`, `pyproject.toml`), next to `code_commit`.

**Why.** Once `web/` is on `main`, a website-only commit changes
`code_commit` although the model did not change. With `pipeline_hash`, a
reader can see that two predictions came from the same pipeline code.

## R2. History series and run index (MINOR)

**What.**

- `history/index.json`: every run folder, with `generated_at` and per-league status.
- `series/<competition>.json`: one compact row per run: `generated_at`,
  `data_through`, and per team `expected_points` and zone chances.

**Why.** Charts over time ("How the race has moved"). A browser can't list
folders, and the build reading every full snapshot grows by about 0.9 MB per
run (around 300 MB a season).

**Measured in Step 3** (see web/README.md): reading the history adds 0.1 s to
the build today (20 files) and about 2.2 s at the end of a season (1,500
files); the whole build goes from about 4 s to about 8 s. Not urgent for build
time; the bigger cost is `npm run data` copying ~250 MB of history.

## R3. Short team names (MINOR)

**What.** A `short_name` for every team (e.g. "Man City", "M'gladbach"), in
`table[]`, `teams[]` and matches, or one `team_names` map per snapshot.

**Why.** Names run to 25 characters ("Borussia Mönchengladbach"): tight on
phones and in match cards. The site should not keep its own list, which would
duplicate `configs/team_aliases.yaml`.

## R4. Zone display fields (MINOR)

**What.** `zones[].short_label` ("Top 4", "Down", "Play-off") and
`zones[].end` (`"top"` or `"bottom"`).

**Why.** Zone labels are sentences ("Relegation to the Championship"), too
long for column headers, and the site shouldn't hard-code which zone ids sit
at the bottom of the table.

## R1. Mathematically certain outcomes (MINOR, investigate first)

**What (proposed).** Per team:

- `certain`: a map of zone id to `"clinched"` or `"impossible"`, listing only
  zones that are decided;
- `possible_positions`: `[best, worst]`, the finishing positions still possible.

**Why.** The display rule allows 0% and 100% only for outcomes the data marks
as certain. Today an exact `0.0` can mean "didn't happen in 10,000
simulations" (five games into the 2026-27 season, Manchester City's
relegation chance is `0.0`), which is not the same as impossible.

**A conservative definition, on points alone.** For each team, using only
points and the matches each team has left in the fixture list:

- `max(T)` = T's points now + 3 × T's remaining matches; `now(T)` = points now.
- T is **certainly above** U if `now(T) > max(U)` (strictly: an equal total
  would be decided by tiebreakers, which this definition does not try to
  predict).
- `a` = teams certainly above T, `b` = teams certainly below T.
  T can only finish in positions `a + 1` to `N - b`.
- A top zone of positions 1..k is **clinched** if `N - b <= k` and
  **impossible** if `a + 1 > k`. Bottom zones mirror this.

**Why this is conservative, and the complications to settle before building:**

1. **Tiebreakers.** Level on points is treated as undecided, even when goal
   difference makes the order all but certain. This only ever withholds a
   0%/100% the data could have claimed; it never claims one wrongly.
2. **Head-to-head matches.** Each rival's maximum assumes it wins every
   remaining match, even against other rivals, which can't all happen. Again
   conservative (fewer certainties), never wrong.
3. **Points deductions and appeals.** A future deduction, or a deduction
   restored on appeal (both handled in `configs/points_deductions.yaml`),
   changes `now` after the fact. A certainty computed today could become false.
   Options: compute on the points as they stand and say so, or withhold
   certainty for any league with a pending case. Needs a decision.
4. **Awarded and provisional results.** While a result is provisional
   (`provisional: true`), certainty that depends on it should be withheld.
5. **Fixtures that change.** A cancelled match lowers a team's maximum, and a
   season ended early (Ligue 1's `completed_early` rule, points per match)
   changes the ranking rule itself. Certainty must be recomputed from the
   fixture list every run, and never claimed under a points-per-match rule.
6. **Play-off places** (Bundesliga 16th, Serie A position play-offs). A zone
   decided by a play-off _match_ can be certain as a position but not as an
   outcome (the play-off itself is still to be played). The label should say
   "finishes 16th", not "relegated".
7. **Agreement with the simulations.** Add a guarantee: an outcome marked
   `impossible` has chance exactly 0 in the simulations, and one marked
   `clinched` has exactly 1. If they ever disagree, that's a bug in one of them.

## R5. Recent results (MINOR)

**What.** `recent_results[]` in each snapshot: the last N played matches with
`match_id`, score, date and status (including awarded).

**Why.** Played matches that were never locked (before the pipeline went live,
or missed) have no result in any published file.

## R6. Which matches were awarded (MINOR)

**What.** The lock ids of awarded matches in `summary.json` (a list, or a flag
per match).

**Why.** `counts.awarded_not_scored` gives a number but not which matches, so
the site can't label them. On the matches page an awarded match's lock is never
scored, so it would show "awaiting result" for good.

## R7. Version on lock-log lines (MINOR)

**What.** `contract_version` on each new line of `track_record/locks.jsonl`.
Existing lines are untouched, so the hash chain still verifies.

**Why.** The site checks the contract version of every file it reads, and this
file has none.

## R12. Schema for lock-log lines (PATCH: a new schema file; data unchanged)

**What.** `contracts/lock_log.schema.json` describing the four line types
(`lock`, `void`, `invalid`, `missed`), as `contracts/README.md` already does
in prose.

**Why.** It's the only published file without a machine-readable schema. The
site's types for it are hand-written in `src/data/track-record.ts` and can
drift from the pipeline.

## R10. Backtest summary (MINOR)

**What.** `methodology/backtests.json`: per league, log loss against base
rates (difference ± 95% interval), the share of the gap to the market closed,
and the code commit that produced them.

**Why.** Otherwise the methodology page copies numbers from the README by
hand, and copies drift.

## R9. Confirmed kick-off times (investigate)

**What.** A flag saying whether a kick-off time is confirmed or a default slot.

**Why.** `TIMED` can still move for TV. football-data.org may not provide this,
so check the source first; if it can't be known, drop the request.

## R13. Matches that have kicked off in `upcoming_matches` (PATCH, wording)

**What.** One sentence in `contracts/README.md` saying whether a match that
has kicked off (or is in play) when a run happens can still be listed in
`upcoming_matches`, with a prediction made after its kick-off.

**Why.** Runs have been starting hours late (10:43 and 11:09 UTC on 30 Sep
and 1 Oct, not 04:37), so a 10:30 UTC kick-off could be in progress during a
run. Such a prediction is not the one that gets locked. The site already
handles it (a snapshot made after a match's listed kick-off shows the match as
"kicked off", with a sentence saying its prediction won't be the one
recorded), but the contract should say which happens.

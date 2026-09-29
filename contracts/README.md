# TableTalk data contract, version 1.0.0

This folder describes the files `python -m tabletalk update` writes. The website
is built against these files and this document, not against the Python code.
The machine-readable versions are [snapshot.schema.json](snapshot.schema.json)
and [index.schema.json](index.schema.json) (JSON Schema, draft 2020-12). Every
file is checked against its schema before it is written. A file that fails the
check is never published.

## Files

```
latest/index.json                 what the last run did, per league (read this first)
latest/<competition>.json         the newest snapshot for each league
latest/run_report.md              the same as index.json, written for a person
history/<YYYY-MM-DDTHHMMZ>/...    every run's files, kept unchanged
```

`<competition>` is a config id: `premier_league`, `bundesliga`, `la_liga`,
`serie_a`, `ligue_1`. The history folder name is the run's start time in UTC.

## index.json

| Field | Meaning |
|---|---|
| `contract_version` | Version of this contract (see "Versioning") |
| `generated_at` | When the run started (UTC) |
| `history_path` | This run's folder under `history/` |
| `competitions[]` | One entry per league |
| `.status` | `updated`: this run wrote a new snapshot. `kept_previous`: this run failed for this league, so the previous snapshot is still the latest. `no_snapshot`: it failed and there has never been one |
| `.file` | The snapshot's file name in `latest/`, or null |
| `.snapshot_generated_at` | When the snapshot in `latest/` was made. For `kept_previous` this is older than the run |
| `.data_through`, `.provisional` | Copied from the snapshot |
| `.error` | Why this league failed, or null |

A website should show `snapshot_generated_at` and `data_through`, not just
the run time, so a reader can see when a league's numbers are older.

## <competition>.json (a snapshot)

All times are UTC, written as `YYYY-MM-DDTHH:MM:SSZ`. Dates are `YYYY-MM-DD`.
Probabilities are numbers from 0 to 1, rounded to 6 decimals.

**About the run**

| Field | Meaning |
|---|---|
| `competition` | `id`, `name`, `country`, `season` (e.g. `2026-27`) |
| `generated_at` | When this snapshot was made |
| `data_through` | Date of the latest result included, or null before the season starts |
| `latest_result` | That result: date, teams and score |
| `provisional` | `true` when the table counts a result not yet confirmed: see `notices` |
| `notices` | Things a reader should know, in plain English (e.g. an awarded match awaiting confirmation) |
| `run.seed` | The random seed. Re-running with the same code, configs, data and date gives the same numbers |
| `run.seed_rule` | How the seed is made from the date and the league |
| `run.n_simulations` | How many seasons were simulated |
| `run.code_commit` | The git commit of the code that made this file. `run.code_dirty` is true if the code had uncommitted changes |
| `run.config_hash` | A fingerprint of the config files listed in `run.config_files`. Any change to them changes it |
| `run.model` | Last result date the model was fitted on, the promoted-team method and teams, and how uncertainty is handled |
| `sources` | Every data source used, with its role (`results`, `fixtures`, `context`, `check`) |

**The league**

| Field | Meaning |
|---|---|
| `zones[]` | The finishing-position groups we give chances for: `id`, `label`, `positions` (1 = top). Zones are league positions only, never European places |
| `table[]` | The current table in order: position, team, played, won, drawn, lost, goals for and against, goal difference, points, and `points_deducted` (the net points change, negative for a deduction; already included in `points`) |
| `teams[]` | One entry per team, ordered by expected finishing position |
| `.position_now`, `.points_now` | Where the team is now |
| `.expected_points` | Average final points across the simulated seasons |
| `.points_p10`, `.points_p90` | 80% of simulated seasons end between these two totals |
| `.expected_position` | Average finishing position |
| `.zones` | Chance of finishing in each zone, keyed by zone id |
| `.finishing_positions` | Chance of finishing 1st, 2nd, ... last (list, first item = 1st place). Adds up to 1 |

**Every match still to play**

| Field | Meaning |
|---|---|
| `match_id` | The fixture source's id (e.g. `fdorg:560593`). It stays the same when a match is moved, so use it to follow a match over time |
| `matchday` | e.g. `Matchday 7` |
| `date` | The listed date |
| `kickoff_utc` | Kick-off time, or null when not set yet |
| `status` | The fixture source's status: `TIMED` (a time is set, but in some leagues it can still move for TV), `SCHEDULED` (date only), `POSTPONED`, ... |
| `probabilities` | `home`, `draw`, `away`: add up to 1 |
| `expected_goals` | `home`, `away`: the match model's average goals for each side |
| `likely_scorelines[]` | The 5 most likely scores, most likely first |

Match probabilities come from the model's best estimate of each team's
strength. The season chances (`teams[]`) also allow for uncertainty in those
strengths, which is why they are a little less extreme than repeating each
match's probabilities would suggest.

## Guarantees

These are checked before any file is written. If one fails, the league's
previous files stay as they were and `index.json` says `kept_previous`.

- Every team name is the project's canonical name.
- `probabilities` add up to 1, and every `finishing_positions` list adds up to 1.
- Each finishing position is filled by exactly one team in every simulated season.
- A zone inside another is never more likely (title is at most top four).
- `expected_points` lies between the points a team has now and the most it can still reach.
- The table agrees with the results, recounted separately.
- The fixture list has the number of matches and teams the league's rules say.

## Versioning

`contract_version` follows `MAJOR.MINOR.PATCH`:

- **PATCH** (1.0.x): wording in this document only; files unchanged.
- **MINOR** (1.x.0): new fields added. Existing fields keep their name and meaning, so a website written for 1.0 keeps working.
- **MAJOR** (x.0.0): a field removed, renamed or changing meaning. The website must be updated. Snapshots in `history/` keep the version they were written with.

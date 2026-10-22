# The daily update

How the forecasts are refreshed every night, published, locked before kick-off and scored afterwards, and the checks that keep that record trustworthy.

Contents:

- [How the daily update works](#how-the-daily-update-works)

[Back to the README](../README.md)

## How the daily update works

One command runs the whole cycle for all five leagues:

```
python -m tabletalk update                      # fetch, check, refit, simulate, write
python -m tabletalk update --no-refresh         # same, from cached data (no downloads)
python -m tabletalk update --competitions serie_a --n-simulations 1000
```

It needs a free football-data.org API key in the environment variable
`FOOTBALL_DATA_API_KEY` (register at football-data.org). The key is read from
the environment only: never put it in a file in this repository.

For each league, in order:

1. **Fetch** the current season from every source. History comes from the local
   cache, because it does not change: re-downloading 17 seasons every night
   would add minutes and prove nothing.
2. **Load and cross-check.** Current-season results come from football-data.co.uk
   and football-data.org, the fixture list from football-data.org, and
   openfootball is a second opinion. The run stops if a team name does not map,
   or if two sources give different scores for the same match.
3. **Check the fixture list** against the league's rules (teams, matches, home
   and away).
4. **Awarded matches** (results decided off the pitch) never stop the run. The
   model never learns from an awarded score: it uses the score played on the
   pitch when football-data.co.uk has it, and otherwise leaves the match out.
   If the result is not yet in `configs/awarded_results.yaml`, the table uses
   football-data.org's result, the snapshot is marked **provisional**, and the
   run report contains a draft entry. A person checks the league's decision,
   fills in the reason, date and source, and adds it. A draft pasted without
   being filled in is refused.
5. **Refit and simulate**, with a random seed made from the date and the league,
   so the same day's run can be repeated exactly.
6. **Safety checks** on the outputs (listed in [contracts/README.md](../contracts/README.md#guarantees)),
   then a check that the file matches the data contract.

A league is written only if every step passed. A league that failed keeps its
previous files, the other leagues still update, and the command exits with an
error. A full run takes about 1.5 minutes on a laptop.

**What it writes** (`outputs/`, not tracked by git; where it will be published
is decided with the scheduling step):

```
outputs/latest/<league>.json         newest snapshot for each league
outputs/latest/index.json            what the last run did, per league
outputs/latest/run_report.md         the same, for a person
outputs/history/<time>/...           every run, kept unchanged
outputs/track_record/locks.jsonl     locked predictions (see below)
outputs/track_record/summary.json    the live track record
outputs/state/run_state.json         working file: is today done? (not part of the contract)
outputs/state/results_seen.json      working file: when each result first appeared, per source
outputs/state/known_results.json     working file: every final score a source has given (see below)
outputs/state/raw_manifest.sha256    working file: the record of past-season downloads (see below)
```

The format is the **data contract**: [contracts/README.md](../contracts/README.md)
explains every field, and [contracts/snapshot.schema.json](../contracts/snapshot.schema.json)
is the machine-checkable version. The website is built against the contract,
not against the Python code.

**If a run fails:** read `outputs/latest/run_report.md` (or the command's
output). It names the league and every problem found. Nothing needs undoing:
the league's previous files are untouched.

- *Unmapped team name*: add the name to `configs/team_aliases.yaml`, and check
  it with `python -m tabletalk data check -c <league>`.
- *Sources disagree about a score*: look up the real result, then wait for the
  wrong source to be corrected. Don't override it.
- *Fixture list does not match the config*: usually a source mid-update; run
  again later. If it persists, compare the sources with
  `python -m tabletalk data compare-fixtures -c <league>`.
- *A safety check on the outputs*: this is a bug, not bad data. Don't publish
  around it.
- *"Results may be late"* (a warning, not a failure: the files are still
  written, but the run is marked failed so you are told). A match that kicked
  off more than 2 days ago (`--stale-after-days`) still has no result and was
  not postponed. It is judged from the fixture list, so an international
  break never triggers it. Usually the source is slow; if it lasts, check the
  match was really played and compare the sources. A match whose final score
  is already in the run's results data is never "late", whatever the fixture
  source says.
- *"Fixture source behind"* (a notice, not a failure). The fixture source
  (football-data.org) lists a match from more than 2 days ago as not
  finished, but the run's results data has its final score, so it is
  counted. football-data.org has been seen to flip finished matches back to
  TIMED for a while (October 2026). Nothing to do unless it lasts for days.
- *"Results not in yet"* (not a failure, except on the day's last try). A match
  that kicked off at least 3 hours before the run has no final score in the
  data the run used, so that day's predictions do not include it. The run
  still publishes; the next scheduled try runs the update again. See
  [when a day is done](#the-nightly-schedule-github-actions).
- *Lock log hash chain broken*: someone or something edited
  `track_record/locks.jsonl`. Restore it from its published copy; never "fix"
  a line by hand.

Then run `python -m tabletalk update` again.

### The nightly schedule (GitHub Actions)

[.github/workflows/daily-update.yml](../.github/workflows/daily-update.yml) tries
to run the update four times a day: at **01:37, 03:37, 05:37 and 07:37 UTC**.
The first try GitHub actually starts does the update. The others check whether
the day (by the UTC date) is already **done**, and if so stop within seconds.
You can also start it by hand (Actions tab, "Daily update", "Run workflow"); a
manual run skips too, unless **force** is ticked.

**When a day is done.** Every league updated, *and* its results were complete:
no match that kicked off at least **3 hours** before the run (about two hours
of football plus an hour for a late start; a match with no time set counts
from the end of its day) is missing its final score in the data the run
actually used. A match the source calls finished but whose score is not in
that data still counts as missing; a postponed, suspended or cancelled match
does not. If a league failed or results were missing, the run still publishes
what it has, lists the missing matches in the run report and the snapshot's
`notices`, and the next try runs the whole update again. This came out of the
trial: on 12 Oct 2026 football-data.org still had no result for Sunday's
Premier League and Bundesliga matches at 07:57 UTC, so Monday's predictions
were made without them, and the later tries skipped.

- **Re-running all five leagues** (simpler than re-running only some, and no
  change to the data contract) means a league whose results were already
  complete gets the same numbers again, with a newer `predicted_at`. The seed
  depends only on the date and the league, so the same data gives exactly the
  same predictions. Each publishing try adds its own `history/` folder.
- **The last try** (07:37, set once as `LAST_TRY_SCHEDULE` in the workflow)
  passes `--last-try`. If results are still missing then, it publishes, warns
  in the run report and fails the job, so you get an email. Two known cases:
  GitHub can start tries out of order, so the 07:37 try may run before the
  05:37 one and send a false alarm (the 05:37 try then still runs, because the
  day is not done, and can complete it); and if GitHub drops the 07:37 try,
  there is no email that day (the run report says what is missing, and the
  2-day "results may be late" check fails the run if the gap lasts).
- **Where "done" is kept:** `state/run_state.json` on the `data` branch, a
  working file outside the data contract. It fails safe: missing, unreadable,
  from another day, or not mentioning a league all mean "not done", and the
  update runs again.
- **Two more checks in the run report.** *Results first seen:* for each new
  result, which source had it and the first of our runs to see it
  (`state/results_seen.json`), summarised as hours after kick-off. It is an
  upper bound on the source's delay, since our runs only look a few times a
  day; results already there when the log began are a baseline with no delay.
  *Timing:* a warning when the day's first update publishes less than 60
  minutes before the day's first kick-off. Neither fails the run.
- **A result never disappears once published.** football-data.org sometimes
  lists finished matches as TIMED again, with no score, for hours or days
  (11 Oct 2026 matches on 16-17 Oct; six Serie A matches on 20 Oct), while
  football-data.co.uk is still 1-4 days behind. Those matches then looked
  unplayed: the table dropped them, the simulation played them again and the
  track record stopped scoring their locks (13 Serie A locks on 20 Oct, for
  about two hours). So every final score is remembered in
  `state/known_results.json` and put back while no source gives it; the
  snapshot says so ("Results kept from earlier runs"). A source that has a
  score always wins: a different score there replaces the remembered one, and
  a match now listed as postponed, suspended, cancelled or awarded is no longer
  counted. Both are a "Score changed" / "Result withdrawn" warning, which fails
  the run so a person is told. Losing the file is safe: the run then works from
  the sources alone, as before.

**Why four tries, so early.** A prediction is locked from the last run that
finished before kick-off, and the earliest kick-off in the five leagues is
10:30 UTC (Serie A on Sunday lunchtime; 11:30 UTC after the clocks change in
late October). GitHub starts scheduled runs late when it is busy, promises no
limit, and can drop runs altogether. In the first days the original schedule
(04:37, backup 07:37) started **6 to 7 hours late**: 10:42 and 11:08 UTC for
the main run, after 10:30 kick-offs, so those matches would have been locked
with the previous day's prediction (still valid, but a day older and without
the previous day's results). Starting at 01:37 means that even 6-7 hours late,
the first try publishes by about 08:40; if GitHub drops it, the next try has
another chance. 01:37 is about three hours after the last evening matches end
(around 22:45 UTC), so the previous night's results should already be in. If
GitHub ever ran 01:37 on time before a result was available, that day's
predictions would miss it and the next day's run would pick it up. The times
are off the hour because GitHub is busiest at the start of each hour. None of
this changes the locking rules: a lock is still the last prediction written
before kick-off.

**Where the files live: the `data` branch.** Each run checks out the `data`
branch, runs the update on it (so the lock store carries on from last night),
and commits the result there as `github-actions[bot]`. The workflow never
writes to `main`. Each commit on `data` is one nightly run and links to the
Actions run that made it. The branch is protected against force-pushes and
deletion, so its public history cannot be quietly rewritten. That makes it
strong evidence of when every prediction was published, and so that locks came
before kick-off. It is not proof: it rests on GitHub's records and on the
protection staying on.

The website reads the files straight from that branch, e.g.

```
https://raw.githubusercontent.com/umarjaved204/TableTalk/data/latest/index.json
https://cdn.jsdelivr.net/gh/umarjaved204/TableTalk@data/latest/index.json   (CDN; may lag by hours)
```

**Set-up (once):** add the API key as a repository secret named
`FOOTBALL_DATA_API_KEY` (Settings, Secrets and variables, Actions, New
repository secret). Create the `data` branch once by hand (the workflow
refuses to start without it). Then protect `data`: Settings, Rules, Rulesets,
a branch ruleset (here `protect-data`) targeting `data`, with only **Restrict
deletions** and **Block force pushes** ticked and an empty bypass list. Normal
pushes, which add a commit on top, still work, so the bot is not blocked.

**Two jobs: the one with the key cannot push.** The workflow has no
permissions by default, and each job gets only what it needs:
- *update* (`contents: read`) has the API key, installs the locked libraries
  and runs the model. It commits the new outputs locally and hands over just
  that one commit (a git bundle, kept 7 days as a run artifact) together with
  the `data` commit it started from. Its checkout keeps no credentials.
- *publish* (`contents: write`) never sees the key and runs no project code,
  only [scripts/check_publish.sh](../scripts/check_publish.sh) and git. It pushes
  only if the commit sits directly on that starting point (and the branch has
  not moved since), touches only `latest/`, `history/`, `track_record/`,
  `state/` and `README.md`, deletes nothing, only adds to `history/`, keeps
  the old lock log as an exact prefix of the new one, and keeps every line of
  the raw-download record. It cannot tell an honest new lock line from a
  made-up one: that would need the locks to be checked or signed at push time
  (hardening item F-06, not built).
- *site*, after a successful publish, calls
  [.github/workflows/site.yml](../.github/workflows/site.yml): *build-site*
  (`contents: read`, no secrets) checks and builds the website from the
  `data` commit just pushed, and *deploy* (no repository permissions; the
  Cloudflare token lives only in the `production` environment) uploads it.
  Until that token exists the deploy skips with a notice and the run still
  passes. Details in [web/DEPLOYMENT.md](../web/DEPLOYMENT.md).

Every action is pinned to a full commit SHA, with the version in a comment,
and values from the event reach the shell only through `env:`.
[.github/dependabot.yml](../.github/dependabot.yml) opens a weekly pull request
per ecosystem (actions, the Python lock, the website's npm packages); nothing
changes until one is merged.

**The raw-download cache is checked before it is trusted.** Past seasons'
downloads are kept in a GitHub Actions cache between runs. Anything able to
write to that cache could change an old result, so `state/raw_manifest.sha256`
on the `data` branch records every past-season file's sha256 as first
downloaded. Before each update (`python -m tabletalk raw-cache prepare`), a
cached file is kept only if it matches its record; everything else is deleted
and downloaded again (with no record yet, the whole cache goes, so the first
record comes from a fresh download). After the update (`raw-cache record`),
new past-season files are added. A recorded line is never changed (the
publish checks refuse it): if a source rewrites an old season, the run fails
with a "raw-download record" problem and a person decides.

**Exact library versions.** The run installs from
[requirements-lock.txt](../requirements-lock.txt): every library at one exact
version with its hashes, for Linux and Python 3.13 (what the runner uses), so
a new or tampered release on PyPI cannot change the numbers or run code in the
job. It is compiled by pip-tools from
[requirements-lock.in](../requirements-lock.in), which lists the same libraries
as `dependencies` in `pyproject.toml` (a test fails if the two differ). The
names follow what Dependabot needs to recognise a pip-tools lock (a `.in` file
and a `.txt` lock), so its weekly pull requests can move the versions on; each
one changes nothing until it is merged. `requirements.txt` stays as the loose
list for working on your own machine. To regenerate the lock by hand, on Linux
(e.g. WSL) with Python 3.13 and pip-tools:

```
pip-compile --allow-unsafe --generate-hashes --newline=LF --output-file=requirements-lock.txt --strip-extras requirements-lock.in
```

Without `--upgrade` it keeps the versions already in the lock and only adds
or removes what changed; `--upgrade-package <name>` moves one library on.

**When a run fails:**
- *How you are told:* GitHub emails whoever last changed the `cron` lines in
  the workflow file. The run's summary page shows the run report.
- *What counts as a failure:* any league failing its checks, "results may be
  late", results still missing on the day's last try, a locking problem, a
  changed old file in the raw-download record, or the publish checks refusing
  the commit (the publish job's log says which check). Whatever passed is
  still published first, and a failed league keeps its previous files. A
  refused commit publishes nothing that run; the next try starts again from
  the branch as it is.
- *What to do:* fix the cause as described above, then start the workflow by
  hand with **force** ticked. Never switch off the `data` branch's protection
  to rewrite it: its history is the evidence of timing.

**GitHub limits that matter** (checked 2026-09-29):
- The repository is public, so Actions minutes are free (a private repository
  would get 2,000 minutes a month; a run takes a few minutes).
- Scheduled runs can be delayed or dropped at busy times, with no promised
  limit (6-7 hours seen on 30 Sep and 1 Oct 2026). That is what the four
  early tries are for. A manual run (`workflow_dispatch`) starts within
  seconds.
- When several late runs arrive together, GitHub keeps only the newest one
  that is waiting (the workflow allows one run at a time); every scheduled try
  follows the same skip rule, so losing a waiting one changes nothing.
- **Scheduled runs stop after 60 days without activity.** In a public
  repository, GitHub switches off scheduled workflows when the repository has
  had no activity for 60 days. GitHub does not say exactly what counts, so do
  not rely on the bot's nightly commits to `data`; a commit to `main` is the
  safe way to keep the repository active. The summer break is the likely time.
  To check:
  `gh workflow list --all` shows `Daily update` as `disabled_inactivity`. To
  re-enable: Actions tab, **Daily update** in the list on the left, **Enable
  workflow** (or `gh workflow enable daily-update.yml`). Then start one run by
  hand, since the missed nights are not made up.
- A job can run for at most 6 hours; this one takes a few minutes. The cache of
  past seasons' raw files is about 24 MB, well under the 10 GB limit.

### Locking predictions before kick-off

A forecast is only worth checking if it was made before the match. So every
run's predictions go through one rule, and the result is a log that is only
ever added to.

- **The lock is the last prediction made before kick-off.** Each run replaces
  a match's pending prediction with its newest one, until the match starts.
  At the first run after that, the pending prediction becomes the match's lock.
- **Moved earlier?** The lock is whatever the last run before the *new*
  kick-off produced. If no run predicted it in time, the match is recorded as
  **missed**. Nothing is ever back-dated.
- **Postponed?** The lock is kept and marked **void**. Once the match has a new
  date, it gets a new lock before the new kick-off. Both stay in the log; only
  the second is scored. Suspended and cancelled matches are voided the same way.
  Every postponed, suspended or cancelled match is listed in the run report and
  in the snapshot's `notices`, and voided locks in the run report.
- **Assumption: a cancelled match is still simulated** as a match to be played,
  because cancelled matches are almost always replayed. If one is scrapped or
  awarded instead, it goes into `configs/awarded_results.yaml` like any other
  awarded result.
- **Several tries in one day?** Each publishing try refreshes the waiting
  predictions of matches that have not kicked off yet, so the lock is still the
  newest prediction made before kick-off. A match that kicked off between two
  tries keeps the earlier try's prediction, even if the source is slow to say
  it has started.
- **Checked against the real kick-off.** Whether a lock came first is checked
  against the kick-off time reported once the match has started, not the one we
  saw when predicting. A lock that turns out to be from after kick-off is marked
  **invalid** and never scored. "Made" means when the prediction was written to
  disk, the strictest reading.
- **Every lock records the model version**: the code commit and a fingerprint
  of the configs. A later model change never rewrites the past.
- **Edits to the log show.** Each line carries a fingerprint (sha256) of the
  line before it, so changing or deleting any old line breaks the chain, and
  the pipeline stops. The chain shows the log was not edited; it does not show
  when lines were written. For timing, the evidence is the protected public
  history of the `data` branch, where every night's copy of the log is kept:
  strong evidence, not proof.

**Honesty rule.** Matches played before the pipeline first ran cannot have
genuine locks, so they have none, and they never count as missed. Backtests
(which predict past matches using only earlier data) are reported separately in
this README and are never mixed into the live track record.

### The live track record

```
python -m tabletalk track-record              # score locks that have results
python -m tabletalk track-record --refresh    # download the latest results and odds first
```

The nightly `update` also runs it. It scores every valid lock that has a result
against two alternatives, on the same matches:

- **base rates**: the league's historical home/draw/away frequencies, i.e.
  knowing nothing about the teams;
- **the market**: closing odds from football-data.co.uk with the margin
  removed. They reach those files a few days after each match, so this
  comparison trails by a few days.

It also shows calibration: when the model says 60%, does it happen about 60% of
the time? Results follow the project's wording rule: a difference is quoted as
mean difference ± 95% interval. If the interval includes zero it is "no
detectable difference", and if it holds in only one half of the matches it is
"consistently better but modest". It is never "beats".

**Early on, expect wide intervals.** The backtest found a gap of about 0.08 in
log loss against base rates and 0.02 against the market, and one match's
result swings log loss by far more than that. So a small live sample cannot
detect those gaps. The report works out, from the live matches' own spread,
roughly how many matches each comparison needs. "No detectable difference" in
October means "not enough matches yet", not "no better".

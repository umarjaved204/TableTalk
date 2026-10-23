# Runbook

How TableTalk runs every night and how the website is deployed: what each
run does, what to do when something fails, the one-time set-up, and the
routine tasks. Dated history is in [CHANGELOG.md](../CHANGELOG.md).

Contents:

- [The daily update](#the-daily-update)
- [The nightly schedule](#the-nightly-schedule)
- [Locking predictions before kick-off](#locking-predictions-before-kick-off)
- [The live track record](#the-live-track-record)
- [Deploying the website](#deploying-the-website)
- [Response headers](#response-headers)
- [The go-live check](#the-go-live-check)
- [When something fails](#when-something-fails)
- [One-time set-up](#one-time-set-up)
- [Routine tasks](#routine-tasks)
- [Visitor numbers without tracking](#visitor-numbers-without-tracking)
- [Share images](#share-images)

[Back to the README](../README.md)

## The daily update

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

1. **Fetch** the current season from the results and fixture sources. History
   comes from the local cache, because it does not change: re-downloading 17
   seasons every night would add minutes and prove nothing.
2. **Load and cross-check.** Current-season results come from football-data.co.uk
   and football-data.org, and the fixture list from football-data.org. The run
   stops if a team name does not map, or if the two sources give different
   scores for the same match.
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

**What the nightly run loads.** Each league's config lists four kinds of
source (`role`); the nightly update loads two (`nightly_roles` in
`src/tabletalk/pipeline/update.py`), and each snapshot's `sources` lists only
what that run loaded:

| Role | Source | Nightly? |
|---|---|---|
| `results` | football-data.co.uk and football-data.org | yes |
| `fixtures` | football-data.org | yes |
| `check` | openfootball, a third opinion on scores | no: the two results sources must already agree, and a failed download would fail the league |
| `context` | second-tier results (Championship and so on) | only for the `second_tier` promoted-team strategy; every league uses `prior`, which never reads them |

Both are still used by `python -m tabletalk data check` and the backtests.

**What it writes** (`outputs/` locally, not tracked by git; the nightly run
publishes it on the `data` branch):

```
outputs/latest/<league>.json         newest snapshot for each league
outputs/latest/index.json            what the last run did, per league
outputs/latest/run_report.md         the same, for a person
outputs/history/<time>/...           every run, kept unchanged
outputs/track_record/locks.jsonl     locked predictions (see below)
outputs/track_record/summary.json    the live track record
outputs/state/run_state.json         working file: is today done? (not part of the contract)
outputs/state/known_results.json     working file: every final score a source has given
outputs/state/raw_manifest.sha256    working file: the record of past-season downloads
outputs/state/results_seen.json      frozen since 23 Oct 2026: no longer written
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
- *"Fixture source behind"* (a notice, not a failure). football-data.org lists
  a match from more than 2 days ago as not finished, but the run's results
  data has its final score, so it is counted. Nothing to do unless it lasts
  for days.
- *"Results not in yet"* (not a failure, except on the day's last try). A match
  that kicked off at least 3 hours before the run has no final score in the
  data the run used, so that day's predictions do not include it. The run
  still publishes; the next scheduled try runs the update again (see
  [when a day is done](#the-nightly-schedule)).
- *"Score changed" / "Result withdrawn"* (warnings that fail the run): a
  remembered result (below) was replaced by a source or withdrawn. Check the
  match.
- *Lock log hash chain broken*: someone or something edited
  `track_record/locks.jsonl`. Restore it from its published copy; never "fix"
  a line by hand.

Then run `python -m tabletalk update` again.

## The nightly schedule

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
`notices`, and the next try runs the whole update again.

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
- **Timing warning** in the run report when the day's first update publishes
  less than 60 minutes before the day's first kick-off. It does not fail the
  run.
- **A result never disappears once published.** football-data.org sometimes
  lists finished matches as TIMED again, with no score, for hours or days,
  while football-data.co.uk is still 1-4 days behind. Those matches would then
  look unplayed: the table would drop them, the simulation would play them
  again and the track record would stop scoring their locks. So every final
  score is remembered in `state/known_results.json` and put back while no
  source gives it; the snapshot says so ("Results kept from earlier runs"). A
  source that has a score always wins: a different score there replaces the
  remembered one, and a match now listed as postponed, suspended, cancelled or
  awarded is no longer counted. Both are a warning that fails the run. Losing
  the file is safe: the run then works from the sources alone.

**Why four tries, so early.** A prediction is locked from the last run that
finished before kick-off, and the earliest kick-off in the five leagues is
10:30 UTC (Serie A on Sunday lunchtime; 11:30 UTC in winter). GitHub starts
scheduled runs late when it is busy (4.5 to 7 hours has been seen), promises
no limit, and can drop runs altogether. Starting at 01:37 means that even 6-7
hours late, the first try publishes by about 08:40; if GitHub drops it, the
next try has another chance. 01:37 is about three hours after the last evening
matches end (around 22:45 UTC), so the previous night's results should
already be in; a result that arrives later is picked up by a later try or the
next day. The times are off the hour because GitHub is busiest at the start of
each hour. None of this changes the locking rules: a lock is still the last
prediction written before kick-off.

**Where the files live: the `data` branch.** Each run checks out the `data`
branch, runs the update on it (so the lock store carries on from last night),
and commits the result there as `github-actions[bot]`. The workflow never
writes to `main`. Each commit on `data` is one run and links to the Actions
run that made it. The branch is protected against force-pushes and deletion,
so its public history cannot be quietly rewritten. That makes it strong
evidence of when every prediction was published, and so that locks came
before kick-off. It is not proof: it rests on GitHub's records and on the
protection staying on.

The files can be read straight from that branch, e.g.

```
https://raw.githubusercontent.com/umarjaved204/TableTalk/data/latest/index.json
https://cdn.jsdelivr.net/gh/umarjaved204/TableTalk@data/latest/index.json   (CDN; may lag by hours)
```

**Three jobs; the one with the key cannot push.** The workflow has no
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
  (not built).
- *site*, after a successful publish, builds and deploys the website with the
  `data` commit just pushed ([Deploying the website](#deploying-the-website)).

Every action is pinned to a full commit SHA, with the version in a comment,
and values from the event reach the shell only through `env:`.
[.github/dependabot.yml](../.github/dependabot.yml) opens a weekly pull request
per ecosystem (actions, the Python lock, the website's and the deploy tool's
npm packages), after a 14-day cooldown for version updates; nothing changes
until one is merged.

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
names follow what Dependabot needs to recognise a pip-tools lock. On your own
machine, `pip install -e ".[dev]"` installs the loose versions from
`pyproject.toml` (plus pytest and Jupyter). To regenerate the lock by hand, on
Linux (e.g. WSL) with Python 3.13 and pip-tools:

```
pip-compile --allow-unsafe --generate-hashes --newline=LF --output-file=requirements-lock.txt --strip-extras requirements-lock.in
```

Without `--upgrade` it keeps the versions already in the lock and only adds
or removes what changed; `--upgrade-package <name>` moves one library on.

**GitHub limits that matter:**

- The repository is public, so Actions minutes are free.
- Scheduled runs can be delayed or dropped at busy times, with no promised
  limit. That is what the four early tries are for. A manual run
  (`workflow_dispatch`) starts within seconds.
- When several late runs arrive together, GitHub keeps only the newest one
  that is waiting (the workflow allows one run at a time); every scheduled try
  follows the same skip rule, so losing a waiting one changes nothing.
- **Scheduled runs stop after 60 days without activity** (see
  [Routine tasks](#routine-tasks)).
- A job can run for at most 6 hours; this one takes a few minutes. The cache of
  past seasons' raw files is about 24 MB, well under the 10 GB limit.

## Locking predictions before kick-off

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
- **Every lock records the model version**: the code commit, a fingerprint of
  the configs (`config_hash`) and of everything that can change the numbers
  (`pipeline_hash`). A later model change never rewrites the past.
- **Edits to the log show.** Each line carries a fingerprint (sha256) of the
  line before it, so changing or deleting any old line breaks the chain, and
  the pipeline stops. The chain shows the log was not edited; it does not show
  when lines were written. For timing, the evidence is the protected public
  history of the `data` branch, where every night's copy of the log is kept:
  strong evidence, not proof.

**Honesty rule.** Matches played before the pipeline first ran cannot have
genuine locks, so they have none, and they never count as missed. Backtests
(which predict past matches using only earlier data) are reported separately
and are never mixed into the live track record.

## The live track record

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
roughly how many matches each comparison needs. "No detectable difference"
early in the season means "not enough matches yet", not "no better".

## Deploying the website

The site is plain files, served by a Cloudflare Worker with **no Worker code**
(static assets only) at **https://tabletalk.fyi**. Cloudflare rather than
GitHub Pages, because Pages can't send response headers (`frame-ancestors`,
HSTS, cache rules), and Cloudflare also hosts the domain.

```
daily-update.yml (nightly)              deploy-site.yml (push to main
  update   -> publish (pushes data)       touching web/, deploy/ or the
                 |                        site workflows; by hand; or
                 v                        started by redeploy below)
      site.yml (reusable), with the data          |
      commit publish just pushed                  v
                 |                        site.yml, with the tip of data
  build-site  contents: read, no secrets
              checkout the TIP OF MAIN, npm ci, copy the data commit
              into web/.data, npm run verify (astro check, lint, unit
              tests, build with SITE_URL=https://tabletalk.fyi, build
              check), upload dist/; outputs the main and data commits
                 |
  deploy      no repository permissions; environment "production"
              (main only); concurrency group "site-deploy"
              token missing?          -> notice, stop, job passes
              main or data moved on?  -> notice, stop, stale=true
              fetch deploy/ at the built commit (no credentials),
              npm ci --ignore-scripts (Wrangler, exact version),
              download dist/, wrangler deploy,
              wait until the live home page is the built one (max 3 min),
              bash deploy/check-live.sh https://tabletalk.fyi (up to 4 tries,
              30 s apart)
                 |
  redeploy    only if stale; actions: write, no secrets
              gh workflow run deploy-site.yml --ref main
```

- **Why the deploy is inside the nightly workflow:** a push made with the
  workflow's own token does not start other workflows, so an "on push to
  `data`" workflow would never run.
- **Why the build job and the deploy job are separate:** the build runs the
  website's code and about 680 npm packages; the token never reaches that
  job. The deploy job runs no website code and no install scripts; its only
  third-party code is Wrangler, at the version in `deploy/package-lock.json`
  (checked against its hashes).
- **Why `npm run verify`, not just a build:** a website commit that fails its
  type check, lint or unit tests never goes live. The browser suite is not
  run here (it needs browsers and takes minutes); run it before merging.
- **No `cloudflare/wrangler-action`:** the repository allows GitHub-owned
  actions only. Wrangler runs from its own lockfile instead.
- **No checkout in the deploy job:** it has no repository permissions, so it
  fetches `deploy/` from the public repository with plain `git`, the way
  `scripts/check_publish.sh` fetches the `data` branch.
- **The token is passed by name:** a reusable workflow sees only the secrets
  its caller passes, even a secret kept in the environment its job names.
  Both callers pass `CLOUDFLARE_API_TOKEN` (and nothing else; never
  `secrets: inherit`, which would also pass the football-data.org key), and
  the deploy job gets the `production` value. Without it the deploy sees an
  empty token and skips with a green run; a test checks it.

**Never older files over newer ones:**

1. **Always the tip of main.** A nightly run can start hours late, so the
   commit it started on can be older than `main` by the time it builds.
   `build-site` therefore checks out the tip of `main`, not the run's own
   commit.
2. **Out of date means skip.** Just before deploying, the deploy job reads
   the tips of `main` and `data` (`git ls-remote`, no credentials). If
   either is not what was built, it doesn't deploy: something newer exists.
3. **A skip asks for a redeploy.** GitHub keeps **one** waiting job per
   concurrency group; a newer one replaces it (that run then shows as
   cancelled). So a skipped deploy can't assume the newer commit's own
   deploy is still coming. The `redeploy` job (permission `actions: write`
   only, no secrets) starts "Deploy site" on `main`, which builds and
   deploys the tips. (A `workflow_dispatch` made with the workflow's own
   token does start a run: it is one of GitHub's stated exceptions.)

What remains: a deploy that has already passed the out-of-date check can
still finish a minute after a newer commit lands; that newer commit's own
deploy then waits its turn and follows. And a nightly run whose deploy was
replaced in the queue ends as "cancelled", not "success" (its data was
published; only the deploy was handed over to the newer run).

**The files:**

| File                                | What it is                                                                                               |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `.github/workflows/site.yml`        | The reusable workflow: `build-site`, `deploy` and `redeploy`. `SITE_URL` is set here.                    |
| `.github/workflows/deploy-site.yml` | Calls `site.yml` on a push to `main` touching the site, or by hand.                                      |
| `deploy/wrangler.jsonc`             | Every hosting setting, reviewed as code: static assets only, 404 page, `workers_dev`, the custom domain. |
| `deploy/package.json` + lockfile    | Wrangler at one exact version, nothing else. Dependabot proposes updates.                                |
| `deploy/check-live.sh`              | The go-live check: the last step of every deploy, and by hand against any address.                       |
| `web/public/_headers`               | The response headers. Astro copies it into `dist/`; Cloudflare reads it and doesn't serve it.            |
| `web/scripts/check-build.mjs`       | Fails the build if `_headers` is missing or loses a line, or any file would get a wrong header.          |

Nothing about hosting is set by hand in the Cloudflare dashboard, apart from
the account and zone settings in the set-up list below.

## Response headers

`web/public/_headers` has three rules. Cloudflare applies **every** rule that
matches a path, and when two rules set the same header it sends both values
joined with a comma; `! Name` in a rule removes what earlier rules set.

**`/*` (every response, including the 404 page):**

| Header                         | Value                                                                              | Why                                                                                                                                                                            |
| ------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Content-Security-Policy`      | `frame-ancestors 'none'`                                                           | Stops other sites framing this one; only works as a header. The full policy stays in each page's `<meta>` tag (both apply), because its script hashes change with every build. |
| `X-Frame-Options`              | `DENY`                                                                             | The same, for older browsers.                                                                                                                                                  |
| `X-Content-Type-Options`       | `nosniff`                                                                          | Browsers use the declared file type instead of guessing.                                                                                                                       |
| `Referrer-Policy`              | `strict-origin-when-cross-origin`                                                  | Links to other sites send only the domain, never the page address (also the browsers' default).                                                                                |
| `Permissions-Policy`           | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()` | The site uses none of these, so nothing on it can ask for them.                                                                                                                |
| `Cross-Origin-Opener-Policy`   | `same-origin`                                                                      | A page this site opens (or that opens it) can't reach into its window.                                                                                                         |
| `Cross-Origin-Resource-Policy` | `same-origin`                                                                      | Other sites can't load this site's files into their pages.                                                                                                                     |
| `Strict-Transport-Security`    | `max-age=86400` now; `max-age=31536000` once HTTPS on the domain is stable         | Browsers refuse plain HTTP for the domain. No `includeSubDomains` or `preload` (hard to undo). The build check accepts these two values only.                                  |
| `Cache-Control`                | `no-cache`                                                                         | Browsers may keep a copy but must check it first (cheap, with the ETag), because the data changes every night. No `no-transform` (see below).                                  |

**`/_astro/*` (Astro's CSS, JavaScript and fonts):** `! Cache-Control`, then
`Cache-Control: public, max-age=31536000, immutable`. Their names contain a
hash of their content, so a changed file has a new name and an old one never
needs checking. Without the `!` line these files would get both values
joined (`no-cache, public, max-age=31536000, immutable`).

**`/share/*` (the share images):** `! Cross-Origin-Resource-Policy`, then
`Cross-Origin-Resource-Policy: cross-origin`. These are the pictures chat and
social apps show for a link, so other sites must be allowed to load them.
Every other file stays `same-origin`; the build check and the go-live check
both check this.

Files outside `/_astro/` that aren't pages (icons, `manifest.webmanifest`,
`robots.txt`, `sitemap.xml`) get the `/*` value too: their names don't change
when their content does, so they must be checked as well.

**Not sent: `Report-To` and `Nel`.** Cloudflare adds these itself ("Network
Error Logging"): after a failed load, Chromium browsers would send a short
report to `a.nel.cloudflare.com`, a request to another server, which the
About page says never happens. `! Report-To` and `! Nel` in `_headers` don't
remove them, because Cloudflare adds them after `_headers` is applied. So
Network Error Logging is switched off in the zone's settings (set-up step 6),
and the go-live check fails if they come back. If the zone setting ever stops
working, the About page's wording must change.

**No `no-transform`.** It would stop Cloudflare changing the pages, but
Cloudflare also honours it by not compressing (the Premier League page would
be sent at 232 KB instead of about 26 KB). Injection is covered without it:
Web Analytics is off (set-up step 6), the go-live check fails on its beacon,
the deploy's wait step compares the live home page with the built one byte
for byte, and each page's Content Security Policy would block an injected
script. The go-live check also fails if a page isn't compressed.

**Checked twice:** `web/scripts/check-build.mjs` (part of every build) works
out the headers each built file and the 404 page will get, the way Cloudflare
combines the rules, and fails on a missing line, a header sent twice or a
wrong value. `deploy/check-live.sh` checks the real responses.

## The go-live check

```sh
bash deploy/check-live.sh https://tabletalk.fyi
```

It asks for the home page, a team page (the first one linked from the
Premier League page), a page that doesn't exist, the home page's first
`/_astro/` stylesheet and the first font in its stylesheets, and checks, for
each:

1. the status (404 for the missing page, 200 for the rest);
2. every security header in the table above, **exactly once**, with the
   planned value (`Strict-Transport-Security` may be either value);
3. **exactly one** `Cache-Control`: `no-cache` for the three pages,
   `public, max-age=31536000, immutable` for the stylesheet and the font;
4. **no `Set-Cookie`** (the footer promises no cookies), and **no
   `Report-To` or `Nel`**;
5. for the pages, **no `cloudflareinsights`** in the HTML (Cloudflare's
   injected Web Analytics beacon), and the page **compressed** (gzip or
   Brotli) when asked for as a browser asks.

It also asks for the site's share image (`/share/tabletalk.png`): status 200,
`image/png`, and `Cross-Origin-Resource-Policy: cross-origin`. It prints a
line per check and exits 1 if any failed.

**After every deploy** the deploy job runs it against `SITE_URL` as its last
step, with curl only and no secrets. It first waits, for up to three minutes,
until the live home page is byte for byte the `index.html` just built
(Cloudflare changes nothing in the HTML), so it checks the new version, not
the old one. A deploy that changes only headers leaves the home page as it
was, so that wait ends at once while some requests may still get the old
version; so a failed check is tried again, 30 seconds apart, up to 4 times. A
check that fails all 4 times, or a home page that never updates, fails the job
and GitHub emails you; the new site stays up, so look at the failed lines and
fix forward or roll back (below).

The browser tests are written for the test data, so they are not run against
the live site (many of their checks would fail on real data). The live site's
speed and page sizes are measured by the monthly Lighthouse check
([Routine tasks](#routine-tasks)).

## When something fails

**How you are told:** GitHub emails whoever last changed the `cron` lines in
the daily-update workflow file (and, for "Deploy site", whoever started it).
The run's summary page shows the run report.

| What fails                                                                                                | What visitors see                                                                               |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| One league's update                                                                                       | The site is rebuilt; that league shows its previous numbers with "last night's update failed"   |
| A warning ("results may be late", results missing on the last try, "score changed", "result withdrawn")   | Everything is published; the run fails so you are told                                          |
| The whole update, locking, the raw-download record, or the publish checks refusing the commit            | No build or deploy; yesterday's site stays up; after 30 hours each page shows the stale warning |
| `npm run verify` (types, lint, unit tests, build check)                                                   | Nothing is deployed; the previous site stays up; the run fails                                  |
| The deploy finds `main` or `data` moved on since its build                                                | Not deployed (the job passes, with a notice); "Deploy site" is started to deploy the tips       |
| The deploy itself (token, Cloudflare, network)                                                            | The previous site stays up; the run fails; re-run the deploy job once the cause is fixed        |
| The go-live check after a deploy (4 tries in a row)                                                       | The new site is up; the run fails; the log shows each failed check                              |

Whatever passed is still published first, and a failed league keeps its
previous files. A refused commit publishes nothing that run; the next try
starts again from the branch as it is.

**What to do:** fix the cause as described in [the daily update](#the-daily-update),
then start the workflow by hand with **force** ticked. Never switch off the
`data` branch's protection to rewrite it: its history is the evidence of
timing.

**Rolling back the site:** revert the bad commit on `main` (Deploy site then
redeploys), or re-run an earlier run's deploy job. In an emergency,
Cloudflare's dashboard can roll the Worker back to an earlier version
(Workers & Pages, `tabletalk`, Deployments); the next deploy replaces it.

**Limits (Cloudflare free plan):** requests for static assets are free and
unlimited; up to 20,000 files per version and 25 MiB per file. The site is a
few hundred files and under 10 MB.

## One-time set-up

Already done for this repository; kept for a fresh copy. Menus change, so
check Cloudflare's and GitHub's docs again.

**The pipeline:**

1. Add the football-data.org key as a repository secret named
   `FOOTBALL_DATA_API_KEY` (Settings, Secrets and variables, Actions, New
   repository secret).
2. Create the `data` branch once by hand (the workflow refuses to start
   without it).
3. Protect `data`: Settings, Rules, Rulesets, a branch ruleset
   (`protect-data`) targeting `data`, with only **Restrict deletions** and
   **Block force pushes** ticked and an empty bypass list. Normal pushes,
   which add a commit on top, still work, so the bot is not blocked.

**The website:**

1. **GitHub environment.** Settings, Environments, New environment,
   `production`. Deployment branches and tags: **Selected branches and
   tags**, add `main`. No reviewers or wait timer. Create it **before** the
   first workflow names it: a workflow that names a missing environment
   creates it with no branch limit.
2. **workers.dev subdomain.** In the Cloudflare dashboard, Workers & Pages:
   if asked, choose the account's `workers.dev` subdomain (once per account).
3. **Account ID.** Copy it from the dashboard (Account home, the account's
   menu, Copy account ID) into the `production` environment as a
   **variable** (not a secret) named `CLOUDFLARE_ACCOUNT_ID`.
4. **The API token.** My Profile, API Tokens, Create Token, **Create Custom
   Token**, named e.g. `tabletalk-deploy-2026-10`:

   | Permission                     | Scope                                                   | Why                                                                                                                                                                   |
   | ------------------------------ | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | Account, Workers Scripts, Edit | Account Resources: Include, this account only           | Uploads the Worker and its static assets and deploys a version. Also what the Workers Domains API asks for to attach a domain (`PUT /accounts/{id}/workers/domains`). |
   | Zone, Workers Routes, Edit     | Zone Resources: Include, Specific zone, `tabletalk.fyi` | Adding, changing or removing a route or **Custom Domain** needs "Workers Routes Write" on each affected zone.                                                         |

   - **Client IP address filtering:** none (GitHub's runners have no fixed
     addresses).
   - **TTL:** an end date about 90 days ahead, with a calendar reminder two
     weeks before it ([Routine tasks](#routine-tasks)).
   - **Not needed:** DNS Edit (a Custom Domain creates its own DNS record and
     certificate), Zone Read, User Details, Account Settings, Pages, KV, R2
     and every other permission.
   - **Wrangler 4.143.1 or later** is needed: before it, deploys of a
     custom-domain-only Worker with `workers_dev` off failed with "No access"
     unless the token could read the zone's routes (workers-sdk issue 15863).

5. **The secret.** Add the token to the `production` environment as the
   secret `CLOUDFLARE_API_TOKEN`. Never in a repository secret, so only the
   deploy job (which names the environment) can read it.
6. **Cloudflare account and zone settings** (not part of the Worker, so not
   in `wrangler.jsonc`):
   - Web Analytics: no site for `tabletalk.fyi`, or the site **Disabled**
     (Observability, Analytics, Web analytics, Manage site). The go-live
     check fails if the beacon appears.
   - **Network Error Logging off** for the `tabletalk.fyi` zone (the zone's
     Network page). On by default for free zones; see
     [Response headers](#response-headers).
   - Security: **Bot Fight Mode off** (it can show challenge pages to real
     visitors and set cookies).
   - Domain Registration: **auto-renew on** for `tabletalk.fyi`.
7. **The domain.** `deploy/wrangler.jsonc` has
   `"routes": [{ "pattern": "tabletalk.fyi", "custom_domain": true }]` and
   `"workers_dev": false`. Cloudflare creates the DNS record and the
   certificate; the zone must have no DNS record for `tabletalk.fyi` before
   the first deploy with the route. After it, run the go-live check, and
   check that the workers.dev address no longer serves the site.
8. **GitHub repository settings** (Settings, Advanced Security, and
   Settings, Rules): secret scanning and push protection on; Dependabot
   alerts and security updates on; private vulnerability reporting on; a
   ruleset `protect-main` targeting `main` only, with **Restrict deletions**
   and **Block force pushes**, no pull-request or status-check requirements
   and an empty bypass list.

## Routine tasks

- **Monthly: the live site's speed and page sizes.**
  `cd web`, then `npm run lighthouse -- --live https://tabletalk.fyi`, and add
  a column to the table in [web/README.md](../web/README.md#monthly-live-check).
- **Every 90 days: replace the Cloudflare token** (two weeks before it
  expires, from the calendar reminder):
  1. Create a new token with **the same permissions and scope** (set-up
     step 4) and a new end date about 90 days ahead.
  2. Settings, Environments, `production`: replace the `CLOUDFLARE_API_TOKEN`
     secret with the new token.
  3. Run Actions, Deploy site, Run workflow, and check the deploy job passed
     (a deploy, not the "no token" notice).
  4. Revoke the old token (My Profile, API Tokens, the old token, Delete).
  5. Move the calendar reminder to two weeks before the new expiry date.

  If the token expires anyway, the deploy job fails, you get GitHub's email,
  and the site stays as it was; then do steps 1 to 4.
- **Keep the repository active (60 days).** GitHub switches off scheduled
  workflows in a public repository after 60 days without activity, and does
  not say exactly what counts, so don't rely on the bot's commits to `data`;
  a commit to `main` is the safe way. The summer break is the likely time. To
  check: `gh workflow list --all` shows `Daily update` as
  `disabled_inactivity`. To re-enable: Actions tab, **Daily update**, **Enable
  workflow** (or `gh workflow enable daily-update.yml`), then start one run by
  hand, since the missed nights are not made up.
- **Weekly: Dependabot pull requests.** Pull requests have no checks of their
  own in this repository, so test one before merging (the website's with
  `npm run verify` and the browser suite; the deploy tool's with
  `npm ci --ignore-scripts` and `wrangler deploy --dry-run` in `deploy/`).
- **Once HTTPS on the domain has been stable for a few weeks:** raise
  `Strict-Transport-Security` to `max-age=31536000` in `web/public/_headers`.
  `www.tabletalk.fyi` isn't set up; if wanted, it would be a second Custom
  Domain plus a redirect.
- **Before announcing the site:** the manual keyboard, NVDA and real-phone
  passes in [web/docs/accessibility-review.md](../web/docs/accessibility-review.md).

## Visitor numbers without tracking

Goal: know roughly how many people visit and how they find the site, without
adding a script, a cookie or a third-party request to any page.

1. **Cloudflare's request counts.** The zone `tabletalk.fyi`, Analytics &
   Logs, Traffic: requests, page views, bandwidth, "unique visitors",
   countries and status codes, kept for at least 30 days. Nothing is added to
   the pages. "Unique visitors" are unique IP addresses, not people, and bots
   are included on the free plan: look at trends, not totals. Cloudflare's
   "Web Analytics" is a different product (a beacon it can inject into
   pages): keep it off. The CSP would block it anyway.
2. **Google Search Console.** Search impressions, clicks, positions and
   queries, measured on Google's side. Add a **Domain property** verified
   with the **TXT record** Search Console gives (in Cloudflare's DNS; not the
   HTML-file or meta-tag methods, which would put Google's token into the
   site), then submit `https://tabletalk.fyi/sitemap.xml`.
3. **What the site says.** Every privacy statement must be exactly true. The
   footer says "No trackers, no cookies, no analytics scripts". The About
   page says Cloudflare sees the normal details of each request, counts
   requests on its own servers, and TableTalk looks only at the anonymous
   totals; nothing on the pages counts you, and nothing is stored in your
   browser for it. (The site does keep the visitor's own theme, table
   settings and favourite team in local storage, said separately with the
   details.) If a `Set-Cookie` ever appears in the go-live check, the footer
   and the About page must change.
4. **Not planned: a cookieless analytics script** (Plausible, Umami,
   GoatCounter). Each adds a third-party request unless self-hosted, needs
   the CSP opened, and makes "no analytics" untrue; the two sources above
   answer "is anyone visiting, and how do they find it?" without any of this.

## Share images

**Fixed images, no numbers**, in the Floodlights look: chat and social apps
keep a link's preview for days or weeks, so an image with that night's
chances would go on showing old numbers. Six 1200 x 630 PNGs in
`web/public/share/`: `tabletalk.png` for the site, and one per league
(`premier-league.png`, ...) used by its league page, matches page and team
pages. `web/src/layouts/Base.astro` names each page's image (`og:image`, with
size and alt text, and `twitter:card` `summary_large_image`), only when
`SITE_URL` is set, since apps need the full address. The words on the images
and their alt text both come from `web/src/data/share.ts`.

They are drawn by `node scripts/make-share-images.mjs` (in `web/`, with
Playwright's Chromium and the site's own fonts) and committed; run it again
only when the design or the list of leagues changes. The build check fails if
a page with a public address names no image, or names one that isn't a
1200 x 630 PNG in the build; a unit test checks there is one image per league.
Apps keep their copy of an image: after changing one, a link already shared
keeps its old preview until the app fetches it again.

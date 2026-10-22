# Deployment: Cloudflare Workers static assets

The site is plain files, served by a Cloudflare Worker with **no Worker code**
(static assets only) at **https://tabletalk.fyi**. Chosen over GitHub Pages
(hardening plan, 15 Oct 2026) because Pages can't send response headers
(`frame-ancestors`, HSTS, cache rules) and Cloudflare now hosts the domain
anyway.

**Status (22 Oct 2026): built, not live.** The workflows, config and checks
are on `main`, but nothing has been deployed: the deploy job skips (with a
notice, and the run still passes) until the Cloudflare token exists. The
one-time setup and the three go-live stages below are still to do.

## Contents

- [What runs](#what-runs)
- [The files](#the-files)
- [Response headers](#response-headers)
- [One-time setup](#one-time-setup)
- [Going live in three stages](#going-live-in-three-stages)
- [The go-live check](#the-go-live-check)
- [Replacing the token before it expires](#replacing-the-token-before-it-expires)
- [When something fails](#when-something-fails)
- [Visitor numbers without tracking](#visitor-numbers-without-tracking)
- [Still to decide](#still-to-decide)

## What runs

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
              download dist/, wrangler deploy
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
  `secrets: inherit`), and the deploy job gets the `production` value. Found
  on 22 Oct 2026: without it the first deploy saw an empty token and skipped
  ("No CLOUDFLARE_API_TOKEN"), with a green run. A test now checks it.

### Never older files over newer ones

Three rules (review of PR #4, 22 Oct 2026):

1. **Always the tip of main.** A nightly run can start hours late and spend
   up to about 40 minutes on the update, so the commit it started on can be
   older than `main` by the time it builds. `build-site` therefore checks
   out the tip of `main`, not the run's own commit.
2. **Out of date means skip.** Just before deploying, the deploy job reads
   the tips of `main` and `data` (`git ls-remote`, no credentials). If
   either is not what was built, it doesn't deploy: something newer exists.
3. **A skip asks for a redeploy.** GitHub keeps **one** waiting job per
   concurrency group; a newer one replaces it (that run then shows as
   cancelled). So a skipped deploy can't assume the newer commit's own
   deploy is still coming. Example: a deploy-site deploy for main M2 is
   waiting; the nightly deploy (built from M1) arrives, replaces it, then
   finds it is out of date. The `redeploy` job (permission `actions: write`
   only, no secrets) then starts "Deploy site" on `main`, which builds and
   deploys the tips. A `workflow_dispatch` made with the workflow's own
   token does start a run (GitHub's docs: `workflow_dispatch` and
   `repository_dispatch` are the exceptions to "events from `GITHUB_TOKEN`
   start no workflows"; checked 22 Oct 2026). If the tips move again before
   that run deploys, it asks again.

What remains: a deploy that has already passed the out-of-date check can
still finish a minute after a newer commit lands; that newer commit's own
deploy then waits its turn in the queue and follows. And a nightly run whose
deploy was replaced in the queue ends as "cancelled", not "success" (its data
was published; only the deploy was handed over to the newer run).

## The files

| File                                   | What it is                                                                                               |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `../.github/workflows/site.yml`        | The reusable workflow: `build-site`, `deploy` and `redeploy`. `SITE_URL` is set here.                    |
| `../.github/workflows/deploy-site.yml` | Calls `site.yml` on a push to `main` touching the site, or by hand.                                      |
| `../deploy/wrangler.jsonc`             | Every hosting setting, reviewed as code: static assets only, 404 page, `workers_dev`, the custom domain. |
| `../deploy/package.json` + lockfile    | Wrangler at one exact version (4.148.0), nothing else. Dependabot proposes updates weekly.               |
| `../deploy/check-live.sh`              | The go-live check, run against the live address.                                                         |
| `public/_headers`                      | The response headers. Astro copies it into `dist/`; Cloudflare reads it and doesn't serve it.            |
| `scripts/check-build.mjs`              | Fails the build if `_headers` is missing or loses a line, or any file would get a wrong header.          |

Nothing about hosting is set by hand in the Cloudflare dashboard, apart from
the account-wide settings in the set-up list below.

## Response headers

`public/_headers` has two rules. Cloudflare applies **every** rule that
matches a path, and when two rules set the same header it sends both values
joined with a comma; `! Name` in a rule removes what earlier rules set.

**`/*` (every response, including the 404 page):**

| Header                         | Value                                                                              | Why                                                                                                                                                                                                                |
| ------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Content-Security-Policy`      | `frame-ancestors 'none'`                                                           | Stops other sites framing this one; only works as a header. The full policy stays in each page's `<meta>` tag (both apply), because its script hashes change with every build.                                     |
| `X-Frame-Options`              | `DENY`                                                                             | The same, for older browsers.                                                                                                                                                                                      |
| `X-Content-Type-Options`       | `nosniff`                                                                          | Browsers use the declared file type instead of guessing.                                                                                                                                                           |
| `Referrer-Policy`              | `strict-origin-when-cross-origin`                                                  | Links to other sites send only the domain, never the page address (also the browsers' default).                                                                                                                    |
| `Permissions-Policy`           | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()` | The site uses none of these, so nothing on it can ask for them.                                                                                                                                                    |
| `Cross-Origin-Opener-Policy`   | `same-origin`                                                                      | A page this site opens (or that opens it) can't reach into its window.                                                                                                                                             |
| `Cross-Origin-Resource-Policy` | `same-origin`                                                                      | Other sites can't load this site's files into their pages.                                                                                                                                                         |
| `Strict-Transport-Security`    | `max-age=86400` now; `max-age=31536000` once HTTPS on the domain is stable         | Browsers refuse plain HTTP for the domain. No `includeSubDomains` or `preload` (hard to undo). The build check accepts these two values only.                                                                      |
| `Cache-Control`                | `no-cache, no-transform`                                                           | `no-cache`: browsers may keep a copy but must check it first (cheap, with the ETag), because the data changes every night. `no-transform`: Cloudflare must not change the pages, e.g. inject its analytics beacon. |

**`/_astro/*` (Astro's CSS, JavaScript and fonts):** `! Cache-Control`, then
`Cache-Control: public, max-age=31536000, immutable`. Their names contain a
hash of their content, so a changed file has a new name and an old one never
needs checking. Without the `!` line these files would get
`no-cache, no-transform, public, max-age=31536000, immutable` (tested with
`wrangler dev`, 22 Oct 2026).

Files outside `/_astro/` that aren't pages (icons, `manifest.webmanifest`,
`robots.txt`, `sitemap.xml`, the QR codes) get the `/*` value too: their
names don't change when their content does, so they must be checked as well.
The plan said `no-transform` for HTML only; on these files it changes
nothing, and this deviation was **accepted** (22 Oct 2026).

**Checked twice:** `scripts/check-build.mjs` (part of every build) works out
the headers each built file and the 404 page will get, the way Cloudflare
combines the rules, and fails on a missing line, a header sent twice or a
wrong value. `deploy/check-live.sh` checks the real responses.

## One-time setup

Steps 1 to 5 are needed before the first deploy. Checked against
Cloudflare's docs on 22 Oct 2026; menus change, so check again.

1. **GitHub environment.** Settings, Environments, New environment,
   `production`. Deployment branches and tags: **Selected branches and
   tags**, add `main`. No reviewers or wait timer. Create it **before**
   merging the deploy step: a workflow that names a missing environment
   creates it with no branch limit.
2. **workers.dev subdomain.** In the Cloudflare dashboard, Workers & Pages:
   if asked, choose the account's `workers.dev` subdomain (once per
   account). Stage 1 serves the site at
   `https://tabletalk.<subdomain>.workers.dev`.
3. **Account ID.** Copy it from the dashboard (Account home, the account's
   menu, Copy account ID) into the `production` environment as a
   **variable** (not a secret) named `CLOUDFLARE_ACCOUNT_ID`. It isn't
   secret, but keeping it out of the repository means it's in one place.
4. **The API token.** My Profile, API Tokens, Create Token, **Create Custom
   Token**, named e.g. `tabletalk-deploy-2026-10`:

   | Permission                     | Scope                                                   | Why                                                                                                                                                                   |
   | ------------------------------ | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | Account, Workers Scripts, Edit | Account Resources: Include, this account only           | Uploads the Worker and its static assets and deploys a version. Also what the Workers Domains API asks for to attach a domain (`PUT /accounts/{id}/workers/domains`). |
   | Zone, Workers Routes, Edit     | Zone Resources: Include, Specific zone, `tabletalk.fyi` | Cloudflare's Workers permissions page: adding, changing or removing a route or **Custom Domain** needs "Workers Routes Write" on each affected zone.                  |
   - **Client IP address filtering:** none (GitHub's runners have no fixed
     addresses).
   - **TTL:** an end date about 90 days ahead. Put a reminder two weeks
     before it in your calendar (see
     [Replacing the token](#replacing-the-token-before-it-expires)).
   - **Not needed:** DNS Edit (a Custom Domain creates its own DNS record and
     certificate), Zone Read, User Details, Account Settings (the account ID
     is given), Pages, KV, R2 and every other permission.
   - **Stage 1 alone** (workers.dev only) uses just Workers Scripts. The
     Routes permission is included from the start so stage 2 needs no token
     change; it covers this one zone only.
   - **If stage 2 fails** with an authentication error about the zone or
     DNS: add `Zone, DNS, Edit` for `tabletalk.fyi` only (some people report
     needing it), re-run, and record it here.
   - **Wrangler bug, already handled:** before Wrangler 4.143.1, later
     deploys of a custom-domain-only Worker with `workers_dev` off failed
     with "No access" unless the token could read the zone's routes
     (workers-sdk issue 15863). The pinned 4.148.0 has the fix.

5. **The secret.** Add the token to the `production` environment as the
   secret `CLOUDFLARE_API_TOKEN`. Never in a repository secret, so only the
   deploy job (which names the environment) can read it.
6. **Cloudflare account settings** (not part of the Worker, so not in
   `wrangler.jsonc`):
   - Web Analytics: no site for `tabletalk.fyi`, or **JS Snippet injection
     off** (Analytics & Logs, Web Analytics, Manage site, Advanced options).
     `Cache-Control: no-transform` should already stop the injection; the
     go-live check confirms it.
   - Security, Bots: **Bot Fight Mode off** (it can show challenge pages to
     real visitors and set cookies).
   - Domain Registration: **auto-renew on** for `tabletalk.fyi` (expires
     2027-10-22).
7. **GitHub repository settings** (Settings, Advanced Security, and
   Settings, Rules):
   - Secret scanning and push protection on.
   - Dependabot alerts and Dependabot security updates on.
   - Private vulnerability reporting on.
   - **Ruleset `protect-main` (decided 22 Oct 2026):** a branch ruleset
     targeting `main` only, with **Restrict deletions** and **Block force
     pushes**; no pull-request or status-check requirements; an empty bypass
     list. The owner creates it by hand, like `protect-data`.

## Going live in three stages

Each stage is a reviewed change on `main`; nothing is set in the dashboard.

1. **workers.dev.** With the token in place, run Actions, Deploy site, Run
   workflow (on `main`). The deploy log prints the address. Then run
   `bash deploy/check-live.sh https://tabletalk.<subdomain>.workers.dev`
   and fix anything it reports.
2. **The domain.** In `deploy/wrangler.jsonc`, add
   `"routes": [{ "pattern": "tabletalk.fyi", "custom_domain": true }]`
   (a pull request; merging it starts Deploy site). Cloudflare creates the
   DNS record and the certificate; the domain must have no DNS record for
   `tabletalk.fyi` before this (none exists; don't add one). Allow a few
   minutes for the certificate, then
   `bash deploy/check-live.sh https://tabletalk.fyi`.
3. **One address.** Set `"workers_dev": false` (another reviewed change),
   check the domain again, and check that the workers.dev address no longer
   serves the site.

**Later:** once HTTPS on the domain has been stable for a few weeks, raise
`Strict-Transport-Security` to `max-age=31536000` in `public/_headers`.
`www.tabletalk.fyi` isn't set up; if wanted, it would be a second Custom
Domain plus a redirect, decided then.

**Before announcing the site:** the manual keyboard, NVDA and real-phone
passes in `docs/accessibility-review.md` are still marked "to do".

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
3. **exactly one** `Cache-Control`: `no-cache, no-transform` for the three
   pages, `public, max-age=31536000, immutable` for the stylesheet and the
   font;
4. **no `Set-Cookie`** (the footer promises no cookies);
5. for the pages, **no `cloudflareinsights`** in the HTML (Cloudflare's
   injected Web Analytics beacon).

It prints a line per check and exits 1 if any failed; the site isn't live
until it passes. Tested on 22 Oct 2026 against `wrangler dev` (passing), and
with the `! Cache-Control` line removed (failing on the two `/_astro/` files,
as it should). Afterwards, run the browser tests against the live address
once.

## Replacing the token before it expires

1. Two weeks before the expiry date (the calendar reminder), create a new
   token with **the same permissions and scope** (step 4 above) and a new
   end date about 90 days ahead.
2. Settings, Environments, `production`: replace the `CLOUDFLARE_API_TOKEN`
   secret with the new token.
3. Run Actions, Deploy site, Run workflow, and check the deploy job passed
   (a deploy, not the "no token" notice).
4. Revoke the old token (My Profile, API Tokens, the old token, Delete).
5. Move the calendar reminder to two weeks before the new expiry date.

If the token expires anyway, the deploy job fails (a token exists but
doesn't work), you get GitHub's email, and the site stays as it was; then
do steps 1 to 4.

## When something fails

| What fails                                                 | What visitors see                                                                               |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| One league's update                                        | The site is rebuilt; that league shows its previous numbers with "last night's update failed"   |
| The whole update, or publish                               | No build or deploy; yesterday's site stays up; after 30 hours each page shows the stale warning |
| `npm run verify` (types, lint, unit tests, build check)    | Nothing is deployed; the previous site stays up; the run fails and GitHub emails you            |
| The deploy finds `main` or `data` moved on since its build | Not deployed (the job passes, with a notice); "Deploy site" is started to deploy the tips       |
| The deploy itself (token, Cloudflare, network)             | The previous site stays up; the run fails; re-run the deploy job once the cause is fixed        |

**Rolling back:** revert the bad commit on `main` (Deploy site then
redeploys), or re-run an earlier run's deploy job. In an emergency,
Cloudflare's dashboard can roll the Worker back to an earlier version
(Workers & Pages, `tabletalk`, Deployments); the next deploy replaces it.

**Limits (free plan):** requests for static assets are free and unlimited;
up to 20,000 files per version and 25 MiB per file. The site is about 350
files and 1 MB.

## Visitor numbers without tracking

Goal: know roughly how many people visit and how they find the site, without
adding a script, a cookie or a third-party request to any page.

### 1. Cloudflare's request counts

Cloudflare counts the requests it serves. The zone `tabletalk.fyi`,
Analytics & Logs, Traffic: requests, page views, bandwidth, "unique
visitors", countries and status codes, kept for at least 30 days. Nothing is
added to the pages. Limits to say out loud:

- **"Unique visitors" are unique IP addresses**, not people (one school
  counts once; one person on two devices counts twice).
- **Bots are included** on the free plan. Treat the numbers as an upper
  bound and look at trends, not totals.
- **Cloudflare's "Web Analytics" is a different product**: a JavaScript
  beacon it can inject into pages. Keep it off (setup step 6). The CSP would
  block it anyway (`script-src` lists only our hashes, `connect-src 'none'`),
  so it would mean console errors and a broken promise, not tracking.

### 2. Google Search Console

Search impressions, clicks, positions and queries, measured on Google's
side: nothing is added to the pages. Add a **Domain property** verified with
the **TXT record** Search Console gives (added in Cloudflare's DNS; not the
HTML-file or meta-tag methods, which would put Google's token into the
site), then submit `https://tabletalk.fyi/sitemap.xml`. The build makes the
sitemap and `robots.txt` when `SITE_URL` is set, which the deploy always
does. About 16 months of data, a day or two behind.

### 3. What the site says

Every privacy statement on the site must be exactly true. The footer says
"No trackers, no cookies, no analytics scripts" (changed 22 Oct 2026 from
"no analytics", since Cloudflare's request counts are analytics of a kind,
just not on the pages). The About page's privacy list says the same, and its
paragraph (live from the first deploy) says:

> The site is delivered by Cloudflare, which stores its files and sends them
> to you. Like any web server, it sees the normal details of each request:
> your IP address, the page asked for, the time and your browser's
> user-agent. Cloudflare counts those requests on its own servers, and
> TableTalk looks only at the anonymous totals (how many requests, and from
> which countries), never at who made them. Nothing on the pages counts you:
> no script, and nothing stored in your browser for it. Cloudflare's own
> privacy policy covers what it keeps. The code and the nightly data files
> are on GitHub; visiting the site never contacts GitHub, only following a
> link there does.

"Nothing stored in your browser for it" is deliberate: the site does keep
the visitor's own theme, table settings and favourite team in local storage
(said separately, with the details). If a `Set-Cookie` ever appears in the
go-live check, the footer and this paragraph must change.

### 4. Later, if ever: a cookieless analytics script

Plausible, Umami or GoatCounter count page views more accurately, but each
adds a third-party request (unless self-hosted), needs `script-src` and
`connect-src` opened in the CSP, and makes "no analytics" untrue. Not
proposed: the request counts and Search Console answer "is anyone visiting,
and how do they find it?" without any of this.

## Still to decide

- **Share images** (Open Graph cards per league): now possible, since the
  public address is known; how they're made is still open.

# Deployment plan (not done yet)

A plan for putting the site online after the pipeline trial. **Nothing here
has been set up**: no workflow, no hosting settings, no merge to `main`. Each
step needs your go-ahead.

## Before anything is deployed

1. The pipeline trial is reviewed.
2. **Contract request R8** (pipeline fingerprint) is done. Once `web/` is on
   `main`, a website-only commit changes `code_commit` in every snapshot and
   lock; R8 lets a reader see the model didn't change.
3. `web/` is merged into `main`.
4. The manual keyboard and NVDA passes in `docs/accessibility-review.md` are
   done, and the site has been opened on a real iPhone and Android phone again.
5. The custom domain is set up (chosen; see below).

## Where: GitHub Pages (recommended in the plan)

Free for a public repository, HTTPS included, and it serves plain files,
which is all this site is. Two limits matter:

- **No custom response headers.** The Content Security Policy is already a
  `<meta>` tag, so it still applies. What a meta tag can't do is
  `frame-ancestors` (stopping other sites from framing this one). The site has
  no logins or actions, so being framed can't trick anyone into doing
  anything; noted, accepted.
- **The address.** A project site lives at
  `https://umarjaved204.github.io/TableTalk/`, under `/TableTalk/`. Every link
  in the site starts at the root (`/premier-league/`), so it would break
  there. Two ways out:
  - **A custom domain** (e.g. a domain you own, pointed at Pages): the site
    is served from the root and **no code changes**. Recommended, and
    **chosen** (2 Oct 2026): you will set it up once the remaining work is
    done.
  - **The `/TableTalk/` path:** set Astro's `base: "/TableTalk/"` and change
    every internal link and asset to go through it (about 20 places), with a
    browser test that follows every link on the built site.

Either way, `SITE_URL` is set to the final https address in the build
(canonical links and `og:url` need it; the build check refuses `localhost`).

## How: a deploy job in the nightly workflow

The site must be rebuilt after each nightly data commit. A push made with
the workflow's own token (`GITHUB_TOKEN`) does **not** start other workflows,
so a separate "on push to data" workflow would never run. The deploy is
therefore a second job in `.github/workflows/daily-update.yml`:

```
update  (existing: fetch, refit, simulate, commit to data)
  └─ deploy  (new, needs: update; runs even if one league failed)
       checkout main (web/), checkout the data branch into web/.data
       setup Node 24, npm ci
       SITE_URL=https://… npm run build       (type check, build, build check)
       upload web/dist as the Pages artifact
       deploy to GitHub Pages
```

- **Permissions** for the deploy job only: `pages: write`, `id-token: write`,
  `contents: read`. The update job keeps its own.
- **Actions pinned** to exact versions, as the existing workflow already does
  (`actions/configure-pages`, `actions/upload-pages-artifact`,
  `actions/deploy-pages`).
- **Concurrency:** one deploy at a time (`concurrency: pages`), so the backup
  run can't race the main one.
- **No secrets needed:** the data branch is public. The football-data.org key
  stays in the update job only.
- **Time:** about a minute (`npm ci` with a cache, a 5-second build).

## When something fails

| What fails                                                                 | What visitors see                                                                                       |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| One league's update                                                        | The site still builds; that league shows its previous numbers with "last night's update failed"         |
| The whole update job                                                       | The deploy job doesn't run; yesterday's site stays up; after 30 hours each page shows the stale warning |
| The build (a broken index, contradicting lock files, a failed build check) | Nothing is deployed; the previous site stays up; the run is marked failed and you get GitHub's email    |
| The deploy step itself                                                     | The previous site stays up; re-run the job by hand                                                      |

Rolling back: re-run an earlier successful deploy, or revert the commit on
`main` and re-run.

## Visitor numbers without tracking (plan only, nothing set up)

Goal: know roughly how many people visit and how they find the site, without
adding a script, a cookie or a third-party request to any page. The footer's
"No trackers, no analytics, no cookies" stays true, and the Content Security
Policy doesn't change. Checked 4 Oct 2026; plans and menus change, so check
again when setting it up.

### 1. Cloudflare (free plan) in front of the custom domain

The domain's DNS moves to Cloudflare and the site's records are "proxied"
(orange cloud): visitors connect to Cloudflare, which fetches the pages from
GitHub Pages. Cloudflare counts the requests it passes on.

**What it shows (Analytics & Logs > Traffic, free plan):** requests, page
views, bandwidth, "unique visitors", countries and status codes. Since 2 Oct
2026 every plan keeps at least 30 days of this data (before that, the free
plan showed 1 to 8 days depending on the view). Nothing is added to the
pages: the numbers come from requests Cloudflare already handles.

**Limits to say out loud:**

- **"Unique visitors" are unique IP addresses**, not people. Several people
  behind one address (a school, a mobile network) count once; one person on a
  phone and a laptop counts twice.
- **Bots are included.** Crawlers, uptime checkers and scanners count as
  visitors on the free plan; the bot breakdown (Bot Analytics) needs a paid
  plan. Treat the numbers as an upper bound and look at trends, not totals.
- **Cloudflare's "Web Analytics" product is different**: it is a JavaScript
  beacon, and since September 2025 Cloudflare injects it into proxied pages
  **by default on the free plan**. Switch it off: Analytics & Logs > Web
  Analytics > Manage site > Advanced options > JS Snippet injection: off
  (some people report having to enable Web Analytics first to reach the
  switch). Our CSP would block the injected script anyway (`script-src` lists
  only our hashes, `connect-src 'none'`), so leaving it on would mean console
  errors and a broken promise rather than tracking. After setup, check that
  the pages as served contain no `cloudflareinsights` script.
- Leave **Bot Fight Mode** off: it can show challenge pages to real visitors,
  and a static site doesn't need it.

**With GitHub Pages (custom domain, HTTPS):**

1. Point the domain at GitHub Pages with the records **DNS only** (grey
   cloud) first. GitHub can only issue its Let's Encrypt certificate when it
   sees its own addresses; while proxied it reports that the domain "is not
   properly configured to support HTTPS".
2. Once the certificate is issued and "Enforce HTTPS" is ticked in the
   repository's Pages settings, set Cloudflare's SSL/TLS mode to **Full
   (strict)**, and only then switch the records to **proxied**. Never
   "Flexible": it talks to GitHub over plain HTTP and loops with Enforce HTTPS.
3. **Known issue: certificate renewal.** GitHub renews its certificate about
   every three months over plain HTTP; behind the proxy that request can be
   redirected to HTTPS and fail, and with Full (strict) an expired GitHub
   certificate takes the site down. Mitigations, best first: a Cloudflare rule
   that lets `/.well-known/acme-challenge/*` through without the HTTPS
   redirect; a calendar reminder about 80 days after issue to check the
   certificate; if renewal fails, switch to grey cloud, let GitHub reissue,
   then switch back.
4. Caching: Cloudflare follows the cache headers GitHub Pages sends (10
   minutes) and doesn't cache HTML by default, so a nightly deploy shows up
   within minutes. No cache rules needed.

### 2. Real security headers (same Cloudflare setup)

A `<meta>` tag can't set response headers, and GitHub Pages can't send
custom ones. Cloudflare can add them on the way out with a **response header
Transform Rule** (free plan: 10 rules; one rule can set several headers).

| Header                       | Value                                                                              | Why                                                                                                                                                                                                                                                                    |
| ---------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Content-Security-Policy`    | `frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'none'`   | `frame-ancestors` only works as a header: it stops other sites framing this one. The script rules stay in the `<meta>` tag (both policies apply), because the early script's hash changes with the team list and the code, and a fixed header can't follow each build. |
| `Strict-Transport-Security`  | `max-age=86400` at first, then `max-age=31536000` once HTTPS is known to be stable | Browsers then refuse plain HTTP for the domain. Set in SSL/TLS > Edge Certificates > HSTS (free). No `includeSubDomains` or `preload` unless every subdomain is HTTPS for good: preload is hard to undo.                                                               |
| `X-Content-Type-Options`     | `nosniff`                                                                          | Browsers use the declared file type instead of guessing.                                                                                                                                                                                                               |
| `Referrer-Policy`            | `strict-origin-when-cross-origin`                                                  | Links to other sites (GitHub, football-data.org) send only the domain, never the page address. It is also the browsers' default; stating it keeps it if defaults change.                                                                                               |
| `Permissions-Policy`         | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()` | The site uses none of these, so nothing on it can ever ask for them.                                                                                                                                                                                                   |
| `X-Frame-Options`            | `DENY`                                                                             | The same protection as `frame-ancestors`, for older browsers.                                                                                                                                                                                                          |
| `Cross-Origin-Opener-Policy` | `same-origin`                                                                      | A page this site opens (or that opens it) can't reach into its window.                                                                                                                                                                                                 |

After setting them, check with `curl -sI https://<domain>/` and a header
scanner, and run the browser tests against the live address once.

### 3. Google Search Console

Search impressions, clicks, positions and the queries people used to find the
site, measured on Google's side: **nothing is added to the pages**.

- Add a **Domain property** and verify it with the **TXT record** Search
  Console gives, added in Cloudflare's DNS. (Not the HTML-file or meta-tag
  methods, which would put Google's token into the site.)
- Submit `https://<domain>/sitemap.xml` (generated by the build from Step 3 of
  the favourites stage) and add the `Sitemap:` line to `robots.txt`.
- It keeps about 16 months of data, with a delay of a day or two.

### 4. What the About page must say once Cloudflare is in use

The footer stays true: no trackers, no analytics scripts, no cookies set by
this site. Cloudflare's free plan doesn't set cookies on a static site with
Bot Fight Mode and challenges off; check the response headers for
`Set-Cookie` after setup, and if one ever appears, the footer must change.
The About page's privacy section gains a paragraph:

> The site is delivered through Cloudflare, which sits between you and the
> site's files on GitHub Pages. Like any web server, it sees the normal
> details of each request: your IP address, the page asked for, the time and
> your browser's user-agent. TableTalk uses only Cloudflare's totals (how
> many requests, and from which countries), with no script on the pages and
> no cookies. Cloudflare's own privacy policy covers what it keeps.

GitHub, which hosts the files, is already in the same position, and the
About page should say so too when the site goes live.

### 5. Later, if ever: a cookieless analytics script

Plausible, Umami or GoatCounter count page views more accurately (they filter
most bots and show which pages are read). Each would change things:

- **A third-party request on every page** (unless self-hosted), which breaks
  "no third-party requests" in the README and on the About page.
- **The CSP**: `script-src` and `connect-src` must allow the service's address.
- **The footer**: "no analytics" would no longer be true; it would become
  something like "cookieless page-view counts, no personal data".

Not proposed now: Cloudflare's request counts and Search Console answer "is
anyone visiting, and how do they find it?" without any of this.

## Decided later, at deployment

- **Share images** (Open Graph cards per league): deferred to here. They need
  the public `SITE_URL`, and how they're made depends on where the build runs.
- **`robots.txt`**: add a `Sitemap:` line once the address is known (a sitemap
  needs absolute URLs). `sitemap.xml` itself is generated by the build from
  Step 3 of the favourites stage.
- **Limits:** a Pages site may be up to 1 GB with a soft 100 GB/month of
  traffic; this site is about 1 MB.

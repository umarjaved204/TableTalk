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

## Decided later, at deployment

- **Share images** (Open Graph cards per league): deferred to here. They need
  the public `SITE_URL`, and how they're made depends on where the build runs.
- **`robots.txt`**: add a `Sitemap:` line once the address is known (a sitemap
  needs absolute URLs).
- **Limits:** a Pages site may be up to 1 GB with a soft 100 GB/month of
  traffic; this site is about 1 MB.

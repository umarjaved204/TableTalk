// Getting around with the site's own links only. Added to the home screen,
// the site opens as an app (manifest: display standalone), and on iPhones
// that app has no back button and no address bar. So, walking the built test
// site from the home page and following only links in the pages:
//   - every page is reached (the 404 page only by a wrong address, and stub
//     pages for last season's teams only by old bookmarks and links);
//   - every page links to the home page (the brand in the header);
//   - every team page links up to its league page (the breadcrumb);
//   - no link inside the site is broken.
// Plain HTTP requests, no browser: links are in the built HTML.
import { readdirSync } from "node:fs";
import { relative } from "node:path";
import { E2E_OUT_DIR } from "./site.ts";
import { expect, test } from "./test.ts";

/** Every page in the built site, as its address ("/premier-league/arsenal/"). */
function builtPages(dir = E2E_OUT_DIR): string[] {
  const pages: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || entry.name !== "index.html") continue;
    const folder = relative(E2E_OUT_DIR, entry.parentPath).split("\\").join("/");
    pages.push(folder ? `/${folder}/` : "/");
  }
  return pages.sort();
}

/** The site's own page links in a page's HTML (not files such as /favicon.svg). */
function pageLinks(html: string): string[] {
  return [...html.matchAll(/<a\b[^>]*\shref="(\/[^"#?]*)/g)]
    .map((m) => m[1]!)
    .filter((href) => href.endsWith("/"));
}

test("every page can be reached, and left, with the site's own links", async ({ request }) => {
  const built = builtPages();
  const seen = new Map<string, string[]>(); // page -> its links
  const broken: string[] = [];
  const queue = ["/"];
  while (queue.length > 0) {
    const path = queue.shift()!;
    if (seen.has(path)) continue;
    const response = await request.get(path);
    if (response.status() !== 200) {
      broken.push(`${path} (${response.status()})`);
      seen.set(path, []);
      continue;
    }
    const links = pageLinks(await response.text());
    seen.set(path, links);
    for (const link of links) if (!seen.has(link)) queue.push(link);
  }

  expect(broken, "links inside the site that lead nowhere").toEqual([]);
  // Stub pages (last season's teams, noindex) are for old bookmarks and links,
  // so they needn't be linked to; like every page, they must link out.
  const unlinked: string[] = [];
  for (const path of built.filter((p) => !seen.has(p))) {
    const html = await (await request.get(path)).text();
    seen.set(path, pageLinks(html));
    if (!html.includes('<meta name="robots" content="noindex">')) unlinked.push(path);
  }
  expect(unlinked, "pages no link leads to").toEqual([]);
  expect(
    built.filter((p) => !(seen.get(p) ?? []).includes("/")),
    "pages without a link to the home page",
  ).toEqual([]);

  const teamPages = built.filter((p) => p.split("/").length === 4 && !p.endsWith("/matches/"));
  expect(teamPages.length).toBeGreaterThan(0);
  expect(
    teamPages.filter((p) => !(seen.get(p) ?? []).includes(`/${p.split("/")[1]}/`)),
    "team pages without a link up to their league",
  ).toEqual([]);
});

test("the 404 page links to the home page", async ({ request }) => {
  const response = await request.get("/not-a-page/");
  expect(response.status()).toBe(404);
  expect(pageLinks(await response.text())).toContain("/");
});

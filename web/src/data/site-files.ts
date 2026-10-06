// The text of /sitemap.xml and /robots.txt (routes in src/pages).

/** The sitemap XML for these pages on this site. */
export function sitemapXml(site: URL, paths: readonly string[]): string {
  const urls = paths.map((path) => `<url><loc>${new URL(path, site).href}</loc></url>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`;
}

/** robots.txt: everything may be indexed (stub pages say noindex themselves);
 *  with the site's address, it points to the sitemap. */
export function robotsTxt(site: URL | undefined): string {
  const lines = ["User-agent: *", "Allow: /"];
  if (site) lines.push("", `Sitemap: ${new URL("/sitemap.xml", site).href}`);
  return `${lines.join("\n")}\n`;
}

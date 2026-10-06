// /sitemap.xml: every real page of the site, for search engines. Never the
// stub pages for last season's teams (noindex), the 404 page or QR images.
//
// Built only when SITE_URL is set: a sitemap must list full addresses, and
// without the public address there is none to give (check-build.mjs refuses
// local addresses in built files). The file name is a route parameter only so
// that it can be left out, as /qr/<team>.svg is.
import type { APIRoute, GetStaticPaths } from "astro";
import { sitemapXml } from "../data/site-files.ts";
import { sitemapPaths } from "../data/team-page.ts";

export const getStaticPaths: GetStaticPaths = () =>
  import.meta.env.SITE ? [{ params: { sitemap: "sitemap" } }] : [];

export const GET: APIRoute = ({ site }) => {
  if (!site) throw new Error("sitemap.xml needs SITE_URL");
  return new Response(sitemapXml(site, sitemapPaths()), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};

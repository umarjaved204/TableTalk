// /robots.txt. With SITE_URL set it also points to the sitemap; without it
// there is no sitemap to point to (see [sitemap].xml.ts).
import type { APIRoute } from "astro";
import { robotsTxt } from "../data/site-files.ts";

export const GET: APIRoute = ({ site }) =>
  new Response(robotsTxt(site), { headers: { "Content-Type": "text/plain; charset=utf-8" } });

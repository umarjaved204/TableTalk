// /qr/<team>.svg: the QR code for a team's personal link (SITE_URL/?team=<slug>),
// shown in the "Your team" dialog. Built only when SITE_URL is set: a QR code
// must hold the site's full public address, and without one there is none to
// encode (a local address would be useless on a phone, and check-build.mjs
// refuses local addresses in built files).
import type { APIRoute, GetStaticPaths } from "astro";
import { qrSvg } from "../../data/qr.ts";
import { loadTeamIndex } from "../../data/teams.ts";

export const getStaticPaths: GetStaticPaths = () => {
  if (!import.meta.env.SITE) return [];
  return loadTeamIndex().teams.map((team) => ({ params: { team: team.slug } }));
};

export const GET: APIRoute = ({ params, site }) => {
  const link = new URL(`/?team=${params["team"] ?? ""}`, site);
  return new Response(qrSvg(link.href), { headers: { "Content-Type": "image/svg+xml" } });
};

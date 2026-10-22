// Checks on a finished build (run by `npm run build` after `astro build`).
//
//   1. No local address anywhere in the built files ("localhost",
//      "127.0.0.1"), e.g. a canonical link made from a local preview URL.
//      Only HTML was asked for; CSS, JavaScript and other text files are
//      checked too, since a local address in them would be just as wrong.
//   2. Fonts: WOFF2 only, and only the Latin and Latin Extended subsets
//      (see src/styles/fonts.css).
//   3. Response headers (public/_headers, read by Cloudflare): the file is
//      there and every planned line is in its rule. Then, the way Cloudflare
//      combines rules (every matching rule adds its headers; a header set
//      twice gets both values joined with a comma; "! Name" removes it from
//      the rules before), every built file, and a page that doesn't exist
//      (the 404 page), gets each security header exactly once and exactly one
//      Cache-Control: "no-cache, no-transform" for pages and other files,
//      "public, max-age=31536000, immutable" for /_astro/ (hashed names).
//
// Usage: node scripts/check-build.mjs [folder]   (default: dist)
// Exits with an error, listing every problem, if any check fails.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const TEXT = new Set([".html", ".css", ".js", ".mjs", ".json", ".xml", ".txt", ".svg", ".webmanifest"]);
const FONTS = new Set([".woff2", ".woff", ".ttf", ".otf", ".eot"]);
const LOCAL = /localhost|127\.0\.0\.1/;
const ALLOWED_SUBSETS = /-(latin|latin-ext)-/;

// The planned headers (web/DEPLOYMENT.md). deploy/check-live.sh checks the
// same values on the live site.
const SECURITY = {
  "Content-Security-Policy": "frame-ancestors 'none'",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
};
// One day at first; a year once HTTPS on the domain is known to be stable.
const HSTS = /^max-age=(86400|31536000)$/;
const PAGE_CACHE = "no-cache, no-transform";
const HASHED_CACHE = "public, max-age=31536000, immutable";
// Each rule's lines: exact text, or a pattern for the one value that may change.
const REQUIRED = {
  "/*": [
    ...Object.entries(SECURITY).map(([name, value]) => `${name}: ${value}`),
    /^Strict-Transport-Security: max-age=(86400|31536000)$/,
    `Cache-Control: ${PAGE_CACHE}`,
  ],
  "/_astro/*": ["! Cache-Control", `Cache-Control: ${HASHED_CACHE}`],
};
// Stands for any address with no file: Cloudflare answers with 404.html.
const MISSING = "/no-such-page/";

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

/** The rules of a _headers file, in order: { pattern, lines, set: [[name, value]], detach: [name] }. */
export function parseHeaders(text) {
  const rules = [];
  for (const raw of text.split(/\r?\n/)) {
    if (raw.trim() === "" || raw.trim().startsWith("#")) continue;
    if (!/^\s/.test(raw)) {
      rules.push({ pattern: raw.trim(), lines: [], set: [], detach: [] });
      continue;
    }
    const rule = rules.at(-1);
    const line = raw.trim();
    if (!rule) continue;
    rule.lines.push(line);
    if (line.startsWith("! ")) rule.detach.push(line.slice(2).trim().toLowerCase());
    else {
      const colon = line.indexOf(":");
      rule.set.push([line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim()]);
    }
  }
  return rules;
}

/** Whether a path pattern ("*" any characters, ":name" any but "/") matches a path. */
function matches(pattern, path) {
  const source = pattern
    .split(/(\*|:[A-Za-z]\w*)/)
    .map((part) =>
      part === "*" ? ".*" : part.startsWith(":") ? "[^/]+" : part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"),
    )
    .join("");
  return new RegExp(`^${source}$`).test(path);
}

/** The headers a path gets: header name (lower case) -> every value set, in order. */
export function headersFor(rules, path) {
  const headers = new Map();
  for (const rule of rules.filter((r) => matches(r.pattern, path))) {
    for (const name of rule.detach) headers.delete(name);
    for (const [name, value] of rule.set) headers.set(name, [...(headers.get(name) ?? []), value]);
  }
  return headers;
}

/** The address each built file is served at (folders for index.html, the 404 page for any missing address). */
function urlPath(name) {
  if (name === "404.html") return MISSING;
  if (name === "index.html") return "/";
  if (name.endsWith("/index.html")) return `/${name.slice(0, -"index.html".length)}`;
  return `/${name}`;
}

function checkHeaders(dir, names) {
  const file = join(dir, "_headers");
  if (!existsSync(file)) return ["_headers: missing (public/_headers must be copied into the build)"];
  const problems = [];
  const rules = parseHeaders(readFileSync(file, "utf8"));
  for (const [pattern, required] of Object.entries(REQUIRED)) {
    const rule = rules.find((r) => r.pattern === pattern);
    for (const line of required) {
      const found = rule?.lines.some((l) => (typeof line === "string" ? l === line : line.test(l)));
      if (!found) problems.push(`_headers: rule ${pattern} is missing "${line}"`);
    }
  }
  const paths = [...new Set([...names.filter((n) => n !== "_headers").map(urlPath), MISSING])];
  for (const path of paths) {
    const headers = headersFor(rules, path);
    const one = (name) => {
      const values = headers.get(name.toLowerCase()) ?? [];
      return values.length === 1 ? values[0] : `${values.length} values: ${values.join(" + ")}`;
    };
    for (const [name, value] of Object.entries(SECURITY))
      if (one(name) !== value)
        problems.push(`_headers: ${path} gets ${name} "${one(name)}", expected "${value}"`);
    if (!HSTS.test(one("Strict-Transport-Security")))
      problems.push(`_headers: ${path} gets Strict-Transport-Security "${one("Strict-Transport-Security")}"`);
    const cache = path.startsWith("/_astro/") ? HASHED_CACHE : PAGE_CACHE;
    if (one("Cache-Control") !== cache)
      problems.push(`_headers: ${path} gets Cache-Control "${one("Cache-Control")}", expected "${cache}"`);
  }
  return problems;
}

/** Every problem found in the build folder, as readable lines. */
export function checkBuild(dir) {
  const problems = [];
  const names = [];
  for (const path of files(dir)) {
    const name = relative(dir, path).replaceAll("\\", "/");
    names.push(name);
    const extension = extname(path).toLowerCase();
    if (TEXT.has(extension)) {
      const lines = readFileSync(path, "utf8").split("\n");
      lines.forEach((line, i) => {
        const match = LOCAL.exec(line);
        if (match) problems.push(`${name}:${i + 1}: contains "${match[0]}"`);
      });
    }
    if (FONTS.has(extension)) {
      if (extension !== ".woff2") problems.push(`${name}: font is not WOFF2`);
      else if (!ALLOWED_SUBSETS.test(name))
        problems.push(`${name}: font subset is not Latin or Latin Extended`);
    }
  }
  return [...problems, ...checkHeaders(dir, names)];
}

// Run from the command line.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2] ?? "dist";
  const problems = checkBuild(dir);
  if (problems.length > 0) {
    console.error(`[check-build] ${dir}: ${problems.length} problem(s):\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  console.log(
    `[check-build] ${dir}: no local addresses, fonts are Latin/Latin Extended WOFF2 only, ` +
      "_headers complete with one Cache-Control per file",
  );
}

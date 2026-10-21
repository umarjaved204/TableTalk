// Checks on a finished build (run by `npm run build` after `astro build`).
//
//   1. No local address anywhere in the built files ("localhost",
//      "127.0.0.1"), e.g. a canonical link made from a local preview URL.
//      Only HTML was asked for; CSS, JavaScript and other text files are
//      checked too, since a local address in them would be just as wrong.
//   2. Fonts: WOFF2 only, and only the Latin and Latin Extended subsets
//      (see src/styles/fonts.css).
//
// Usage: node scripts/check-build.mjs [folder]   (default: dist)
// Exits with an error, listing every problem, if any check fails.
import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const TEXT = new Set([".html", ".css", ".js", ".mjs", ".json", ".xml", ".txt", ".svg", ".webmanifest"]);
const FONTS = new Set([".woff2", ".woff", ".ttf", ".otf", ".eot"]);
const LOCAL = /localhost|127\.0\.0\.1/;
const ALLOWED_SUBSETS = /-(latin|latin-ext)-/;

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

/** Every problem found in the build folder, as readable lines. */
export function checkBuild(dir) {
  const problems = [];
  for (const path of files(dir)) {
    const name = relative(dir, path).replaceAll("\\", "/");
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
  return problems;
}

// Run from the command line.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2] ?? "dist";
  const problems = checkBuild(dir);
  if (problems.length > 0) {
    console.error(`[check-build] ${dir}: ${problems.length} problem(s):\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`[check-build] ${dir}: no local addresses, fonts are Latin/Latin Extended WOFF2 only`);
}

// Writes the crest SVGs, league marks and club colour stylesheet from the
// designs in src/identity/ (see src/identity/build.ts for the list). Run it
// after changing a design, and commit what it writes:
//
//   node scripts/make-crests.mjs
//
// Files for clubs that are no longer in the registry are deleted, so the
// folder always matches the registry. The lettering comes from
// src/identity/glyphs.json, so this needs no font tool (only
// scripts/crest-glyphs.py does, and only when the letters change).
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { identityFiles } from "../src/identity/build.ts";

const files = identityFiles();
let written = 0;
for (const [path, text] of files) {
  mkdirSync(dirname(path), { recursive: true });
  let old = null;
  try {
    old = readFileSync(path, "utf8");
  } catch {
    // a new file
  }
  if (old !== text) {
    writeFileSync(path, text, "utf8");
    written++;
  }
}
let removed = 0;
for (const dir of ["src/identity/crests", "src/identity/marks"]) {
  for (const name of readdirSync(dir)) {
    const path = `${dir}/${name}`;
    if (!files.has(path)) {
      rmSync(join(dir, name));
      removed++;
    }
  }
}
console.log(`${files.size} files: ${written} written, ${files.size - written} unchanged, ${removed} removed`);

// Every source file is clean UTF-8: no byte-order mark, and none of the
// garbled sequences ("mojibake") that appear when a UTF-8 file is read as
// Windows-1252 and saved again (an en dash becomes three junk characters
// starting with a-circumflex). This happened once
// (an editor round-trip broke the en dashes in match cards); this test makes
// sure it can't slip through again.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOTS = ["src", "tests/unit", "tests/e2e", "scripts", "public"].map((d) => resolve(d));
const TEXT = new Set([".ts", ".js", ".mjs", ".astro", ".css", ".md", ".json", ".svg"]);
// UTF-8 bytes of "–", "—", "·", "é", "ö" etc. read as Windows-1252 start with these.
const MOJIBAKE = new RegExp("\u00e2\u20ac|\u00c2[\u00a0-\u00bf]|\u00c3[\u0080-\u00bf\u2018-\u203a]");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : TEXT.has(extname(name)) ? [path] : [];
  });
}

describe("source files are clean UTF-8", () => {
  const all = ROOTS.flatMap(files);

  it("finds the files", () => {
    expect(all.length).toBeGreaterThan(20);
  });

  it.each(all.map((f) => [f.slice(resolve(".").length + 1)]))("%s", (relative) => {
    const bytes = readFileSync(resolve(relative));
    expect(bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), "byte-order mark").toBe(false);
    const text = bytes.toString("utf8");
    expect(text.includes(String.fromCharCode(0xfffd)), "invalid UTF-8").toBe(false);
    expect(MOJIBAKE.exec(text)?.[0] ?? null, "garbled characters").toBeNull();
  });
});

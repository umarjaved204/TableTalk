import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONTRACTS_DIR, SCHEMA_COPIES_DIR } from "../../src/data/paths.ts";
import {
  currentVersion,
  frozenCopies,
  schemaPath,
  schemaVersionFor,
  schemaVersions,
} from "../../src/data/schemas.ts";

describe("which schemas a file is checked against", () => {
  const versions = ["1.1.0", "1.2.0"];
  it.each([
    ["1.0.0", "1.1.0"], // older than every version: the oldest (1.0.0 files match 1.1.0)
    ["1.1.0", "1.1.0"],
    ["1.1.5", "1.1.0"],
    ["1.2.0", "1.2.0"],
    ["1.4.0", "1.2.0"], // newer than every version: the newest, relaxed
  ])("%s -> %s", (version, expected) => {
    expect(schemaVersionFor(version, versions)).toBe(expected);
  });

  it("compares versions as numbers, not text", () => {
    expect(schemaVersionFor("1.10.0", ["1.2.0", "1.9.0", "1.10.0"])).toBe("1.10.0");
    expect(schemaVersionFor("1.9.5", ["1.2.0", "1.9.0", "1.10.0"])).toBe("1.9.0");
  });

  it("the current version is read from the pipeline's folder, older ones from the frozen copies", () => {
    const current = currentVersion();
    expect(schemaVersions().at(-1)).toBe(current);
    expect(schemaPath(current, "snapshot.schema.json")).toBe(join(CONTRACTS_DIR, "snapshot.schema.json"));
    expect(schemaPath("1.1.0", "snapshot.schema.json")).toBe(
      join(SCHEMA_COPIES_DIR, "1.1.0", "snapshot.schema.json"),
    );
    const generated = readFileSync(join("src", "data", "contract.gen.ts"), "utf8");
    expect(generated).toContain(`from contracts/*.schema.json (version ${current})`);
  });
});

describe("frozen copies of earlier versions", () => {
  // contracts/README.md lists every version with its date: "1.1.0 (2026-09-29) ...".
  const readme = readFileSync(join(CONTRACTS_DIR, "README.md"), "utf8");
  const history = [...readme.matchAll(/\b(\d+\.\d+\.\d+) \(\d{4}-\d{2}-\d{2}\)/g)].map((m) => m[1]!);

  it("reads the version history from contracts/README.md", () => {
    expect(history).toContain("1.1.0");
    expect(history).toContain(currentVersion());
  });

  // history/ keeps files of every earlier version, so each needs its schemas
  // after the pipeline moves on. 1.0.0 files are checked against 1.1.0.
  it("every earlier version has a frozen copy (copy the schemas before raising the version)", () => {
    const earlier = history.filter((v) => v !== currentVersion() && v !== "1.0.0");
    expect(earlier.filter((v) => !frozenCopies().includes(v))).toEqual([]);
  });

  it("there is no frozen copy of the current version (it is read from contracts/ itself)", () => {
    expect(frozenCopies()).not.toContain(currentVersion());
  });
});

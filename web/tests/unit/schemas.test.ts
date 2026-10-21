import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONTRACTS_DIR, SCHEMA_COPIES_DIR } from "../../src/data/paths.ts";
import { latestSchemaCopy, schemaCopies, schemaVersionFor } from "../../src/data/schemas.ts";

describe("which schema copy a file is checked against", () => {
  const copies = ["1.1.0", "1.2.0"];
  it.each([
    ["1.0.0", "1.1.0"], // older than every copy: the oldest (1.0.0 files match 1.1.0)
    ["1.1.0", "1.1.0"],
    ["1.1.5", "1.1.0"],
    ["1.2.0", "1.2.0"],
    ["1.4.0", "1.2.0"], // newer than every copy: the newest, relaxed
  ])("%s -> %s", (version, expected) => {
    expect(schemaVersionFor(version, copies)).toBe(expected);
  });

  it("compares versions as numbers, not text", () => {
    expect(schemaVersionFor("1.10.0", ["1.2.0", "1.9.0", "1.10.0"])).toBe("1.10.0");
    expect(schemaVersionFor("1.9.5", ["1.2.0", "1.9.0", "1.10.0"])).toBe("1.9.0");
  });

  it("finds the copies in web/contracts/, oldest first; the newest makes the types", () => {
    const found = schemaCopies();
    expect(found.indexOf("1.1.0")).toBeGreaterThanOrEqual(0);
    expect(found.indexOf("1.1.0")).toBeLessThan(found.indexOf("1.2.0"));
    expect(latestSchemaCopy(found)).toBe(found.at(-1));
    const generated = readFileSync(join("src", "data", "contract.gen.ts"), "utf8");
    expect(generated).toContain(`web/contracts/${latestSchemaCopy(found)}/`);
  });
});

describe("the copies match the pipeline's contract", () => {
  // contracts/README.md starts "# TableTalk data contract, version X.Y.Z".
  const readme = readFileSync(join(CONTRACTS_DIR, "README.md"), "utf8");
  const current = /version (\d+\.\d+\.\d+)/.exec(readme.split("\n")[0] ?? "")?.[1];
  const schemas = readdirSync(CONTRACTS_DIR).filter((name) => name.endsWith(".schema.json"));

  it("has a copy of the pipeline's current version", () => {
    expect(current).toBeDefined();
    expect(schemaCopies()).toContain(current);
  });

  it.each(schemas)("%s is identical to its copy", (name) => {
    const normalise = (text: string) => text.replace(/\r\n/g, "\n");
    const pipeline = normalise(readFileSync(join(CONTRACTS_DIR, name), "utf8"));
    const copy = normalise(readFileSync(join(SCHEMA_COPIES_DIR, current!, name), "utf8"));
    expect(copy).toBe(pipeline);
  });
});

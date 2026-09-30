import { rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DataError, loadFile, relax } from "../../src/data/load.ts";
import { checkVersion } from "../../src/data/version.ts";
import { REAL, copyOfReal, editJson, useDataDir } from "./helpers.ts";

describe("checkVersion", () => {
  it.each(["1.0.0", "1.1.0", "1.9.3"])("accepts %s (same MAJOR)", (v) => {
    expect(checkVersion(v).ok).toBe(true);
  });
  it("rejects a different MAJOR", () => {
    expect(checkVersion("2.0.0")).toEqual({ ok: false, found: "2.0.0", reason: "different-major" });
  });
  it("rejects missing or malformed versions", () => {
    expect(checkVersion(undefined)).toMatchObject({ ok: false, reason: "missing" });
    expect(checkVersion("1.1")).toMatchObject({ ok: false, reason: "malformed" });
    expect(checkVersion(1)).toMatchObject({ ok: false, reason: "malformed" });
  });
});

describe("relax", () => {
  it("removes every additionalProperties: false and nothing else", () => {
    const schema = {
      additionalProperties: false,
      properties: {
        a: { type: "object", additionalProperties: false },
        b: { additionalProperties: { type: "number" } },
      },
    };
    expect(relax(schema)).toEqual({
      properties: { a: { type: "object" }, b: { additionalProperties: { type: "number" } } },
    });
  });
});

describe("loadFile", () => {
  let dir = "";
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = "";
  });

  it("loads and validates the real files", () => {
    useDataDir(REAL);
    const index = loadFile("latest/index.json", "index");
    const snapshot = loadFile("latest/premier_league.json", "snapshot");
    const summary = loadFile("track_record/summary.json", "track_record");
    expect([index.status, snapshot.status, summary.status]).toEqual(["ok", "ok", "ok"]);
  });

  it("reports a missing file instead of throwing", () => {
    useDataDir(REAL);
    expect(loadFile("latest/nope.json", "snapshot")).toEqual({ status: "missing", path: "latest/nope.json" });
  });

  it("accepts unknown fields from a newer MINOR version", () => {
    dir = copyOfReal();
    editJson(dir, "latest/premier_league.json", (d) => {
      d["contract_version"] = "1.4.0";
      d["a_field_added_later"] = { anything: true };
      (d["teams"] as Record<string, unknown>[])[0]!["short_name"] = "Man City";
    });
    useDataDir(dir);
    expect(loadFile("latest/premier_league.json", "snapshot")).toMatchObject({
      status: "ok",
      version: "1.4.0",
    });
  });

  it("returns 'unsupported' for a different MAJOR, before validating", () => {
    dir = copyOfReal();
    editJson(dir, "latest/premier_league.json", (d) => {
      d["contract_version"] = "2.0.0";
      delete d["teams"]; // a MAJOR change may remove fields: must not be reported as invalid
    });
    useDataDir(dir);
    expect(loadFile("latest/premier_league.json", "snapshot")).toEqual({
      status: "unsupported",
      path: "latest/premier_league.json",
      found: "2.0.0",
    });
  });

  it("stops the build on a file that breaks the contract", () => {
    dir = copyOfReal();
    editJson(dir, "latest/premier_league.json", (d) => {
      delete d["table"];
    });
    useDataDir(dir);
    expect(() => loadFile("latest/premier_league.json", "snapshot")).toThrow(DataError);
  });

  it("stops the build on a file that isn't JSON", async () => {
    dir = copyOfReal();
    const { writeFileSync } = await import("node:fs");
    writeFileSync(join(dir, "latest/index.json"), "{ not json");
    useDataDir(dir);
    expect(() => loadFile("latest/index.json", "index")).toThrow(/not valid JSON/);
  });
});

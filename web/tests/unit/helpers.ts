// Test helpers: point the data layer at a folder of published files.
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/** Real files from the `data` branch at commit 16a5512 (29 Sep 2026 run). */
export const REAL = resolve("tests/fixtures/data-16a5512");

export function useDataDir(dir: string): void {
  process.env["TABLETALK_DATA_DIR"] = dir;
}

/** A throwaway copy of the real fixtures, for edge cases (edited files, missing files). */
export function copyOfReal(): string {
  const dir = mkdtempSync(join(tmpdir(), "tabletalk-"));
  cpSync(REAL, dir, { recursive: true });
  return dir;
}

export function editJson(
  dir: string,
  relativePath: string,
  edit: (data: Record<string, unknown>) => void,
): void {
  const path = join(dir, relativePath);
  const data = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  edit(data);
  writeFileSync(path, JSON.stringify(data));
}

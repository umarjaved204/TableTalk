// Which commit of the `data` branch this build was made from (written by
// scripts/fetch-data.mjs). Shown in the footer so every page says exactly
// which published files it was built from.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "./paths.ts";

export interface DataSource {
  commit: string;
  copiedAt: string;
}

export function dataSource(): DataSource | null {
  const path = join(dataDir(), "SOURCE.json");
  if (!existsSync(path)) return null;
  const raw = JSON.parse(readFileSync(path, "utf8")) as { commit?: string; copied_at?: string };
  return raw.commit && raw.copied_at ? { commit: raw.commit, copiedAt: raw.copied_at } : null;
}

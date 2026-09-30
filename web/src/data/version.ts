// Contract versions are MAJOR.MINOR.PATCH (see contracts/README.md).
// A MINOR or PATCH difference is safe: fields are only ever added, so the site
// ignores fields it doesn't know. A different MAJOR means a field was removed,
// renamed or changed meaning, so the site must not show the numbers.

/** The contract MAJOR version this site was written for. */
export const SUPPORTED_MAJOR = 1;

export type VersionCheck =
  | { ok: true; version: string; major: number; minor: number }
  | { ok: false; found: string | null; reason: "missing" | "malformed" | "different-major" };

export function checkVersion(value: unknown): VersionCheck {
  if (value === undefined || value === null) return { ok: false, found: null, reason: "missing" };
  if (typeof value !== "string") return { ok: false, found: String(value), reason: "malformed" };
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
  if (!match) return { ok: false, found: value, reason: "malformed" };
  const major = Number(match[1]);
  const minor = Number(match[2]);
  if (major !== SUPPORTED_MAJOR) return { ok: false, found: value, reason: "different-major" };
  return { ok: true, version: value, major, minor };
}

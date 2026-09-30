// Read one published file, check its contract version, then validate it.
//
// Order matters: the version is checked first, because a file from a newer
// MAJOR version may not match our schema at all, and the right message for it
// is "newer format", not "invalid".
//
// Validation uses a RELAXED copy of each contract schema: the published
// schemas say `additionalProperties: false` (they describe exactly what the
// pipeline writes), but a reader must accept fields added by a later MINOR
// version. So `relax()` removes every `additionalProperties: false`.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Ajv2020, type ValidateFunction } from "ajv/dist/2020.js";
import { CONTRACTS_DIR, dataDir } from "./paths.ts";
import { checkVersion } from "./version.ts";

export type ContractFile = "index" | "snapshot" | "track_record";

const SCHEMA_FILES: Record<ContractFile, string> = {
  index: "index.schema.json",
  snapshot: "snapshot.schema.json",
  track_record: "track_record.schema.json",
};

export type FileResult<T> =
  | { status: "ok"; path: string; data: T; version: string }
  | { status: "missing"; path: string }
  | { status: "unsupported"; path: string; found: string | null };

/** A published file that exists but is broken. The pipeline checks every file
 *  against the contract before publishing, so this means something is badly
 *  wrong: the build stops rather than show numbers we can't trust. */
export class DataError extends Error {
  override name = "DataError";
}

/** Remove every `additionalProperties: false`, recursively. */
export function relax(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(relax);
  if (schema === null || typeof schema !== "object") return schema;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === "additionalProperties" && value === false) continue;
    out[key] = relax(value);
  }
  return out;
}

const validators = new Map<ContractFile, ValidateFunction>();

function validatorFor(kind: ContractFile): ValidateFunction {
  let validate = validators.get(kind);
  if (!validate) {
    const schema = JSON.parse(readFileSync(join(CONTRACTS_DIR, SCHEMA_FILES[kind]), "utf8"));
    validate = new Ajv2020({ allErrors: true, strict: false }).compile(relax(schema) as object);
    validators.set(kind, validate);
  }
  return validate;
}

/** Load `relativePath` (inside the data folder) as a contract file of the given kind. */
export function loadFile<T>(relativePath: string, kind: ContractFile): FileResult<T> {
  const path = join(dataDir(), relativePath);
  if (!existsSync(path)) return { status: "missing", path: relativePath };

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new DataError(`${relativePath} is not valid JSON: ${(error as Error).message}`);
  }
  const versionField =
    parsed !== null && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)["contract_version"]
      : null;
  const version = checkVersion(versionField);
  if (!version.ok) return { status: "unsupported", path: relativePath, found: version.found };

  const validate = validatorFor(kind);
  if (!validate(parsed)) {
    const problems = (validate.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message}`).join("; ");
    throw new DataError(`${relativePath} does not match the ${kind} contract: ${problems}`);
  }
  return { status: "ok", path: relativePath, data: parsed as T, version: version.version };
}

import { dirname, resolve } from "node:path";
import { createHashupCache, type HashupCache } from "../lib/cache.js";
import { combineHashes } from "../lib/combine-hashes.js";
import { createResolver } from "../lib/create-resolver.js";
import { hashup, type HashupResult } from "../lib/hashup.js";
import type { LogLevel } from "../lib/logger.js";
import type { UnresolvedImport } from "../lib/unresolved-import.js";
import { dedupeUnresolved } from "./dedupe-unresolved.js";
import { expandPaths } from "./expand-paths.js";
import { formatNamedResults } from "./format-output.js";
import { loadConfig } from "./load-config.js";
import { resolveFrom } from "./resolve-from.js";

export interface RunConfigModeInput {
  cwd: string;
  configPath: string | undefined;
  baseDirOverride: string | undefined;
  json: boolean;
  files: boolean;
  logLevel?: LogLevel | undefined;
  /** `false` (from `--no-tsconfig`) wins over the config's `tsconfig` field. */
  tsconfig?: boolean | undefined;
  /** From `--fail-on-unresolved[=<n>]`; wins over the config's `failOnUnresolved`. */
  failOnUnresolved?: number | undefined;
}

export type RunConfigModeResult =
  | {
      ok: true;
      output: string;
      /** Every unresolved edge across all entries, deduplicated and sorted. */
      unresolved: UnresolvedImport[];
      /** Effective log level after merging flag and config. */
      logLevel: LogLevel | undefined;
      /** Effective threshold after merging flag and config; `undefined` = never fail. */
      failOnUnresolved: number | undefined;
    }
  | { ok: false; error: string };

/**
 * Sentinel emitted when an entry's `entry` pattern matches zero files.
 * Chosen to be visually distinct and lexicographically invalid as a
 * hex digest so consumers can't confuse it with a real hash.
 */
export const NO_HASH = "<no-hash>";

export async function runConfigMode(input: RunConfigModeInput): Promise<RunConfigModeResult> {
  const configPath = resolve(input.cwd, input.configPath ?? "hashup.json");
  const loaded = await loadConfig(configPath);
  if (!loaded.ok) {
    return loaded;
  }

  const configDir = dirname(configPath);
  const rootBase = resolveRootBase({
    cwd: input.cwd,
    configDir,
    override: input.baseDirOverride,
    fromFile: loaded.data.baseDir,
  });

  // One shared cache + resolver for every entry in this invocation:
  // files imported by multiple named entries (shared utilities, common
  // types) are read and hashed once instead of once per entry.
  const cache = createHashupCache();
  const resolver = createResolver();
  const logLevel = input.logLevel ?? loaded.data.logLevel;
  const tsconfig = input.tsconfig === false ? false : (loaded.data.tsconfig ?? true);
  const failOnUnresolved = input.failOnUnresolved ?? normalizeFailOn(loaded.data.failOnUnresolved);
  const shared: SharedOptions = { logLevel, tsconfig, cache, resolver };

  const results: Record<string, HashupResult> = {};
  for (const [name, entry] of Object.entries(loaded.data.entries)) {
    const baseDir = entry.baseDir !== undefined ? resolveFrom(configDir, entry.baseDir) : rootBase;
    const entryFiles = await expandPaths([entry.entry], baseDir);
    if (entryFiles.length === 0) {
      // Zero-match globs are a valid state (feature flags off, package
      // doesn't have tests yet, etc.) — emit a sentinel hash instead
      // of failing the whole run. Downstream tooling can detect it.
      results[name] = { hash: NO_HASH, files: [], unresolved: [] };
      continue;
    }
    const extras = entry.extras ? await expandPaths(entry.extras, baseDir) : [];
    results[name] = await hashEntrySet(entryFiles, extras, baseDir, shared);
  }

  return {
    ok: true,
    output: formatNamedResults(results, { json: input.json, files: input.files }),
    unresolved: dedupeUnresolved(Object.values(results).map((r) => r.unresolved)),
    logLevel,
    failOnUnresolved,
  };
}

function normalizeFailOn(value: boolean | number | undefined): number | undefined {
  if (value === undefined || value === false) return undefined;
  return value === true ? 0 : value;
}

interface SharedOptions {
  logLevel: LogLevel | undefined;
  tsconfig: boolean;
  cache: HashupCache;
  resolver: ReturnType<typeof createResolver>;
}

interface ResolveRootBaseInput {
  cwd: string;
  configDir: string;
  override: string | undefined;
  fromFile: string | undefined;
}

function resolveRootBase({ cwd, configDir, override, fromFile }: ResolveRootBaseInput): string {
  if (override !== undefined) {
    return resolveFrom(cwd, override);
  }
  if (fromFile !== undefined) {
    return resolveFrom(configDir, fromFile);
  }
  // Default to the current working directory, not the config's
  // directory. Running `hashup --cwd ./pkg` or `cd pkg && hashup`
  // resolves globs against the invocation point, which is what most
  // users expect; to get the old config-relative behavior, set
  // `"baseDir": "."` in `hashup.json`.
  return cwd;
}

/**
 * Hash every matched entry file in a named entry set and fold the results
 * into a single deterministic hash. Extras are attached to the first call
 * only so they contribute exactly once, regardless of how many files the
 * glob matched. When the entry expands to a single file the outer combine
 * is skipped so non-glob entries keep their historical hash.
 */
async function hashEntrySet(
  entryFiles: string[],
  extras: string[],
  baseDir: string,
  shared: SharedOptions,
): Promise<HashupResult> {
  const perFile: HashupResult[] = [];
  for (let i = 0; i < entryFiles.length; i++) {
    const entry = entryFiles[i]!;
    const options =
      i === 0 && extras.length > 0 ? { ...shared, extras, baseDir } : { ...shared, baseDir };
    perFile.push(await hashup(entry, options));
  }

  if (perFile.length === 1) {
    return perFile[0]!;
  }

  const files = Array.from(new Set(perFile.flatMap((r) => r.files))).sort();
  const hash = combineHashes(perFile.map((r) => r.hash));
  const unresolved = dedupeUnresolved(perFile.map((r) => r.unresolved));
  return { hash, files, unresolved };
}

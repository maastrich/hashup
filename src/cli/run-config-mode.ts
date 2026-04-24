import { dirname, resolve } from "node:path";
import { createHashupCache, type HashupCache } from "../lib/cache.js";
import { combineHashes } from "../lib/combine-hashes.js";
import { createResolver } from "../lib/create-resolver.js";
import { hashup, type HashupResult } from "../lib/hashup.js";
import type { LogLevel } from "../lib/logger.js";
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
}

export type RunConfigModeResult = { ok: true; output: string } | { ok: false; error: string };

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

  const results: Record<string, HashupResult> = {};
  for (const [name, entry] of Object.entries(loaded.data.entries)) {
    const baseDir = entry.baseDir !== undefined ? resolveFrom(configDir, entry.baseDir) : rootBase;
    const entryFiles = await expandPaths([entry.entry], baseDir);
    if (entryFiles.length === 0) {
      return {
        ok: false,
        error: `entries.${name}: pattern "${entry.entry}" matched no files`,
      };
    }
    const extras = entry.extras ? await expandPaths(entry.extras, baseDir) : [];
    const logLevel = input.logLevel ?? loaded.data.logLevel;
    results[name] = await hashEntrySet(entryFiles, extras, baseDir, logLevel, cache, resolver);
  }

  return {
    ok: true,
    output: formatNamedResults(results, { json: input.json, files: input.files }),
  };
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
  return configDir;
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
  logLevel: LogLevel | undefined,
  cache: HashupCache,
  resolver: ReturnType<typeof createResolver>,
): Promise<HashupResult> {
  const perFile: HashupResult[] = [];
  for (let i = 0; i < entryFiles.length; i++) {
    const entry = entryFiles[i]!;
    const options =
      i === 0 && extras.length > 0
        ? { extras, baseDir, logLevel, cache, resolver }
        : { baseDir, logLevel, cache, resolver };
    perFile.push(await hashup(entry, options));
  }

  if (perFile.length === 1) {
    return perFile[0]!;
  }

  const files = Array.from(new Set(perFile.flatMap((r) => r.files))).sort();
  const hash = combineHashes(perFile.map((r) => r.hash));
  return { hash, files };
}

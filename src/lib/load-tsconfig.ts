import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, isAbsolute, resolve } from "node:path";
import type { HashupCache } from "./cache.js";
import { parseJsonc } from "./parse-jsonc.js";

export interface TsconfigPathPattern {
  /** Pattern as written, e.g. `@/*` or `@/config.json`. */
  pattern: string;
  /** Text before the `*` (whole pattern when there is no `*`). */
  prefix: string;
  /** Text after the `*` (empty when there is no `*`). */
  suffix: string;
  hasStar: boolean;
  /** Absolute target templates, `*` still present where it was. */
  targets: string[];
}

export interface TsconfigPaths {
  /** The config file `file` resolved to. */
  configPath: string;
  /** Absolute `baseUrl`, if any config in the chain set one. */
  baseUrl: string | undefined;
  /** `paths` entries, already anchored to absolute directories. */
  paths: TsconfigPathPattern[];
}

interface RawTsconfig {
  extends?: string | string[];
  compilerOptions?: {
    baseUrl?: string;
    paths?: Record<string, string[]>;
  };
}

/**
 * Parse a `tsconfig.json` (honouring `extends`, including chains that
 * cross package boundaries) down to the two things hashup needs for
 * module resolution: `baseUrl` and `paths`. Results are memoised by
 * config path in `cache.tsconfigs`; a config is never read twice.
 *
 * Semantics follow TypeScript: `paths` in a child replace the parent's
 * wholesale; relative `paths` targets are anchored at `baseUrl` when
 * set, otherwise at the directory of the config that declared them.
 * A config that fails to read or parse yields `null` (and is logged by
 * the caller).
 */
export async function loadTsconfig(
  configPath: string,
  cache: HashupCache,
): Promise<TsconfigPaths | null> {
  const memo = cache.tsconfigs.get(configPath);
  if (memo !== undefined) return memo;
  let result: TsconfigPaths | null;
  try {
    result = await loadChain(configPath, new Set());
  } catch {
    result = null;
  }
  cache.tsconfigs.set(configPath, result);
  return result;
}

interface Collected {
  baseUrl: string | undefined;
  paths: Record<string, string[]> | undefined;
  pathsDir: string;
}

async function loadChain(configPath: string, seen: Set<string>): Promise<TsconfigPaths | null> {
  const collected = await collect(configPath, seen);
  if (!collected) return null;
  const { baseUrl, paths, pathsDir } = collected;
  const anchor = baseUrl ?? pathsDir;
  const patterns: TsconfigPathPattern[] = [];
  for (const [pattern, targets] of Object.entries(paths ?? {})) {
    const star = pattern.indexOf("*");
    patterns.push({
      pattern,
      prefix: star === -1 ? pattern : pattern.slice(0, star),
      suffix: star === -1 ? "" : pattern.slice(star + 1),
      hasStar: star !== -1,
      targets: targets.map((t) => (isAbsolute(t) ? t : resolve(anchor, t))),
    });
  }
  return { configPath, baseUrl, paths: patterns };
}

async function collect(configPath: string, seen: Set<string>): Promise<Collected | null> {
  if (seen.has(configPath)) return null;
  seen.add(configPath);
  const raw = parseJsonc(await readFile(configPath, "utf8")) as RawTsconfig | null;
  if (raw === null || typeof raw !== "object") return null;
  const dir = dirname(configPath);

  let merged: Collected = { baseUrl: undefined, paths: undefined, pathsDir: dir };
  const bases = raw.extends === undefined ? [] : ([] as string[]).concat(raw.extends);
  for (const base of bases) {
    const basePath = resolveExtends(base, dir);
    if (basePath === null) continue;
    const parent = await collect(basePath, seen);
    if (parent) merged = { ...merged, ...definedOnly(parent) };
  }

  const own = raw.compilerOptions ?? {};
  if (own.baseUrl !== undefined) merged.baseUrl = resolve(dir, own.baseUrl);
  if (own.paths !== undefined) {
    merged.paths = own.paths;
    merged.pathsDir = dir;
  }
  return merged;
}

function definedOnly(c: Collected): Partial<Collected> {
  const out: Partial<Collected> = {};
  if (c.baseUrl !== undefined) out.baseUrl = c.baseUrl;
  if (c.paths !== undefined) {
    out.paths = c.paths;
    out.pathsDir = c.pathsDir;
  }
  return out;
}

/**
 * Resolve an `extends` value: relative/absolute paths against the config's
 * directory (with an implicit `.json`), bare names through Node resolution
 * from the config's directory (`@tsconfig/node20`, `configs/ts-config`).
 */
function resolveExtends(value: string, fromDir: string): string | null {
  if (value.startsWith(".") || isAbsolute(value)) {
    const direct = resolve(fromDir, value);
    if (existsSync(direct)) return direct;
    if (existsSync(`${direct}.json`)) return `${direct}.json`;
    return null;
  }
  const req = createRequire(resolve(fromDir, "noop.js"));
  for (const candidate of [value, `${value}.json`, `${value}/tsconfig.json`]) {
    try {
      return req.resolve(candidate);
    } catch {
      // try next
    }
  }
  return null;
}

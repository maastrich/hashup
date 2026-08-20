import type { Resolver } from "enhanced-resolve";
import type { HashupCache } from "./cache.js";
import { findTsconfig } from "./find-tsconfig.js";
import { loadTsconfig, type TsconfigPaths } from "./load-tsconfig.js";
import { mapTsconfigPaths } from "./map-tsconfig-paths.js";
import { resolveImport } from "./resolve-import.js";
import { stripQuery } from "./strip-query.js";

export interface ResolveSpecifierOptions {
  /** Apply the nearest tsconfig's `paths` / `baseUrl`. Default `true`. */
  tsconfig?: boolean;
}

/**
 * Resolve one import specifier from `sourceFile` to an absolute path.
 *
 * Order: strip `?query` / `#fragment`, try each tsconfig `paths` /
 * `baseUrl` candidate (longest-prefix match, targets in order), then
 * fall back to plain Node/bundler resolution through enhanced-resolve.
 * Returns `false` when nothing matches.
 */
export async function resolveSpecifier(
  resolver: Resolver,
  sourceFile: string,
  specifier: string,
  cache: HashupCache,
  options: ResolveSpecifierOptions = {},
): Promise<string | false> {
  const bare = stripQuery(specifier);
  if (bare.length === 0) return false;

  if (options.tsconfig !== false) {
    const tsconfig = await tsconfigFor(sourceFile, cache);
    if (tsconfig !== null) {
      for (const candidate of mapTsconfigPaths(bare, tsconfig)) {
        const resolved = await resolveImport(resolver, sourceFile, candidate);
        if (resolved) return stripQuery(resolved);
      }
    }
  }

  const resolved = await resolveImport(resolver, sourceFile, bare);
  return resolved ? stripQuery(resolved) : false;
}

/** Nearest parsed tsconfig for `file`, memoised through the cache. */
export async function tsconfigFor(file: string, cache: HashupCache): Promise<TsconfigPaths | null> {
  const configPath = findTsconfig(file, cache);
  if (configPath === null) return null;
  return await loadTsconfig(configPath, cache);
}

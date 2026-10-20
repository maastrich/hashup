import { createHashupCache, type HashupCache } from "../lib/cache.js";
import { createResolver } from "../lib/create-resolver.js";
import type { LogLevel } from "../lib/logger.js";

export interface SharedOptions {
  logLevel: LogLevel | undefined;
  tsconfig: boolean;
  cache: HashupCache;
  resolver: ReturnType<typeof createResolver>;
}

/**
 * One cache + resolver per distinct condition set, created on first
 * use. Entries that resolve under the same conditions share them, so a
 * utility imported by several entries is read and hashed once. Entries
 * with different conditions cannot share a cache — the same file may
 * have different edges under each — and get their own pair.
 */
export function createSharedOptions(base: {
  logLevel: LogLevel | undefined;
  tsconfig: boolean;
}): (conditions: readonly string[] | undefined) => SharedOptions {
  const pools = new Map<string, SharedOptions>();
  return (conditions) => {
    const key = JSON.stringify(conditions ?? null);
    let shared = pools.get(key);
    if (shared === undefined) {
      shared = {
        ...base,
        cache: createHashupCache(),
        resolver: createResolver({ tsconfig: base.tsconfig, conditions }),
      };
      pools.set(key, shared);
    }
    return shared;
  };
}

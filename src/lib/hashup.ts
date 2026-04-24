import { resolve } from "node:path";
import type { Resolver } from "enhanced-resolve";
import { collectReachable, createHashupCache, type HashupCache } from "./cache.js";
import { combineHashes } from "./combine-hashes.js";
import { createResolver } from "./create-resolver.js";
import { hashFile } from "./hash-file.js";
import { createLogger, type LogLevel } from "./logger.js";

export interface HashupOptions {
  /**
   * Additional files to include in the hash calculation
   * (e.g., configuration files like package.json, tsconfig.json,
   * or a lockfile to pin installed dependency versions).
   */
  extras?: string[];

  /**
   * Base directory for resolving relative paths
   * @default process.cwd()
   */
  baseDir?: string;

  /**
   * Verbosity of diagnostic messages written to stderr.
   *
   * - `silent` (default): no output
   * - `warn`: file-hash failures
   * - `info`: high-level progress
   * - `debug`: per-file decisions (e.g. which node_modules paths were skipped)
   *
   * @default "silent"
   */
  logLevel?: LogLevel;

  /**
   * Optional shared cache. Pass the same cache across multiple
   * `hashup()` calls to dedupe work (a file visited by entry A is
   * reused by entry B). Scoped to one consumer's lifetime — not
   * persisted and not shared across processes.
   *
   * Create with `createHashupCache()`.
   */
  cache?: HashupCache;

  /**
   * Optional shared `enhanced-resolve` resolver. Pass a shared instance
   * across many calls to reuse its internal filesystem cache. Create
   * with `createResolver()`.
   */
  resolver?: Resolver;
}

export interface HashupResult {
  /**
   * The final deterministic hash
   */
  hash: string;

  /**
   * All file paths that contributed to this call's hash (entry +
   * extras + their transitive non-`node_modules` imports). Accurate
   * whether or not a shared cache was used.
   */
  files: string[];
}

/**
 * Resolves every import in an entry file's user-code graph and produces
 * a deterministic hash. Imports that resolve into `node_modules` are
 * treated as opaque and skipped — add a lockfile to `extras` if you
 * want install-tree changes reflected in the hash.
 *
 * The hash is `sha256` over the concatenation of each reachable file's
 * own content hash, in sorted-path order. Each file contributes exactly
 * once regardless of how many import paths reach it, which keeps memory
 * usage linear in the number of unique files.
 *
 * @param entryFile - The entry file to hash
 * @param options - Optional configuration
 * @returns The deterministic hash and list of included files
 *
 * @example
 * ```typescript
 * import { hashup } from '@maastrich/hashup';
 *
 * // Simple usage
 * const result = await hashup('./src/index.ts');
 * console.log(result.hash); // "a1b2c3d4..."
 *
 * // Pin dependency versions by folding in the lockfile
 * const result = await hashup('./src/index.ts', {
 *   extras: ['./pnpm-lock.yaml', './package.json']
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Share a cache across entries to dedupe work
 * import { hashup, createHashupCache, createResolver } from '@maastrich/hashup';
 *
 * const cache = createHashupCache();
 * const resolver = createResolver();
 * const app = await hashup('./src/app.ts', { cache, resolver });
 * const worker = await hashup('./src/worker.ts', { cache, resolver });
 * ```
 */
export async function hashup(
  entryFile: string,
  options: HashupOptions = {},
): Promise<HashupResult> {
  const {
    extras = [],
    baseDir = process.cwd(),
    logLevel = "silent",
    cache = createHashupCache(),
    resolver = createResolver(),
  } = options;

  const logger = createLogger(logLevel);
  const resolvedEntry = resolve(baseDir, entryFile);

  await hashFile(resolvedEntry, cache, resolver, logger);

  const resolvedExtras: string[] = [];
  for (const extraFile of extras) {
    const resolvedExtra = resolve(baseDir, extraFile);
    resolvedExtras.push(resolvedExtra);
    await hashFile(resolvedExtra, cache, resolver, logger);
  }

  // Reconstruct the transitive contribution by walking `cache.deps`
  // from this call's roots. Each file contributes exactly once; sort
  // by path so the combined hash is independent of traversal order.
  const files = collectReachable([resolvedEntry, ...resolvedExtras], cache).sort();

  const selfHashes: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const h = cache.hashes.get(files[i] as string);
    if (h !== undefined) selfHashes.push(h);
  }

  return { hash: combineHashes(selfHashes), files };
}

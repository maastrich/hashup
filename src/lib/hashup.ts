import { resolve } from "node:path";
import type { Resolver } from "enhanced-resolve";
import { collectReachable, createHashupCache, type HashupCache } from "./cache.js";
import { combineHashes } from "./combine-hashes.js";
import { createResolver } from "./create-resolver.js";
import { hashFile } from "./hash-file.js";
import { createLogger, type LogLevel } from "./logger.js";
import { pushAll } from "./push-all.js";

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

  const entryHashes = await hashFile(resolvedEntry, cache, resolver, logger);

  const extraHashes: string[] = [];
  const resolvedExtras: string[] = [];
  for (const extraFile of extras) {
    const resolvedExtra = resolve(baseDir, extraFile);
    resolvedExtras.push(resolvedExtra);
    const hashes = await hashFile(resolvedExtra, cache, resolver, logger);
    pushAll(extraHashes, hashes);
  }

  const combined: string[] = [];
  pushAll(combined, entryHashes);
  pushAll(combined, extraHashes);
  const finalHash = combineHashes(combined);

  // `files` is the transitive closure of this call's roots — entry +
  // extras — regardless of whether individual files were already in
  // the shared cache. Walks the `deps` map, which is cheap.
  const files = collectReachable([resolvedEntry, ...resolvedExtras], cache);

  return { hash: finalHash, files };
}

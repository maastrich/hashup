import { resolve } from "node:path";
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
}

export interface HashupResult {
  /**
   * The final deterministic hash
   */
  hash: string;

  /**
   * All file paths that were included in the hash calculation
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
 */
export async function hashup(
  entryFile: string,
  options: HashupOptions = {},
): Promise<HashupResult> {
  const { extras = [], baseDir = process.cwd(), logLevel = "silent" } = options;

  const logger = createLogger(logLevel);
  const resolvedEntry = resolve(baseDir, entryFile);
  const cache = new Map<string, string[]>();
  const resolver = createResolver();

  const entryHashes = await hashFile(resolvedEntry, cache, resolver, logger);

  const extraHashes: string[] = [];
  for (const extraFile of extras) {
    const resolvedExtra = resolve(baseDir, extraFile);
    const hashes = await hashFile(resolvedExtra, cache, resolver, logger);
    pushAll(extraHashes, hashes);
  }

  const combined: string[] = [];
  pushAll(combined, entryHashes);
  pushAll(combined, extraHashes);
  const finalHash = combineHashes(combined);
  const files = Array.from(cache.keys());

  return { hash: finalHash, files };
}

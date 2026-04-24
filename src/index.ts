import { resolve } from "node:path";
import { hashFile } from "./hash.js";
import { combineHashes } from "./file-operations.js";
import { createResolver } from "./resolve-imports.js";

export interface HashupOptions {
  /**
   * Additional files to include in the hash calculation
   * (e.g., configuration files like package.json, tsconfig.json)
   */
  extras?: string[];

  /**
   * Base directory for resolving relative paths
   * @default process.cwd()
   */
  baseDir?: string;
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
 * Resolves every import and produces a fully deterministic hash for any entry file.
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
 * // Include extra files
 * const result = await hashup('./src/index.ts', {
 *   extras: ['./package.json', './tsconfig.json']
 * });
 * ```
 */
export async function hashup(
  entryFile: string,
  options: HashupOptions = {},
): Promise<HashupResult> {
  const { extras = [], baseDir = process.cwd() } = options;

  const resolvedEntry = resolve(baseDir, entryFile);
  const cache = new Map<string, string[]>();
  const resolver = createResolver();

  // Hash the entry file and all its dependencies
  const entryHashes = await hashFile(resolvedEntry, cache, resolver);

  // Hash extra files if provided
  const extraHashes: string[] = [];
  for (const extraFile of extras) {
    const resolvedExtra = resolve(baseDir, extraFile);
    const hashes = await hashFile(resolvedExtra, cache, resolver);
    extraHashes.push(...hashes);
  }

  // Combine all hashes into a single deterministic hash
  const finalHash = combineHashes([...entryHashes, ...extraHashes]);

  // Get all files that were processed
  const files = Array.from(cache.keys());

  return {
    hash: finalHash,
    files,
  };
}

// Re-export utilities for advanced usage
export { createContentHash, combineHashes } from "./file-operations.js";
export { createResolver, resolveImport } from "./resolve-imports.js";
export { extractImports } from "./extract-imports.js";
export { hashFile } from "./hash.js";

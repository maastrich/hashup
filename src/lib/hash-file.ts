import type { Resolver } from "enhanced-resolve";
import { type HashupCache } from "./cache.js";
import { createContentHash } from "./create-content-hash.js";
import { extractImports } from "./extract-imports.js";
import { isInNodeModules } from "./is-in-node-modules.js";
import { createLogger, type Logger } from "./logger.js";
import { readFileContent } from "./read-file-content.js";
import { resolveImport } from "./resolve-import.js";

/**
 * Ensure `file` and every file reachable from it are present in the
 * cache. Returns the file's own content hash (sha256 hex) on success,
 * or `null` if the file could not be read or parsed — in which case
 * callers should skip it. The transitive contribution is reconstructed
 * at combine time by walking `cache.deps`.
 *
 * Terminates deterministically on circular imports: the cache entry is
 * seeded with the self hash before recursing, so a cycle A → B → A
 * short-circuits on the revisit.
 */
export async function hashFile(
  file: string,
  cache: HashupCache,
  resolver: Resolver,
  logger: Logger = createLogger("silent"),
): Promise<string | null> {
  const cached = cache.hashes.get(file);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const content = await readFileContent(file);
    const selfHash = createContentHash(content);
    const deps: string[] = [];
    cache.hashes.set(file, selfHash);
    cache.deps.set(file, deps);

    const imports = await extractImports(file, content);
    await walkDependencies(imports, file, cache, resolver, logger, deps);

    return selfHash;
  } catch (error) {
    logger.warn(`Failed to hash file ${file}:`, error);
    cache.hashes.delete(file);
    cache.deps.delete(file);
    return null;
  }
}

async function walkDependencies(
  imports: string[],
  sourceFile: string,
  cache: HashupCache,
  resolver: Resolver,
  logger: Logger,
  deps: string[],
): Promise<void> {
  for (const imported of imports) {
    const resolved = await resolveImport(resolver, sourceFile, imported);
    if (!resolved) continue;
    // Dependencies installed into `node_modules` are opaque: we don't
    // walk their files. Users that need to pin to installed versions
    // can add their lockfile (pnpm-lock.yaml / package-lock.json /
    // yarn.lock) to `extras` so any install-tree change still shifts
    // the final hash.
    if (isInNodeModules(resolved)) {
      logger.debug(`Skipping node_modules dependency: ${resolved}`);
      continue;
    }
    deps.push(resolved);
    await hashFile(resolved, cache, resolver, logger);
  }
}

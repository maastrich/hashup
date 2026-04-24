import type { Resolver } from "enhanced-resolve";
import { type HashupCache } from "./cache.js";
import { createContentHash } from "./create-content-hash.js";
import { extractImports } from "./extract-imports.js";
import { isInNodeModules } from "./is-in-node-modules.js";
import { createLogger, type Logger } from "./logger.js";
import { pushAll } from "./push-all.js";
import { readFileContent } from "./read-file-content.js";
import { resolveImport } from "./resolve-import.js";

export async function hashFile(
  file: string,
  cache: HashupCache,
  resolver: Resolver,
  logger: Logger = createLogger("silent"),
): Promise<string[]> {
  const cached = cache.hashes.get(file);
  if (cached) {
    return cached;
  }

  try {
    const content = await readFileContent(file);
    const hashes = [createContentHash(content)];
    const deps: string[] = [];
    // Seed both caches before recursing so circular imports terminate:
    // on a cycle A → B → A, the revisit of A hits `cache.hashes` and
    // returns the placeholder instead of walking forever.
    cache.hashes.set(file, hashes);
    cache.deps.set(file, deps);

    const imports = await extractImports(file, content);
    const dependencyHashes = await hashDependencies(imports, file, cache, resolver, logger, deps);
    pushAll(hashes, dependencyHashes);

    return hashes;
  } catch (error) {
    logger.warn(`Failed to hash file ${file}:`, error);
    cache.hashes.delete(file);
    cache.deps.delete(file);
    return [];
  }
}

async function hashDependencies(
  imports: string[],
  sourceFile: string,
  cache: HashupCache,
  resolver: Resolver,
  logger: Logger,
  deps: string[],
): Promise<string[]> {
  const hashes: string[] = [];

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
    const resolvedHashes = await hashFile(resolved, cache, resolver, logger);
    pushAll(hashes, resolvedHashes);
  }

  return hashes;
}

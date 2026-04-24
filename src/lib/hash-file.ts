import type { Resolver } from "enhanced-resolve";
import { createContentHash } from "./create-content-hash.js";
import { extractImports } from "./extract-imports.js";
import { pushAll } from "./push-all.js";
import { readFileContent } from "./read-file-content.js";
import { resolveImport } from "./resolve-import.js";

export async function hashFile(
  file: string,
  cache: Map<string, string[]>,
  resolver: Resolver,
): Promise<string[]> {
  const cached = cache.get(file);
  if (cached) {
    return cached;
  }

  try {
    const content = await readFileContent(file);
    const fileHash = createContentHash(content);
    const hashes = [fileHash];
    // Seed the cache before recursing so that circular imports terminate:
    // on a cycle A → B → A, the revisit of A returns this placeholder
    // instead of walking forever until the stack blows.
    cache.set(file, hashes);

    const imports = await extractImports(file, content);
    const dependencyHashes = await hashDependencies(imports, file, cache, resolver);
    pushAll(hashes, dependencyHashes);

    return hashes;
  } catch (error) {
    console.warn(`Failed to hash file ${file}:`, error);
    cache.delete(file);
    return [];
  }
}

async function hashDependencies(
  imports: string[],
  sourceFile: string,
  cache: Map<string, string[]>,
  resolver: Resolver,
): Promise<string[]> {
  const hashes: string[] = [];

  for (const imported of imports) {
    const resolved = await resolveImport(resolver, sourceFile, imported);
    if (resolved) {
      const resolvedHashes = await hashFile(resolved, cache, resolver);
      pushAll(hashes, resolvedHashes);
    }
  }

  return hashes;
}

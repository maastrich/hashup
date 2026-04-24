import type { Resolver } from "enhanced-resolve";
import { createContentHash } from "./create-content-hash.js";
import { extractImports } from "./extract-imports.js";
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

    const imports = await extractImports(file, content);
    const dependencyHashes = await hashDependencies(imports, file, cache, resolver);
    hashes.push(...dependencyHashes);

    cache.set(file, hashes);
    return hashes;
  } catch (error) {
    console.warn(`Failed to hash file ${file}:`, error);
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
      hashes.push(...resolvedHashes);
    }
  }

  return hashes;
}

import { isBuiltin } from "node:module";
import type { Resolver } from "enhanced-resolve";
import { type HashupCache } from "./cache.js";
import { createContentHash } from "./create-content-hash.js";
import { expandGlobImports } from "./expand-glob-imports.js";
import { extractGlobPatterns } from "./extract-glob-patterns.js";
import { extractImports } from "./extract-imports.js";
import { isInNodeModules } from "./is-in-node-modules.js";
import { createLogger, type Logger } from "./logger.js";
import { readFileContent } from "./read-file-content.js";
import { resolveSpecifier } from "./resolve-specifier.js";
import type { UnresolvedImport, UnresolvedReason } from "./unresolved-import.js";

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
 *
 * tsconfig `paths` handling lives in the resolver — build it with
 * `createResolver({ tsconfig })`.
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

  const ctx: WalkContext = {
    cache,
    resolver,
    logger,
    deps: [],
    unresolved: [],
  };
  try {
    const content = await readFileContent(file);
    const selfHash = createContentHash(content);
    cache.hashes.set(file, selfHash);
    cache.deps.set(file, ctx.deps);
    cache.unresolved.set(file, ctx.unresolved);
    logger.debug(`[hash]: ${file}`);

    const imports = await extractImports(file, content);
    await walkDependencies(imports, file, ctx);
    await walkGlobs(content, file, ctx);

    return selfHash;
  } catch (error) {
    logger.warn(`Failed to hash file ${file}:`, error);
    cache.hashes.delete(file);
    cache.deps.delete(file);
    cache.unresolved.delete(file);
    return null;
  }
}

interface WalkContext {
  cache: HashupCache;
  resolver: Resolver;
  logger: Logger;
  deps: string[];
  unresolved: UnresolvedImport[];
}

async function walkDependencies(
  imports: string[],
  sourceFile: string,
  ctx: WalkContext,
): Promise<void> {
  const { resolver, logger } = ctx;
  for (const imported of imports) {
    const resolved = await resolveSpecifier(resolver, sourceFile, imported);
    if (!resolved) {
      logger.debug(`[import]: ${sourceFile} -> "${imported}" -> <unresolved>`);
      if (!isOpaqueSpecifier(imported)) report(ctx, sourceFile, imported, "unresolved");
      continue;
    }
    logger.debug(`[import]: ${sourceFile} -> "${imported}" -> ${resolved}`);
    // Dependencies installed into `node_modules` are opaque: we don't
    // walk their files. Users that need to pin to installed versions
    // can add their lockfile (pnpm-lock.yaml / package-lock.json /
    // yarn.lock) to `extras` so any install-tree change still shifts
    // the final hash.
    if (isInNodeModules(resolved)) {
      logger.debug(`[skip]: ${resolved}`);
      continue;
    }
    await addDependency(resolved, sourceFile, imported, ctx);
  }
}

/**
 * `import.meta.glob(...)` is invisible to es-module-lexer; expand each
 * literal call ourselves and walk every match like a regular import.
 */
async function walkGlobs(content: string, sourceFile: string, ctx: WalkContext): Promise<void> {
  const { calls, skipped } = extractGlobPatterns(content);
  for (const snippet of skipped) {
    ctx.logger.debug(`[glob]: ${sourceFile} -> ${snippet} -> <non-literal>`);
    report(ctx, sourceFile, snippet, "non-literal-glob");
  }
  for (const call of calls) {
    const expanded = await expandGlobImports(call.patterns, sourceFile, ctx.resolver);
    for (const pattern of expanded.unsupported) {
      ctx.logger.debug(`[glob]: ${sourceFile} -> "${pattern}" -> <unsupported>`);
      report(ctx, sourceFile, pattern, "unsupported-glob");
    }
    const label = call.patterns.join(", ");
    ctx.logger.debug(`[glob]: ${sourceFile} -> "${label}" -> ${expanded.files.length} file(s)`);
    for (const match of expanded.files) {
      if (match === sourceFile || isInNodeModules(match)) continue;
      await addDependency(match, sourceFile, label, ctx);
    }
  }
}

async function addDependency(
  resolved: string,
  sourceFile: string,
  specifier: string,
  ctx: WalkContext,
): Promise<void> {
  const hash = await hashFile(resolved, ctx.cache, ctx.resolver, ctx.logger);
  if (hash === null) {
    report(ctx, sourceFile, specifier, "unreadable");
    return;
  }
  ctx.deps.push(resolved);
}

function report(ctx: WalkContext, from: string, specifier: string, reason: UnresolvedReason): void {
  ctx.unresolved.push({ from, specifier, reason });
}

/**
 * Specifiers that never denote a file on disk and therefore must not be
 * counted as escapes: Node builtins (`fs`, `node:path`) and URL-schemed
 * virtual modules (`virtual:…`, `data:…`, `https://…`).
 */
function isOpaqueSpecifier(specifier: string): boolean {
  return isBuiltin(specifier) || /^[a-z][a-z0-9+.-]*:/i.test(specifier);
}

import { dirname, isAbsolute, join, relative } from "node:path";
import type { Resolver } from "enhanced-resolve";
import { glob, isDynamicPattern } from "tinyglobby";
import { createResolver } from "./create-resolver.js";
import { resolveImport } from "./resolve-import.js";

export interface ExpandedGlob {
  /** Absolute matched files, sorted. */
  files: string[];
  /** Patterns hashup could not anchor (root-relative or unmapped alias). */
  unsupported: string[];
}

/**
 * Expand one `import.meta.glob([...])` call's literal patterns to the
 * files it matches on disk. Relative patterns are anchored at the
 * importing file's directory; bare patterns (`@/locales/*.json`) have
 * their static prefix (`@/locales`) resolved as a directory through the
 * same tsconfig-aware resolution as imports. Root-relative patterns
 * (`/src/**`) need the bundler's root, which hashup doesn't know, so
 * they are reported as unsupported rather than silently dropped.
 *
 * Dotfiles are excluded, matching Vite's default (`exhaustive: false`).
 */
export async function expandGlobImports(
  patterns: readonly string[],
  sourceFile: string,
  resolver: Resolver,
): Promise<ExpandedGlob> {
  const cwd = dirname(sourceFile);
  const positive: string[] = [];
  const ignore: string[] = [];
  const unsupported: string[] = [];

  for (const raw of patterns) {
    const negated = raw.startsWith("!");
    const pattern = negated ? raw.slice(1) : raw;
    const anchored = await anchor(pattern, sourceFile, resolver);
    if (anchored === null) {
      unsupported.push(raw);
      continue;
    }
    (negated ? ignore : positive).push(anchored);
  }

  const files =
    positive.length === 0
      ? []
      : await glob(positive, { cwd, ignore, absolute: true, onlyFiles: true });
  return { files: files.sort(), unsupported };
}

/** Turn a pattern into one tinyglobby can run from the importing file's directory. */
async function anchor(
  pattern: string,
  sourceFile: string,
  resolver: Resolver,
): Promise<string | null> {
  if (pattern.startsWith("./") || pattern.startsWith("../")) return pattern;
  if (isAbsolute(pattern)) return null;

  // Alias pattern: split into the static directory prefix and the glob
  // tail, resolve the prefix as a directory, re-attach the tail.
  const segments = pattern.split("/");
  const firstDynamic = segments.findIndex((s) => isDynamicPattern(s));
  if (firstDynamic <= 0) return null;
  const prefix = segments.slice(0, firstDynamic).join("/");
  const tail = segments.slice(firstDynamic).join("/");
  const dir = await resolveImport(contextResolverFor(resolver), sourceFile, prefix);
  if (!dir) return null;
  return join(relative(dirname(sourceFile), dir), tail)
    .split("\\")
    .join("/");
}

// A directory-mode twin of each resolver, created lazily and reused so
// its tsconfig setting and filesystem cache follow the main resolver.
const contextResolvers = new WeakMap<Resolver, Resolver>();

function contextResolverFor(resolver: Resolver): Resolver {
  let ctx = contextResolvers.get(resolver);
  if (ctx === undefined) {
    const tsconfig = (resolver.options as { tsconfig?: unknown }).tsconfig !== false;
    ctx = createResolver({ tsconfig, resolveToContext: true });
    contextResolvers.set(resolver, ctx);
  }
  return ctx;
}

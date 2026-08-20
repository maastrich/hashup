import { dirname, isAbsolute } from "node:path";
import { glob } from "tinyglobby";
import type { HashupCache } from "./cache.js";
import { mapTsconfigPaths } from "./map-tsconfig-paths.js";
import { tsconfigFor } from "./resolve-specifier.js";

export interface ExpandedGlob {
  /** Absolute matched files, sorted. */
  files: string[];
  /** Patterns hashup could not anchor (root-relative or unmapped alias). */
  unsupported: string[];
}

/**
 * Expand one `import.meta.glob([...])` call's literal patterns to the
 * files it matches on disk. Relative patterns are anchored at the
 * importing file's directory; bare patterns (`@/locales/*.json`) go
 * through tsconfig `paths` mapping when enabled. Root-relative patterns
 * (`/src/**`) need the bundler's root, which hashup doesn't know, so
 * they are reported as unsupported rather than silently dropped.
 */
export async function expandGlobImports(
  patterns: readonly string[],
  sourceFile: string,
  cache: HashupCache,
  useTsconfig: boolean,
): Promise<ExpandedGlob> {
  const cwd = dirname(sourceFile);
  const positive: string[] = [];
  const ignore: string[] = [];
  const unsupported: string[] = [];
  const tsconfig = useTsconfig ? await tsconfigFor(sourceFile, cache) : null;

  for (const raw of patterns) {
    const negated = raw.startsWith("!");
    const pattern = negated ? raw.slice(1) : raw;
    const anchored = anchor(pattern, tsconfig);
    if (anchored === null) {
      unsupported.push(raw);
      continue;
    }
    (negated ? ignore : positive).push(anchored);
  }

  const files =
    positive.length === 0
      ? []
      : await glob(positive, { cwd, ignore, absolute: true, onlyFiles: true, dot: true });
  return { files: files.sort(), unsupported };

  function anchor(pattern: string, ts: typeof tsconfig): string | null {
    if (pattern.startsWith("./") || pattern.startsWith("../")) return pattern;
    if (isAbsolute(pattern)) return null;
    if (ts === null) return null;
    const mapped = mapTsconfigPaths(pattern, ts);
    return mapped.length > 0 ? (mapped[0] as string) : null;
  }
}

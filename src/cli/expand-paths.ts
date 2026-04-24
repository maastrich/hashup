import { isAbsolute, resolve } from "node:path";
import { glob, isDynamicPattern } from "tinyglobby";

/**
 * Expand a list of paths (literal file paths or glob patterns) into a
 * sorted, unique list of absolute file paths anchored at `baseDir`.
 *
 * Literal paths pass through unchanged (existence is not verified here —
 * that happens later when the file is actually read). Globs are matched
 * against `baseDir` with `onlyFiles: true`, so directories never appear in
 * the output.
 */
export async function expandPaths(patterns: string[], baseDir: string): Promise<string[]> {
  const literals: string[] = [];
  const globs: string[] = [];
  for (const pattern of patterns) {
    if (isDynamicPattern(pattern)) {
      globs.push(pattern);
    } else {
      literals.push(pattern);
    }
  }

  const matched =
    globs.length > 0 ? await glob(globs, { cwd: baseDir, absolute: true, onlyFiles: true }) : [];

  const resolvedLiterals = literals.map((p) => (isAbsolute(p) ? p : resolve(baseDir, p)));

  return Array.from(new Set([...resolvedLiterals, ...matched])).sort();
}

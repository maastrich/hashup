import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type { HashupCache } from "./cache.js";

/**
 * Locate the nearest `tsconfig.json` for `file`, walking up from its
 * directory to the filesystem root. Every directory visited is memoised
 * in `cache.tsconfigDirs`, so a run over thousands of files in the same
 * package touches the filesystem once per directory, not once per file.
 *
 * Returns the absolute config path or `null` when none exists.
 */
export function findTsconfig(file: string, cache: HashupCache): string | null {
  const start = dirname(file);
  const visited: string[] = [];
  let dir = start;
  let found: string | null = null;
  for (;;) {
    const memo = cache.tsconfigDirs.get(dir);
    if (memo !== undefined) {
      found = memo;
      break;
    }
    visited.push(dir);
    const candidate = join(dir, "tsconfig.json");
    if (existsSync(candidate)) {
      found = candidate;
      break;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  for (const d of visited) cache.tsconfigDirs.set(d, found);
  return found;
}

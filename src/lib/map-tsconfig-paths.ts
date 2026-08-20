import { resolve } from "node:path";
import type { TsconfigPaths } from "./load-tsconfig.js";

/**
 * Apply TypeScript `paths` / `baseUrl` mapping to a bare specifier and
 * return the absolute candidate paths to try, in order. Empty when the
 * specifier is relative/absolute or nothing matches.
 *
 * Matching follows `tsc`: the pattern with the longest prefix wins; `*`
 * captures the remainder and is substituted into every target, which are
 * tried in declaration order. When no pattern matches but `baseUrl` is
 * set, the specifier is tried relative to `baseUrl`.
 */
export function mapTsconfigPaths(specifier: string, tsconfig: TsconfigPaths): string[] {
  if (specifier.startsWith(".") || specifier.startsWith("/")) return [];

  let best: { captured: string; targets: string[] } | null = null;
  let bestPrefix = -1;
  for (const p of tsconfig.paths) {
    if (!p.hasStar) {
      if (specifier === p.pattern && p.prefix.length > bestPrefix) {
        best = { captured: "", targets: p.targets };
        bestPrefix = p.prefix.length;
      }
      continue;
    }
    if (
      specifier.length >= p.prefix.length + p.suffix.length &&
      specifier.startsWith(p.prefix) &&
      specifier.endsWith(p.suffix) &&
      p.prefix.length > bestPrefix
    ) {
      best = {
        captured: specifier.slice(p.prefix.length, specifier.length - p.suffix.length),
        targets: p.targets,
      };
      bestPrefix = p.prefix.length;
    }
  }

  if (best !== null) {
    const { captured, targets } = best;
    return targets.map((t) => t.replace("*", captured));
  }
  if (tsconfig.baseUrl !== undefined) {
    return [resolve(tsconfig.baseUrl, specifier)];
  }
  return [];
}

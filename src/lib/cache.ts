/**
 * In-memory memoization for the hasher. Scoped to one consumer's
 * lifetime — not persisted, not shared across processes.
 *
 * Passing the same cache to multiple `hashup()` calls dedupes both
 * work (a file visited by entry A is reused by entry B) and
 * computation (the file's content hash is recomputed at most once).
 *
 * Two parallel maps keyed by absolute file path:
 *   - `hashes`: the file's own content hash (sha256 of its bytes).
 *     One 64-char string per file — not a flattened transitive list,
 *     because that was O(files × avg closure) and blew out the heap
 *     on large monorepos. See `hashup()` for how the transitive
 *     contribution is reconstructed at combine time.
 *   - `deps`: the file's direct resolved dependency paths. Walked by
 *     `collectReachable` to enumerate the transitive closure.
 */
export interface HashupCache {
  hashes: Map<string, string>;
  deps: Map<string, string[]>;
}

export function createHashupCache(): HashupCache {
  return { hashes: new Map(), deps: new Map() };
}

/**
 * Compute the transitive closure of `roots` against the cache's direct
 * dependency edges. Iterative — never recurses — so deep graphs cannot
 * blow the stack.
 */
export function collectReachable(roots: readonly string[], cache: HashupCache): string[] {
  const visited = new Set<string>();
  const stack: string[] = [];
  for (let i = 0; i < roots.length; i++) {
    stack.push(roots[i] as string);
  }
  while (stack.length > 0) {
    const file = stack.pop() as string;
    if (visited.has(file)) continue;
    visited.add(file);
    const depList = cache.deps.get(file);
    if (!depList) continue;
    for (let i = 0; i < depList.length; i++) {
      const d = depList[i] as string;
      if (!visited.has(d)) stack.push(d);
    }
  }
  return Array.from(visited);
}

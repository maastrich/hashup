import type { UnresolvedImport } from "../lib/unresolved-import.js";

/**
 * Merge the per-entry `unresolved` lists of a run into one sorted list
 * with each (from, specifier, reason) triple reported once — a shared
 * utility with a broken import would otherwise show up under every
 * entry that reaches it.
 */
export function dedupeUnresolved(
  lists: readonly (readonly UnresolvedImport[])[],
): UnresolvedImport[] {
  const seen = new Map<string, UnresolvedImport>();
  for (const list of lists) {
    for (const u of list) {
      seen.set(`${u.from}\0${u.specifier}\0${u.reason}`, u);
    }
  }
  return Array.from(seen.values()).sort(
    (a, b) => a.from.localeCompare(b.from) || a.specifier.localeCompare(b.specifier),
  );
}

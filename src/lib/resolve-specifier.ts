import type { Resolver } from "enhanced-resolve";
import { resolveImport } from "./resolve-import.js";
import { stripQuery } from "./strip-query.js";

/**
 * Resolve one import specifier from `sourceFile` to an absolute path.
 *
 * Strips `?query` / `#fragment` from the specifier first, then hands it
 * to enhanced-resolve (which applies tsconfig `paths` / `baseUrl` when
 * the resolver was created with `tsconfig: true`). enhanced-resolve
 * escapes a literal `#` inside a path as `\0#`; that escape is undone so
 * the result can be read from disk. Returns `false` when nothing matches.
 */
export async function resolveSpecifier(
  resolver: Resolver,
  sourceFile: string,
  specifier: string,
): Promise<string | false> {
  const bare = stripQuery(specifier);
  if (bare.length === 0) return false;
  const resolved = await resolveImport(resolver, sourceFile, bare);
  return resolved ? resolved.split("\0#").join("#") : false;
}

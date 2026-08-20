/**
 * One import edge that could not be turned into a hashed file.
 *
 * - `unresolved`: the resolver found nothing for the specifier
 * - `unreadable`: the specifier resolved, but the target could not be
 *   read or parsed
 * - `non-literal-glob`: an `import.meta.glob(...)` whose first argument
 *   is not a string literal / array of string literals
 * - `unsupported-glob`: a literal glob pattern hashup cannot anchor
 *   (root-relative `/src/**` or an alias with no tsconfig mapping)
 */
export type UnresolvedReason =
  | "unresolved"
  | "unreadable"
  | "non-literal-glob"
  | "unsupported-glob";

export interface UnresolvedImport {
  /** Absolute path of the importing file. */
  from: string;
  /** The specifier as written (query/fragment included). */
  specifier: string;
  reason: UnresolvedReason;
}

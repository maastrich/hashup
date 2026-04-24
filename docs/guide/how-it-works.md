# How it Works

`hashup` produces a deterministic hash in four steps:

1. **Resolve the entry file** against `baseDir` (defaults to `process.cwd()`).
2. **Walk the import graph** starting at the entry. Each file is parsed with
   [`es-module-lexer`](https://github.com/guybedford/es-module-lexer) to extract
   its static imports, which are then resolved with
   [`enhanced-resolve`](https://github.com/webpack/enhanced-resolve) — the same
   resolver Webpack uses. This honors `tsconfig` paths, package `exports`,
   conditional exports, and extension resolution.
3. **Hash each file's content** (SHA-256). Results are cached per absolute path
   so a file reachable through multiple paths is hashed once.
4. **Combine all hashes** — the entry's graph plus any `extras` — into a single
   deterministic SHA-256 digest.

## Determinism

The final hash depends only on:

- The resolved set of files
- Each file's content
- The order in which hashes are combined (stable for a given graph)

It does **not** depend on:

- Timestamps
- Absolute paths on disk (only file content)
- The working directory (when `baseDir` is explicit)

## What Is Not Included

- Type-only imports (`import type`) — erased at compile time.
- Dynamic imports whose specifier is not a static string literal.
- Files outside the reachable import graph, unless passed via `extras`.

If you care about changes in those (e.g. a lockfile determining which package
version is installed), pass them explicitly via `extras`.

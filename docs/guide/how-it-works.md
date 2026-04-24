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
- **Anything under `node_modules`**. Imports that resolve into `node_modules`
  are treated as opaque: they contribute nothing to the hash and their own
  imports are never walked. This keeps the graph bounded on large monorepos
  and avoids re-hashing code you didn't write.

If you care about changes in those (e.g. a lockfile determining which package
version is installed), pass them explicitly via `extras`. Adding your
`pnpm-lock.yaml` / `package-lock.json` / `yarn.lock` captures every
direct, transitive, and peer-dep change — including integrity bumps — in a
single byte-accurate input.

## Logging

By default `hashup()` writes nothing to stderr. Pass `logLevel` to opt in:

| Level    | What you'll see                                                        |
| -------- | ---------------------------------------------------------------------- |
| `silent` | Nothing. Default for programmatic use.                                 |
| `warn`   | Files that could not be hashed (read or parse failures).               |
| `info`   | Higher-level progress messages.                                        |
| `debug`  | Per-file decisions, including which `node_modules` paths were skipped. |

The CLI accepts `--log-level <level>` / `-l`, and `hashup.json` accepts a
top-level `"logLevel"` field. The CLI flag wins when both are set.

## Caveats

- **Circular imports** terminate deterministically, but the exact hash of a
  cycle depends on which member was the entry point — the cache is seeded
  with the entry's content hash first, so cycle re-visits return that
  placeholder. Entering the same cycle from a different file produces a
  different (still deterministic) hash.

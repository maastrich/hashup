# How it Works

`hashup` produces a deterministic hash in four steps:

1. **Resolve the entry file** against `baseDir` (defaults to `process.cwd()`).
2. **Walk the import graph** starting at the entry. Each file is parsed with
   [`es-module-lexer`](https://github.com/guybedford/es-module-lexer) to extract
   its static imports, plus a small dedicated parser for
   `import.meta.glob(...)` calls. `?query` / `#fragment` suffixes are
   stripped, bare specifiers are mapped through the nearest
   `tsconfig.json` (`paths` / `baseUrl`, following `extends`), and the
   result is resolved with
   [`enhanced-resolve`](https://github.com/webpack/enhanced-resolve) — the same
   resolver Webpack uses. This honors package `exports`, conditional
   exports, and extension resolution. Glob patterns are expanded with
   `tinyglobby` relative to the importing file.
3. **Hash each file's content** (SHA-256). Results are cached per absolute path
   so a file reachable through multiple paths is hashed once.
4. **Combine the unique file hashes**, in sorted-path order, into a single
   SHA-256 digest. Every file in the transitive closure contributes exactly
   once, regardless of how many import paths reach it — memory stays linear
   in the number of unique files, independent of graph width or diamond count.

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

- Dynamic imports and `import.meta.glob` calls whose argument is not a
  string literal (these are reported in `result.unresolved`).
- Files outside the reachable import graph, unless passed via `extras`.
- **Anything under `node_modules`**. Imports that resolve into `node_modules`
  are treated as opaque: they contribute nothing to the hash and their own
  imports are never walked. This keeps the graph bounded on large monorepos
  and avoids re-hashing code you didn't write.

Every import edge that did **not** end in a hashed file — unresolvable
specifier, unreadable target, opaque glob — is listed in
`result.unresolved` and summarised on stderr by the CLI, so a narrowed
file set is never silent. See
[Unresolved imports](/guide/cli#unresolved-imports).

If you care about changes in those (e.g. a lockfile determining which package
version is installed), pass them explicitly via `extras`. Adding your
`pnpm-lock.yaml` / `package-lock.json` / `yarn.lock` captures every
direct, transitive, and peer-dep change — including integrity bumps — in a
single byte-accurate input.

## Logging

By default `hashup()` writes nothing to stderr. Pass `logLevel` to opt in:

| Level    | What you'll see                                          |
| -------- | -------------------------------------------------------- |
| `silent` | Nothing. Default for programmatic use.                   |
| `warn`   | Files that could not be hashed (read or parse failures). |
| `info`   | Higher-level progress messages.                          |
| `debug`  | Per-file trace of hashing, import resolution, and skips. |

The CLI accepts `--log-level <level>` / `-l`, and `hashup.json` accepts a
top-level `"logLevel"` field. The CLI flag wins when both are set.

### Debug-level prefixes

At `debug` level every line starts with a bracketed tag so you can
filter with `grep`:

| Prefix      | When                                                            |
| ----------- | --------------------------------------------------------------- |
| `[hash]:`   | A file's content was read and its sha256 computed.              |
| `[import]:` | A static import was resolved (or marked `<unresolved>`).        |
| `[skip]:`   | A resolved path was skipped because it lives in `node_modules`. |
| `[glob]:`   | An `import.meta.glob` call was expanded (or skipped).           |

```bash
# Watch only what got hashed
hashup -l debug 2>&1 | grep '^\[hash\]:'

# See every unresolved import
hashup -l debug 2>&1 | grep '<unresolved>'

# Count how many node_modules paths were short-circuited
hashup -l debug 2>&1 | grep -c '^\[skip\]:'
```

## Caveats

- **Circular imports** terminate deterministically. The cache is seeded with
  the file's own content hash before recursing, and each unique file
  contributes exactly once to the final digest, so entering the same
  cycle from any of its members produces the same hash.

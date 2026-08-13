# @maastrich/hashup

## 0.9.1

### Patch Changes

- eb8af56: Update runtime dependencies: `enhanced-resolve` 5.24, `es-module-lexer` 2.x, `esbuild` 0.28, `tinyglobby` 0.2.17. Hash output is unchanged.

## 0.9.0

### Minor Changes

- 77e4fd6: Default `baseDir` is now the current working directory, not the
  config file's directory.

  Globs and relative entry paths in `hashup.json` anchor at `cwd` unless
  an explicit `baseDir` is set (top-level or per-entry). Running
  `hashup --cwd ./pkg` or `cd pkg && hashup` both resolve `src/**/*.ts`
  against `./pkg/`, which is what most users expect when invoking from
  a subdirectory.

  **To keep the old config-relative behavior**, add `"baseDir": "."` to
  `hashup.json`:

  ```json
  {
    "baseDir": ".",
    "entries": { "app": { "entry": "src/**/*.ts" } }
  }
  ```

  Explicit `baseDir` values (top-level or per-entry) still resolve
  against the config file's directory. The CLI `--base-dir` flag still
  resolves against the real cwd and wins over both.

## 0.8.0

### Minor Changes

- ab4b73b: Zero-match entry globs no longer fail the run — the entry's hash is
  emitted as the sentinel `<no-hash>` and the remaining entries continue
  processing.

  Motivation: in a monorepo a package may not have tests yet, a feature
  flag may empty a directory, or a glob may intentionally target files
  that aren't always present. Previously any single zero-match entry
  aborted the whole invocation; now it's a local, addressable signal
  downstream tooling can detect.

  ```
  app           48adf62a70c2645d0fc15ee3060973245af5dc30a542372791a7e1f05eaeacf6
  visual-tests  <no-hash>
  worker        0c4b8d9f…
  ```

  In `--json` mode the sentinel appears as `{ "hash": "<no-hash>",
"files": [] }`. The sentinel is also exported from
  `@maastrich/hashup/cli` as `NO_HASH` for programmatic callers of
  `runConfigMode`.

## 0.7.1

### Patch Changes

- 7aec2ca: Add structured debug-log prefixes for easy filtering.

  At `--log-level debug` the hasher now emits one line per event, each
  starting with a bracketed tag at column zero:
  - `[hash]: <file>` — a file's content was read and its sha256 computed.
  - `[import]: <source> -> "<specifier>" -> <resolved>` — a static import
    was resolved. Unresolved specifiers show `<unresolved>` in the third
    slot.
  - `[skip]: <file>` — a resolved path was skipped because it lives in
    `node_modules`.

  ```bash
  hashup -l debug 2>&1 | grep '^\[hash\]:'
  hashup -l debug 2>&1 | grep -c '^\[skip\]:'
  ```

## 0.7.0

### Minor Changes

- 542c5ed: Linear-memory cache + `--cwd` CLI flag.

  **Linear-memory cache.** `HashupCache.hashes` now stores each file's own
  sha256 content hash (one 64-char string) instead of the flattened
  transitive hash list. The transitive contribution is reconstructed at
  combine time by walking `cache.deps`. Memory drops from
  O(files × avg closure) to O(unique files) — on a real-world run that
  previously needed 9 GB of heap, peak RSS is now ~125 MB and wall time
  drops from minutes to ~1 s.

  **Hash output changes.** The final digest is now
  `sha256(concat of each reachable file's content hash, sorted by path)`.
  Each unique file contributes exactly once regardless of how many import
  paths reach it. Any stored 0.6.x hashes must be re-baselined. As a
  welcome side effect: cycles now hash the same regardless of which
  member was the entry point.

  **`--cwd <dir>` CLI flag.** Run `hashup` as if invoked from the given
  directory. Changes where `hashup.json` is discovered, where relative
  entry/extras paths resolve, and where `--out` writes. Defaults to
  `process.cwd()`.

  ```bash
  hashup --cwd ./packages/app
  hashup --cwd ./packages/app src/index.ts -o ../dist/app.hash
  ```

  **Targeted break for direct `hashFile` callers.** Return type is now
  `Promise<string | null>` (the file's own hash, or `null` on failure)
  instead of `Promise<string[]>`. Callers should use `collectReachable`
  to enumerate the transitive set and read each file's hash from
  `cache.hashes` at combine time. `hashup()` itself is unchanged.

## 0.6.0

### Minor Changes

- 2bfc65a: Share the hash cache across entries — shared utilities are now read and
  hashed exactly once per `hashup` invocation instead of once per entry.
  - `HashupOptions` gains `cache?: HashupCache` and `resolver?: Resolver`.
    Pass the same values across multiple `hashup()` calls to reuse work.
    The CLI's config mode does this automatically: every named entry in a
    single `hashup` invocation now shares one cache + one resolver.
  - New exports: `createHashupCache()`, `collectReachable()`, and the
    `HashupCache` type.
  - Hash output is byte-identical to 0.5.0 on every existing input — the
    inline snapshot in `tests/examples.test.ts` still matches. Shared cache
    is a pure dedupe, not a semantic change.

  **Targeted break for direct `hashFile` callers:** the cache parameter is
  now `HashupCache` (an object with `hashes` and `deps` maps) instead of
  `Map<string, string[]>`. `hashup()` itself is untouched — the new
  `cache` option is additive. Callers of `hashFile` directly should swap
  `new Map<string, string[]>()` for `createHashupCache()`.

## 0.5.0

### Minor Changes

- ca24e81: Skip `node_modules` when hashing, and add configurable log levels.

  **Skip node_modules.** Imports that resolve into any `node_modules` directory
  are now treated as opaque: the file is never read, its imports are never
  walked, and it contributes nothing to the hash. This fixes out-of-memory
  crashes on large monorepos where the transitive dependency graph ran into
  the millions of files. To pin installed dependency versions, add your
  lockfile (`pnpm-lock.yaml`, `package-lock.json`, or `yarn.lock`) to
  `extras` — the raw bytes capture every direct, transitive, and peer-dep
  change. **This changes hashes** for any graph that previously reached into
  `node_modules` through a static import.

  **Log levels.** `hashup()` now accepts `logLevel?: "silent" | "warn" | "info"
| "debug"` (default `"silent"`). The CLI exposes the same via
  `--log-level <level>` / `-l`, and `hashup.json` accepts a top-level
  `"logLevel"` field. Diagnostics — including previous `console.warn` calls
  for files that fail to hash — are now suppressed by default and written to
  stderr when enabled. Exports `createLogger`, `isLogLevel`, `isInNodeModules`,
  plus the `Logger` and `LogLevel` types.

## 0.4.3

### Patch Changes

- 9c3d09e: Fix `Error: Invalid string length` when hashing very large dependency graphs.

  `combineHashes` used `hashes.join("")` to feed the sha256 hasher. With
  millions of entries (each a 64-char hash) the joined string exceeds
  V8's maximum string length (~512 MB) and the join itself throws. Feed
  each hash to the hasher with `update()` instead — sha256 is incremental,
  so the output hash is byte-for-byte identical to the old implementation
  on inputs that used to succeed.

## 0.4.2

### Patch Changes

- 6a99b2e: Fix `RangeError: Maximum call stack size exceeded` on large dependency graphs.

  `hashFile` and `hashup()` accumulated transitive hashes with
  `target.push(...source)`, which blows V8's argument-stack limit once
  `source` reaches a few tens of thousands of entries — easy to hit in
  large monorepos. Replaced every spread-append with a `pushAll` helper
  that iterates without spreading, eliminating the overflow while
  preserving hash output.

## 0.4.1

### Patch Changes

- 2031358: Fix stack overflow on circular imports and spurious parse errors on non-JS file types.
  - `hashFile` now seeds the cache with the file's own content hash before recursing into dependencies, so `A → B → A` cycles terminate deterministically instead of blowing the call stack.
  - `extractImports` now skips the JS parser for non-JS extensions (e.g. `.svg`, `.css`). Those files still contribute their content hash, but are no longer dropped with a `Parse error` warning.

## 0.4.0

### Minor Changes

- e0617ed: Support both zod 3 and zod 4. `zod` moved from `dependencies` to
  `peerDependencies` with the range `^3.25.0 || ^4.0.0`, and all internal
  imports now use the `zod/v4` subpath so the same code runs under either
  major. Consumers must now install `zod` themselves.

## 0.3.0

### Minor Changes

- 64bf13a: Add `-o, --out <path>` flag to the `hashup` CLI. Writes the output to the given file (creating parent directories as needed) instead of stdout. Works in every mode: single-file, config, and `--print-schema`.

### Patch Changes

- b95c473: Fix the published JSON schema URL. The docs workflow now generates `docs/public/schema.json` before building VitePress, so `https://maastrich.github.io/hashup/schema.json` is served correctly (previously 404).

## 0.2.1

### Patch Changes

- 02eb8ab: Ensure `scripts/generate-schema.mjs` creates the output directory before writing. On a clean checkout (e.g. CI), `docs/public/` does not exist because its only file is gitignored, which broke `prepack` during `npm publish`.

## 0.2.0

### Minor Changes

- 2637d09: Add `hashup` CLI with `hashup.json` config, glob support, and a JSON Schema
  - New `hashup` bin hashes a single file (`hashup src/index.ts`) or every named entry in a `hashup.json` (`hashup`). Flags: `-c/--config`, `-b/--base-dir`, `-e/--extra`, `--json`, `--files`, `--print-schema`, `-h`.
  - `entry` and `extras` in the config accept glob patterns (via `tinyglobby`). Matches are sorted and deduplicated so the resulting hash is stable across machines; a glob that expands to a single file produces the same hash as the literal form. Zero-match globs error out with `entries.<name>: pattern "<glob>" matched no files`.
  - Zod schema for the config is the source of truth, exposed via the new `@maastrich/hashup/config` subpath export. The generated JSON Schema ships as `./schema.json` inside the package and is hosted at `https://maastrich.github.io/hashup/schema.json` for editor completion (`"$schema": "..."`).
  - Library exports are unchanged at the package root; Zod and `tinyglobby` stay out of the main entry's static import graph.

- fd2fa39: Migrate toolchain to Vite+ (oxlint, oxfmt, tsgolint, tsdown, vitest) and add VitePress documentation site under `docs/`.

### Patch Changes

- d2bea59: improve hash testing

## 0.1.4

### Patch Changes

- 77154cd: fix release auth configuration

## 0.1.3

### Patch Changes

- 99e64d5: Update pnpm requirements

## 0.1.2

### Patch Changes

- d8a3429: Use OICD to release

## 0.1.1

### Patch Changes

- 0fa1db0: Initialize hashup repository

## 0.1.0

### Initial Release

- Initial project setup

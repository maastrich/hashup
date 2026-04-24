# @maastrich/hashup

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

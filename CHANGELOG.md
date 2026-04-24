# @maastrich/hashup

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

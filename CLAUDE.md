# CLAUDE.md

Guidance for Claude sessions working on this repo.

## Toolchain

This project uses [Vite+](https://viteplus.dev). Use `vp` for everything —
never invoke `pnpm`, `tsup`, `prettier`, `oxlint`, or `vitest` directly.

- `vp check` — format + lint + type-check (oxfmt, oxlint, tsgolint)
- `vp check --fix` — auto-fix formatting and fixable lint issues
- `vp test` — run tests (vitest, imported from `vite-plus/test`)
- `vp pack` — build the library (tsdown, configured in `vite.config.ts`)
- `vp docs:dev` / `vp docs:build` / `vp docs:preview` — VitePress site

Tests must import from `vite-plus/test` (not `vitest`, not `bun:test`).

## Documentation is part of the code

**Whenever you modify `src/`, update `docs/` in the same change.**

Specifically:

- If you add, remove, or rename an exported symbol → update `docs/api/`.
- If you change a public function's signature, parameters, return type, or
  behavior → update the relevant `docs/api/*.md`.
- If behavior users observe changes (supported file types, resolution rules,
  determinism guarantees, error handling) → update `docs/guide/`.
- If you add a new user-facing feature → add an example in
  `docs/guide/usage.md` and reference it from `docs/api/`.
- If you change the package's installation or runtime requirements → update
  `docs/guide/getting-started.md`.

Before declaring a code change complete, check: does any `docs/` page now
describe the code inaccurately? If yes, fix it in the same commit.

Docs map:

- `docs/index.md` — landing page, features list
- `docs/guide/getting-started.md` — install, requirements, first example
- `docs/guide/usage.md` — patterns: baseDir, extras, supported file types
- `docs/guide/how-it-works.md` — algorithm, determinism, what is and isn't
  included
- `docs/api/index.md` — API surface overview / index
- `docs/api/hashup.md` — `hashup()` signature and options
- `docs/api/utilities.md` — lower-level exports from `src/file-operations.ts`,
  `src/resolve-imports.ts`, `src/extract-imports.ts`, `src/hash.ts`

## Before wrapping up

Run `vp check && vp test` and fix any failures before finishing.

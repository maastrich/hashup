# Task: close the fingerprint gaps found in a real monorepo

Read `AGENTS.md` first and follow it (layout, tests, changesets).

## Why

`hashup` is used as the cache key for vitest runs in a large pnpm/moon monorepo
(`mobsuccess-front`, ~60 projects, ~2 900 test files). A review on 2026-08-20
ran `hashup -c .config/hashup.json --log-level debug` per project and found
that a large share of each test's real import graph never reaches the hash.
When that happens the monorepo's task runner keeps a stale "tests passed" cache
entry for a change that should have re-run them. The measured escapes:

| escape                                                      | measured in that repo                                                                                        |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| tsconfig `paths` aliases (`@/features/*`)                   | ≈ 5 185 import sites; 445 unresolved edges in one webapp's test closures, 141 / 115 / 85 / 36 in four others |
| query-suffixed imports (`./en.json?lingui`, `?raw`, `?url`) | resolver returns `…/en.json?lingui`, `readFile` throws, file is dropped with a warn-level log only           |
| `import.meta.glob([...], { eager: true })`                  | 14 call sites (locale catalogs, image sets); matched files never walked                                      |
| silent narrowing                                            | all of the above is visible only at `--log-level debug`; the CLI exits 0 and prints a confident hash         |

Concrete example: for `GoToV2Link.test.tsx` the fingerprint contained the test
and the component, but not the hook the component calls
(`@/features/navigation/use-migrate-to-v2`) nor anything under it.

## What to implement

Keep the public API and the hash algorithm stable (sha256 over sorted per-file
content hashes). Everything below is about making the _file set_ correct.

### 1. tsconfig `paths` (and `baseUrl`) resolution

- For each source file, locate the nearest `tsconfig.json` walking up from the
  file's directory, honouring `extends` (chains can cross package boundaries,
  e.g. `configs/ts-config/tsconfig.json` extended by `webapps/*/tsconfig.json`).
- Resolve `compilerOptions.paths` / `baseUrl` with standard TypeScript semantics:
  longest-prefix match, `*` capture, multiple candidate targets tried in order
  (the repo uses a two-candidate fallback:
  `"@/x.json": ["../../a.json", "../../b.json"]`).
- Prefer wiring this into enhanced-resolve (`plugins: [TsconfigPathsPlugin]` or
  an `alias` map derived per tsconfig) over re-implementing resolution; keep
  `createResolver()` cacheable — a resolver per tsconfig file, memoised by
  path, is fine.
- Cache tsconfig lookups and parsed results across the run (`HashupCache` is
  the natural home). Never read the same tsconfig twice.
- Option to disable: `tsconfig: false` in config / `--no-tsconfig` in the CLI,
  default on.

### 2. Query strings and fragments on specifiers

- Strip `?query` and `#fragment` from the _specifier_ before resolving, and
  from the _resolved path_ before reading. Hash the file by its real path, once,
  regardless of how many query variants import it.
- Specifiers that are only meaningful with the query (e.g. `?raw` on a `.yml`)
  still point at a real file: include it.

### 3. `import.meta.glob`

- `es-module-lexer` does not surface it. Detect `import.meta.glob(` (and
  `globEager` for older code) with a small, conservative parser: accept a
  string literal or an array of string literals as the first argument, including
  `!` negations; ignore the options object. Anything non-literal → skip and log.
- Expand patterns relative to the importing file with `tinyglobby`
  (`onlyFiles: true`), add every match as a dependency edge and walk it like a
  normal import (matches may be `.ts` modules with their own imports).

### 4. Make narrowing loud

- Collect every unresolved specifier and every unreadable resolved path per
  entry. Expose them in the programmatic result
  (`{ hash, files, unresolved: [{ from, specifier, reason }] }`) and in
  `--json` output.
- At default log level, print a one-line summary to stderr when the count is
  non-zero (`hashup: 445 unresolved imports (run with --log-level info to
list)`); list them at `info`.
- New CLI flag `--fail-on-unresolved[=<n>]`: exit non-zero when the count
  exceeds `n` (default 0 when the flag is present). Also accepted in config as
  `failOnUnresolved`. Do not count bare package specifiers that resolve into
  `node_modules` — those are intentionally opaque.

### 5. `extras` per entry already exist — document them for non-import inputs

No code change needed, but add to `docs/`: how to fold snapshot / screenshot /
`.env*` files into an entry's hash via `extras` globs, and the trade-off vs
putting them in the task runner's own inputs.

## Tests to add (`tests/`, fixtures under `tests/fixtures/`)

- `tsconfig-paths.test.ts`: nested tsconfig with `extends`, wildcard and
  non-wildcard aliases, two-candidate fallback, alias target outside the
  importing package; assert the aliased files are in `files` and that the hash
  changes when an aliased file changes.
- `query-imports.test.ts`: `./a.json?lingui`, `./b.yml?raw`, `./c.svg?url`;
  same file imported with and without a query contributes once.
- `import-meta-glob.test.ts`: literal string, literal array with negation,
  matched `.ts` module whose own import must be walked; non-literal argument
  is skipped and reported.
- `unresolved-report.test.ts`: `unresolved` list shape, stderr summary at
  default level, `--fail-on-unresolved` exit code, `node_modules` hits not
  counted.
- Extend `examples.test.ts` if the examples directory gains a monorepo-style
  example (recommended: a tiny `packages/a`, `webapps/b` with `@/` alias and a
  `?lingui` import).

## Done when

- `pnpm test` green, `pnpm lint`/typecheck green, changeset added (minor).
- Re-running the monorepo's `hashup -c .config/hashup.json --log-level info`
  in `webapps/lcm` reports 0 unresolved `@/…` edges and no
  `Failed to hash file …?lingui` lines. (If you do not have that repo, the
  examples-based test above is the proxy.)
- `README.md` / `docs/` updated: tsconfig support, query handling,
  `import.meta.glob`, the unresolved report and flag.

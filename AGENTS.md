# hashup

Guidance for agents (Claude, Codex, etc.) working on this repo. `CLAUDE.md`
is a symlink to this file — keep everything here.

## What this repo ships

Two public entry points backed by one library:

- **Library** (`@maastrich/hashup`) — `hashup()` and related helpers for
  deterministic hashing of an entry file's full import graph.
- **CLI** (`hashup` bin) — reads a `hashup.json` with one or more named
  entries and prints `name  hash` lines (or JSON).
- **Config schema** (`@maastrich/hashup/config` + `schema.json`) — Zod
  schema that's the source of truth for the config, plus the generated
  JSON Schema used by editors.

## Source layout

`src/` is split into three areas. The three files at the root are the
bundler entry points (`src/index.ts`, `src/cli.ts`, `src/config.ts`);
each maps to one output in `dist/` and one `package.json` export.

```
src/
  index.ts              # library entry (barrel)
  cli.ts                # CLI entry (shebang, calls main())
  config.ts             # config entry (barrel)
  lib/                  # pure library — no CLI / no zod
    hashup.ts
    hash-file.ts
    combine-hashes.ts
    create-content-hash.ts
    read-file-content.ts
    create-resolver.ts
    resolve-import.ts
    extract-imports.ts
    preprocess.ts
  cli/                  # CLI plumbing — may import from lib/ and config/
    main.ts             # orchestration, writes to stdout
    parse-args.ts
    load-config.ts      # returns { ok, data } | { ok: false, error }
    run-config-mode.ts  # returns formatted output (testable)
    run-single-file-mode.ts
    format-output.ts
    resolve-from.ts
    usage.ts
    die.ts
  config/               # zod schema + generated JSON Schema
    entry-schema.ts
    config-schema.ts
    json-schema.ts
    types.ts
```

**Invariant: `src/lib/` must not import zod or anything from `src/cli/` or
`src/config/`.** The library entry (`src/index.ts`) is statically walked by
users of `hashup()` (including our own tests), so adding heavy deps to the
lib inflates the hash graph. Zod lives behind the `@maastrich/hashup/config`
subpath for exactly this reason.

## Function isolation

Prefer one exported function per file, named after the function
(kebab-case filename → camelCase export). Small co-located types and tiny
private helpers can share the file. When editing a file that bundles
multiple responsibilities, split it as part of the change rather than
growing it further.

## Testing expectations

Most things are tested, including the CLI. Tests live in `tests/`:

- `tests/basic.test.ts`, `tests/examples.test.ts` — library behavior
- `tests/cli/*.test.ts` — `parseCliArgs`, `resolveFrom`, `loadConfig`,
  `formatSingleResult` / `formatNamedResults`, `runConfigMode`,
  `runSingleFileMode`
- `tests/config/schema.test.ts` — zod schemas and generated JSON Schema

Design CLI functions so they return values (strings, result objects)
instead of writing directly to stdout or calling `process.exit()`; the
`cli.ts` entrypoint does the writing. This is what makes `runConfigMode`
and friends testable — keep that discipline when adding new CLI code.
Use `vite-plus/test` (never import from `vitest` directly).

## Toolchain

This project uses [Vite+](https://viteplus.dev). Use `vp` for everything —
never invoke the underlying tools (pnpm, oxlint, oxfmt, vitest, tsdown)
directly, and don't install them as dependencies. Vite+ wraps them.

- `vp check` — format + lint + type-check (oxfmt, oxlint, tsgolint)
- `vp check --fix` — auto-fix formatting and fixable lint issues
- `vp test` — run tests (vitest, imported from `vite-plus/test`)
- `vp pack` — build the library (tsdown, configured in `vite.config.ts`).
  Declarations are emitted in `tsgo` mode against the native `tsc` binary,
  because TypeScript 7 no longer exposes a JS compiler API. If `typescript`
  is ever moved back to 5.x, revert `pack.dts` to `true` — tsgo mode has no
  binary to resolve there.
- `vp docs:dev` / `vp docs:build` / `vp docs:preview` — VitePress site
- `pnpm schema:generate` — re-emit `schema.json` + `docs/public/schema.json`
  from `src/config/json-schema.ts` (runs automatically on `prepack`)

See the Vite+ section below for the full command reference.

## Documentation is part of the code

**Whenever you modify `src/`, update `docs/` in the same change.**

- Add, remove, or rename an exported symbol → update `docs/api/`.
- Change a public function's signature, parameters, return type, or
  behavior → update the relevant `docs/api/*.md`.
- Change observable behavior (supported file types, resolution rules,
  determinism guarantees, error handling) → update `docs/guide/`.
- Add a new user-facing feature → add an example in
  `docs/guide/usage.md` and reference it from `docs/api/`.
- Change the config file shape → update `docs/guide/cli.md` _and_ verify
  the emitted `schema.json` (via `pnpm schema:generate` → inspect).
- Change install or runtime requirements → update
  `docs/guide/getting-started.md`.

Before declaring a code change complete, check: does any `docs/` page now
describe the code inaccurately? If yes, fix it in the same commit.

### Docs map

- `docs/index.md` — landing page, features list
- `docs/guide/getting-started.md` — install, requirements, first example
- `docs/guide/usage.md` — patterns: baseDir, extras, supported file types
- `docs/guide/cli.md` — `hashup` binary, `hashup.json` config, `$schema`
- `docs/guide/how-it-works.md` — algorithm, determinism, scope
- `docs/api/index.md` — API surface overview, subpath exports
- `docs/api/hashup.md` — `hashup()` signature and options
- `docs/api/utilities.md` — lower-level exports from `src/lib/*`
- `docs/public/schema.json` — generated; published at
  `https://maastrich.github.io/hashup/schema.json`

## Before wrapping up

Run `vp check && vp test` and fix any failures before finishing. If you
touched anything under `src/config/`, also re-run `pnpm schema:generate`
and sanity-check the diff of `schema.json`.

---

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, but it invokes Vite through `vp dev` and `vp build`.

## Vite+ Workflow

`vp` is a global binary that handles the full development lifecycle. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

### Start

- create - Create a new project from a template
- migrate - Migrate an existing project to Vite+
- config - Configure hooks and agent integration
- staged - Run linters on staged files
- install (`i`) - Install dependencies
- env - Manage Node.js versions

### Develop

- dev - Run the development server
- check - Run format, lint, and TypeScript type checks
- lint - Lint code
- fmt - Format code
- test - Run tests

### Execute

- run - Run monorepo tasks
- exec - Execute a command from local `node_modules/.bin`
- dlx - Execute a package binary without installing it as a dependency
- cache - Manage the task cache

### Build

- build - Build for production
- pack - Build libraries
- preview - Preview production build

### Manage Dependencies

Vite+ automatically detects and wraps the underlying package manager such as pnpm, npm, or Yarn through the `packageManager` field in `package.json` or package manager-specific lockfiles.

- add - Add packages to dependencies
- remove (`rm`, `un`, `uninstall`) - Remove packages from dependencies
- update (`up`) - Update packages to latest versions
- dedupe - Deduplicate dependencies
- outdated - Check for outdated packages
- list (`ls`) - List installed packages
- why (`explain`) - Show why a package is installed
- info (`view`, `show`) - View package information from the registry
- link (`ln`) / unlink - Manage local package links
- pm - Forward a command to the package manager

### Maintain

- upgrade - Update `vp` itself to the latest version

These commands map to their corresponding tools. For example, `vp dev --port 3000` runs Vite's dev server and works the same as Vite. `vp test` runs JavaScript tests through the bundled Vitest. The version of all tools can be checked using `vp --version`. This is useful when researching documentation, features, and bugs.

## Common Pitfalls

- **Using the package manager directly:** Do not use pnpm, npm, or Yarn directly. Vite+ can handle all package manager operations.
- **Always use Vite commands to run tools:** Don't attempt to run `vp vitest` or `vp oxlint`. They do not exist. Use `vp test` and `vp lint` instead.
- **Running scripts:** Vite+ built-in commands (`vp dev`, `vp build`, `vp test`, etc.) always run the Vite+ built-in tool, not any `package.json` script of the same name. To run a custom script that shares a name with a built-in command, use `vp run <script>`. For example, if you have a custom `dev` script that runs multiple services concurrently, run it with `vp run dev`, not `vp dev` (which always starts Vite's dev server).
- **Do not install Vitest, Oxlint, Oxfmt, or tsdown directly:** Vite+ wraps these tools. They must not be installed directly. You cannot upgrade these tools by installing their latest versions. Always use Vite+ commands.
- **Use Vite+ wrappers for one-off binaries:** Use `vp dlx` instead of package-manager-specific `dlx`/`npx` commands.
- **Import JavaScript modules from `vite-plus`:** Instead of importing from `vite` or `vitest`, all modules should be imported from the project's `vite-plus` dependency. For example, `import { defineConfig } from 'vite-plus';` or `import { expect, test, vi } from 'vite-plus/test';`. You must not install `vitest` to import test utilities.
- **Type-Aware Linting:** There is no need to install `oxlint-tsgolint`, `vp lint --type-aware` works out of the box.

## CI Integration

For GitHub Actions, consider using [`voidzero-dev/setup-vp`](https://github.com/voidzero-dev/setup-vp) to replace separate `actions/setup-node`, package-manager setup, cache, and install steps with a single action.

```yaml
- uses: voidzero-dev/setup-vp@v1
  with:
    cache: true
- run: vp check
- run: vp test
```

## Review Checklist for Agents

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to validate changes.
<!--VITE PLUS END-->

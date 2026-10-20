# Usage

## Basic

```ts
import { hashup } from "@maastrich/hashup";

const { hash, files } = await hashup("./src/index.ts");
```

## Relative vs. Absolute Paths

By default, relative entry paths are resolved against `process.cwd()`. Override
with `baseDir`:

```ts
const result = await hashup("./index.ts", {
  baseDir: "/absolute/path/to/project",
});
```

## Extras

Files outside the import graph that should still influence the hash — lockfiles,
environment config, compiler settings:

```ts
const result = await hashup("./src/index.ts", {
  extras: ["./package.json", "./pnpm-lock.yaml", "./tsconfig.json"],
});
```

Each extra is resolved as its own file graph too — if your extra imports other
files, those are included as well.

### Non-import inputs: snapshots, screenshots, `.env*`

Some inputs change a test's outcome without ever being imported: Vitest
snapshots (`__snapshots__/*.snap`), visual-regression screenshots,
`.env`, `.env.test`, fixture directories. Fold them in with `extras`
globs — in `hashup.json` every entry accepts them:

```json
{
  "entries": {
    "unit-tests": {
      "entry": "src/**/*.test.ts",
      "extras": ["src/**/__snapshots__/*.snap", ".env", ".env.test"]
    },
    "visual-tests": {
      "entry": "src/**/*.visual-test.ts",
      "extras": ["src/**/__screenshots__/**/*.png", "playwright.config.ts"]
    }
  }
}
```

Trade-off vs. listing the same files in your task runner's own `inputs`:

- **In `extras`** — one hash covers code _and_ artefacts, so the cache key
  is self-contained and portable (works the same in CI, locally, or from
  another tool). Binary files are hashed byte-for-byte; large screenshot
  sets add read time to every run.
- **In the task runner** — cheaper when the runner already tracks those
  globs (no double read), but the hashup output alone no longer tells
  the whole story, and two runners need two configurations.

A reasonable split: keep everything that affects _which code runs_ in
hashup (`extras` for `.env*`, setup files, snapshots), and leave purely
infrastructural inputs (Docker files, CI config) to the runner.

## Dependencies (`node_modules`)

Imports that resolve into `node_modules` are treated as opaque: hashup does not
walk their files and they contribute nothing to the hash. This keeps hashing
fast on large projects and avoids making your cache key depend on code you
didn't write.

If you want the installed dependency versions to influence the hash — so a
`pnpm install` that bumps a transitive version shifts your cache key — add
your lockfile to `extras`:

```ts
const result = await hashup("./src/index.ts", {
  extras: ["./pnpm-lock.yaml"], // or package-lock.json / yarn.lock
});
```

The lockfile's bytes capture every direct, transitive, and peer-dep version
change, so there's no need to parse it.

## Logging

`hashup()` is silent by default. Pass `logLevel` to see diagnostics on stderr:

```ts
await hashup("./src/index.ts", { logLevel: "warn" }); // show hash failures
await hashup("./src/index.ts", { logLevel: "debug" }); // plus skipped node_modules paths
```

Levels: `silent` (default) < `warn` < `info` < `debug`.

## tsconfig paths

Bare specifiers like `@/features/nav/use-thing` are resolved through the
nearest `tsconfig.json` (walking up from the importing file, following
`extends` — including chains that cross package boundaries in a
monorepo). `compilerOptions.paths` and `baseUrl` are applied with
TypeScript's semantics: longest-prefix match, `*` capture, multiple
targets tried in order. Only when no mapping matches does hashup fall
back to plain Node/bundler resolution.

```json
// webapps/b/tsconfig.json
{
  "extends": "../../configs/ts-config/tsconfig.json",
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@/config.json": ["./env/local.json", "./env/default.json"]
    }
  }
}
```

This is enhanced-resolve's own `TsconfigPathsPlugin` in auto mode, so
semantics track the resolver webpack/rspack use (including `${configDir}`
and project `references`). Disable with `tsconfig: false` (`--no-tsconfig`
on the CLI), or build the resolver yourself with
`createResolver({ tsconfig: false })`:

```ts
await hashup("./src/index.ts", { tsconfig: false });
```

## Resolution conditions

Package `exports` / `imports` maps are resolved with the conditions
`import`, `require`, `node` and `webpack` by default (`default` always
matches). Code that only runs in a browser — Vitest browser-mode tests,
a service-worker entry — may import subpaths a package does not provide
under `node`. Pass `conditions` to resolve the way that bundle would.
The list **replaces** the default set rather than adding to it (unlike
Node's `--conditions`), so repeat `import` / `require` if you still
want them:

```ts
await hashup("./src/app.visual-test.ts", {
  conditions: ["browser", "import", "default"],
});
```

In `hashup.json` the field is accepted at the top level and per entry;
the CLI accepts a repeatable `--condition <name>` (precedence: per-entry
list, then flags, then top level, then the default):

```json
{
  "entries": {
    "unit-tests": { "entry": "src/**/*.unit-test.ts" },
    "visual-tests": {
      "entry": "src/**/*.visual-test.ts",
      "conditions": ["browser", "import", "default"]
    }
  }
}
```

Even without this, a subpath of an installed package whose target is
explicitly `null` for the active conditions is not treated as a gap.
msw ships

```json
"./browser": { "types": "./lib/browser/index.d.ts", "node": null, "default": "./lib/browser/index.js" }
```

so `import { setupWorker } from "msw/browser"` resolves to nothing under
`node`. hashup reads that `null` as "deliberately unavailable here": the
edge is logged as `<unavailable>` at `debug` level, contributes nothing
to the hash, and is not listed in `result.unresolved`. A subpath the
package never exports, or one with no matching condition at all, is
still reported. So is a `null` target in a workspace package (one whose
real path is outside `node_modules`): its files would be hashed under
other conditions, so the miss stays visible instead of silently
shrinking the hash.

## Query strings and fragments

Bundler-style suffixes are stripped before resolution and the file is
hashed by its real path, once, no matter how many variants import it:

```ts
import messages from "./locales/en.json?lingui";
import raw from "./schema.yml?raw";
import icon from "./logo.svg?url";
```

All three land in `files` as `…/en.json`, `…/schema.yml`, `…/logo.svg`.

## `import.meta.glob`

`import.meta.glob(...)` (and the legacy `import.meta.globEager`) is not a
static import, so `es-module-lexer` never sees it. hashup detects the
call with a small, conservative parser and expands its patterns with
`tinyglobby` relative to the importing file. Every match becomes a
dependency edge and is walked like a normal import — a matched `.ts`
module contributes its own imports too.

```ts
const catalogs = import.meta.glob("./locales/*.json", { eager: true });
const commands = import.meta.glob(["./commands/*.ts", "!./commands/index.ts"]);
```

Accepted: a string literal or an array of string literals (negations
with `!` included); the options object is ignored. Dotfiles are excluded,
as in Vite. Bare patterns such as `@/locales/*.json` have their static
prefix (`@/locales`) resolved as a directory through tsconfig `paths`.
Anything else —
a variable, a template literal with `${}`, a root-relative `/src/**`
pattern — is skipped and reported in
[`result.unresolved`](/api/hashup#returns) (`non-literal-glob` /
`unsupported-glob`), never silently dropped.

## Unresolved imports

Every edge that did not produce a hashed file is listed in
`result.unresolved`:

```ts
const { hash, unresolved } = await hashup("./src/app.test.ts");
if (unresolved.length > 0) {
  for (const { from, specifier, reason } of unresolved) {
    console.warn(`${reason}: ${from} -> ${specifier}`);
  }
}
```

Bare specifiers that resolve into `node_modules`, Node builtins,
URL-schemed virtual modules and subpaths an installed package's
`exports` map sets to `null` for the active
[conditions](#resolution-conditions) are never listed. The CLI prints a one-line summary by default and can fail the
run with `--fail-on-unresolved` — see the
[CLI guide](/guide/cli#unresolved-imports).

## Supported File Types

The resolver handles the common web/Node module formats:

- TypeScript: `.ts`, `.tsx`, `.mts`, `.cts`
- JavaScript: `.js`, `.jsx`, `.mjs`, `.cjs`
- JSON: `.json`

Type-only imports (`import type { ... }`, `export type { ... }`,
`import { type X }`) are not included in the hash — every TypeScript file is
lowered with esbuild before extraction, which erases them. They are not
reported as unresolved either, even when the specifier has no runtime
module (a types-only package export).

Files of other types reached through an import (`.json`, `.yml?raw`,
`.svg?url`, `import.meta.glob` matches) are hashed by content but not
parsed for further imports.

## Advanced: Reusing the Resolver

For hashing many entries in the same project, you can reuse the lower-level
pieces to avoid re-creating the resolver for each call. See the
[utilities reference](/api/utilities).

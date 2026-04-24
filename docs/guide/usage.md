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

## Supported File Types

The resolver handles the common web/Node module formats:

- TypeScript: `.ts`, `.tsx`, `.mts`, `.cts`
- JavaScript: `.js`, `.jsx`, `.mjs`, `.cjs`
- JSON: `.json`

Type-only imports (`import type { ... }`) are not included in the hash because
they are erased at compile time and do not affect runtime behavior.

## Advanced: Reusing the Resolver

For hashing many entries in the same project, you can reuse the lower-level
pieces to avoid re-creating the resolver for each call. See the
[utilities reference](/api/utilities).

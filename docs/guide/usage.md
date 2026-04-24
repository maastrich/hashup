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

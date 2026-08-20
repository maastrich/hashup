# hashup()

```ts
function hashup(entryFile: string, options?: HashupOptions): Promise<HashupResult>;
```

Resolves every import reachable from `entryFile` and returns a deterministic
SHA-256 hash covering the entry, its transitive dependencies, and any `extras`.
Each unique file contributes exactly once; the final digest is
`sha256(sorted concat of each reachable file's content hash)`.

## Parameters

### `entryFile: string`

Path to the entry file. May be relative (resolved against `options.baseDir`) or
absolute.

### `options?: HashupOptions`

```ts
interface HashupOptions {
  /**
   * Additional files to include in the hash calculation
   * (e.g. configuration files like package.json, tsconfig.json,
   * or a lockfile to pin installed dependency versions).
   */
  extras?: string[];

  /**
   * Base directory for resolving relative paths.
   * @default process.cwd()
   */
  baseDir?: string;

  /**
   * Verbosity of diagnostic messages written to stderr.
   * One of `"silent"`, `"warn"`, `"info"`, `"debug"`.
   * @default "silent"
   */
  logLevel?: "silent" | "warn" | "info" | "debug";

  /**
   * Optional shared cache. Pass the same cache across multiple calls
   * to dedupe work — a file visited by entry A is reused by entry B.
   * Create with `createHashupCache()`.
   */
  cache?: HashupCache;

  /**
   * Optional shared `enhanced-resolve` resolver. Pass a shared
   * instance to reuse its internal filesystem cache across calls.
   * Create with `createResolver()`.
   */
  resolver?: Resolver;

  /**
   * Honour the nearest `tsconfig.json` (walking up from each source
   * file, following `extends`) when resolving bare specifiers:
   * `compilerOptions.paths` and `baseUrl` are applied with TypeScript's
   * longest-prefix semantics before falling back to Node resolution.
   * @default true
   */
  tsconfig?: boolean;
}
```

## Returns

```ts
interface HashupResult {
  /** The final deterministic hash (SHA-256, hex encoded). */
  hash: string;
  /** All absolute file paths included in the hash calculation. */
  files: string[];
  /**
   * Import edges reachable from this entry that did not produce a
   * hashed file. Sorted by `from`, then `specifier`. Empty means the
   * file set is complete.
   */
  unresolved: UnresolvedImport[];
}

interface UnresolvedImport {
  /** Absolute path of the importing file. */
  from: string;
  /** The specifier as written (query/fragment included). */
  specifier: string;
  reason: "unresolved" | "unreadable" | "non-literal-glob" | "unsupported-glob";
}
```

`unresolved` never lists bare specifiers that resolve into `node_modules`,
Node builtins or URL-schemed virtual modules (`virtual:…`) — those are
intentionally opaque. See [Unresolved imports](/guide/usage#unresolved-imports).

## Example

```ts
import { hashup } from "@maastrich/hashup";

const result = await hashup("./src/index.ts", {
  extras: ["./package.json"],
});

console.log(result.hash);
console.log(result.files);
```

### Sharing a cache across entries

```ts
import { createHashupCache, createResolver, hashup } from "@maastrich/hashup";

const cache = createHashupCache();
const resolver = createResolver();

const app = await hashup("./src/app.ts", { cache, resolver });
const worker = await hashup("./src/worker.ts", { cache, resolver });
// Files imported by both app and worker are read + hashed exactly once.
```

`result.files` still returns only the files reachable from each call's
own roots (entry + extras), not the full cache contents.

## Notes

- The `files` array contains every file that was hashed, including files reached
  through `extras`.
- Paths in `files` are absolute.
- The `hash` is stable for a given graph and set of file contents — it does not
  depend on timestamps or on which absolute directory the project lives in
  (assuming `baseDir` is set consistently).
- Imports that resolve into `node_modules` are treated as opaque: they contribute
  nothing to the hash and their own imports are never walked. To pin installed
  dependency versions, add your lockfile (`pnpm-lock.yaml`, `package-lock.json`,
  or `yarn.lock`) to `extras`.
- `?query` and `#fragment` suffixes on specifiers are stripped; the
  target file is hashed by its real path exactly once.
- `import.meta.glob(...)` calls with literal patterns are expanded and
  every match is walked like a regular import.
- By default nothing is written to stderr. Pass `logLevel: "warn"` (or higher)
  to surface parse failures and skipped dependencies while debugging.

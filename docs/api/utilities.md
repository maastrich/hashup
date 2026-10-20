# Utilities

Low-level helpers exported alongside [`hashup()`](./hashup). Use them when you
want to build your own hashing pipeline — e.g. to share a resolver across many
entries, or to hash files that are not reached through a static import graph.

## createResolver

```ts
function createResolver(options?: {
  tsconfig?: boolean;
  resolveToContext?: boolean;
  conditions?: readonly string[];
}): Resolver;
```

Creates an [`enhanced-resolve`](https://github.com/webpack/enhanced-resolve)
instance preconfigured for the file types hashup supports:

- Extensions: `.ts`, `.tsx`, `.mts`, `.js`, `.jsx`, `.mjs`, `.json`
- Extension aliases: `.js → .ts/.tsx/.js/.jsx`, `.mjs → .mts/.mjs`,
  `.cjs → .cts/.cjs`
- Condition names: `import`, `require`, `node`, `webpack` by default;
  pass `conditions` to resolve `exports` / `imports` maps the way another
  environment would (`["browser", "import", "default"]` for a browser
  bundle)
- `tsconfig: true` (default) — enhanced-resolve's `TsconfigPathsPlugin`
  in auto mode: nearest `tsconfig.json` above the importing file,
  `extends` chains, JSONC, `paths` / `baseUrl` with TypeScript semantics.
  Pass `tsconfig: false` for plain Node/bundler resolution.
- `resolveToContext: true` resolves to a directory (used internally to
  anchor alias-prefixed `import.meta.glob` patterns).
- Cached file system (4s TTL), shared by every resolver in the process

A resolver and a `HashupCache` must be paired consistently: cache entries
are keyed by path only, so a file walked with `tsconfig: true` is not
re-walked when the same cache is reused with `tsconfig: false`.

## resolveImport

```ts
function resolveImport(
  resolver: Resolver,
  importSource: string, // absolute path of the file doing the import
  importName: string, // the specifier, e.g. "./foo" or "lodash"
): Promise<string | false>;
```

Resolves a single specifier against the resolver. Returns the absolute path or
`false` if the import cannot be resolved.

## resolveSpecifier

```ts
function resolveSpecifier(
  resolver: Resolver,
  sourceFile: string,
  specifier: string,
): Promise<string | false>;
```

What `hashup()` actually calls per import: strips `?query` / `#fragment`
(see [`stripQuery`](#stripquery)), resolves through
[`resolveImport`](#resolveimport) (tsconfig `paths` apply when the
resolver was built with `tsconfig: true`), and un-escapes the `\0#`
sequence enhanced-resolve uses for a literal `#` in a path.

## isNullExport

```ts
function isNullExport(resolver: Resolver, sourceFile: string, specifier: string): Promise<boolean>;
```

After a bare specifier failed to resolve, tells whether that is because
the package's `exports` map sets the subpath's target to `null` under
the resolver's condition names (`"./browser": { "node": null, "default":
"./browser.js" }` seen through `node`) — as opposed to a subpath the
package never exports, which enhanced-resolve reports identically.
`hashFile` uses it to log such edges as `<unavailable>` instead of
counting them as unresolved. The package is located by walking
`node_modules` up from `sourceFile`; a tsconfig alias, a self-reference
or an uninstalled package yields `false`, and so does a workspace
package whose real path is outside `node_modules` (its files are walked
and hashed, so a miss there stays reported).

## matchExportTarget

```ts
type ExportTarget = "file" | "null" | "none";

function matchExportTarget(
  exports: unknown, // the package.json `exports` value
  subpath: string, // ".", "./browser", "./features/x"
  conditions: ReadonlySet<string>,
): ExportTarget;
```

Pure lookup behind `isNullExport`: selects the target Node's
`PACKAGE_EXPORTS_RESOLVE` would pick (exact keys, `*` patterns with the
longest prefix winning, legacy `./dir/` keys, conditional objects in
source order with `default` always matching, fallback arrays) and
reports what it is — a `file` target, an explicit `null`, or `none`
when no key or no condition matches. `"exports": null` counts as no
`exports` field (`none`). One deliberate divergence from Node: a `null`
item in a fallback array ends the lookup, as it does in
enhanced-resolve, instead of falling through to the next item.

## stripQuery

```ts
function stripQuery(specifier: string): string;
```

`"./en.json?lingui"` → `"./en.json"`, `"./a.js#x"` → `"./a.js"`. A leading
`#` (package.json `imports` subpath) is preserved.

## extractGlobPatterns / expandGlobImports

```ts
function extractGlobPatterns(content: string): {
  calls: { patterns: string[] }[];
  skipped: string[]; // source snippets with a non-literal argument
};
function expandGlobImports(
  patterns: readonly string[],
  sourceFile: string,
  resolver: Resolver,
): Promise<{ files: string[]; unsupported: string[] }>;
```

Detect `import.meta.glob(...)` / `globEager(...)` calls whose first
argument is a string literal or array of string literals, then expand
them with `tinyglobby` (`onlyFiles: true`, dotfiles excluded like Vite)
relative to `sourceFile`. Negated patterns (`!./x`) become ignores; bare
patterns (`@/locales/*.json`) have their static prefix resolved as a
directory through `resolver` (so tsconfig aliases apply); root-relative
or unresolvable patterns are returned as `unsupported`.

## extractImports

```ts
function extractImports(file: string, content: string): Promise<string[]>;
```

Parses a file's source with `es-module-lexer` and returns its static import
specifiers. Type-only imports and dynamic imports with non-literal specifiers
are excluded.

## createHashupCache

```ts
interface HashupCache {
  hashes: Map<string, string>;
  deps: Map<string, string[]>;
  unresolved: Map<string, UnresolvedImport[]>;
}

function createHashupCache(): HashupCache;
function collectReachable(roots: readonly string[], cache: HashupCache): string[];
```

An in-memory cache scoped to one consumer's lifetime — not persisted,
not shared across processes. `hashes` stores each file's own content
hash (one 64-char sha256 string per file); `deps` stores each file's
direct resolved dependency paths; `unresolved` stores the import edges of
each file that produced no hashed file. Memory is linear in the number of unique files. Pass the same `HashupCache` to multiple `hashup()` or
`hashFile()` calls to dedupe work. `collectReachable` walks `deps`
iteratively (no recursion) to enumerate the transitive closure — used
internally by `hashup()` to produce `result.files` and to fold each
file's content hash into the final digest.

## hashFile

```ts
function hashFile(
  file: string,
  cache: HashupCache,
  resolver: Resolver,
  logger?: Logger,
): Promise<string | null>;
```

Hashes a file and recursively populates `cache.hashes`, `cache.deps` and
`cache.unresolved` for every non-`node_modules` transitive import
(static imports, `?query` variants, `import.meta.glob` matches). Returns the file's own
content hash on success, or `null` if the file could not be read or
parsed. The transitive contribution is reconstructed at combine time by
walking `cache.deps` — `hashFile` never returns the flattened list.
Results are memoized in `cache` — pass the same `HashupCache` across
multiple calls to dedupe work. `logger` defaults to a silent logger;
build one with [`createLogger`](#createlogger) when you want diagnostics
on stderr.

Imports that resolve into `node_modules` are treated as opaque: the resolved
path is skipped, its files are never read, and the dependency's own imports
are never walked. Add your lockfile to `extras` if you need install-tree
changes reflected in the hash.

## createContentHash

```ts
function createContentHash(content: string): string;
```

SHA-256 (hex) of a string.

## createLogger

```ts
type LogLevel = "silent" | "warn" | "info" | "debug";

interface Logger {
  warn(message: string, error?: unknown): void;
  info(message: string): void;
  debug(message: string): void;
}

function createLogger(level?: LogLevel): Logger;
function isLogLevel(value: string): value is LogLevel;
```

Build a stderr logger filtered to `level` (default `"silent"`). `isLogLevel`
is a type-narrowing predicate for user-supplied strings.

## isInNodeModules

```ts
function isInNodeModules(file: string): boolean;
```

Returns `true` if the path contains a `node_modules` directory segment.
Handles both POSIX and Windows separators.

## combineHashes

```ts
function combineHashes(hashes: string[]): string;
```

Folds an array of hex hashes into a single SHA-256 digest by concatenating them
and hashing the result. Order-sensitive — pass hashes in a stable order.

## Composing Your Own Pipeline

```ts
import {
  collectReachable,
  combineHashes,
  createHashupCache,
  createResolver,
  hashFile,
} from "@maastrich/hashup";

const resolver = createResolver();
const cache = createHashupCache();

const entries = ["./src/a.ts", "./src/b.ts"];
for (const entry of entries) {
  await hashFile(entry, cache, resolver);
}

const files = collectReachable(entries, cache).sort();
const selfHashes = files.map((f) => cache.hashes.get(f)).filter((h) => h !== undefined);
const combined = combineHashes(selfHashes);
```

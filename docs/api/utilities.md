# Utilities

Low-level helpers exported alongside [`hashup()`](./hashup). Use them when you
want to build your own hashing pipeline — e.g. to share a resolver across many
entries, or to hash files that are not reached through a static import graph.

## createResolver

```ts
function createResolver(): Resolver;
```

Creates an [`enhanced-resolve`](https://github.com/webpack/enhanced-resolve)
instance preconfigured for the file types hashup supports:

- Extensions: `.ts`, `.tsx`, `.mts`, `.js`, `.jsx`, `.mjs`, `.json`
- Extension aliases: `.js → .ts/.tsx/.js/.jsx`, `.mjs → .mts/.mjs`,
  `.cjs → .cts/.cjs`
- Condition names: `import`, `require`, `node`, `webpack`
- Cached file system (4s TTL)

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
  cache: HashupCache,
  options?: { tsconfig?: boolean },
): Promise<string | false>;
```

What `hashup()` actually calls per import: strips `?query` / `#fragment`
(see [`stripQuery`](#stripquery)), tries every tsconfig `paths` /
`baseUrl` candidate for the importing file (unless `tsconfig: false`),
then falls back to [`resolveImport`](#resolveimport). The returned path
never carries a query.

## stripQuery

```ts
function stripQuery(specifier: string): string;
```

`"./en.json?lingui"` → `"./en.json"`, `"./a.js#x"` → `"./a.js"`. A leading
`#` (package.json `imports` subpath) is preserved.

## findTsconfig / loadTsconfig / mapTsconfigPaths

```ts
function findTsconfig(file: string, cache: HashupCache): string | null;
function loadTsconfig(configPath: string, cache: HashupCache): Promise<TsconfigPaths | null>;
function mapTsconfigPaths(specifier: string, tsconfig: TsconfigPaths): string[];

interface TsconfigPaths {
  configPath: string;
  baseUrl: string | undefined;
  paths: TsconfigPathPattern[]; // targets already absolute
}
```

`findTsconfig` walks up from the file's directory to the nearest
`tsconfig.json` (memoised per directory in `cache.tsconfigDirs`).
`loadTsconfig` parses it — JSONC, `extends` chains (relative paths or
package names), TypeScript's "child `paths` replace parent `paths`" rule —
memoised per config in `cache.tsconfigs`. `mapTsconfigPaths` applies
longest-prefix matching and returns the absolute candidates to try, in
order (empty for relative specifiers or when nothing matches).

## extractGlobPatterns / expandGlobImports

```ts
function extractGlobPatterns(content: string): {
  calls: { patterns: string[] }[];
  skipped: string[]; // source snippets with a non-literal argument
};
function expandGlobImports(
  patterns: readonly string[],
  sourceFile: string,
  cache: HashupCache,
  useTsconfig: boolean,
): Promise<{ files: string[]; unsupported: string[] }>;
```

Detect `import.meta.glob(...)` / `globEager(...)` calls whose first
argument is a string literal or array of string literals, then expand
them with `tinyglobby` (`onlyFiles: true`) relative to `sourceFile`.
Negated patterns (`!./x`) become ignores; bare patterns go through
tsconfig `paths`; root-relative patterns are returned as `unsupported`.

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
  tsconfigDirs: Map<string, string | null>;
  tsconfigs: Map<string, TsconfigPaths | null>;
}

function createHashupCache(): HashupCache;
function collectReachable(roots: readonly string[], cache: HashupCache): string[];
```

An in-memory cache scoped to one consumer's lifetime — not persisted,
not shared across processes. `hashes` stores each file's own content
hash (one 64-char sha256 string per file); `deps` stores each file's
direct resolved dependency paths; `unresolved` stores the import edges of
each file that produced no hashed file. `tsconfigDirs` / `tsconfigs`
memoise tsconfig discovery and parsing so no config is read twice.
Memory is linear in the number of unique files. Pass the same `HashupCache` to multiple `hashup()` or
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
  options?: { tsconfig?: boolean },
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

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

## extractImports

```ts
function extractImports(file: string, content: string): Promise<string[]>;
```

Parses a file's source with `es-module-lexer` and returns its static import
specifiers. Type-only imports and dynamic imports with non-literal specifiers
are excluded.

## hashFile

```ts
function hashFile(
  file: string,
  cache: Map<string, string[]>,
  resolver: Resolver,
): Promise<string[]>;
```

Hashes a file and all its transitive static imports. Results are memoized in
`cache` — pass the same `Map` across multiple calls to dedupe work. On error
(file read or parse failure), a warning is logged and an empty array is
returned.

## createContentHash

```ts
function createContentHash(content: string): string;
```

SHA-256 (hex) of a string.

## combineHashes

```ts
function combineHashes(hashes: string[]): string;
```

Folds an array of hex hashes into a single SHA-256 digest by concatenating them
and hashing the result. Order-sensitive — pass hashes in a stable order.

## Composing Your Own Pipeline

```ts
import { createResolver, hashFile, combineHashes } from "@maastrich/hashup";

const resolver = createResolver();
const cache = new Map<string, string[]>();

const entries = ["./src/a.ts", "./src/b.ts"];
const allHashes: string[] = [];

for (const entry of entries) {
  allHashes.push(...(await hashFile(entry, cache, resolver)));
}

const combined = combineHashes(allHashes);
```

# API Reference

The package exposes one main entry, [`hashup()`](./hashup), plus a set of
lower-level utilities for advanced use cases.

## Entry Point

- [`hashup(entry, options?)`](./hashup) — resolve an entry file's full import
  graph and return a deterministic hash.

## Utilities

- [`createResolver()`](./utilities#createresolver) — build the enhanced-resolve
  instance used internally.
- [`resolveSpecifier()`](./utilities#resolvespecifier) — resolve one import
  the way `hashup()` does: query stripping, tsconfig paths, then Node rules.
- [`resolveImport()`](./utilities#resolveimport) — resolve a single import
  specifier with enhanced-resolve only.
- [`stripQuery()`](./utilities#stripquery) — drop `?query` / `#fragment`
  from a specifier or path.
- [`findTsconfig()` / `loadTsconfig()` / `mapTsconfigPaths()`](./utilities#findtsconfig-loadtsconfig-maptsconfigpaths)
  — tsconfig discovery, parsing (with `extends`) and `paths` mapping.
- [`extractGlobPatterns()` / `expandGlobImports()`](./utilities#extractglobpatterns-expandglobimports)
  — detect and expand `import.meta.glob(...)` calls.
- [`extractImports()`](./utilities#extractimports) — parse a file and return its
  static imports.
- [`hashFile()`](./utilities#hashfile) — hash a single file and its transitive
  imports.
- [`createContentHash()`](./utilities#createcontenthash) — SHA-256 a buffer.
- [`combineHashes()`](./utilities#combinehashes) — fold a list of hashes into a
  single deterministic digest.
- [`createLogger(level?)`](./utilities#createlogger) — build the `Logger` used
  internally. Exports `type LogLevel` and `type Logger`.
- [`isInNodeModules(file)`](./utilities#isinnodemodules) — predicate used by
  the hasher to decide whether to walk into a resolved path.
- [`createHashupCache()`](./utilities#createhashupcache) — build a
  `HashupCache` to share across multiple `hashup()` or `hashFile()` calls.
- [`collectReachable(roots, cache)`](./utilities#createhashupcache) — rebuild
  a per-call file list from the cache's dependency edges.

## Config (subpath export)

The Zod schema and generated JSON schema for `hashup.json` live on a
separate subpath so the main entry stays dep-free:

```ts
import { configSchema, configJsonSchema } from "@maastrich/hashup/config";
```

See the [CLI guide](/guide/cli) for the config shape and editor integration.

## Main entry

All core functions are exported from the package root:

```ts
import {
  hashup,
  createResolver,
  resolveSpecifier,
  resolveImport,
  stripQuery,
  findTsconfig,
  loadTsconfig,
  mapTsconfigPaths,
  extractGlobPatterns,
  expandGlobImports,
  extractImports,
  hashFile,
  createContentHash,
  combineHashes,
  createLogger,
  isLogLevel,
  isInNodeModules,
  createHashupCache,
  collectReachable,
  type HashupCache,
  type UnresolvedImport,
  type TsconfigPaths,
  type Logger,
  type LogLevel,
} from "@maastrich/hashup";
```

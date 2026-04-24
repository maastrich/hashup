---
"@maastrich/hashup": minor
---

Skip `node_modules` when hashing, and add configurable log levels.

**Skip node_modules.** Imports that resolve into any `node_modules` directory
are now treated as opaque: the file is never read, its imports are never
walked, and it contributes nothing to the hash. This fixes out-of-memory
crashes on large monorepos where the transitive dependency graph ran into
the millions of files. To pin installed dependency versions, add your
lockfile (`pnpm-lock.yaml`, `package-lock.json`, or `yarn.lock`) to
`extras` — the raw bytes capture every direct, transitive, and peer-dep
change. **This changes hashes** for any graph that previously reached into
`node_modules` through a static import.

**Log levels.** `hashup()` now accepts `logLevel?: "silent" | "warn" | "info"
| "debug"` (default `"silent"`). The CLI exposes the same via
`--log-level <level>` / `-l`, and `hashup.json` accepts a top-level
`"logLevel"` field. Diagnostics — including previous `console.warn` calls
for files that fail to hash — are now suppressed by default and written to
stderr when enabled. Exports `createLogger`, `isLogLevel`, `isInNodeModules`,
plus the `Logger` and `LogLevel` types.

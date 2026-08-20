---
"@maastrich/hashup": minor
---

Close the fingerprint gaps found in large monorepos. The hash algorithm is unchanged; the _file set_ it covers is now correct in four more situations:

- **tsconfig `paths` / `baseUrl`** — bare specifiers are mapped through the nearest `tsconfig.json` (walking up from each file, following `extends` across packages) via enhanced-resolve's `TsconfigPathsPlugin` (auto mode). `createResolver()` now enables it by default; pass `createResolver({ tsconfig: false })` to opt out. Disable with `tsconfig: false` / `--no-tsconfig`.
- **Query strings and fragments** — `./en.json?lingui`, `./a.yml?raw`, `./icon.svg?url` resolve to the real file, which is hashed once however many variants import it.
- **`import.meta.glob`** — literal string / array-of-string patterns (negations included, `globEager` too) are expanded relative to the importing file and every match is walked like a normal import. Non-literal arguments are reported, not ignored.
- **Unresolved imports are loud** — `hashup()` returns `unresolved: [{ from, specifier, reason }]`; `--json` includes it per entry; the CLI prints a one-line stderr summary by default and lists each edge at `--log-level info`. New `--fail-on-unresolved[=<n>]` flag / `failOnUnresolved` config field exits `1` when the count exceeds the threshold. Bare specifiers resolving into `node_modules`, Node builtins and `virtual:` modules are not counted.

Also documents how to fold snapshots / screenshots / `.env*` into an entry via `extras` globs.

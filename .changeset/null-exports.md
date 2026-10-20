---
"@maastrich/hashup": minor
---

Stop counting an import as unresolved when an installed package's `exports` map deliberately sets its target to `null` for the active conditions — `msw/browser`, published as `"./browser": { "node": null, "default": "./lib/browser/index.js" }`, seen through the default `node` condition. Such an edge is the package opting out of the environment, not a gap: it is logged as `<unavailable>` at `debug` level, adds nothing to the hash, and no longer trips `--fail-on-unresolved`. A subpath the package never exports, one with no matching condition at all, or a `null` target in a workspace package (real path outside `node_modules`, whose files hashup walks) is still reported. New `isNullExport()` / `matchExportTarget()` utilities back this.

New `conditions` option to choose the `exports` / `imports` condition names used for resolution (default `["import", "require", "node", "webpack"]`; a list replaces the defaults): `hashup(entry, { conditions })`, `createResolver({ conditions })`, a top-level or per-entry `conditions` field in `hashup.json`, and a repeatable `--condition <name>` CLI flag (precedence: per-entry, then flag, then top level). Entries that resolve under different conditions get their own resolver and cache.

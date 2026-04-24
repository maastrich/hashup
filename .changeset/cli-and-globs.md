---
"@maastrich/hashup": minor
---

Add `hashup` CLI with `hashup.json` config, glob support, and a JSON Schema

- New `hashup` bin hashes a single file (`hashup src/index.ts`) or every named entry in a `hashup.json` (`hashup`). Flags: `-c/--config`, `-b/--base-dir`, `-e/--extra`, `--json`, `--files`, `--print-schema`, `-h`.
- `entry` and `extras` in the config accept glob patterns (via `tinyglobby`). Matches are sorted and deduplicated so the resulting hash is stable across machines; a glob that expands to a single file produces the same hash as the literal form. Zero-match globs error out with `entries.<name>: pattern "<glob>" matched no files`.
- Zod schema for the config is the source of truth, exposed via the new `@maastrich/hashup/config` subpath export. The generated JSON Schema ships as `./schema.json` inside the package and is hosted at `https://maastrich.github.io/hashup/schema.json` for editor completion (`"$schema": "..."`).
- Library exports are unchanged at the package root; Zod and `tinyglobby` stay out of the main entry's static import graph.

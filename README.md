# @maastrich/hashup

> Resolves every import and produces a fully deterministic hash for any entry file.

[![npm version](https://img.shields.io/npm/v/@maastrich/hashup.svg?style=flat-square)](https://www.npmjs.com/package/@maastrich/hashup)
[![npm downloads](https://img.shields.io/npm/dm/@maastrich/hashup.svg?style=flat-square)](https://www.npmjs.com/package/@maastrich/hashup)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@maastrich/hashup?style=flat-square)](https://bundlephobia.com/package/@maastrich/hashup)
[![install size](https://packagephobia.com/badge?p=@maastrich/hashup)](https://packagephobia.com/result?p=@maastrich/hashup)
[![license](https://img.shields.io/npm/l/@maastrich/hashup.svg?style=flat-square)](./LICENSE)
[![node](https://img.shields.io/node/v/@maastrich/hashup.svg?style=flat-square)](https://nodejs.org)
[![GitHub stars](https://img.shields.io/github/stars/maastrich/hashup?style=flat-square)](https://github.com/maastrich/hashup/stargazers)

`hashup` walks every `import` reachable from a given entry file — respecting
`tsconfig` paths, package exports, and conditional imports — and produces a
stable SHA-256 hash of the combined graph. Use it as a cache key, a build
invalidation signal, or a content-addressed fingerprint for a module.

## Features

- **Fully deterministic** — same inputs always produce the same SHA-256 hash.
- **Transitive resolution** — walks the full import graph via `enhanced-resolve`.
- **Monorepo-aware** — honours `tsconfig.json` `paths` / `baseUrl` (following
  `extends`), strips `?raw` / `?url` / `?lingui` queries, expands
  `import.meta.glob(...)`.
- **Loud about gaps** — every import that could not be hashed is reported in
  `result.unresolved` / `--json`, summarised on stderr, and can fail the run
  with `--fail-on-unresolved`.
- **Multi-format** — `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.mts`, `.cjs`, `.json`, and more.
- **Extras** — include arbitrary files (lockfiles, configs) in the hash.
- **Library or CLI** — call `hashup()` from Node, or run the `hashup` binary
  against a `hashup.json` with any number of named entries.

## Installation

```bash
npm install @maastrich/hashup
# or
pnpm add @maastrich/hashup
# or
yarn add @maastrich/hashup
```

Requires Node.js `>= 18`. ESM-only.

## Usage

### Library

```ts
import { hashup } from "@maastrich/hashup";

const { hash, files } = await hashup("./src/index.ts");

console.log(hash); // "48adf62a70c2645d0fc15ee3060973245af5dc30a542372791a7e1f05eaeacf6"
console.log(files.length); // number of resolved files
```

Include files outside the import graph (lockfiles, configs) via `extras`:

```ts
await hashup("./src/index.ts", {
  extras: ["./package.json", "./pnpm-lock.yaml"],
});
```

### CLI

Drop a `hashup.json` at the root of your project:

```json
{
  "$schema": "https://maastrich.github.io/hashup/schema.json",
  "baseDir": ".",
  "entries": {
    "app": { "entry": "src/index.ts", "extras": ["package.json"] },
    "worker": { "entry": "src/worker.ts" }
  }
}
```

Then run:

```bash
$ hashup
app     48adf62a70c2645d0fc15ee3060973245af5dc30a542372791a7e1f05eaeacf6
worker  0c4b8d9f…
```

Other modes:

```bash
hashup --json              # machine-readable output
hashup --json --files      # include the resolved file list
hashup src/index.ts        # one-off, skip the config file
hashup -c build.hashup.json
```

Flags: `-c/--config <path>`, `-b/--base-dir <dir>`, `-e/--extra <file>`
(single-file mode, repeatable), `--json`, `--files`, `--no-tsconfig`,
`--fail-on-unresolved[=<n>]`, `-l/--log-level <lvl>`, `-h/--help`.

When some imports cannot be turned into files (an alias with no tsconfig
mapping, a missing module, a dynamic `import.meta.glob`), the CLI still
prints the hash but adds a summary on stderr:

```
hashup: 3 unresolved imports (run with --log-level info to list)
```

Use `--fail-on-unresolved` (or `"failOnUnresolved": true` in the config) to
turn that into a non-zero exit in CI.

## Documentation

Full docs live at **<https://maastrich.github.io/hashup>**:

- [Getting started](https://maastrich.github.io/hashup/guide/getting-started)
- [Usage patterns](https://maastrich.github.io/hashup/guide/usage)
- [CLI & config reference](https://maastrich.github.io/hashup/guide/cli)
- [How it works](https://maastrich.github.io/hashup/guide/how-it-works)
- [API reference](https://maastrich.github.io/hashup/api/)

## Contributing

Issues and PRs welcome. The repo uses [Vite+](https://viteplus.dev) — use `vp`
for everything:

```bash
vp install      # install dependencies
vp check        # format + lint + type-check
vp test         # run tests
vp pack         # build
```

See [`AGENTS.md`](./AGENTS.md) for repo conventions.

## License

[MIT](./LICENSE) © [Mathis Pinsault](https://github.com/maastrich)

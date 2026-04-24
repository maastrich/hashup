# Getting Started

`@maastrich/hashup` resolves every import reachable from a given entry file and
produces a deterministic SHA-256 hash of their combined content. Use it when you
need a stable fingerprint for a module graph — cache keys, build invalidation,
content addressing, or change detection.

## Installation

::: code-group

```bash [pnpm]
pnpm add @maastrich/hashup
```

```bash [npm]
npm install @maastrich/hashup
```

```bash [yarn]
yarn add @maastrich/hashup
```

:::

## Requirements

- Node.js `>= 18`
- ESM-only package

## Quick Example

```ts
import { hashup } from "@maastrich/hashup";

const { hash, files } = await hashup("./src/index.ts");

console.log(hash); // "48adf62a70c2645d0fc15ee3060973245af5dc30a542372791a7e1f05eaeacf6"
console.log(files.length); // number of resolved files
```

The returned `hash` is stable across runs as long as the underlying file
contents and the resolved graph do not change.

## Including Extra Files

If you want the hash to change when files outside the import graph change
(e.g. `package.json`, a config file), pass them via `extras`:

```ts
const result = await hashup("./src/index.ts", {
  extras: ["./package.json", "./tsconfig.json"],
});
```

See the [Usage guide](./usage) for more patterns, and the
[API reference](/api/hashup) for the full signature.

## CLI

The package also ships a `hashup` binary. With no arguments it reads a
`hashup.json` config from the current directory and prints one hash per
named entry:

```json
// hashup.json
{
  "baseDir": ".",
  "entries": {
    "app": { "entry": "src/index.ts", "extras": ["package.json"] },
    "worker": { "entry": "src/worker.ts" }
  }
}
```

```bash
$ hashup
app     48adf62a70c2645d0fc15ee3060973245af5dc30a542372791a7e1f05eaeacf6
worker  0c4b8d9f…

$ hashup --json          # machine-readable output
$ hashup --json --files  # include the resolved file list
$ hashup src/index.ts    # one-off, skip the config file
$ hashup -c build.hashup.json
```

Flags: `-c/--config <path>`, `-b/--base-dir <dir>`, `-e/--extra <file>`
(single-file mode, repeatable), `--json`, `--files`, `-h/--help`. An entry's
`baseDir` overrides the top-level one; otherwise paths resolve relative to
the config file's directory.

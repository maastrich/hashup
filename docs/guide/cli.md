# CLI

The package ships a `hashup` binary alongside the library. The CLI is a thin
wrapper over [`hashup()`](/api/hashup) that can hash a single file or every
entry declared in a `hashup.json` config.

## Installation

The binary is installed automatically with the package:

```bash
pnpm add @maastrich/hashup
```

Invoke it through your package manager (`pnpm exec hashup`, `npx hashup`,
`yarn hashup`) or install globally.

## Single-file mode

```bash
hashup src/index.ts
```

Prints the hash of `src/index.ts` and its transitive import graph. Flags:

- `-e, --extra <file>` — include an additional file in the hash (repeatable)
- `-b, --base-dir <dir>` — base directory for resolution (default: cwd)
- `--json` — emit `{ "hash": "…" }` instead of plain text
- `--files` — include the resolved file list in the JSON output

```bash
hashup src/index.ts -e package.json -e tsconfig.json --json --files
```

## Config mode

With no positional argument the CLI reads `hashup.json` from the current
directory (override with `-c/--config`). Every entry in `entries` is hashed
and printed as `name  hash`:

```json
// hashup.json
{
  "$schema": "https://maastrich.github.io/hashup/schema.json",
  "baseDir": ".",
  "entries": {
    "app": { "entry": "src/index.ts", "extras": ["package.json"] },
    "worker": { "entry": "src/worker.ts" }
  }
}
```

The `$schema` line is optional, but adding it enables autocompletion and
validation in VS Code and other JSON-schema-aware editors. See
[Editor integration](#editor-integration) below.

```bash
$ hashup
app     48adf62a70c2645d0fc15ee3060973245af5dc30a542372791a7e1f05eaeacf6
worker  0c4b8d9f…

$ hashup --json            # keyed JSON object
$ hashup --json --files    # include each entry's resolved file list
$ hashup -c build.hashup.json
```

### Config schema

```ts
interface HashupConfig {
  /** Default base directory for every entry. Relative to the config file. */
  baseDir?: string;
  /** Map of name → entry definition. Names appear in the output. */
  entries: Record<
    string,
    {
      entry: string;
      extras?: string[];
      /** Overrides the top-level baseDir for this entry. */
      baseDir?: string;
    }
  >;
}
```

Resolution rules:

- Relative paths in the config resolve against the config file's directory,
  unless a `baseDir` is set (top-level or per-entry).
- `--base-dir` on the command line overrides both.
- Entry names must be unique (it's a record). Output order matches insertion
  order in the JSON file.

## Editor integration

The JSON schema for `hashup.json` is published alongside the docs site so
editors can fetch it:

```json
{
  "$schema": "https://maastrich.github.io/hashup/schema.json"
}
```

It also ships inside the installed package, so you can point at the local
copy if your editor can't reach the network:

```json
{
  "$schema": "./node_modules/@maastrich/hashup/schema.json"
}
```

To print the schema from the CLI (e.g. for piping into a file or a custom
tool):

```bash
hashup --print-schema > hashup.schema.json
```

Library consumers who want to validate a config programmatically can import
the underlying Zod schema from the `@maastrich/hashup/config` subpath:

```ts
import { configSchema, configJsonSchema } from "@maastrich/hashup/config";

const result = configSchema.safeParse(someObject);
```

This subpath pulls in Zod as a runtime dep; importing from
`@maastrich/hashup` directly does not.

## Exit codes

- `0` — success
- `1` — missing config, invalid JSON, schema violation, or resolution error

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
- `--cwd <dir>` — run as if invoked from this directory. Changes where
  `hashup.json` is discovered and where relative paths resolve. Defaults
  to `process.cwd()`.
- `-b, --base-dir <dir>` — base directory for resolution (default: cwd)
- `--json` — emit `{ "hash": "…" }` instead of plain text
- `--files` — include the resolved file list in the JSON output
- `-o, --out <path>` — write output to a file instead of stdout
  (parent directories are created automatically)
- `-l, --log-level <lvl>` — verbosity of stderr diagnostics:
  `silent` (default), `warn`, `info`, `debug`

```bash
hashup src/index.ts -e package.json -e tsconfig.json --json --files
hashup src/index.ts -o dist/index.hash
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
$ hashup --json -o dist/hashes.json   # write to file instead of stdout
```

### Config schema

```ts
interface HashupConfig {
  /** Default base directory for every entry. Relative to the config file. */
  baseDir?: string;
  /**
   * Verbosity of diagnostic messages written to stderr. Defaults to
   * "silent". The CLI --log-level flag overrides this.
   */
  logLevel?: "silent" | "warn" | "info" | "debug";
  /** Map of name → entry definition. Names appear in the output. */
  entries: Record<
    string,
    {
      /** File path or glob pattern. Globs fold every match into one hash. */
      entry: string;
      /** Extra files (paths or globs) to fold into the hash. */
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

### Glob patterns

Both `entry` and `extras` accept glob patterns (as well as plain file
paths). Globs are matched relative to the entry's effective `baseDir`,
resolve to files only, and are sorted so the resulting hash is stable
across machines.

```json
{
  "entries": {
    "tests": { "entry": "tests/**/*.test.ts" },
    "app": { "entry": "src/index.ts", "extras": ["package.json", "tsconfig.*.json"] }
  }
}
```

When a glob expands to multiple files, each match is hashed (with its
transitive import graph) and the results are combined into a single
deterministic hash for that named entry — useful for "did anything in
this set change?" style cache keys. A single-match glob produces the
same hash as the literal form, so converting a literal entry to a glob
that still only matches one file is a no-op.

If a glob matches **zero** files, that entry's hash is emitted as the
sentinel `<no-hash>` and the run continues with the remaining entries.
This keeps CI configs stable through normal churn — a package that
doesn't have visual tests yet, a feature flag that removes a whole
directory — without forcing every entry to gate-keep the whole run.
Downstream tooling can detect the sentinel to decide whether to skip,
warn, or fail.

```
app           48adf62a70c2645d0fc15ee3060973245af5dc30a542372791a7e1f05eaeacf6
visual-tests  <no-hash>
worker        0c4b8d9f…
```

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

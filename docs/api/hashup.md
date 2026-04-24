# hashup()

```ts
function hashup(entryFile: string, options?: HashupOptions): Promise<HashupResult>;
```

Resolves every import reachable from `entryFile` and returns a deterministic
SHA-256 hash covering the entry, its transitive dependencies, and any `extras`.

## Parameters

### `entryFile: string`

Path to the entry file. May be relative (resolved against `options.baseDir`) or
absolute.

### `options?: HashupOptions`

```ts
interface HashupOptions {
  /**
   * Additional files to include in the hash calculation
   * (e.g. configuration files like package.json, tsconfig.json,
   * or a lockfile to pin installed dependency versions).
   */
  extras?: string[];

  /**
   * Base directory for resolving relative paths.
   * @default process.cwd()
   */
  baseDir?: string;

  /**
   * Verbosity of diagnostic messages written to stderr.
   * One of `"silent"`, `"warn"`, `"info"`, `"debug"`.
   * @default "silent"
   */
  logLevel?: "silent" | "warn" | "info" | "debug";
}
```

## Returns

```ts
interface HashupResult {
  /** The final deterministic hash (SHA-256, hex encoded). */
  hash: string;
  /** All absolute file paths included in the hash calculation. */
  files: string[];
}
```

## Example

```ts
import { hashup } from "@maastrich/hashup";

const result = await hashup("./src/index.ts", {
  extras: ["./package.json"],
});

console.log(result.hash);
console.log(result.files);
```

## Notes

- The `files` array contains every file that was hashed, including files reached
  through `extras`.
- Paths in `files` are absolute.
- The `hash` is stable for a given graph and set of file contents — it does not
  depend on timestamps or on which absolute directory the project lives in
  (assuming `baseDir` is set consistently).
- Imports that resolve into `node_modules` are treated as opaque: they contribute
  nothing to the hash and their own imports are never walked. To pin installed
  dependency versions, add your lockfile (`pnpm-lock.yaml`, `package-lock.json`,
  or `yarn.lock`) to `extras`.
- By default nothing is written to stderr. Pass `logLevel: "warn"` (or higher)
  to surface parse failures and skipped dependencies while debugging.

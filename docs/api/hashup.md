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
   * (e.g. configuration files like package.json, tsconfig.json).
   */
  extras?: string[];

  /**
   * Base directory for resolving relative paths.
   * @default process.cwd()
   */
  baseDir?: string;
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

/**
 * Remove a `?query` and/or `#fragment` suffix from an import specifier
 * or resolved path. `./en.json?lingui`, `./icon.svg?url#x` → `./en.json`,
 * `./icon.svg`.
 *
 * A leading `#` is left alone: that's a package.json `imports` subpath
 * (`#internal/utils`), not a fragment.
 */
export function stripQuery(specifier: string): string {
  let end = specifier.length;
  const q = specifier.indexOf("?");
  if (q !== -1) end = q;
  const h = specifier.indexOf("#", 1);
  if (h !== -1 && h < end) end = h;
  return specifier.slice(0, end);
}

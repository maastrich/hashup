import { dirname } from "node:path";
import type { Resolver } from "enhanced-resolve";
import { findPackageJson } from "./find-package-json.js";
import { matchExportTarget } from "./match-export-target.js";
import { stripQuery } from "./strip-query.js";

/**
 * True when `specifier` is a bare import whose package `exports` map
 * deliberately sets the target to `null` under the resolver's active
 * conditions — `msw/browser` with
 * `"./browser": { "node": null, "default": "./lib/browser/index.js" }`
 * seen through the default `node` condition, for instance. The author
 * is saying "not available here", not "missing", so hashup logs the
 * edge and moves on instead of counting it as unresolved.
 *
 * enhanced-resolve reports that case and a subpath that was never
 * exported with the same error, so after a failed resolution the
 * `exports` field is looked up again here. The package is found with
 * plain `node_modules` walking from the importing file, mirroring the
 * resolver's default `modules` setting; anything else (a tsconfig
 * alias, a self-reference, an uninstalled package) yields `false` and
 * leaves the resolver's verdict as it was.
 */
export async function isNullExport(
  resolver: Resolver,
  sourceFile: string,
  specifier: string,
): Promise<boolean> {
  const parsed = parsePackageSpecifier(stripQuery(specifier));
  if (parsed === null) return false;
  const manifest = await findPackageJson(dirname(sourceFile), parsed.name);
  if (manifest === null) return false;
  const target = matchExportTarget(
    manifest.exports,
    parsed.subpath,
    resolver.options.conditionNames,
  );
  return target === "null";
}

/**
 * `@scope/name/sub/path` → `{ name: "@scope/name", subpath: "./sub/path" }`,
 * `name` → `{ name, subpath: "." }`. `null` for anything that is not a
 * bare package specifier (relative, absolute, `#imports`).
 */
function parsePackageSpecifier(specifier: string): { name: string; subpath: string } | null {
  if (
    specifier.length === 0 ||
    specifier.startsWith(".") ||
    specifier.startsWith("/") ||
    specifier.startsWith("#")
  ) {
    return null;
  }
  const segments = specifier.split("/");
  const nameSegments = specifier.startsWith("@") ? 2 : 1;
  if (segments.length < nameSegments) return null;
  const name = segments.slice(0, nameSegments);
  if (name.some((segment) => segment.length === 0)) return null;
  const rest = segments.slice(nameSegments).join("/");
  return { name: name.join("/"), subpath: rest.length === 0 ? "." : `./${rest}` };
}

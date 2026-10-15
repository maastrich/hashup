/**
 * What a package.json `exports` map says about one subpath under a set
 * of conditions:
 *
 * - `file`: a string target was selected — the subpath is exported
 * - `null`: the selected target is `null` — the package author marked
 *   the subpath as deliberately unavailable under these conditions
 *   (`"./browser": { "node": null, "default": "./browser.js" }` seen
 *   with the `node` condition)
 * - `none`: no key matches the subpath, or no condition matches
 */
export type ExportTarget = "file" | "null" | "none";

/**
 * Look `subpath` (`.`, `./browser`, `./features/x`) up in an `exports`
 * field the way Node's PACKAGE_EXPORTS_RESOLVE does, but stop at the
 * selected target instead of turning it into a path: exact keys, `*`
 * patterns (longest prefix wins), legacy `./dir/` keys, conditional
 * objects (keys tried in source order, `default` always matches) and
 * fallback arrays.
 *
 * The resolver is still enhanced-resolve; this exists only to tell an
 * explicit `null` target apart from a subpath the package never
 * exports, which the resolver reports identically.
 */
export function matchExportTarget(
  exports: unknown,
  subpath: string,
  conditions: ReadonlySet<string>,
): ExportTarget {
  if (exports === undefined) return "none";
  if (!isSubpathMap(exports)) {
    // Sugar for the main entry: a string, an array, or a conditions
    // object with no `./` keys.
    return subpath === "." ? selectTarget(exports, conditions) : "none";
  }
  if (!subpath.includes("*") && !subpath.endsWith("/") && hasOwn(exports, subpath)) {
    return selectTarget(exports[subpath], conditions);
  }
  const key = bestPatternKey(exports, subpath);
  return key === undefined ? "none" : selectTarget(exports[key], conditions);
}

function isSubpathMap(exports: unknown): exports is Record<string, unknown> {
  if (exports === null || typeof exports !== "object" || Array.isArray(exports)) return false;
  const keys = Object.keys(exports);
  return keys.length > 0 && keys.every((key) => key.startsWith("."));
}

function hasOwn(map: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(map, key);
}

/**
 * Pick the pattern key (`./features/*`, `./lib/*.js`) or legacy folder
 * key (`./lib/`) that matches `subpath`: the longest static prefix wins,
 * then the longest key.
 */
function bestPatternKey(map: Record<string, unknown>, subpath: string): string | undefined {
  let best: { key: string; prefix: string } | undefined;
  for (const key of Object.keys(map)) {
    const star = key.indexOf("*");
    let prefix: string;
    let suffix = "";
    if (star !== -1) {
      if (key.indexOf("*", star + 1) !== -1) continue;
      prefix = key.slice(0, star);
      suffix = key.slice(star + 1);
    } else if (key.endsWith("/")) {
      prefix = key;
    } else {
      continue;
    }
    if (!subpath.startsWith(prefix)) continue;
    if (suffix.length > 0 && (!subpath.endsWith(suffix) || subpath.length < key.length)) continue;
    if (
      best === undefined ||
      prefix.length > best.prefix.length ||
      (prefix.length === best.prefix.length && key.length > best.key.length)
    ) {
      best = { key, prefix };
    }
  }
  return best?.key;
}

/**
 * Walk one mapping value. A `null` anywhere on the selected path stops
 * the search, as in Node: it is an answer ("not here"), not a miss.
 */
function selectTarget(target: unknown, conditions: ReadonlySet<string>): ExportTarget {
  if (target === null) return "null";
  if (typeof target === "string") return "file";
  if (Array.isArray(target)) {
    for (const item of target) {
      const hit = selectTarget(item, conditions);
      if (hit !== "none") return hit;
    }
    return "none";
  }
  if (typeof target === "object") {
    for (const [condition, inner] of Object.entries(target)) {
      if (condition !== "default" && !conditions.has(condition)) continue;
      const hit = selectTarget(inner, conditions);
      if (hit !== "none") return hit;
    }
  }
  return "none";
}

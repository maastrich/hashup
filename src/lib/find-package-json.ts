import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Locate `name`'s manifest the way Node's module lookup does: try
 * `<dir>/node_modules/<name>/package.json` in `fromDir`, then in each
 * ancestor directory. Returns the parsed object, or `null` when the
 * package is not installed anywhere above `fromDir` (or its manifest
 * cannot be parsed).
 */
export async function findPackageJson(
  fromDir: string,
  name: string,
): Promise<Record<string, unknown> | null> {
  let dir = fromDir;
  for (;;) {
    const manifest = await readJsonObject(join(dir, "node_modules", name, "package.json"));
    if (manifest !== null) return manifest;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

async function readJsonObject(file: string): Promise<Record<string, unknown> | null> {
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

import { stat } from "node:fs/promises";

/** `true` when `path` exists and is a directory; `false` otherwise. */
export async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

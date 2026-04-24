import { isAbsolute, resolve } from "node:path";

/**
 * Resolve `value` against `anchor` unless it is already absolute.
 * Anchors vary per call site: the CLI `--base-dir` resolves against the
 * process cwd; config-file paths resolve against the config's directory.
 */
export function resolveFrom(anchor: string, value: string): string {
  return isAbsolute(value) ? value : resolve(anchor, value);
}

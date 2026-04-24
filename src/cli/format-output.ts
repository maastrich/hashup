import type { HashupResult } from "../lib/hashup.js";

export interface FormatOptions {
  json: boolean;
  files: boolean;
}

export function formatSingleResult(result: HashupResult, options: FormatOptions): string {
  if (!options.json) {
    return `${result.hash}\n`;
  }
  const payload = options.files
    ? { hash: result.hash, files: result.files }
    : { hash: result.hash };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export function formatNamedResults(
  results: Record<string, HashupResult>,
  options: FormatOptions,
): string {
  if (options.json) {
    const payload: Record<string, { hash: string; files?: string[] }> = {};
    for (const [name, result] of Object.entries(results)) {
      payload[name] = options.files
        ? { hash: result.hash, files: result.files }
        : { hash: result.hash };
    }
    return `${JSON.stringify(payload, null, 2)}\n`;
  }

  const names = Object.keys(results);
  if (names.length === 0) {
    return "";
  }
  const width = Math.max(...names.map((n) => n.length));
  return names.map((name) => `${name.padEnd(width)}  ${results[name]!.hash}\n`).join("");
}

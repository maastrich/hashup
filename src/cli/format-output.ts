import type { HashupResult } from "../lib/hashup.js";
import type { UnresolvedImport } from "../lib/unresolved-import.js";

export interface FormatOptions {
  json: boolean;
  files: boolean;
}

interface JsonPayload {
  hash: string;
  files?: string[];
  unresolved: UnresolvedImport[];
}

function toPayload(result: HashupResult, options: FormatOptions): JsonPayload {
  return options.files
    ? { hash: result.hash, files: result.files, unresolved: result.unresolved }
    : { hash: result.hash, unresolved: result.unresolved };
}

export function formatSingleResult(result: HashupResult, options: FormatOptions): string {
  if (!options.json) {
    return `${result.hash}\n`;
  }
  return `${JSON.stringify(toPayload(result, options), null, 2)}\n`;
}

export function formatNamedResults(
  results: Record<string, HashupResult>,
  options: FormatOptions,
): string {
  if (options.json) {
    const payload: Record<string, JsonPayload> = {};
    for (const [name, result] of Object.entries(results)) {
      payload[name] = toPayload(result, options);
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

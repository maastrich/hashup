import { callSnippet } from "./call-snippet.js";
import { parseStringLiteral } from "./parse-string-literal.js";
import { skipWhitespace } from "./skip-whitespace.js";

export interface GlobCall {
  /** Literal patterns, negations kept with their leading `!`. */
  patterns: string[];
}

export interface ExtractedGlobs {
  calls: GlobCall[];
  /** Source snippets of `import.meta.glob(` calls with a non-literal argument. */
  skipped: string[];
}

const CALL = /\bimport\s*\.\s*meta\s*\.\s*(?:glob|globEager)\s*\(/g;

/**
 * Find `import.meta.glob(...)` / `import.meta.globEager(...)` calls and
 * pull out their first argument when it is a string literal or an array
 * of string literals. Deliberately conservative: template literals with
 * interpolation, identifiers, spreads — anything that is not a plain
 * literal — land in `skipped` so the caller can report them.
 *
 * Bails early for sources that never mention `import.meta.glob`, which
 * keeps the cost negligible on the overwhelming majority of files.
 */
export function extractGlobPatterns(content: string): ExtractedGlobs {
  const out: ExtractedGlobs = { calls: [], skipped: [] };
  // Cheap bail-out: the regex below tolerates whitespace around the
  // dots, but every spelling still contains the word "glob".
  if (!content.includes("glob")) return out;
  CALL.lastIndex = 0;
  for (let m = CALL.exec(content); m !== null; m = CALL.exec(content)) {
    const start = m.index + m[0].length;
    const parsed = parseFirstArg(content, start);
    if (parsed === null) {
      out.skipped.push(callSnippet(content, m.index));
      continue;
    }
    out.calls.push({ patterns: parsed });
  }
  return out;
}

function parseFirstArg(src: string, from: number): string[] | null {
  let i = skipWhitespace(src, from);
  const ch = src[i];
  if (ch === "[") {
    const items: string[] = [];
    i = skipWhitespace(src, i + 1);
    while (i < src.length && src[i] !== "]") {
      const lit = parseStringLiteral(src, i);
      if (lit === null) return null;
      items.push(lit.value);
      i = skipWhitespace(src, lit.end);
      if (src[i] === ",") i = skipWhitespace(src, i + 1);
      else if (src[i] !== "]") return null;
    }
    return src[i] === "]" ? items : null;
  }
  const lit = parseStringLiteral(src, i);
  return lit === null ? null : [lit.value];
}

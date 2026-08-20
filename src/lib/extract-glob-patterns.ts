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
      out.skipped.push(snippet(content, m.index));
      continue;
    }
    out.calls.push({ patterns: parsed });
  }
  return out;
}

/** The call site up to end-of-line (or 80 chars), for the report. */
function snippet(src: string, from: number): string {
  const eol = src.indexOf("\n", from);
  const end = Math.min(eol === -1 ? src.length : eol, from + 80);
  return src.slice(from, end).trim();
}

function parseFirstArg(src: string, from: number): string[] | null {
  let i = skipWs(src, from);
  const ch = src[i];
  if (ch === "[") {
    const items: string[] = [];
    i = skipWs(src, i + 1);
    while (i < src.length && src[i] !== "]") {
      const lit = parseStringLiteral(src, i);
      if (lit === null) return null;
      items.push(lit.value);
      i = skipWs(src, lit.end);
      if (src[i] === ",") i = skipWs(src, i + 1);
      else if (src[i] !== "]") return null;
    }
    return src[i] === "]" ? items : null;
  }
  const lit = parseStringLiteral(src, i);
  return lit === null ? null : [lit.value];
}

function parseStringLiteral(src: string, at: number): { value: string; end: number } | null {
  const quote = src[at];
  if (quote !== '"' && quote !== "'" && quote !== "`") return null;
  let value = "";
  let i = at + 1;
  while (i < src.length) {
    const ch = src[i] as string;
    if (ch === "\\") {
      value += src[i + 1] ?? "";
      i += 2;
      continue;
    }
    if (ch === quote) return { value, end: i + 1 };
    if (quote === "`" && ch === "$" && src[i + 1] === "{") return null;
    if (ch === "\n" && quote !== "`") return null;
    value += ch;
    i++;
  }
  return null;
}

function skipWs(src: string, i: number): number {
  while (i < src.length && /\s/.test(src[i] as string)) i++;
  return i;
}

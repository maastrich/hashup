export interface StringLiteral {
  /** The literal's value, escapes reduced to the escaped character. */
  value: string;
  /** Index just past the closing quote. */
  end: number;
}

/**
 * Read a `'…'`, `"…"` or `` `…` `` literal starting at `at`. Returns
 * `null` when `at` is not a quote, when the literal is unterminated, or
 * when a template literal interpolates (`${…}`) — its value is then not
 * known statically.
 */
export function parseStringLiteral(src: string, at: number): StringLiteral | null {
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

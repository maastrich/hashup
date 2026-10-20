import type { ImportSpecifier } from "es-module-lexer";
import { callSnippet } from "./call-snippet.js";
import { parseStringLiteral } from "./parse-string-literal.js";
import { skipWhitespace } from "./skip-whitespace.js";

export interface ExtractedUrls {
  /** Relative specifiers (`./w.worker.ts?worker`), query kept. */
  specifiers: string[];
  /** Source snippets of calls whose first argument is not a string literal. */
  nonLiteral: string[];
  /** Root-relative literals (`/logo.svg`) hashup cannot anchor. */
  unsupported: string[];
}

const CALL = /\bnew\s+URL\s*\(/g;
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Find `new URL(<arg>, import.meta.url)` calls — Vite's form for
 * workers (`new Worker(new URL("./w.ts", import.meta.url))`) and static
 * assets. es-module-lexer does not report them as imports, but it does
 * report every real `import.meta`: a call only counts when its second
 * argument starts at one of those positions, so occurrences inside
 * comments or strings are never picked up.
 *
 * `code` and `imports` must come from the same `lexModule()` run.
 *
 * Bare literals (`"w.ts"`) are relative under URL semantics and come
 * back as `./w.ts`. Remote / schemed URLs (`https:`, `data:`, `//cdn`)
 * and directory references (`"."`, `"../"`) are dropped.
 */
export function extractUrlImports(
  code: string,
  imports: readonly ImportSpecifier[],
): ExtractedUrls {
  const out: ExtractedUrls = { specifiers: [], nonLiteral: [], unsupported: [] };
  // Start of each real `import.meta.url` that is a whole argument
  // (`import.meta.url.replace(…)` is some other base).
  const anchors = new Set<number>();
  for (const imp of imports) {
    if (imp.d !== -2) continue;
    const tail = /^\s*\.\s*url\b/.exec(code.slice(imp.e, imp.e + 16));
    if (tail === null) continue;
    const next = code[skipWhitespace(code, imp.e + tail[0].length)];
    if (next === "," || next === ")") anchors.add(imp.ss);
  }
  if (anchors.size === 0) return out;
  CALL.lastIndex = 0;
  for (let m = CALL.exec(code); m !== null; m = CALL.exec(code)) {
    const argStart = skipWhitespace(code, m.index + m[0].length);
    const literal = parseStringLiteral(code, argStart);
    const argEnd = literal === null ? skipExpression(code, argStart) : literal.end;
    if (argEnd === null) continue;
    let i = skipWhitespace(code, argEnd);
    if (code[i] !== ",") continue;
    i = skipWhitespace(code, i + 1);
    if (!anchors.has(i)) continue;
    if (literal === null) {
      out.nonLiteral.push(callSnippet(code, m.index));
      continue;
    }
    classify(literal.value, out);
  }
  return out;
}

function classify(value: string, out: ExtractedUrls): void {
  if (value === "" || value.startsWith("//") || URL_SCHEME.test(value)) return;
  if (value.startsWith("/")) {
    out.unsupported.push(value);
    return;
  }
  const path = value.replace(/[?#].*$/, "");
  if (path === "." || path === ".." || path.endsWith("/")) return;
  out.specifiers.push(value.startsWith("./") || value.startsWith("../") ? value : `./${value}`);
}

/**
 * Index of the `,` or `)` ending the expression that starts at `from`,
 * skipping over nested brackets, strings and template literals. `null`
 * when the source ends first or brackets do not match.
 */
function skipExpression(src: string, from: number): number | null {
  // Expected closers; "`" marks being inside template literal text.
  const stack: string[] = [];
  let i = from;
  while (i < src.length) {
    const ch = src[i] as string;
    if (stack[stack.length - 1] === "`") {
      if (ch === "\\") {
        i += 2;
      } else if (ch === "$" && src[i + 1] === "{") {
        stack.push("}");
        i += 2;
      } else {
        if (ch === "`") stack.pop();
        i++;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      const literal = parseStringLiteral(src, i);
      if (literal === null) return null;
      i = literal.end;
      continue;
    }
    if (ch === "`") stack.push("`");
    else if (ch === "(") stack.push(")");
    else if (ch === "[") stack.push("]");
    else if (ch === "{") stack.push("}");
    else if (ch === ")" || ch === "]" || ch === "}") {
      if (stack.length === 0) return ch === ")" ? i : null;
      if (stack.pop() !== ch) return null;
    } else if (ch === "," && stack.length === 0) return i;
    i++;
  }
  return null;
}

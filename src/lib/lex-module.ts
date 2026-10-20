import { extname } from "node:path";
import { parse, type ImportSpecifier } from "es-module-lexer";
import { preprocess } from "./preprocess.js";

const PARSEABLE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
]);

export interface LexedModule {
  /** The source es-module-lexer saw (TypeScript / JSX already lowered). */
  code: string;
  /** Every import the lexer found, `import.meta` occurrences included. */
  imports: readonly ImportSpecifier[];
}

/**
 * Lower a module to plain ESM and run es-module-lexer over it, once.
 * Returns `null` for file types that are not JavaScript / TypeScript.
 * Positions in `imports` index into `code`, not the original content.
 */
export async function lexModule(filename: string, content: string): Promise<LexedModule | null> {
  const extension = extname(filename);
  if (!PARSEABLE_EXTENSIONS.has(extension)) {
    return null;
  }
  const code = await preprocess(content, extension);
  const [imports] = parse(code);
  return { code, imports };
}

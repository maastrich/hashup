import { extname } from "node:path";
import { parse } from "es-module-lexer";
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

export async function extractImports(filename: string, content: string): Promise<string[]> {
  const extension = extname(filename);
  if (!PARSEABLE_EXTENSIONS.has(extension)) {
    return [];
  }
  const processed = await preprocess(content, extension);
  const [imports] = parse(processed);
  return imports.map((imp) => imp.n).filter((n) => n !== undefined);
}

import { extname } from "node:path";
import { parse } from "es-module-lexer";
import { preprocess } from "./preprocess.js";

export async function extractImports(filename: string, content: string): Promise<string[]> {
  const extension = extname(filename);
  const processed = await preprocess(content, extension);
  const [imports] = parse(processed);
  return imports.map((imp) => imp.n).filter((n) => n !== undefined);
}

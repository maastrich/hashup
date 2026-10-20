import { lexModule } from "./lex-module.js";

export async function extractImports(filename: string, content: string): Promise<string[]> {
  const lexed = await lexModule(filename, content);
  if (lexed === null) {
    return [];
  }
  return lexed.imports.map((imp) => imp.n).filter((n) => n !== undefined);
}

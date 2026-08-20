import { transform, type Loader } from "esbuild";

const LOADERS: Record<string, Loader> = {
  ".ts": "ts",
  ".mts": "ts",
  ".cts": "ts",
  ".tsx": "tsx",
  ".jsx": "jsx",
};

/**
 * Lower TypeScript / JSX to plain ESM before import extraction.
 *
 * es-module-lexer does not understand TypeScript, so `import type` and
 * `export type` would otherwise surface as real imports — edges that do
 * not exist at runtime (and often resolve to nothing, e.g. a types-only
 * package export). esbuild erases them. `verbatimModuleSyntax` keeps
 * every *value* import, even unused ones, so a side-effect import is
 * never dropped from the graph.
 *
 * On any transform error the raw source is returned and the lexer gets
 * its chance; a parse failure there is reported by the caller.
 */
export async function preprocess(content: string, extension: string): Promise<string> {
  const loader = LOADERS[extension];
  if (loader === undefined) return content;
  try {
    const result = await transform(content, {
      loader,
      format: "esm",
      tsconfigRaw: { compilerOptions: { verbatimModuleSyntax: true } },
    });
    return result.code;
  } catch {
    return content;
  }
}

import { transform } from "esbuild";

export async function preprocess(
  content: string,
  extension: string
): Promise<string> {
  try {
    switch (extension) {
      case ".jsx":
      case ".tsx": {
        const result = await transform(content, {
          define: {},
          format: "esm",
          loader: extension === ".jsx" ? "jsx" : "tsx",
        });
        if (!result) {
          return content;
        }
        return result.code;
      }
      default: {
        return content;
      }
    }
  } catch {
    return content;
  }
}

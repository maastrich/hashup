import { dirname } from "node:path";
import type { Resolver } from "enhanced-resolve";

export async function resolveImport(
  resolver: Resolver,
  importSource: string,
  importName: string,
): Promise<string | false> {
  const context = dirname(importSource);
  const resolved = await new Promise<string | false>((resolve) =>
    resolver.resolve({}, context, importName, {}, (err, res) => {
      if (err) {
        resolve(false);
      }
      resolve(res ?? false);
    }),
  );
  return resolved;
}

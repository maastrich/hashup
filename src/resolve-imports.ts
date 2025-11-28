import fs from "node:fs";
import { dirname } from "node:path";
import { createRequire } from "node:module";
import type { Resolver } from "enhanced-resolve";

const require = createRequire(import.meta.url);
const { CachedInputFileSystem, ResolverFactory } = require("enhanced-resolve");

export function createResolver(): Resolver {
  return ResolverFactory.createResolver({
    extensions: [".ts", ".tsx", ".mts", ".js", ".jsx", ".mjs", ".json"],
    extensionAlias: {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
      ".cjs": [".cts", ".cjs"],
    },
    conditionNames: ["import", "require", "node", "webpack"],
    fileSystem: new CachedInputFileSystem(fs, 4000),
  });
}

export async function resolveImport(
  resolver: Resolver,
  importSource: string,
  importName: string
): Promise<string | false> {
  const context = dirname(importSource);
  const resolved = await new Promise<string | false>((resolve) =>
    resolver.resolve({}, context, importName, {}, (err, res) => {
      if (err) {
        resolve(false);
      }
      resolve(res ?? false);
    })
  );
  return resolved;
}

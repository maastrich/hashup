import fs from "node:fs";
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

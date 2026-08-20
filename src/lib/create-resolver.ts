import fs from "node:fs";
import { createRequire } from "node:module";
import type { Resolver } from "enhanced-resolve";

const require = createRequire(import.meta.url);
const { CachedInputFileSystem, ResolverFactory } = require("enhanced-resolve");

export interface CreateResolverOptions {
  /**
   * Honour the nearest `tsconfig.json` (walking up from the importing
   * file's directory, following `extends`) when resolving bare
   * specifiers: `compilerOptions.paths` and `baseUrl` are applied with
   * TypeScript's longest-prefix semantics before Node resolution.
   * Backed by enhanced-resolve's `TsconfigPathsPlugin`.
   *
   * @default true
   */
  tsconfig?: boolean;

  /**
   * Resolve to a directory instead of a file. Used internally to anchor
   * `import.meta.glob` patterns that start with a tsconfig alias.
   *
   * @default false
   */
  resolveToContext?: boolean;
}

// One cached filesystem for every resolver created in this process, so a
// file-mode and a context-mode resolver share stat / readFile results.
const fileSystem = new CachedInputFileSystem(fs, 4000);

export function createResolver(options: CreateResolverOptions = {}): Resolver {
  return ResolverFactory.createResolver({
    extensions: [".ts", ".tsx", ".mts", ".js", ".jsx", ".mjs", ".json"],
    extensionAlias: {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
      ".cjs": [".cts", ".cjs"],
    },
    conditionNames: ["import", "require", "node", "webpack"],
    tsconfig: options.tsconfig !== false,
    resolveToContext: options.resolveToContext === true,
    fileSystem,
  });
}

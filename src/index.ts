export { hashup, type HashupOptions, type HashupResult } from "./lib/hashup.js";
export { createLogger, isLogLevel, type Logger, type LogLevel } from "./lib/logger.js";
export { isInNodeModules } from "./lib/is-in-node-modules.js";
export { createHashupCache, collectReachable, type HashupCache } from "./lib/cache.js";
export { combineHashes } from "./lib/combine-hashes.js";
export { createContentHash } from "./lib/create-content-hash.js";
export { createResolver, type CreateResolverOptions } from "./lib/create-resolver.js";
export { resolveImport } from "./lib/resolve-import.js";
export { extractImports } from "./lib/extract-imports.js";
export { hashFile } from "./lib/hash-file.js";
export { resolveSpecifier } from "./lib/resolve-specifier.js";
export { stripQuery } from "./lib/strip-query.js";
export {
  extractGlobPatterns,
  type ExtractedGlobs,
  type GlobCall,
} from "./lib/extract-glob-patterns.js";
export { expandGlobImports, type ExpandedGlob } from "./lib/expand-glob-imports.js";
export type { UnresolvedImport, UnresolvedReason } from "./lib/unresolved-import.js";

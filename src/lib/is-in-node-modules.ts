import { sep } from "node:path";

const SEGMENT = `${sep}node_modules${sep}`;
const POSIX_SEGMENT = "/node_modules/";

/**
 * True if `file` lives inside any `node_modules` directory.
 *
 * Works on both POSIX and Windows paths. Used by the hasher to stop at
 * the package boundary: user code gets walked; dependencies are treated
 * as opaque and contribute no bytes to the hash. Callers that want to
 * pin to installed versions should add their lockfile to `extras`.
 */
export function isInNodeModules(file: string): boolean {
  return file.includes(SEGMENT) || file.includes(POSIX_SEGMENT);
}

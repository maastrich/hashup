import { hashup } from "../lib/hashup.js";
import type { LogLevel } from "../lib/logger.js";
import type { UnresolvedImport } from "../lib/unresolved-import.js";
import { formatSingleResult } from "./format-output.js";
import { resolveFrom } from "./resolve-from.js";

export interface RunSingleFileModeInput {
  cwd: string;
  file: string;
  extras: string[];
  baseDirOverride: string | undefined;
  json: boolean;
  files: boolean;
  logLevel?: LogLevel | undefined;
  /** `false` disables tsconfig `paths` resolution. Default on. */
  tsconfig?: boolean | undefined;
}

export interface RunSingleFileModeResult {
  output: string;
  unresolved: UnresolvedImport[];
}

export async function runSingleFileMode(
  input: RunSingleFileModeInput,
): Promise<RunSingleFileModeResult> {
  const baseDir =
    input.baseDirOverride !== undefined ? resolveFrom(input.cwd, input.baseDirOverride) : input.cwd;
  const result = await hashup(input.file, {
    extras: input.extras,
    baseDir,
    logLevel: input.logLevel,
    tsconfig: input.tsconfig !== false,
  });
  return {
    output: formatSingleResult(result, { json: input.json, files: input.files }),
    unresolved: result.unresolved,
  };
}

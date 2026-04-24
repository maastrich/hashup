import { hashup } from "../lib/hashup.js";
import type { LogLevel } from "../lib/logger.js";
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
}

export async function runSingleFileMode(input: RunSingleFileModeInput): Promise<string> {
  const baseDir =
    input.baseDirOverride !== undefined ? resolveFrom(input.cwd, input.baseDirOverride) : input.cwd;
  const result = await hashup(input.file, {
    extras: input.extras,
    baseDir,
    logLevel: input.logLevel,
  });
  return formatSingleResult(result, { json: input.json, files: input.files });
}

import type { LogLevel } from "../lib/logger.js";
import type { UnresolvedImport } from "../lib/unresolved-import.js";

export interface ReportUnresolvedInput {
  unresolved: readonly UnresolvedImport[];
  /** Effective log level (`undefined` = the default, which still prints the summary). */
  logLevel: LogLevel | undefined;
  /** Fail when `unresolved.length > failOnUnresolved`; `undefined` never fails. */
  failOnUnresolved: number | undefined;
}

export interface ReportUnresolvedOutput {
  /** Text to write to stderr (may be empty). */
  stderr: string;
  /** `0` or `1`. */
  exitCode: number;
}

/**
 * Turn the unresolved-import list into the CLI's stderr report.
 *
 * - `silent`: nothing (even the summary).
 * - default / `warn`: one summary line when the count is non-zero.
 * - `info` / `debug`: one line per unresolved edge, then the summary.
 *
 * Pure: the caller writes `stderr` and exits with `exitCode`.
 */
export function reportUnresolved(input: ReportUnresolvedInput): ReportUnresolvedOutput {
  const { unresolved, logLevel, failOnUnresolved } = input;
  const count = unresolved.length;
  const exitCode = failOnUnresolved !== undefined && count > failOnUnresolved ? 1 : 0;
  if (count === 0 || logLevel === "silent") {
    return { stderr: "", exitCode };
  }

  const lines: string[] = [];
  const verbose = logLevel === "info" || logLevel === "debug";
  if (verbose) {
    for (const u of unresolved) {
      lines.push(`hashup: ${u.reason}: ${u.from} -> "${u.specifier}"`);
    }
  }
  const noun = count === 1 ? "unresolved import" : "unresolved imports";
  const hint = verbose ? "" : " (run with --log-level info to list)";
  lines.push(`hashup: ${count} ${noun}${hint}`);
  if (exitCode !== 0) {
    lines.push(`hashup: failing because ${count} > --fail-on-unresolved=${failOnUnresolved}`);
  }
  return { stderr: `${lines.join("\n")}\n`, exitCode };
}

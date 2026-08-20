import { resolve } from "node:path";
import { configJsonSchema } from "../config/json-schema.js";
import { die } from "./die.js";
import { parseCliArgs } from "./parse-args.js";
import { reportUnresolved, type ReportUnresolvedInput } from "./report-unresolved.js";
import { runConfigMode } from "./run-config-mode.js";
import { runSingleFileMode } from "./run-single-file-mode.js";
import { USAGE } from "./usage.js";
import { writeOutput } from "./write-output.js";

export async function main(argv: string[]): Promise<void> {
  let args: ReturnType<typeof parseCliArgs>;
  try {
    args = parseCliArgs(argv);
  } catch (err) {
    die(`${(err as Error).message}\n\n${USAGE}`);
  }

  if (args.help) {
    process.stdout.write(USAGE);
    return;
  }

  // --cwd is resolved against the real process.cwd() so that relative
  // values on the command line behave predictably. Everything else
  // (config path, baseDir, output path) resolves against this effective
  // cwd, letting a single `--cwd ./packages/app` move the whole run.
  const cwd = args.cwd !== undefined ? resolve(process.cwd(), args.cwd) : process.cwd();

  if (args.printSchema) {
    await writeOutput(cwd, args.out, `${JSON.stringify(configJsonSchema, null, 2)}\n`);
    return;
  }

  if (args.positionals.length > 1) {
    die(`Unexpected arguments: ${args.positionals.slice(1).join(" ")}\n\n${USAGE}`);
  }

  if (args.positionals.length === 1) {
    const result = await runSingleFileMode({
      cwd,
      file: args.positionals[0]!,
      extras: args.extras,
      baseDirOverride: args.baseDir,
      json: args.json,
      files: args.files,
      logLevel: args.logLevel,
      tsconfig: args.tsconfig,
    });
    await writeOutput(cwd, args.out, result.output);
    finish({
      unresolved: result.unresolved,
      logLevel: args.logLevel,
      failOnUnresolved: args.failOnUnresolved,
    });
    return;
  }

  const result = await runConfigMode({
    cwd,
    configPath: args.config,
    baseDirOverride: args.baseDir,
    json: args.json,
    files: args.files,
    logLevel: args.logLevel,
    tsconfig: args.tsconfig,
    failOnUnresolved: args.failOnUnresolved,
  });
  if (!result.ok) {
    die(result.error);
  }
  await writeOutput(cwd, args.out, result.output);
  finish(result);
}

/**
 * Emit the unresolved-import report to stderr and set the exit code.
 * The hashes have already been written — a failing threshold still
 * lets callers capture the output, it just refuses to report success.
 */
function finish(input: ReportUnresolvedInput): void {
  const report = reportUnresolved(input);
  if (report.stderr.length > 0) process.stderr.write(report.stderr);
  if (report.exitCode !== 0) process.exitCode = report.exitCode;
}

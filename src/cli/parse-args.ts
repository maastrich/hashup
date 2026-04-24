import { parseArgs } from "node:util";
import { isLogLevel, type LogLevel } from "../lib/logger.js";

export interface CliArgs {
  config: string | undefined;
  extras: string[];
  baseDir: string | undefined;
  cwd: string | undefined;
  json: boolean;
  files: boolean;
  help: boolean;
  printSchema: boolean;
  out: string | undefined;
  logLevel: LogLevel | undefined;
  positionals: string[];
}

export function parseCliArgs(argv: string[]): CliArgs {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      config: { type: "string", short: "c" },
      extra: { type: "string", short: "e", multiple: true },
      "base-dir": { type: "string", short: "b" },
      json: { type: "boolean", default: false },
      files: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
      "print-schema": { type: "boolean", default: false },
      out: { type: "string", short: "o" },
      "log-level": { type: "string", short: "l" },
      cwd: { type: "string" },
    },
  });

  const rawLogLevel = values["log-level"] as string | undefined;
  if (rawLogLevel !== undefined && !isLogLevel(rawLogLevel)) {
    throw new Error(
      `Invalid --log-level "${rawLogLevel}". Expected one of: silent, warn, info, debug.`,
    );
  }

  return {
    config: values.config as string | undefined,
    extras: (values.extra as string[] | undefined) ?? [],
    baseDir: values["base-dir"] as string | undefined,
    cwd: values.cwd as string | undefined,
    json: values.json === true,
    files: values.files === true,
    help: values.help === true,
    printSchema: values["print-schema"] === true,
    out: values.out as string | undefined,
    logLevel: rawLogLevel,
    positionals,
  };
}

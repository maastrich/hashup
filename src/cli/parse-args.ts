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
  /** `false` when `--no-tsconfig` was passed, otherwise `undefined` (config/default decides). */
  tsconfig: false | undefined;
  /** Threshold from `--fail-on-unresolved[=<n>]`; `undefined` when the flag is absent. */
  failOnUnresolved: number | undefined;
  positionals: string[];
}

const FAIL_FLAG = "--fail-on-unresolved";

export function parseCliArgs(argv: string[]): CliArgs {
  // `--fail-on-unresolved` takes an *optional* numeric value, which
  // node:util's parseArgs cannot express; peel it off first.
  const failOnUnresolved = extractFailOnUnresolved(argv);

  const { values, positionals } = parseArgs({
    args: failOnUnresolved.rest,
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
      "no-tsconfig": { type: "boolean", default: false },
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
    tsconfig: values["no-tsconfig"] === true ? false : undefined,
    failOnUnresolved: failOnUnresolved.threshold,
    positionals,
  };
}

function extractFailOnUnresolved(argv: string[]): {
  rest: string[];
  threshold: number | undefined;
} {
  const rest: string[] = [];
  let threshold: number | undefined;
  let passthrough = false;
  for (const arg of argv) {
    if (passthrough || arg === "--") {
      // Everything after `--` is positional, never a flag.
      passthrough = true;
      rest.push(arg);
      continue;
    }
    if (arg === FAIL_FLAG) {
      threshold = 0;
      continue;
    }
    if (arg.startsWith(`${FAIL_FLAG}=`)) {
      const raw = arg.slice(FAIL_FLAG.length + 1);
      const n = Number(raw);
      if (!/^\d+$/.test(raw) || !Number.isSafeInteger(n)) {
        throw new Error(`Invalid ${FAIL_FLAG} value "${raw}". Expected a non-negative integer.`);
      }
      threshold = n;
      continue;
    }
    rest.push(arg);
  }
  return { rest, threshold };
}

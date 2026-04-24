import { parseArgs } from "node:util";

export interface CliArgs {
  config: string | undefined;
  extras: string[];
  baseDir: string | undefined;
  json: boolean;
  files: boolean;
  help: boolean;
  printSchema: boolean;
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
    },
  });
  return {
    config: values.config as string | undefined,
    extras: (values.extra as string[] | undefined) ?? [],
    baseDir: values["base-dir"] as string | undefined,
    json: values.json === true,
    files: values.files === true,
    help: values.help === true,
    printSchema: values["print-schema"] === true,
    positionals,
  };
}

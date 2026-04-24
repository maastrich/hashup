import { configJsonSchema } from "../config/json-schema.js";
import { die } from "./die.js";
import { parseCliArgs } from "./parse-args.js";
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

  if (args.printSchema) {
    await writeOutput(process.cwd(), args.out, `${JSON.stringify(configJsonSchema, null, 2)}\n`);
    return;
  }

  if (args.positionals.length > 1) {
    die(`Unexpected arguments: ${args.positionals.slice(1).join(" ")}\n\n${USAGE}`);
  }

  if (args.positionals.length === 1) {
    const output = await runSingleFileMode({
      cwd: process.cwd(),
      file: args.positionals[0]!,
      extras: args.extras,
      baseDirOverride: args.baseDir,
      json: args.json,
      files: args.files,
      logLevel: args.logLevel,
    });
    await writeOutput(process.cwd(), args.out, output);
    return;
  }

  const result = await runConfigMode({
    cwd: process.cwd(),
    configPath: args.config,
    baseDirOverride: args.baseDir,
    json: args.json,
    files: args.files,
    logLevel: args.logLevel,
  });
  if (!result.ok) {
    die(result.error);
  }
  await writeOutput(process.cwd(), args.out, result.output);
}

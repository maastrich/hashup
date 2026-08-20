import { z } from "zod/v4";
import { entrySchema } from "./entry-schema.js";

export const configSchema = z
  .object({
    $schema: z.string().optional(),
    baseDir: z
      .string()
      .min(1)
      .optional()
      .describe("Default base directory for every entry. Relative to the config file."),
    logLevel: z
      .enum(["silent", "warn", "info", "debug"])
      .optional()
      .describe(
        "Verbosity of diagnostic messages written to stderr. Defaults to 'silent'. The CLI --log-level flag overrides this.",
      ),
    tsconfig: z
      .boolean()
      .optional()
      .describe(
        "Resolve bare imports through the nearest tsconfig.json (compilerOptions.paths / baseUrl, following extends). Defaults to true. The CLI --no-tsconfig flag forces it off.",
      ),
    failOnUnresolved: z
      .union([z.boolean(), z.number().int().nonnegative()])
      .optional()
      .describe(
        "Exit non-zero when the number of unresolved imports exceeds this threshold. true means 0. The CLI --fail-on-unresolved flag overrides this.",
      ),
    entries: z
      .record(z.string().min(1), entrySchema)
      .refine((value) => Object.keys(value).length > 0, {
        message: "entries must contain at least one named entry",
      })
      .describe("Named entries to hash. Keys appear in the CLI output."),
  })
  .strict()
  .describe("Configuration for the hashup CLI. Lives in hashup.json.");

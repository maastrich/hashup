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
    entries: z
      .record(z.string().min(1), entrySchema)
      .refine((value) => Object.keys(value).length > 0, {
        message: "entries must contain at least one named entry",
      })
      .describe("Named entries to hash. Keys appear in the CLI output."),
  })
  .strict()
  .describe("Configuration for the hashup CLI. Lives in hashup.json.");

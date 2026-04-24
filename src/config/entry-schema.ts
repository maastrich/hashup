import { z } from "zod";

export const entrySchema = z
  .object({
    entry: z.string().min(1).describe("Path to the entry file, relative to baseDir."),
    extras: z
      .array(z.string().min(1))
      .optional()
      .describe(
        "Additional files whose content should be folded into the hash (e.g. package.json, lockfiles).",
      ),
    baseDir: z
      .string()
      .min(1)
      .optional()
      .describe("Per-entry base directory. Overrides the top-level baseDir for this entry."),
  })
  .strict();

import type { z } from "zod";
import type { configSchema } from "./config-schema.js";
import type { entrySchema } from "./entry-schema.js";

export type HashupConfigFile = z.infer<typeof configSchema>;
export type HashupConfigEntry = z.infer<typeof entrySchema>;

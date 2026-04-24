import { z } from "zod";
import { configSchema } from "./config-schema.js";

export const configJsonSchema = {
  ...z.toJSONSchema(configSchema, { target: "draft-7" }),
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://maastrich.github.io/hashup/schema.json",
  title: "Hashup Config",
};

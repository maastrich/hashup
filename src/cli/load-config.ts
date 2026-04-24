import { readFile } from "node:fs/promises";
import { configSchema } from "../config/config-schema.js";
import type { HashupConfigFile } from "../config/types.js";

export type LoadConfigResult = { ok: true; data: HashupConfigFile } | { ok: false; error: string };

export async function loadConfig(configPath: string): Promise<LoadConfigResult> {
  let contents: string;
  try {
    contents = await readFile(configPath, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return { ok: false, error: `Config file not found: ${configPath}` };
    }
    throw err;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(contents);
  } catch (err) {
    return {
      ok: false,
      error: `${configPath}: invalid JSON (${(err as Error).message})`,
    };
  }

  const result = configSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "<root>";
        return `  ${path}: ${issue.message}`;
      })
      .join("\n");
    return { ok: false, error: `${configPath}: invalid config\n${issues}` };
  }

  return { ok: true, data: result.data };
}

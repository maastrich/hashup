import { dirname, resolve } from "node:path";
import { hashup, type HashupResult } from "../lib/hashup.js";
import { formatNamedResults } from "./format-output.js";
import { loadConfig } from "./load-config.js";
import { resolveFrom } from "./resolve-from.js";

export interface RunConfigModeInput {
  cwd: string;
  configPath: string | undefined;
  baseDirOverride: string | undefined;
  json: boolean;
  files: boolean;
}

export type RunConfigModeResult = { ok: true; output: string } | { ok: false; error: string };

export async function runConfigMode(input: RunConfigModeInput): Promise<RunConfigModeResult> {
  const configPath = resolve(input.cwd, input.configPath ?? "hashup.json");
  const loaded = await loadConfig(configPath);
  if (!loaded.ok) {
    return loaded;
  }

  const configDir = dirname(configPath);
  const rootBase = resolveRootBase({
    cwd: input.cwd,
    configDir,
    override: input.baseDirOverride,
    fromFile: loaded.data.baseDir,
  });

  const results: Record<string, HashupResult> = {};
  for (const [name, entry] of Object.entries(loaded.data.entries)) {
    const baseDir = entry.baseDir !== undefined ? resolveFrom(configDir, entry.baseDir) : rootBase;
    results[name] = await hashup(entry.entry, { extras: entry.extras, baseDir });
  }

  return {
    ok: true,
    output: formatNamedResults(results, { json: input.json, files: input.files }),
  };
}

interface ResolveRootBaseInput {
  cwd: string;
  configDir: string;
  override: string | undefined;
  fromFile: string | undefined;
}

function resolveRootBase({ cwd, configDir, override, fromFile }: ResolveRootBaseInput): string {
  if (override !== undefined) {
    return resolveFrom(cwd, override);
  }
  if (fromFile !== undefined) {
    return resolveFrom(configDir, fromFile);
  }
  return configDir;
}

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import { loadConfig } from "../../src/cli/load-config.js";

let workDir: string;

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), "hashup-load-config-"));
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

async function writeConfig(body: string): Promise<string> {
  const path = join(workDir, "hashup.json");
  await writeFile(path, body);
  return path;
}

describe("loadConfig", () => {
  test("returns parsed data for a valid config", async () => {
    const path = await writeConfig(
      JSON.stringify({
        baseDir: ".",
        entries: { app: { entry: "src/index.ts", extras: ["package.json"] } },
      }),
    );
    const result = await loadConfig(path);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.entries.app!.entry).toBe("src/index.ts");
      expect(result.data.entries.app!.extras).toEqual(["package.json"]);
    }
  });

  test("tolerates a $schema field at the top level", async () => {
    const path = await writeConfig(
      JSON.stringify({
        $schema: "https://example.com/schema.json",
        entries: { a: { entry: "a.ts" } },
      }),
    );
    const result = await loadConfig(path);
    expect(result.ok).toBe(true);
  });

  test("reports a missing file", async () => {
    const result = await loadConfig(join(workDir, "nope.json"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Config file not found/);
    }
  });

  test("reports invalid JSON", async () => {
    const path = await writeConfig("{ not json");
    const result = await loadConfig(path);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/invalid JSON/);
    }
  });

  test("reports empty entries", async () => {
    const path = await writeConfig(JSON.stringify({ entries: {} }));
    const result = await loadConfig(path);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/at least one named entry/);
    }
  });

  test("reports missing entry.entry field", async () => {
    const path = await writeConfig(JSON.stringify({ entries: { a: {} } }));
    const result = await loadConfig(path);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/entries\.a\.entry/);
    }
  });

  test("reports wrong types with a readable path", async () => {
    const path = await writeConfig(JSON.stringify({ entries: { x: { entry: 123 } } }));
    const result = await loadConfig(path);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/entries\.x\.entry/);
      expect(result.error).toMatch(/expected string/);
    }
  });

  test("rejects unknown top-level keys", async () => {
    const path = await writeConfig(
      JSON.stringify({ entries: { a: { entry: "a.ts" } }, bogus: true }),
    );
    const result = await loadConfig(path);
    expect(result.ok).toBe(false);
  });
});

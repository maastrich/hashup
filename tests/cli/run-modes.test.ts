import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import { runConfigMode } from "../../src/cli/run-config-mode.js";
import { runSingleFileMode } from "../../src/cli/run-single-file-mode.js";

let workDir: string;

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), "hashup-run-modes-"));
  await mkdir(join(workDir, "src"), { recursive: true });
  await writeFile(join(workDir, "src", "a.ts"), "export const a = 1;\n");
  await writeFile(
    join(workDir, "src", "b.ts"),
    "import { a } from './a.js';\nexport const b = a + 1;\n",
  );
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe("runSingleFileMode", () => {
  test("hashes a file and emits a newline-terminated hex digest", async () => {
    const output = await runSingleFileMode({
      cwd: workDir,
      file: "src/a.ts",
      extras: [],
      baseDirOverride: undefined,
      json: false,
      files: false,
    });
    expect(output).toMatch(/^[a-f0-9]{64}\n$/);
  });

  test("json mode emits { hash }", async () => {
    const output = await runSingleFileMode({
      cwd: workDir,
      file: "src/a.ts",
      extras: [],
      baseDirOverride: undefined,
      json: true,
      files: false,
    });
    const parsed = JSON.parse(output);
    expect(parsed.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(parsed.files).toBeUndefined();
  });

  test("json + files includes resolved file list", async () => {
    const output = await runSingleFileMode({
      cwd: workDir,
      file: "src/b.ts",
      extras: [],
      baseDirOverride: undefined,
      json: true,
      files: true,
    });
    const parsed = JSON.parse(output);
    expect(parsed.files.some((f: string) => f.endsWith("b.ts"))).toBe(true);
    expect(parsed.files.some((f: string) => f.endsWith("a.ts"))).toBe(true);
  });

  test("extras change the hash", async () => {
    const base = await runSingleFileMode({
      cwd: workDir,
      file: "src/a.ts",
      extras: [],
      baseDirOverride: undefined,
      json: false,
      files: false,
    });
    const withExtra = await runSingleFileMode({
      cwd: workDir,
      file: "src/a.ts",
      extras: ["src/b.ts"],
      baseDirOverride: undefined,
      json: false,
      files: false,
    });
    expect(base).not.toBe(withExtra);
  });
});

describe("runConfigMode", () => {
  async function writeConfigFile(body: unknown): Promise<void> {
    await writeFile(join(workDir, "hashup.json"), JSON.stringify(body));
  }

  test("hashes every entry and prints name + hash", async () => {
    await writeConfigFile({
      entries: {
        a: { entry: "src/a.ts" },
        b: { entry: "src/b.ts" },
      },
    });
    const result = await runConfigMode({
      cwd: workDir,
      configPath: undefined,
      baseDirOverride: undefined,
      json: false,
      files: false,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output).toMatch(/^a {2}[a-f0-9]{64}\nb {2}[a-f0-9]{64}\n$/);
    }
  });

  test("resolves paths relative to the config's baseDir by default", async () => {
    // Write the config in a sibling directory so the default (configDir)
    // is exercised against a non-cwd location.
    const nestedDir = join(workDir, "nested");
    await mkdir(nestedDir);
    await writeFile(
      join(nestedDir, "hashup.json"),
      JSON.stringify({ baseDir: "..", entries: { a: { entry: "src/a.ts" } } }),
    );
    const result = await runConfigMode({
      cwd: workDir,
      configPath: "nested/hashup.json",
      baseDirOverride: undefined,
      json: false,
      files: false,
    });
    expect(result.ok).toBe(true);
  });

  test("per-entry baseDir overrides the root baseDir", async () => {
    const altDir = join(workDir, "alt");
    await mkdir(join(altDir, "src"), { recursive: true });
    await writeFile(join(altDir, "src", "c.ts"), "export const c = 3;\n");
    await writeConfigFile({
      baseDir: ".",
      entries: {
        a: { entry: "src/a.ts" },
        c: { entry: "src/c.ts", baseDir: altDir },
      },
    });
    const result = await runConfigMode({
      cwd: workDir,
      configPath: undefined,
      baseDirOverride: undefined,
      json: false,
      files: false,
    });
    expect(result.ok).toBe(true);
  });

  test("json mode emits a keyed object", async () => {
    await writeConfigFile({ entries: { a: { entry: "src/a.ts" } } });
    const result = await runConfigMode({
      cwd: workDir,
      configPath: undefined,
      baseDirOverride: undefined,
      json: true,
      files: false,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(JSON.parse(result.output).a.hash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  test("propagates config-load errors", async () => {
    const result = await runConfigMode({
      cwd: workDir,
      configPath: "does-not-exist.json",
      baseDirOverride: undefined,
      json: false,
      files: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Config file not found/);
    }
  });
});

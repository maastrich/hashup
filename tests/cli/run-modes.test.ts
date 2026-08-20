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
    const { output } = await runSingleFileMode({
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
    const { output } = await runSingleFileMode({
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
    const { output } = await runSingleFileMode({
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
    const { output: base } = await runSingleFileMode({
      cwd: workDir,
      file: "src/a.ts",
      extras: [],
      baseDirOverride: undefined,
      json: false,
      files: false,
    });
    const { output: withExtra } = await runSingleFileMode({
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

  test("expands glob entries and folds matches into one hash", async () => {
    await writeConfigFile({ entries: { all: { entry: "src/*.ts" } } });
    const result = await runConfigMode({
      cwd: workDir,
      configPath: undefined,
      baseDirOverride: undefined,
      json: true,
      files: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const parsed = JSON.parse(result.output);
      expect(parsed.all.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(parsed.all.files.some((f: string) => f.endsWith("a.ts"))).toBe(true);
      expect(parsed.all.files.some((f: string) => f.endsWith("b.ts"))).toBe(true);
    }
  });

  test("glob hash is stable and changes when a matched file changes", async () => {
    await writeConfigFile({ entries: { all: { entry: "src/*.ts" } } });
    const first = await runConfigMode({
      cwd: workDir,
      configPath: undefined,
      baseDirOverride: undefined,
      json: false,
      files: false,
    });
    const second = await runConfigMode({
      cwd: workDir,
      configPath: undefined,
      baseDirOverride: undefined,
      json: false,
      files: false,
    });
    expect(first.ok && second.ok && first.output).toBe(second.ok && second.output);

    await writeFile(join(workDir, "src", "a.ts"), "export const a = 999;\n");
    const third = await runConfigMode({
      cwd: workDir,
      configPath: undefined,
      baseDirOverride: undefined,
      json: false,
      files: false,
    });
    expect(third.ok && third.output).not.toBe(first.ok && first.output);
  });

  test("default baseDir is cwd, not the config's directory", async () => {
    // Layout:
    //   workDir/
    //     src/a.ts              (the "cwd" version)
    //     pkg/hashup.json       (globs src/**/*.ts)
    //     pkg/src/a.ts          (the "configDir" version)
    // Running with cwd=workDir and -c pkg/hashup.json, the default
    // baseDir should now be workDir, so the glob matches workDir/src/a.ts.
    await mkdir(join(workDir, "pkg", "src"), { recursive: true });
    await writeFile(
      join(workDir, "pkg", "src", "a.ts"),
      "export const fromPkg = true;\n", // distinct content from workDir/src/a.ts
    );
    await writeFile(
      join(workDir, "pkg", "hashup.json"),
      JSON.stringify({ entries: { a: { entry: "src/**/*.ts" } } }),
    );

    const cwdRun = await runConfigMode({
      cwd: workDir,
      configPath: "pkg/hashup.json",
      baseDirOverride: undefined,
      json: true,
      files: true,
    });
    expect(cwdRun.ok).toBe(true);
    if (cwdRun.ok) {
      const parsed = JSON.parse(cwdRun.output);
      // Default baseDir is cwd (workDir) → matches workDir/src/a.ts,
      // NOT workDir/pkg/src/a.ts
      expect(parsed.a.files).toEqual(
        expect.arrayContaining([expect.stringContaining(`${workDir}/src/a.ts`)]),
      );
      expect(parsed.a.files).not.toContain(`${workDir}/pkg/src/a.ts`);
    }
  });

  test('config-relative behavior is still reachable via baseDir: "."', async () => {
    await mkdir(join(workDir, "pkg", "src"), { recursive: true });
    await writeFile(join(workDir, "pkg", "src", "a.ts"), "export const fromPkg = true;\n");
    await writeFile(
      join(workDir, "pkg", "hashup.json"),
      JSON.stringify({ baseDir: ".", entries: { a: { entry: "src/**/*.ts" } } }),
    );

    const result = await runConfigMode({
      cwd: workDir,
      configPath: "pkg/hashup.json",
      baseDirOverride: undefined,
      json: true,
      files: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const parsed = JSON.parse(result.output);
      // baseDir: "." resolves against configDir → pkg/src/a.ts
      expect(parsed.a.files).toEqual(
        expect.arrayContaining([expect.stringContaining(`${workDir}/pkg/src/a.ts`)]),
      );
    }
  });

  test("zero-match glob emits <no-hash> and does not abort other entries", async () => {
    await writeConfigFile({
      entries: {
        none: { entry: "src/*.missing" },
        real: { entry: "src/a.ts" },
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
      expect(result.output).toMatch(/none\s+<no-hash>/);
      expect(result.output).toMatch(/real\s+[a-f0-9]{64}/);
    }
  });

  test("zero-match glob in --json mode emits <no-hash> with an empty files list", async () => {
    await writeConfigFile({ entries: { none: { entry: "src/*.missing" } } });
    const result = await runConfigMode({
      cwd: workDir,
      configPath: undefined,
      baseDirOverride: undefined,
      json: true,
      files: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const parsed = JSON.parse(result.output);
      expect(parsed.none.hash).toBe("<no-hash>");
      expect(parsed.none.files).toEqual([]);
    }
  });

  test("literal entry hash is unchanged vs a single-match glob with the same file", async () => {
    await writeConfigFile({ entries: { a: { entry: "src/a.ts" } } });
    const literal = await runConfigMode({
      cwd: workDir,
      configPath: undefined,
      baseDirOverride: undefined,
      json: false,
      files: false,
    });
    await writeConfigFile({ entries: { a: { entry: "src/a.*" } } });
    const globbed = await runConfigMode({
      cwd: workDir,
      configPath: undefined,
      baseDirOverride: undefined,
      json: false,
      files: false,
    });
    // src/a.* matches only src/a.ts in this fixture, so the outer combine is
    // skipped and the resulting hash matches the literal form byte-for-byte.
    expect(literal.ok && globbed.ok && literal.output).toBe(globbed.ok && globbed.output);
  });

  test("extras globs are folded into the hash", async () => {
    await writeFile(join(workDir, "package.json"), '{"name":"x"}');
    await writeConfigFile({
      entries: { a: { entry: "src/a.ts", extras: ["*.json"] } },
    });
    const withExtras = await runConfigMode({
      cwd: workDir,
      configPath: undefined,
      baseDirOverride: undefined,
      json: false,
      files: false,
    });
    await writeConfigFile({ entries: { a: { entry: "src/a.ts" } } });
    const without = await runConfigMode({
      cwd: workDir,
      configPath: undefined,
      baseDirOverride: undefined,
      json: false,
      files: false,
    });
    expect(withExtras.ok && withExtras.output).not.toBe(without.ok && without.output);
  });
});

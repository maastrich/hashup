import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import { expandPaths } from "../../src/cli/expand-paths.js";

let workDir: string;

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), "hashup-expand-paths-"));
  await mkdir(join(workDir, "src"), { recursive: true });
  await writeFile(join(workDir, "src", "a.ts"), "");
  await writeFile(join(workDir, "src", "b.ts"), "");
  await writeFile(join(workDir, "src", "c.js"), "");
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe("expandPaths", () => {
  test("passes literal paths through, resolved against baseDir", async () => {
    const result = await expandPaths(["src/a.ts"], workDir);
    expect(result).toEqual([join(workDir, "src/a.ts")]);
  });

  test("keeps absolute literal paths as-is", async () => {
    const abs = join(workDir, "src/a.ts");
    expect(await expandPaths([abs], workDir)).toEqual([abs]);
  });

  test("expands a glob to sorted absolute paths", async () => {
    const result = await expandPaths(["src/*.ts"], workDir);
    expect(result).toEqual([join(workDir, "src/a.ts"), join(workDir, "src/b.ts")]);
  });

  test("returns an empty array for a glob that matches nothing", async () => {
    expect(await expandPaths(["nope/**/*.ts"], workDir)).toEqual([]);
  });

  test("deduplicates when a literal is also a glob match", async () => {
    const result = await expandPaths(["src/a.ts", "src/*.ts"], workDir);
    expect(result).toEqual([join(workDir, "src/a.ts"), join(workDir, "src/b.ts")]);
  });

  test("mixes literals and globs deterministically", async () => {
    const result = await expandPaths(["src/c.js", "src/*.ts"], workDir);
    expect(result).toEqual([
      join(workDir, "src/a.ts"),
      join(workDir, "src/b.ts"),
      join(workDir, "src/c.js"),
    ]);
  });

  test("only returns files (never directories)", async () => {
    const result = await expandPaths(["src/**"], workDir);
    for (const p of result) {
      expect(p.endsWith("a.ts") || p.endsWith("b.ts") || p.endsWith("c.js")).toBe(true);
    }
  });
});

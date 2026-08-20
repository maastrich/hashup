import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { extractGlobPatterns, hashup } from "../src/index.js";

const ENTRY = resolve("tests/fixtures/import-meta-glob/entry.ts");

describe("extractGlobPatterns", () => {
  test("accepts string literals and arrays of string literals", () => {
    const src = `
      const a = import.meta.glob('./a/*.ts');
      const b = import.meta.glob(["./b/*.ts", '!./b/skip.ts'], { eager: true });
      const c = import.meta.globEager("./c/*.json");
      const d = import.meta.glob(\`./d/*.ts\`);
    `;
    const { calls, skipped } = extractGlobPatterns(src);
    expect(calls.map((c) => c.patterns)).toEqual([
      ["./a/*.ts"],
      ["./b/*.ts", "!./b/skip.ts"],
      ["./c/*.json"],
      ["./d/*.ts"],
    ]);
    expect(skipped).toEqual([]);
  });

  test("reports non-literal arguments instead of guessing", () => {
    const src = `
      const p = "./x/*.ts";
      import.meta.glob(p);
      import.meta.glob(\`./\${p}\`);
      import.meta.glob([p, "./y/*.ts"]);
    `;
    const { calls, skipped } = extractGlobPatterns(src);
    expect(calls).toEqual([]);
    expect(skipped).toHaveLength(3);
    expect(skipped[0]).toMatch(/^import\.meta\.glob\(p\)/);
  });

  test("is a no-op for sources without import.meta.glob", () => {
    expect(extractGlobPatterns("import x from './x';")).toEqual({ calls: [], skipped: [] });
  });
});

describe("import.meta.glob expansion", () => {
  test("literal string pattern: every match is a dependency", async () => {
    const result = await hashup(ENTRY);
    expect(result.files.some((f) => f.endsWith("locales/en.json"))).toBe(true);
    expect(result.files.some((f) => f.endsWith("locales/fr.json"))).toBe(true);
    expect(result.files.some((f) => f.endsWith("icons/one.svg"))).toBe(true);
  });

  test("array with negation: excluded file stays out", async () => {
    const result = await hashup(ENTRY);
    expect(result.files.some((f) => f.endsWith("mods/a.ts"))).toBe(true);
    expect(result.files.some((f) => f.endsWith("mods/skip.ts"))).toBe(false);
  });

  test("matched .ts modules are walked like normal imports", async () => {
    const result = await hashup(ENTRY);
    expect(result.files.some((f) => f.endsWith("mods/deep/b.ts"))).toBe(true);
  });

  test("non-literal arguments are skipped and reported", async () => {
    const result = await hashup(ENTRY);
    const skipped = result.unresolved.filter((u) => u.reason === "non-literal-glob");
    expect(skipped).toHaveLength(2);
    expect(skipped.every((u) => u.from === ENTRY)).toBe(true);
    expect(skipped.map((u) => u.specifier).sort()).toEqual([
      "import.meta.glob(`./${pattern}`);",
      "import.meta.glob(pattern);",
    ]);
  });

  test("glob matches change the hash when a matched file changes", async () => {
    const target = resolve("tests/fixtures/import-meta-glob/locales/fr.json");
    const original = await readFile(target, "utf8");
    const before = await hashup(ENTRY);
    try {
      await writeFile(target, '{ "hi": "salut" }\n');
      const after = await hashup(ENTRY);
      expect(after.hash).not.toBe(before.hash);
    } finally {
      await writeFile(target, original);
    }
  });
});

import { describe, expect, test } from "vite-plus/test";
import { hashup } from "../src/index.js";

describe("hashup with unknown file types", () => {
  test("should include an SVG import in the hash without erroring", async () => {
    const result = await hashup("./tests/fixtures/unknown-file-types/entry.ts");

    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.files.some((f) => f.endsWith("icon.svg"))).toBe(true);
  });

  test("should change hash when the SVG content changes", async () => {
    const { readFile, writeFile } = await import("node:fs/promises");
    const svgPath = "./tests/fixtures/unknown-file-types/icon.svg";
    const original = await readFile(svgPath, "utf-8");

    const before = await hashup("./tests/fixtures/unknown-file-types/entry.ts");
    try {
      await writeFile(svgPath, `${original.trimEnd()}\n<!-- mutated -->\n`);
      const after = await hashup("./tests/fixtures/unknown-file-types/entry.ts");
      expect(after.hash).not.toBe(before.hash);
    } finally {
      await writeFile(svgPath, original);
    }
  });
});

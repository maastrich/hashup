import { resolve } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { extractImports, hashup } from "../src/index.js";

const ENTRY = resolve("tests/fixtures/type-only-imports/entry.ts");
const has = (files: string[], suffix: string) => files.some((f) => f.endsWith(suffix));

describe("type-only imports in .ts files", () => {
  test("import type / export type are erased before import extraction", async () => {
    const imports = await extractImports(
      "x.ts",
      [
        'import type { A } from "./a";',
        'import { type B, b } from "./b";',
        'export type { C } from "./c";',
        'import "./d";',
        'import e from "./e";',
        "void b;",
      ].join("\n"),
    );
    expect(imports).toEqual(["./b", "./d", "./e"]);
  });

  test("same for .mts and .cts", async () => {
    const src = 'import type { A } from "./a";\nimport { b } from "./b";\nvoid b;';
    expect(await extractImports("x.mts", src)).toEqual(["./b"]);
    expect(await extractImports("x.cts", src)).toEqual(["./b"]);
  });

  test("unresolvable type-only specifier is neither walked nor reported", async () => {
    const result = await hashup(ENTRY);
    expect(result.unresolved).toEqual([]);
    expect(has(result.files, "local-types.ts")).toBe(false);
    expect(has(result.files, "reexported-types.ts")).toBe(false);
  });

  test("value imports survive, including unused and side-effect ones", async () => {
    const result = await hashup(ENTRY);
    expect(has(result.files, "value.ts")).toBe(true);
    expect(has(result.files, "side-effect.ts")).toBe(true);
    expect(has(result.files, "unused.ts")).toBe(true);
  });
});

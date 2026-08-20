import { resolve } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { hashup, stripQuery } from "../src/index.js";

const ENTRY = resolve("tests/fixtures/query-imports/entry.ts");

describe("stripQuery", () => {
  test("removes query strings and fragments", () => {
    expect(stripQuery("./en.json?lingui")).toBe("./en.json");
    expect(stripQuery("./b.yml?raw")).toBe("./b.yml");
    expect(stripQuery("./c.svg?url#icon")).toBe("./c.svg");
    expect(stripQuery("./d.js#section")).toBe("./d.js");
    expect(stripQuery("/abs/path/file.ts?v=2")).toBe("/abs/path/file.ts");
  });

  test("keeps leading # (package.json imports subpaths)", () => {
    expect(stripQuery("#internal/utils")).toBe("#internal/utils");
    expect(stripQuery("#internal/utils?raw")).toBe("#internal/utils");
  });
});

describe("query-suffixed imports", () => {
  test("query-suffixed specifiers resolve to their real file", async () => {
    const result = await hashup(ENTRY);
    const names = result.files.map((f) => f.slice(f.lastIndexOf("/") + 1));
    expect(names).toContain("a.json");
    expect(names).toContain("b.yml");
    expect(names).toContain("c.svg");
    expect(names).toContain("d.ts");
    expect(result.unresolved).toEqual([]);
  });

  test("no resolved path carries a query or fragment", async () => {
    const result = await hashup(ENTRY);
    expect(result.files.some((f) => f.includes("?") || f.includes("#"))).toBe(false);
  });

  test("same file with and without a query contributes once", async () => {
    const result = await hashup(ENTRY);
    const aJson = result.files.filter((f) => f.endsWith("/a.json"));
    const dTs = result.files.filter((f) => f.endsWith("/d.ts"));
    expect(aJson).toHaveLength(1);
    expect(dTs).toHaveLength(1);
    // entry + a.json + b.yml + c.svg + d.ts
    expect(result.files).toHaveLength(5);
  });
});

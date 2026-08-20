import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { createHashupCache, createResolver, hashup } from "../src/index.js";

const ROOT = resolve("tests/fixtures/tsconfig-paths");
const APP_ENTRY = `${ROOT}/packages/app/src/entry.ts`;
const LIB_ENTRY = `${ROOT}/packages/lib/src/index.ts`;
const CATALOGS = `${ROOT}/packages/app/src/catalogs.ts`;

const has = (files: string[], suffix: string) => files.some((f) => f.endsWith(suffix));

describe("tsconfig paths resolution", () => {
  test("wildcard, exact and two-candidate aliases all land in files", async () => {
    const result = await hashup(APP_ENTRY);

    expect(has(result.files, "src/features/nav/use-thing.ts")).toBe(true); // @/*
    expect(has(result.files, "config/a.json")).toBe(true); // @config (exact)
    expect(has(result.files, "config/b.json")).toBe(true); // @/fallback.json, 2nd candidate
    expect(has(result.files, "src/local.ts")).toBe(true); // plain relative still works
    expect(result.unresolved).toEqual([]);
  });

  test("alias target outside the importing package is walked", async () => {
    const result = await hashup(APP_ENTRY);
    expect(has(result.files, "tsconfig-paths/shared/util.ts")).toBe(true);
  });

  test("paths inherited via extends (JSONC base) are anchored at the declaring config", async () => {
    const result = await hashup(LIB_ENTRY);
    expect(has(result.files, "tsconfig-paths/shared/util.ts")).toBe(true);
    expect(result.unresolved).toEqual([]);
  });

  test("hash changes when an aliased file changes", async () => {
    const target = `${ROOT}/packages/app/src/features/nav/use-thing.ts`;
    const original = await readFile(target, "utf8");
    const before = await hashup(APP_ENTRY);
    try {
      await writeFile(target, `${original}\n// touched\n`);
      const after = await hashup(APP_ENTRY);
      expect(after.hash).not.toBe(before.hash);
    } finally {
      await writeFile(target, original);
    }
  });

  test("tsconfig: false turns aliases into unresolved edges", async () => {
    const result = await hashup(APP_ENTRY, { tsconfig: false });
    expect(has(result.files, "use-thing.ts")).toBe(false);
    const specifiers = result.unresolved.map((u) => u.specifier).sort();
    expect(specifiers).toEqual([
      "@/fallback.json",
      "@/features/nav/use-thing",
      "@config",
      "@shared/util",
    ]);
    expect(result.unresolved.every((u) => u.reason === "unresolved")).toBe(true);
  });

  test("a resolver built with createResolver({ tsconfig: false }) behaves the same", async () => {
    const resolver = createResolver({ tsconfig: false });
    const result = await hashup(APP_ENTRY, { resolver, cache: createHashupCache() });
    expect(result.unresolved).toHaveLength(4);
  });

  test("import.meta.glob with an alias prefix is anchored through tsconfig paths", async () => {
    const result = await hashup(CATALOGS);
    expect(has(result.files, "src/locales/en.json")).toBe(true);
    expect(has(result.files, "src/locales/fr.json")).toBe(true);
    expect(result.unresolved).toEqual([
      { from: CATALOGS, specifier: "@nope/*.json", reason: "unsupported-glob" },
    ]);
  });
});

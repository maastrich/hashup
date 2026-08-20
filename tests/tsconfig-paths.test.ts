import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { createHashupCache, hashup, loadTsconfig, mapTsconfigPaths } from "../src/index.js";

const ROOT = resolve("tests/fixtures/tsconfig-paths");
const APP_ENTRY = `${ROOT}/packages/app/src/entry.ts`;
const LIB_ENTRY = `${ROOT}/packages/lib/src/index.ts`;

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

  test("paths inherited via extends are anchored at the declaring config", async () => {
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

  test("each tsconfig is read once per cache", async () => {
    const cache = createHashupCache();
    await hashup(APP_ENTRY, { cache });
    await hashup(LIB_ENTRY, { cache });
    const keys = Array.from(cache.tsconfigs.keys()).sort();
    expect(keys).toEqual([
      `${ROOT}/packages/app/tsconfig.json`,
      `${ROOT}/packages/lib/tsconfig.json`,
    ]);
    // Directories memoise the lookup too — the src dir points at the package config.
    expect(cache.tsconfigDirs.get(`${ROOT}/packages/app/src/features/nav`)).toBe(
      `${ROOT}/packages/app/tsconfig.json`,
    );
  });
});

describe("loadTsconfig + mapTsconfigPaths", () => {
  test("parses JSONC, follows extends and applies longest-prefix matching", async () => {
    const cache = createHashupCache();
    const ts = await loadTsconfig(`${ROOT}/packages/app/tsconfig.json`, cache);
    expect(ts).not.toBeNull();

    expect(mapTsconfigPaths("@/x/y", ts!)).toEqual([`${ROOT}/packages/app/src/x/y`]);
    expect(mapTsconfigPaths("@config", ts!)).toEqual([`${ROOT}/packages/app/config/a.json`]);
    // exact pattern beats the `@/*` wildcard, both candidates kept in order
    expect(mapTsconfigPaths("@/fallback.json", ts!)).toEqual([
      `${ROOT}/packages/app/missing/first.json`,
      `${ROOT}/packages/app/config/b.json`,
    ]);
    expect(mapTsconfigPaths("./relative", ts!)).toEqual([]);
    expect(mapTsconfigPaths("react", ts!)).toEqual([]);
  });

  test("inherited paths resolve relative to the config that declared them", async () => {
    const cache = createHashupCache();
    const ts = await loadTsconfig(`${ROOT}/packages/lib/tsconfig.json`, cache);
    expect(mapTsconfigPaths("@shared/util", ts!)).toEqual([`${ROOT}/shared/util`]);
  });

  test("baseUrl is used when no paths pattern matches", () => {
    const ts = { configPath: "/x/tsconfig.json", baseUrl: "/x/src", paths: [] };
    expect(mapTsconfigPaths("features/a", ts)).toEqual(["/x/src/features/a"]);
  });
});

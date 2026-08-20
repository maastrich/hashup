import { describe, expect, test } from "vite-plus/test";
import { hashup } from "../src/index.js";

describe("hashup with example files", () => {
  test("should hash TypeScript entry file with dependencies", async () => {
    const result = await hashup("./examples/src/index.ts");

    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.files.length).toBeGreaterThan(1);

    // Should include the entry file
    expect(result.files.some((f) => f.includes("index.ts"))).toBe(true);

    // Should include dependencies
    expect(result.files.some((f) => f.includes("math"))).toBe(true);
    expect(result.files.some((f) => f.includes("helpers"))).toBe(true);
    expect(result.files.some((f) => f.includes("user"))).toBe(true);
  });

  test("should hash JavaScript files", async () => {
    const result = await hashup("./examples/src/utils/helpers.js");

    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.files.some((f) => f.includes("helpers.js"))).toBe(true);
  });

  test("should hash TypeScript files with types", async () => {
    const result = await hashup("./examples/src/utils/math.ts");

    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.files.some((f) => f.includes("math.ts"))).toBe(true);
  });

  test("should hash JSX files", async () => {
    const result = await hashup("./examples/src/components/Button.jsx");

    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.files.some((f) => f.includes("Button.jsx"))).toBe(true);
  });

  test("should hash TSX files with dependencies", async () => {
    const result = await hashup("./examples/src/components/Card.tsx");

    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.files.some((f) => f.includes("Card.tsx"))).toBe(true);
    // Note: type-only imports (import type) are not included as they're compile-time only
  });

  test("should hash ESM files (.mjs)", async () => {
    const result = await hashup("./examples/src/utils/logger.mjs");

    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.files.some((f) => f.includes("logger.mjs"))).toBe(true);
  });

  test("should hash ESM TypeScript files (.mts)", async () => {
    const result = await hashup("./examples/src/utils/constants.mts");

    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.files.some((f) => f.includes("constants.mts"))).toBe(true);
  });

  test("should produce different hashes for different files", async () => {
    const result1 = await hashup("./examples/src/utils/math.ts");
    const result2 = await hashup("./examples/src/utils/helpers.js");
    const result3 = await hashup("./examples/src/index.ts");

    expect(result1.hash).not.toBe(result2.hash);
    expect(result2.hash).not.toBe(result3.hash);
    expect(result1.hash).not.toBe(result3.hash);
  });

  test("should produce same hash for same file", async () => {
    const result1 = await hashup("./examples/src/index.ts");
    const result2 = await hashup("./examples/src/index.ts");

    expect(result1.hash).toBe(result2.hash);
    expect(result1.files).toEqual(result2.files);
  });

  test("should resolve JSON imports", async () => {
    const result = await hashup("./examples/src/index.ts");

    // Should include config.json
    expect(result.files.some((f) => f.includes("config.json"))).toBe(true);
  });

  test("should handle .mjs and .mts imports", async () => {
    const result = await hashup("./examples/src/index.ts");

    // Should include logger.mjs and constants.mts
    expect(result.files.some((f) => f.includes("logger.mjs"))).toBe(true);
    expect(result.files.some((f) => f.includes("constants.mts"))).toBe(true);
  });

  test("should resolve a stable hash for the same file", async () => {
    const result1 = await hashup("./examples/src/index.ts");
    const result2 = await hashup("./examples/src/index.ts");

    expect(result1.hash).toBe(result2.hash);
    expect(result1.files).toEqual(result2.files);
  });

  test("should resolve a stable hash", async () => {
    const result = await hashup("./examples/src/index.ts");

    expect(result.hash).toMatchInlineSnapshot(
      `"ed1c4758b6b759306f2b44feee0bbc2d06291ae490d97367043ab188ce670770"`,
    );
  });
});

describe("monorepo example (tsconfig paths, ?lingui, import.meta.glob)", () => {
  const TEST = "./examples/monorepo/webapps/b/src/ProfileLink.entry.ts";
  const has = (files: string[], suffix: string) => files.some((f) => f.endsWith(suffix));

  test("the test's full closure reaches the hash", async () => {
    const result = await hashup(TEST);

    expect(has(result.files, "webapps/b/src/features/navigation/ProfileLink.ts")).toBe(true);
    // `@/` alias into the hook the component calls…
    expect(has(result.files, "webapps/b/src/features/navigation/use-profile-url.ts")).toBe(true);
    // …and the cross-package alias under it (inherited from the base tsconfig)
    expect(has(result.files, "packages/a/src/index.ts")).toBe(true);
    // `./locales/en.json?lingui` → real file, once
    expect(result.files.filter((f) => f.endsWith("locales/en.json"))).toHaveLength(1);
    // `import.meta.glob("./locales/*.json")` → fr.json too
    expect(has(result.files, "locales/fr.json")).toBe(true);
    expect(result.unresolved).toEqual([]);
  });

  test("the config-mode run fails on nothing", async () => {
    const { runConfigMode } = await import("../src/cli/run-config-mode.js");
    const result = await runConfigMode({
      cwd: "./examples/monorepo",
      configPath: "monorepo.hashup.json",
      baseDirOverride: undefined,
      json: true,
      files: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.failOnUnresolved).toBe(0);
    expect(result.unresolved).toEqual([]);
    expect(JSON.parse(result.output)["webapp-b-tests"].files.length).toBeGreaterThan(5);
  });
});

import { describe, expect, test } from "bun:test";
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
      `"48adf62a70c2645d0fc15ee3060973245af5dc30a542372791a7e1f05eaeacf6"`
    );
  });
});

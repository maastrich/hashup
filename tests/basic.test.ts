import { describe, expect, test } from "vite-plus/test";
import { hashup } from "../src/index.js";

describe("hashup", () => {
  test("should generate a deterministic hash", async () => {
    const result1 = await hashup("./src/index.ts");
    const result2 = await hashup("./src/index.ts");

    expect(result1.hash).toBe(result2.hash);
    expect(result1.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  test("should include the entry file in the files list", async () => {
    const result = await hashup("./src/index.ts");

    expect(result.files.length).toBeGreaterThan(0);
    expect(result.files.some((f) => f.includes("index.ts"))).toBe(true);
  });

  test("should include extra files in the hash", async () => {
    const result1 = await hashup("./src/index.ts");
    const result2 = await hashup("./src/index.ts", {
      extras: ["./package.json"],
    });

    expect(result1.hash).not.toBe(result2.hash);
    expect(result2.files.some((f) => f.includes("package.json"))).toBe(true);
  });

  test("should handle relative paths", async () => {
    const result = await hashup("src/index.ts");

    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.files.length).toBeGreaterThan(0);
  });

  test("should change hash when dependencies change", async () => {
    const result1 = await hashup("./src/index.ts");
    const result2 = await hashup("./src/lib/hash-file.ts");

    expect(result1.hash).not.toBe(result2.hash);
  });
});

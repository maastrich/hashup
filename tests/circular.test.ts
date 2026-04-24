import { describe, expect, test } from "vite-plus/test";
import { hashup } from "../src/index.js";

describe("hashup with circular imports", () => {
  test("should not stack-overflow on a direct A → B → A cycle", async () => {
    const result = await hashup("./tests/fixtures/circular/entry.ts");

    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.files.some((f) => f.endsWith("a.ts"))).toBe(true);
    expect(result.files.some((f) => f.endsWith("b.ts"))).toBe(true);
  });

  test("should produce a deterministic hash across runs", async () => {
    const r1 = await hashup("./tests/fixtures/circular/entry.ts");
    const r2 = await hashup("./tests/fixtures/circular/entry.ts");

    expect(r1.hash).toBe(r2.hash);
    expect(r1.files).toEqual(r2.files);
  });

  test("produces the same hash from either cycle member", async () => {
    const fromA = await hashup("./tests/fixtures/circular/a.ts");
    const fromB = await hashup("./tests/fixtures/circular/b.ts");

    expect(fromA.hash).toBe(fromB.hash);
  });
});

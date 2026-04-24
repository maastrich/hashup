import { createHash } from "node:crypto";
import { describe, expect, test } from "vite-plus/test";
import { combineHashes } from "../src/lib/combine-hashes.js";

describe("combineHashes", () => {
  test("matches the reference sha256(join)", () => {
    const hashes = ["a", "b", "c", "deadbeef"];
    const expected = createHash("sha256").update(hashes.join("")).digest("hex");

    expect(combineHashes(hashes)).toBe(expected);
  });

  test("does not throw `Invalid string length` on very large inputs", () => {
    // A single 64-char hash × 10M = 640M chars, past V8's max string length.
    // Guards against anyone reintroducing `hashes.join('')`.
    const oneHash = "a".repeat(64);
    const hashes = new Array<string>(10_000_000).fill(oneHash);

    expect(() => combineHashes(hashes)).not.toThrow();
  });

  test("reference `hashes.join('')` would throw on the same input", () => {
    const oneHash = "a".repeat(64);
    const hashes = new Array<string>(10_000_000).fill(oneHash);

    expect(() => hashes.join("")).toThrow(/Invalid string length/);
  });
});

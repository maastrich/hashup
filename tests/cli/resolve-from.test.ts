import { describe, expect, test } from "vite-plus/test";
import { resolveFrom } from "../../src/cli/resolve-from.js";

describe("resolveFrom", () => {
  test("keeps absolute values as-is", () => {
    expect(resolveFrom("/anchor", "/exact")).toBe("/exact");
  });

  test("resolves relative values against the anchor", () => {
    expect(resolveFrom("/anchor", "./sub")).toBe("/anchor/sub");
  });

  test("handles .. traversal relative to the anchor", () => {
    expect(resolveFrom("/root/nested", "..")).toBe("/root");
  });

  test("normalizes bare segments", () => {
    expect(resolveFrom("/root", "sub")).toBe("/root/sub");
  });
});

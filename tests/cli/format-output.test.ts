import { describe, expect, test } from "vite-plus/test";
import { formatNamedResults, formatSingleResult } from "../../src/cli/format-output.js";

const sample = { hash: "abc123", files: ["/a.ts", "/b.ts"], unresolved: [] };

describe("formatSingleResult", () => {
  test("plain text prints just the hash with a newline", () => {
    expect(formatSingleResult(sample, { json: false, files: false })).toBe("abc123\n");
  });

  test("json mode emits { hash, unresolved }", () => {
    const out = formatSingleResult(sample, { json: true, files: false });
    expect(JSON.parse(out)).toEqual({ hash: "abc123", unresolved: [] });
  });

  test("json + files mode includes file list", () => {
    const out = formatSingleResult(sample, { json: true, files: true });
    expect(JSON.parse(out)).toEqual({
      hash: "abc123",
      files: ["/a.ts", "/b.ts"],
      unresolved: [],
    });
  });

  test("json mode carries the unresolved list through", () => {
    const unresolved = [{ from: "/a.ts", specifier: "@/missing", reason: "unresolved" as const }];
    const out = formatSingleResult({ ...sample, unresolved }, { json: true, files: false });
    expect(JSON.parse(out).unresolved).toEqual(unresolved);
  });

  test("plain text ignores --files", () => {
    expect(formatSingleResult(sample, { json: false, files: true })).toBe("abc123\n");
  });
});

describe("formatNamedResults", () => {
  const results = {
    short: { hash: "h1", files: ["a"], unresolved: [] },
    muchlonger: { hash: "h2", files: ["b"], unresolved: [] },
  };

  test("pads names to the widest key", () => {
    const out = formatNamedResults(results, { json: false, files: false });
    expect(out).toBe("short       h1\nmuchlonger  h2\n");
  });

  test("json mode emits a keyed object of { hash }", () => {
    const out = formatNamedResults(results, { json: true, files: false });
    expect(JSON.parse(out)).toEqual({
      short: { hash: "h1", unresolved: [] },
      muchlonger: { hash: "h2", unresolved: [] },
    });
  });

  test("json + files attaches each entry's file list", () => {
    const out = formatNamedResults(results, { json: true, files: true });
    expect(JSON.parse(out)).toEqual({
      short: { hash: "h1", files: ["a"], unresolved: [] },
      muchlonger: { hash: "h2", files: ["b"], unresolved: [] },
    });
  });

  test("empty input produces empty output", () => {
    expect(formatNamedResults({}, { json: false, files: false })).toBe("");
  });
});

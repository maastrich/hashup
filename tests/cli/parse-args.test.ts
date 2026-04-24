import { describe, expect, test } from "vite-plus/test";
import { parseCliArgs } from "../../src/cli/parse-args.js";

describe("parseCliArgs", () => {
  test("returns defaults for empty input", () => {
    const args = parseCliArgs([]);
    expect(args).toMatchObject({
      config: undefined,
      extras: [],
      baseDir: undefined,
      json: false,
      files: false,
      help: false,
      printSchema: false,
      out: undefined,
      positionals: [],
    });
  });

  test("parses long flags", () => {
    const args = parseCliArgs([
      "--config",
      "custom.json",
      "--base-dir",
      "./pkg",
      "--json",
      "--files",
    ]);
    expect(args).toMatchObject({
      config: "custom.json",
      baseDir: "./pkg",
      json: true,
      files: true,
    });
  });

  test("parses short flags", () => {
    const args = parseCliArgs(["-c", "a.json", "-b", "root", "-h"]);
    expect(args).toMatchObject({ config: "a.json", baseDir: "root", help: true });
  });

  test("collects repeated --extra", () => {
    const args = parseCliArgs(["-e", "a", "--extra", "b", "-e", "c"]);
    expect(args.extras).toEqual(["a", "b", "c"]);
  });

  test("captures positionals", () => {
    const args = parseCliArgs(["src/index.ts", "--json"]);
    expect(args.positionals).toEqual(["src/index.ts"]);
    expect(args.json).toBe(true);
  });

  test("parses --print-schema", () => {
    expect(parseCliArgs(["--print-schema"]).printSchema).toBe(true);
  });

  test("parses --out long and short", () => {
    expect(parseCliArgs(["--out", "hashes.txt"]).out).toBe("hashes.txt");
    expect(parseCliArgs(["-o", "out/hashes.json"]).out).toBe("out/hashes.json");
  });

  test("rejects unknown flags", () => {
    expect(() => parseCliArgs(["--nope"])).toThrow();
  });
});

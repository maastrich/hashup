import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { parseCliArgs } from "../src/cli/parse-args.js";
import { reportUnresolved } from "../src/cli/report-unresolved.js";
import { runConfigMode } from "../src/cli/run-config-mode.js";
import { hashup, type UnresolvedImport } from "../src/index.js";

const FIXTURE = resolve("tests/fixtures/unresolved-report");
const ENTRY = `${FIXTURE}/entry.ts`;

describe("hashup().unresolved", () => {
  test("lists unresolved specifiers and unreadable targets with the importing file", async () => {
    const result = await hashup(ENTRY);
    expect(result.unresolved).toEqual([
      { from: ENTRY, specifier: "./broken", reason: "unreadable" },
      { from: ENTRY, specifier: "./missing", reason: "unresolved" },
      { from: ENTRY, specifier: "@nope/pkg", reason: "unresolved" },
    ]);
  });

  test("node_modules hits, builtins and virtual modules are not counted", async () => {
    const result = await hashup(ENTRY);
    const specifiers = result.unresolved.map((u) => u.specifier);
    expect(specifiers).not.toContain("fake-lib");
    expect(specifiers).not.toContain("node:fs/promises");
    expect(specifiers).not.toContain("path");
    expect(specifiers).not.toContain("virtual:thing");
    expect(result.files.some((f) => f.endsWith("ok.ts"))).toBe(true);
  });

  test("clean graphs report an empty list", async () => {
    const result = await hashup("./examples/src/index.ts");
    expect(result.unresolved).toEqual([]);
  });
});

describe("reportUnresolved", () => {
  const unresolved: UnresolvedImport[] = [
    { from: "/app/a.ts", specifier: "@/x", reason: "unresolved" },
    { from: "/app/b.ts", specifier: "./y", reason: "unreadable" },
  ];

  test("default level: one-line summary with a hint", () => {
    const out = reportUnresolved({ unresolved, logLevel: undefined, failOnUnresolved: undefined });
    expect(out.stderr).toBe("hashup: 2 unresolved imports (run with --log-level info to list)\n");
    expect(out.exitCode).toBe(0);
  });

  test("nothing to report: empty stderr", () => {
    const out = reportUnresolved({ unresolved: [], logLevel: undefined, failOnUnresolved: 0 });
    expect(out).toEqual({ stderr: "", exitCode: 0 });
  });

  test("silent suppresses the summary but not the exit code", () => {
    const out = reportUnresolved({ unresolved, logLevel: "silent", failOnUnresolved: 0 });
    expect(out).toEqual({ stderr: "", exitCode: 1 });
  });

  test("info lists every edge before the summary", () => {
    const out = reportUnresolved({ unresolved, logLevel: "info", failOnUnresolved: undefined });
    expect(out.stderr).toBe(
      [
        'hashup: unresolved: /app/a.ts -> "@/x"',
        'hashup: unreadable: /app/b.ts -> "./y"',
        "hashup: 2 unresolved imports",
        "",
      ].join("\n"),
    );
  });

  test("--fail-on-unresolved threshold drives the exit code", () => {
    expect(
      reportUnresolved({ unresolved, logLevel: undefined, failOnUnresolved: 0 }).exitCode,
    ).toBe(1);
    expect(
      reportUnresolved({ unresolved, logLevel: undefined, failOnUnresolved: 1 }).exitCode,
    ).toBe(1);
    expect(
      reportUnresolved({ unresolved, logLevel: undefined, failOnUnresolved: 2 }).exitCode,
    ).toBe(0);
    const failing = reportUnresolved({ unresolved, logLevel: undefined, failOnUnresolved: 0 });
    expect(failing.stderr).toContain("failing because 2 > --fail-on-unresolved=0");
  });
});

describe("CLI plumbing", () => {
  test("--fail-on-unresolved parses with and without a value", () => {
    expect(parseCliArgs([]).failOnUnresolved).toBeUndefined();
    expect(parseCliArgs(["--fail-on-unresolved"]).failOnUnresolved).toBe(0);
    expect(parseCliArgs(["--fail-on-unresolved=5", "--json"]).failOnUnresolved).toBe(5);
    expect(() => parseCliArgs(["--fail-on-unresolved=abc"])).toThrow(/non-negative integer/);
    // after `--` it is a positional, not a flag
    const after = parseCliArgs(["--", "--fail-on-unresolved"]);
    expect(after.failOnUnresolved).toBeUndefined();
    expect(after.positionals).toEqual(["--fail-on-unresolved"]);
  });

  test("--no-tsconfig is surfaced as tsconfig: false", () => {
    expect(parseCliArgs([]).tsconfig).toBeUndefined();
    expect(parseCliArgs(["--no-tsconfig"]).tsconfig).toBe(false);
  });

  test("runConfigMode merges failOnUnresolved from config and flag, dedupes across entries", async () => {
    const workDir = await mkdtemp(join(tmpdir(), "hashup-unresolved-"));
    try {
      await writeFile(
        join(workDir, "hashup.json"),
        JSON.stringify({
          baseDir: FIXTURE,
          failOnUnresolved: true,
          entries: { one: { entry: "entry.ts" }, two: { entry: "entry.ts" } },
        }),
      );
      const fromConfig = await runConfigMode({
        cwd: workDir,
        configPath: undefined,
        baseDirOverride: undefined,
        json: true,
        files: false,
      });
      expect(fromConfig.ok).toBe(true);
      if (!fromConfig.ok) return;
      expect(fromConfig.failOnUnresolved).toBe(0);
      expect(fromConfig.unresolved).toHaveLength(3);
      expect(JSON.parse(fromConfig.output).two.unresolved).toHaveLength(3);

      const fromFlag = await runConfigMode({
        cwd: workDir,
        configPath: undefined,
        baseDirOverride: undefined,
        json: false,
        files: false,
        failOnUnresolved: 10,
      });
      expect(fromFlag.ok && fromFlag.failOnUnresolved).toBe(10);
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  });
});

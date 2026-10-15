import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { parseCliArgs } from "../src/cli/parse-args.js";
import { runConfigMode } from "../src/cli/run-config-mode.js";
import {
  createResolver,
  hashup,
  isNullExport,
  matchExportTarget,
  resolveSpecifier,
} from "../src/index.js";

const FIXTURE = resolve("tests/fixtures/null-exports");
const ENTRY = `${FIXTURE}/entry.ts`;
const NODE_ONLY = `${FIXTURE}/node-only-entry.ts`;
const BROWSER = ["browser", "import", "default"];

describe("exports targets that are null for the active conditions", () => {
  afterEach(() => vi.restoreAllMocks());

  test("are not reported as unresolved under the default (node) conditions", async () => {
    const result = await hashup(ENTRY);
    // cond-pkg/browser, cond-pkg/features/x, cond-pkg/nested and
    // @scope/pkg/sub all map to `null` under `node`; only the subpath
    // the package never exports remains a gap.
    expect(result.unresolved).toEqual([
      { from: ENTRY, specifier: "cond-pkg/missing", reason: "unresolved" },
    ]);
  });

  test("resolve normally once the conditions select another target", async () => {
    const node = createResolver();
    const browser = createResolver({ conditions: BROWSER });
    expect(await resolveSpecifier(node, ENTRY, "cond-pkg/browser")).toBe(false);
    expect(await resolveSpecifier(browser, ENTRY, "cond-pkg/browser")).toBe(
      `${FIXTURE}/node_modules/cond-pkg/browser.js`,
    );

    const result = await hashup(ENTRY, { conditions: BROWSER });
    expect(result.unresolved.map((u) => u.specifier)).toEqual(["cond-pkg/missing"]);
  });

  test("contribute nothing to the hash either way", async () => {
    const node = await hashup(ENTRY);
    const browser = await hashup(ENTRY, { conditions: BROWSER });
    expect(browser.hash).toBe(node.hash);
    expect(node.files.map((f) => f.slice(FIXTURE.length))).toEqual(["/entry.ts", "/local.ts"]);
  });

  test("a subpath with no matching condition at all is still unresolved", async () => {
    expect((await hashup(NODE_ONLY)).unresolved).toEqual([]);
    const browser = await hashup(NODE_ONLY, { conditions: BROWSER });
    expect(browser.unresolved).toEqual([
      { from: NODE_ONLY, specifier: "cond-pkg/node-only", reason: "unresolved" },
    ]);
  });

  test("are logged as <unavailable> at debug level", async () => {
    const messages: string[] = [];
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      messages.push(typeof chunk === "string" ? chunk : chunk.toString());
      return true;
    });

    await hashup(ENTRY, { logLevel: "debug" });

    const out = messages.join("");
    expect(out).toMatch(/\[import\]: .+entry\.ts -> "cond-pkg\/browser" -> <unavailable>\n/);
    expect(out).toMatch(/\[import\]: .+entry\.ts -> "cond-pkg\/missing" -> <unresolved>\n/);
  });
});

describe("isNullExport", () => {
  const node = createResolver();
  const browser = createResolver({ conditions: BROWSER });

  test("true for a bare specifier the package maps to null under the resolver's conditions", async () => {
    expect(await isNullExport(node, ENTRY, "cond-pkg/browser")).toBe(true);
    // query / fragment are stripped first
    expect(await isNullExport(node, ENTRY, "cond-pkg/browser?raw")).toBe(true);
    // pattern key, nested conditions, scoped package name
    expect(await isNullExport(node, ENTRY, "cond-pkg/features/x")).toBe(true);
    expect(await isNullExport(node, ENTRY, "cond-pkg/nested")).toBe(true);
    expect(await isNullExport(node, ENTRY, "@scope/pkg/sub")).toBe(true);
    // same subpath, conditions that select a real file
    expect(await isNullExport(browser, ENTRY, "cond-pkg/browser")).toBe(false);
  });

  test("false for missing subpaths, unmatched conditions, unknown packages and non-bare specifiers", async () => {
    expect(await isNullExport(node, ENTRY, "cond-pkg/missing")).toBe(false);
    expect(await isNullExport(node, ENTRY, "cond-pkg")).toBe(false);
    expect(await isNullExport(browser, ENTRY, "cond-pkg/node-only")).toBe(false);
    expect(await isNullExport(node, ENTRY, "not-installed/browser")).toBe(false);
    expect(await isNullExport(node, ENTRY, "./local")).toBe(false);
    expect(await isNullExport(node, ENTRY, "/abs/path")).toBe(false);
    expect(await isNullExport(node, ENTRY, "#internal")).toBe(false);
    expect(await isNullExport(node, ENTRY, "@scope")).toBe(false);
  });
});

describe("matchExportTarget", () => {
  const node = new Set(["import", "node"]);
  const browser = new Set(["browser", "import"]);

  test("sugar forms describe the main entry only", () => {
    expect(matchExportTarget("./index.js", ".", node)).toBe("file");
    expect(matchExportTarget("./index.js", "./sub", node)).toBe("none");
    expect(matchExportTarget(["./a.js", "./b.js"], ".", node)).toBe("file");
    expect(matchExportTarget({ node: null, default: "./index.js" }, ".", node)).toBe("null");
    expect(matchExportTarget({ node: null, default: "./index.js" }, ".", browser)).toBe("file");
    expect(matchExportTarget(undefined, ".", node)).toBe("none");
  });

  test("exact keys win over patterns; the longest pattern prefix wins", () => {
    const exports = {
      "./*": "./src/*.js",
      "./lib/*": { node: null, default: "./lib/*.js" },
      "./lib/deep/*.js": "./deep/*.js",
      "./legacy/": null,
      "./exact": null,
    };
    expect(matchExportTarget(exports, "./exact", node)).toBe("null");
    expect(matchExportTarget(exports, "./other", node)).toBe("file");
    expect(matchExportTarget(exports, "./lib/x", node)).toBe("null");
    expect(matchExportTarget(exports, "./lib/x", browser)).toBe("file");
    expect(matchExportTarget(exports, "./lib/deep/x.js", node)).toBe("file");
    expect(matchExportTarget(exports, "./legacy/x", node)).toBe("null");
    expect(matchExportTarget({ "./a": "./a.js" }, "./b", node)).toBe("none");
  });

  test("conditions are tried in source order, nested objects fall through, arrays are fallbacks", () => {
    const nested = { ".": { import: { node: null, default: "./a.js" }, default: "./b.js" } };
    expect(matchExportTarget(nested, ".", node)).toBe("null");
    expect(matchExportTarget(nested, ".", browser)).toBe("file");
    // a nested object with no match is skipped, not fatal
    expect(
      matchExportTarget({ ".": { import: { worker: "./w.js" }, default: "./b.js" } }, ".", node),
    ).toBe("file");
    expect(matchExportTarget({ ".": { require: "./c.cjs" } }, ".", node)).toBe("none");
    expect(matchExportTarget({ ".": [{ node: "./n.js" }, "./fallback.js"] }, ".", browser)).toBe(
      "file",
    );
    expect(matchExportTarget({ ".": [{ node: null }, "./fallback.js"] }, ".", node)).toBe("null");
  });
});

describe("CLI plumbing", () => {
  test("--condition is repeatable and absent by default", () => {
    expect(parseCliArgs([]).conditions).toBeUndefined();
    expect(
      parseCliArgs(["--condition", "browser", "--condition", "import", "--json"]).conditions,
    ).toEqual(["browser", "import"]);
  });

  test("runConfigMode: per-entry conditions > --condition > top-level conditions", async () => {
    const workDir = await mkdtemp(join(tmpdir(), "hashup-conditions-"));
    try {
      await writeFile(
        join(workDir, "hashup.json"),
        JSON.stringify({
          baseDir: FIXTURE,
          conditions: BROWSER,
          entries: {
            fromRoot: { entry: "node-only-entry.ts" },
            perEntry: { entry: "node-only-entry.ts", conditions: ["node"] },
          },
        }),
      );
      const base = {
        cwd: workDir,
        configPath: undefined,
        baseDirOverride: undefined,
        files: false,
      };
      const unresolvedCounts = async (conditions?: string[]) => {
        const result = await runConfigMode({ ...base, json: true, conditions });
        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error(result.error);
        const parsed = JSON.parse(result.output);
        return {
          fromRoot: parsed.fromRoot.unresolved.length,
          perEntry: parsed.perEntry.unresolved.length,
        };
      };

      // top-level browser conditions: cond-pkg/node-only has no match
      expect(await unresolvedCounts()).toEqual({ fromRoot: 1, perEntry: 0 });
      // --condition node overrides the top-level list
      expect(await unresolvedCounts(["node"])).toEqual({ fromRoot: 0, perEntry: 0 });
      // the per-entry list still wins over the flag
      expect(await unresolvedCounts(BROWSER)).toEqual({ fromRoot: 1, perEntry: 0 });
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  });
});

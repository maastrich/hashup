import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { extractUrlImports, hashup, lexModule } from "../src/index.js";

const REPRO = resolve("tests/fixtures/new-url/repro/src/index.ts");
const FORMS = resolve("tests/fixtures/new-url/forms/entry.ts");

async function urls(src: string, filename = "entry.ts") {
  const lexed = await lexModule(filename, src);
  if (lexed === null) throw new Error("not lexable");
  return extractUrlImports(lexed.code, lexed.imports);
}

function names(files: readonly string[], root: string): string[] {
  return files.map((f) => f.slice(root.length + 1)).sort();
}

describe("extractUrlImports", () => {
  test("accepts double, single and backtick literals", async () => {
    const { specifiers } = await urls(`
      const a = new URL("./a.ts", import.meta.url);
      const b = new URL('./b.ts', import.meta.url);
      const c = new URL(\`./c.ts\`, import.meta.url);
    `);
    expect(specifiers).toEqual(["./a.ts", "./b.ts", "./c.ts"]);
  });

  test("finds the URL inside new Worker / new SharedWorker, query kept", async () => {
    const { specifiers } = await urls(`
      new Worker(new URL("./w.ts?worker", import.meta.url), { type: "module" });
      new SharedWorker(new URL("../s.ts", import.meta.url));
    `);
    expect(specifiers).toEqual(["./w.ts?worker", "../s.ts"]);
  });

  test("bare literals are relative under URL semantics", async () => {
    const { specifiers } = await urls(`new URL("w.ts", import.meta.url);`);
    expect(specifiers).toEqual(["./w.ts"]);
  });

  test("reports non-literal and root-relative first arguments", async () => {
    const { specifiers, nonLiteral, unsupported } = await urls(`
      const name = "x";
      new URL(\`./w/\${name}.ts\`, import.meta.url);
      new URL(name, import.meta.url);
      new URL(pick({ a: [1, 2] }, "b,c"), import.meta.url);
      new URL("/logo.svg", import.meta.url);
    `);
    expect(specifiers).toEqual([]);
    expect(nonLiteral).toHaveLength(3);
    expect(nonLiteral[0]).toMatch(/^new URL\(`\.\/w\/\$\{name\}\.ts`, import\.meta\.url\)/);
    expect(unsupported).toEqual(["/logo.svg"]);
  });

  test("ignores remote URLs, directories and other bases", async () => {
    const out = await urls(`
      new URL("https://example.com/x.js", import.meta.url);
      new URL("//cdn.example.com/x.js", import.meta.url);
      new URL("data:text/javascript,export{}", import.meta.url);
      new URL(".", import.meta.url);
      new URL("../", import.meta.url);
      new URL("", import.meta.url);
      new URL("./no-base.ts");
      new URL("./other-base.ts", "https://example.com/");
      new URL("./not-url.ts", import.meta.env);
      new URL(req.url, import.meta.url.replace("x", "y"));
    `);
    expect(out).toEqual({ specifiers: [], nonLiteral: [], unsupported: [] });
  });

  test("never matches inside comments or strings", async () => {
    const src = `
      // new URL("./line.ts", import.meta.url)
      /* new URL("./block.ts", import.meta.url) */
      const s = "new URL('./string.ts', import.meta.url)";
      const t = \`new URL("./template.ts", import.meta.url)\`;
      export const real = new URL("./real.ts", import.meta.url);
    `;
    // .js skips esbuild: comments reach the lexer as written.
    for (const file of ["entry.js", "entry.ts"]) {
      const out = await urls(src, file);
      expect(out).toEqual({ specifiers: ["./real.ts"], nonLiteral: [], unsupported: [] });
    }
  });
});

describe("new URL(…, import.meta.url) edges", () => {
  test("issue #30 repro: the worker and its imports are hashed once", async () => {
    const root = resolve("tests/fixtures/new-url/repro/src");
    const result = await hashup(REPRO);
    expect(names(result.files, root)).toEqual(["greet.ts", "index.ts", "w.worker.ts"]);
    expect(result.unresolved).toEqual([]);
  });

  test("editing the worker changes the entry hash", async () => {
    const dir = await mkdtemp(join(tmpdir(), "hashup-new-url-"));
    try {
      await cp(resolve("tests/fixtures/new-url/repro"), dir, { recursive: true });
      const entry = join(dir, "src/index.ts");
      const before = await hashup(entry);
      await writeFile(join(dir, "src/w.worker.ts"), "self.postMessage(1);\n");
      const after = await hashup(entry);
      expect(after.hash).not.toBe(before.hash);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("follows every literal form and reports the rest", async () => {
    const root = resolve("tests/fixtures/new-url/forms");
    const result = await hashup(FORMS);
    expect(names(result.files, root)).toEqual([
      "assets/icon.svg",
      "bare.ts",
      "double.ts",
      "entry.ts",
      "from-js.ts",
      "legacy.js",
      "no-ext.ts",
      "queried.worker.ts",
      "shared.worker.ts",
      "single.ts",
      "spaced.ts",
      "template.ts",
    ]);
    const reported = result.unresolved.map(({ specifier, reason }) => ({ specifier, reason }));
    expect(reported).toHaveLength(4);
    expect(reported).toEqual(
      expect.arrayContaining([
        { specifier: "./missing.ts", reason: "unresolved" },
        { specifier: expect.stringMatching(/^new URL\(`\.\/dyn\//), reason: "non-literal-url" },
        { specifier: "new URL(name, import.meta.url);", reason: "non-literal-url" },
        { specifier: "/rooted.svg", reason: "unsupported-url" },
      ]),
    );
    expect(result.unresolved.every((u) => u.from === FORMS)).toBe(true);
  });
});

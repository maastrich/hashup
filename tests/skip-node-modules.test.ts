import { readFile, writeFile } from "node:fs/promises";
import { describe, expect, test } from "vite-plus/test";
import { hashup } from "../src/index.js";
import { isInNodeModules } from "../src/lib/is-in-node-modules.js";

const FIXTURE = "./tests/fixtures/skip-node-modules";

describe("isInNodeModules", () => {
  test("matches /node_modules/ segments", () => {
    expect(isInNodeModules("/a/b/node_modules/foo/index.js")).toBe(true);
    expect(isInNodeModules("/app/node_modules/.pnpm/foo@1/node_modules/foo/x.js")).toBe(true);
  });

  test("does not match lookalike paths", () => {
    expect(isInNodeModules("/a/b/my_node_modules/foo.js")).toBe(false);
    expect(isInNodeModules("/a/b/node_modules_fake/foo.js")).toBe(false);
    expect(isInNodeModules("/a/b/src/index.ts")).toBe(false);
  });
});

describe("hashup skips node_modules", () => {
  test("does not include fake-lib files in the resolved file list", async () => {
    const result = await hashup(`${FIXTURE}/entry.ts`);

    expect(result.files.some((f) => f.endsWith("entry.ts"))).toBe(true);
    expect(result.files.some((f) => f.endsWith("local.ts"))).toBe(true);
    expect(result.files.some((f) => f.includes("node_modules"))).toBe(false);
  });

  test("hash does not change when a node_modules file changes", async () => {
    const pkgFile = `${FIXTURE}/node_modules/fake-lib/index.js`;
    const original = await readFile(pkgFile, "utf-8");

    const before = await hashup(`${FIXTURE}/entry.ts`);
    try {
      await writeFile(pkgFile, `${original}\n// tampered\n`);
      const after = await hashup(`${FIXTURE}/entry.ts`);
      expect(after.hash).toBe(before.hash);
    } finally {
      await writeFile(pkgFile, original);
    }
  });

  test("hash still changes when user source changes", async () => {
    const localFile = `${FIXTURE}/local.ts`;
    const original = await readFile(localFile, "utf-8");

    const before = await hashup(`${FIXTURE}/entry.ts`);
    try {
      await writeFile(localFile, `${original}\n// tampered\n`);
      const after = await hashup(`${FIXTURE}/entry.ts`);
      expect(after.hash).not.toBe(before.hash);
    } finally {
      await writeFile(localFile, original);
    }
  });

  test("adding a lockfile as an extra folds install-tree changes back in", async () => {
    const lockPath = `${FIXTURE}/pnpm-lock.yaml`;
    await writeFile(lockPath, "lockfileVersion: '9.0'\n# v1\n");
    try {
      const r1 = await hashup(`${FIXTURE}/entry.ts`, { extras: [lockPath] });
      await writeFile(lockPath, "lockfileVersion: '9.0'\n# v2\n");
      const r2 = await hashup(`${FIXTURE}/entry.ts`, { extras: [lockPath] });
      expect(r2.hash).not.toBe(r1.hash);
    } finally {
      await writeFile(lockPath, "").catch(() => {});
      await import("node:fs/promises").then((fs) => fs.unlink(lockPath).catch(() => {}));
    }
  });
});

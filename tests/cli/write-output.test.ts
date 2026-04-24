import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { writeOutput } from "../../src/cli/write-output.js";

let workDir: string;

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), "hashup-write-output-"));
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe("writeOutput", () => {
  test("writes to stdout when out is undefined", async () => {
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    await writeOutput(workDir, undefined, "hello\n");
    expect(spy).toHaveBeenCalledWith("hello\n");
    spy.mockRestore();
  });

  test("writes to the given file", async () => {
    await writeOutput(workDir, "out.txt", "hello\n");
    expect(await readFile(join(workDir, "out.txt"), "utf8")).toBe("hello\n");
  });

  test("creates parent directories as needed", async () => {
    await writeOutput(workDir, "nested/dir/hashes.json", "{}\n");
    expect(await readFile(join(workDir, "nested/dir/hashes.json"), "utf8")).toBe("{}\n");
  });
});

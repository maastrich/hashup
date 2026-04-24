import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { hashup } from "../src/index.js";

describe("debug log prefixes", () => {
  afterEach(() => vi.restoreAllMocks());

  test("emits [hash]:, [import]:, [skip]: lines at debug level", async () => {
    const messages: string[] = [];
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      messages.push(typeof chunk === "string" ? chunk : chunk.toString());
      return true;
    });

    await hashup("./tests/fixtures/skip-node-modules/entry.ts", { logLevel: "debug" });

    const out = messages.join("");

    // [hash]: — one per successfully hashed user file
    expect(out).toMatch(/\[hash\]: .+entry\.ts\n/);
    expect(out).toMatch(/\[hash\]: .+local\.ts\n/);

    // [import]: — each import resolution, with the source and specifier
    expect(out).toMatch(/\[import\]: .+entry\.ts -> "fake-lib" -> /);
    expect(out).toMatch(/\[import\]: .+entry\.ts -> "\.\/local\.js" -> /);

    // [skip]: — one per node_modules short-circuit
    expect(out).toMatch(/\[skip\]: .+node_modules\/fake-lib\//);
  });

  test("prefixes are grep-friendly at column zero of each line", async () => {
    const messages: string[] = [];
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      messages.push(typeof chunk === "string" ? chunk : chunk.toString());
      return true;
    });

    await hashup("./tests/fixtures/skip-node-modules/entry.ts", { logLevel: "debug" });

    const lines = messages.join("").split("\n").filter(Boolean);
    // Every debug line from the hasher should start with one of our prefixes.
    for (const line of lines) {
      expect(line).toMatch(/^\[(hash|import|skip)\]: /);
    }
  });

  test("warn level suppresses all three prefixes", async () => {
    const messages: string[] = [];
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      messages.push(typeof chunk === "string" ? chunk : chunk.toString());
      return true;
    });

    await hashup("./tests/fixtures/skip-node-modules/entry.ts", { logLevel: "warn" });

    const out = messages.join("");
    expect(out).not.toMatch(/\[hash\]:/);
    expect(out).not.toMatch(/\[import\]:/);
    expect(out).not.toMatch(/\[skip\]:/);
  });
});

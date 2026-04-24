import { describe, expect, test, vi } from "vite-plus/test";
import { createLogger, isLogLevel } from "../src/lib/logger.js";

function captureStderr(): { messages: string[]; restore: () => void } {
  const messages: string[] = [];
  const original = process.stderr.write.bind(process.stderr);
  const spy = vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
    messages.push(typeof chunk === "string" ? chunk : chunk.toString());
    return true;
  });
  return {
    messages,
    restore: () => {
      spy.mockRestore();
      process.stderr.write = original;
    },
  };
}

describe("createLogger", () => {
  test("silent (default) swallows everything", () => {
    const cap = captureStderr();
    try {
      const log = createLogger();
      log.warn("w");
      log.info("i");
      log.debug("d");
      expect(cap.messages).toEqual([]);
    } finally {
      cap.restore();
    }
  });

  test("warn level only writes warn", () => {
    const cap = captureStderr();
    try {
      const log = createLogger("warn");
      log.warn("w");
      log.info("i");
      log.debug("d");
      expect(cap.messages.join("")).toBe("w\n");
    } finally {
      cap.restore();
    }
  });

  test("info level writes warn + info", () => {
    const cap = captureStderr();
    try {
      const log = createLogger("info");
      log.warn("w");
      log.info("i");
      log.debug("d");
      expect(cap.messages.join("")).toBe("w\ni\n");
    } finally {
      cap.restore();
    }
  });

  test("debug level writes everything", () => {
    const cap = captureStderr();
    try {
      const log = createLogger("debug");
      log.warn("w");
      log.info("i");
      log.debug("d");
      expect(cap.messages.join("")).toBe("w\ni\nd\n");
    } finally {
      cap.restore();
    }
  });

  test("warn appends an Error's stack when provided", () => {
    const cap = captureStderr();
    try {
      const log = createLogger("warn");
      const err = new Error("boom");
      log.warn("failed:", err);
      const out = cap.messages.join("");
      expect(out).toMatch(/^failed:/);
      expect(out).toMatch(/boom/);
    } finally {
      cap.restore();
    }
  });
});

describe("isLogLevel", () => {
  test("accepts all four levels", () => {
    expect(isLogLevel("silent")).toBe(true);
    expect(isLogLevel("warn")).toBe(true);
    expect(isLogLevel("info")).toBe(true);
    expect(isLogLevel("debug")).toBe(true);
  });

  test("rejects anything else", () => {
    expect(isLogLevel("trace")).toBe(false);
    expect(isLogLevel("")).toBe(false);
    expect(isLogLevel("WARN")).toBe(false);
  });
});

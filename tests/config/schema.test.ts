import { describe, expect, test } from "vite-plus/test";
import { configJsonSchema, configSchema, entrySchema } from "../../src/config.js";

describe("entrySchema", () => {
  test("accepts a minimal entry", () => {
    expect(entrySchema.safeParse({ entry: "src/index.ts" }).success).toBe(true);
  });

  test("rejects missing entry", () => {
    expect(entrySchema.safeParse({}).success).toBe(false);
  });

  test("rejects empty entry", () => {
    expect(entrySchema.safeParse({ entry: "" }).success).toBe(false);
  });

  test("rejects unknown fields (strict)", () => {
    expect(entrySchema.safeParse({ entry: "a.ts", rogue: 1 }).success).toBe(false);
  });
});

describe("configSchema", () => {
  test("accepts a minimal valid config", () => {
    const result = configSchema.safeParse({ entries: { a: { entry: "a.ts" } } });
    expect(result.success).toBe(true);
  });

  test("rejects empty entries", () => {
    const result = configSchema.safeParse({ entries: {} });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]!.message).toMatch(/at least one named entry/);
    }
  });

  test("accepts optional $schema", () => {
    const result = configSchema.safeParse({
      $schema: "https://example.com/schema.json",
      entries: { a: { entry: "a.ts" } },
    });
    expect(result.success).toBe(true);
  });

  test("rejects unknown top-level keys", () => {
    expect(configSchema.safeParse({ entries: { a: { entry: "a.ts" } }, extra: 1 }).success).toBe(
      false,
    );
  });
});

describe("configJsonSchema", () => {
  test("advertises draft-07 and a stable $id", () => {
    expect(configJsonSchema.$schema).toBe("http://json-schema.org/draft-07/schema#");
    expect(configJsonSchema.$id).toBe("https://maastrich.github.io/hashup/schema.json");
    expect(configJsonSchema.title).toBe("Hashup Config");
  });

  test("describes an object with an entries property", () => {
    const schema = configJsonSchema as unknown as {
      type: string;
      properties: Record<string, unknown>;
      required?: string[];
    };
    expect(schema.type).toBe("object");
    expect(schema.properties).toHaveProperty("entries");
    expect(schema.required).toContain("entries");
  });
});

import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {},
  lint: {
    options: { typeAware: true, typeCheck: true },
    ignorePatterns: ["dist", "examples", "node_modules", "*.d.ts"],
    env: { node: true, es2024: true },
    globals: { NodeJS: "readonly" },
    rules: {
      // Test helpers/fixtures intentionally import types only for inference
      "no-unused-vars": "warn",
    },
  },
  pack: {
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: true,
  },
});

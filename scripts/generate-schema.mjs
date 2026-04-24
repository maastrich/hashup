#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { configJsonSchema } from "../dist/config.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const serialized = `${JSON.stringify(configJsonSchema, null, 2)}\n`;
const targets = [resolve(repoRoot, "schema.json"), resolve(repoRoot, "docs/public/schema.json")];

await Promise.all(targets.map((path) => writeFile(path, serialized)));

for (const path of targets) {
  process.stdout.write(`wrote ${path}\n`);
}

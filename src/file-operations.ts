import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export async function readFileContent(filePath: string): Promise<string> {
  return await readFile(filePath, "utf-8");
}

export function createContentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function combineHashes(hashes: string[]): string {
  return createHash("sha256").update(hashes.join("")).digest("hex");
}

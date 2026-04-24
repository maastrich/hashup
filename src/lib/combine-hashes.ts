import { createHash } from "node:crypto";

export function combineHashes(hashes: string[]): string {
  return createHash("sha256").update(hashes.join("")).digest("hex");
}

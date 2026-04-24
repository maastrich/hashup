import { createHash } from "node:crypto";

export function combineHashes(hashes: readonly string[]): string {
  const hasher = createHash("sha256");
  for (let i = 0; i < hashes.length; i++) {
    hasher.update(hashes[i] as string);
  }
  return hasher.digest("hex");
}

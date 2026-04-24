---
"@maastrich/hashup": minor
---

Linear-memory cache + `--cwd` CLI flag.

**Linear-memory cache.** `HashupCache.hashes` now stores each file's own
sha256 content hash (one 64-char string) instead of the flattened
transitive hash list. The transitive contribution is reconstructed at
combine time by walking `cache.deps`. Memory drops from
O(files × avg closure) to O(unique files) — on a real-world run that
previously needed 9 GB of heap, peak RSS is now ~125 MB and wall time
drops from minutes to ~1 s.

**Hash output changes.** The final digest is now
`sha256(concat of each reachable file's content hash, sorted by path)`.
Each unique file contributes exactly once regardless of how many import
paths reach it. Any stored 0.6.x hashes must be re-baselined. As a
welcome side effect: cycles now hash the same regardless of which
member was the entry point.

**`--cwd <dir>` CLI flag.** Run `hashup` as if invoked from the given
directory. Changes where `hashup.json` is discovered, where relative
entry/extras paths resolve, and where `--out` writes. Defaults to
`process.cwd()`.

```bash
hashup --cwd ./packages/app
hashup --cwd ./packages/app src/index.ts -o ../dist/app.hash
```

**Targeted break for direct `hashFile` callers.** Return type is now
`Promise<string | null>` (the file's own hash, or `null` on failure)
instead of `Promise<string[]>`. Callers should use `collectReachable`
to enumerate the transitive set and read each file's hash from
`cache.hashes` at combine time. `hashup()` itself is unchanged.

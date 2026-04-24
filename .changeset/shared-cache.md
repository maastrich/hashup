---
"@maastrich/hashup": minor
---

Share the hash cache across entries — shared utilities are now read and
hashed exactly once per `hashup` invocation instead of once per entry.

- `HashupOptions` gains `cache?: HashupCache` and `resolver?: Resolver`.
  Pass the same values across multiple `hashup()` calls to reuse work.
  The CLI's config mode does this automatically: every named entry in a
  single `hashup` invocation now shares one cache + one resolver.
- New exports: `createHashupCache()`, `collectReachable()`, and the
  `HashupCache` type.
- Hash output is byte-identical to 0.5.0 on every existing input — the
  inline snapshot in `tests/examples.test.ts` still matches. Shared cache
  is a pure dedupe, not a semantic change.

**Targeted break for direct `hashFile` callers:** the cache parameter is
now `HashupCache` (an object with `hashes` and `deps` maps) instead of
`Map<string, string[]>`. `hashup()` itself is untouched — the new
`cache` option is additive. Callers of `hashFile` directly should swap
`new Map<string, string[]>()` for `createHashupCache()`.

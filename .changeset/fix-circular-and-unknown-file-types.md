---
"@maastrich/hashup": patch
---

Fix stack overflow on circular imports and spurious parse errors on non-JS file types.

- `hashFile` now seeds the cache with the file's own content hash before recursing into dependencies, so `A → B → A` cycles terminate deterministically instead of blowing the call stack.
- `extractImports` now skips the JS parser for non-JS extensions (e.g. `.svg`, `.css`). Those files still contribute their content hash, but are no longer dropped with a `Parse error` warning.

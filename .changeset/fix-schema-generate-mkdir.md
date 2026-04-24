---
"@maastrich/hashup": patch
---

Ensure `scripts/generate-schema.mjs` creates the output directory before writing. On a clean checkout (e.g. CI), `docs/public/` does not exist because its only file is gitignored, which broke `prepack` during `npm publish`.

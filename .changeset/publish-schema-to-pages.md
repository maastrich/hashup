---
"@maastrich/hashup": patch
---

Fix the published JSON schema URL. The docs workflow now generates `docs/public/schema.json` before building VitePress, so `https://maastrich.github.io/hashup/schema.json` is served correctly (previously 404).

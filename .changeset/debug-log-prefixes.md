---
"@maastrich/hashup": patch
---

Add structured debug-log prefixes for easy filtering.

At `--log-level debug` the hasher now emits one line per event, each
starting with a bracketed tag at column zero:

- `[hash]: <file>` — a file's content was read and its sha256 computed.
- `[import]: <source> -> "<specifier>" -> <resolved>` — a static import
  was resolved. Unresolved specifiers show `<unresolved>` in the third
  slot.
- `[skip]: <file>` — a resolved path was skipped because it lives in
  `node_modules`.

```bash
hashup -l debug 2>&1 | grep '^\[hash\]:'
hashup -l debug 2>&1 | grep -c '^\[skip\]:'
```

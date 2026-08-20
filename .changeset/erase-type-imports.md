---
"@maastrich/hashup": patch
---

Erase type-only imports in `.ts` / `.mts` / `.cts` files before import extraction. Previously only `.tsx` / `.jsx` went through esbuild, so `import type { X } from "pkg/types"` in a plain `.ts` file was walked like a value import — and, when the specifier had no runtime module (a types-only package export), counted as unresolved. All TypeScript now goes through esbuild with `verbatimModuleSyntax` semantics: `import type` / `export type` / `import { type X }` vanish, every value import (unused or side-effect) is kept.

Hashes of entries whose `.ts` graph contained type-only edges to real files change, since those files no longer contribute.

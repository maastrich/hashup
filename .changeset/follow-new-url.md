---
"@maastrich/hashup": minor
---

Follow `new URL("./x", import.meta.url)` — Vite's form for workers and static assets — like a relative import, on its own or inside `new Worker(...)` / `new SharedWorker(...)`. Single, double and backtick literals (no `${}`) are accepted; `?worker` / `?url` queries are stripped and extensions resolved as for imports; a bare `"w.ts"` is read as `./w.ts` (URL semantics); a missing target is reported as `unresolved`. A non-literal first argument is reported as `non-literal-url`, a root-relative `"/logo.svg"` as `unsupported-url`; remote URLs (`https:`, `//cdn`, `data:`), directory references (`"."`, `"../"`) and `new URL(...)` without `import.meta.url` as base are ignored. Only real code matches — the call is anchored on the `import.meta` es-module-lexer reports, so comments and strings never count.

New `lexModule()` / `extractUrlImports()` utilities back this. Hashes of entries that reach a file through `new URL(…, import.meta.url)` change, since that file now contributes.

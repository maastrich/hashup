---
"@maastrich/hashup": major
---

Complete rewrite from TypeScript to Rust with WASM + Go CLI distribution.

- Rust core library with tree-sitter parsing for JS/TS, Python, Rust, and Go
- WASI binary for cross-platform execution
- Go CLI using wazero WASM runtime
- Multi-language import resolution (was JS/TS only)
- Moon monorepo structure

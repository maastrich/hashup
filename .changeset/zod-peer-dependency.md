---
"@maastrich/hashup": minor
---

Support both zod 3 and zod 4. `zod` moved from `dependencies` to
`peerDependencies` with the range `^3.25.0 || ^4.0.0`, and all internal
imports now use the `zod/v4` subpath so the same code runs under either
major. Consumers must now install `zod` themselves.

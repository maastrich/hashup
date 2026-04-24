---
"@maastrich/hashup": patch
---

Fix `RangeError: Maximum call stack size exceeded` on large dependency graphs.

`hashFile` and `hashup()` accumulated transitive hashes with
`target.push(...source)`, which blows V8's argument-stack limit once
`source` reaches a few tens of thousands of entries — easy to hit in
large monorepos. Replaced every spread-append with a `pushAll` helper
that iterates without spreading, eliminating the overflow while
preserving hash output.

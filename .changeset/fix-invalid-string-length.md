---
"@maastrich/hashup": patch
---

Fix `Error: Invalid string length` when hashing very large dependency graphs.

`combineHashes` used `hashes.join("")` to feed the sha256 hasher. With
millions of entries (each a 64-char hash) the joined string exceeds
V8's maximum string length (~512 MB) and the join itself throws. Feed
each hash to the hasher with `update()` instead — sha256 is incremental,
so the output hash is byte-for-byte identical to the old implementation
on inputs that used to succeed.

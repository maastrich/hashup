---
"@maastrich/hashup": minor
---

Zero-match entry globs no longer fail the run — the entry's hash is
emitted as the sentinel `<no-hash>` and the remaining entries continue
processing.

Motivation: in a monorepo a package may not have tests yet, a feature
flag may empty a directory, or a glob may intentionally target files
that aren't always present. Previously any single zero-match entry
aborted the whole invocation; now it's a local, addressable signal
downstream tooling can detect.

```
app           48adf62a70c2645d0fc15ee3060973245af5dc30a542372791a7e1f05eaeacf6
visual-tests  <no-hash>
worker        0c4b8d9f…
```

In `--json` mode the sentinel appears as `{ "hash": "<no-hash>",
"files": [] }`. The sentinel is also exported from
`@maastrich/hashup/cli` as `NO_HASH` for programmatic callers of
`runConfigMode`.

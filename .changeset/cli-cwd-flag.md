---
"@maastrich/hashup": minor
---

Add a `--cwd <dir>` CLI flag so you can run `hashup` from elsewhere
without `cd`-ing into the project. Changes where `hashup.json` is
discovered, where relative entry/extras paths resolve, and where the
`--out` target is written. Defaults to `process.cwd()`.

```bash
hashup --cwd ./packages/app
hashup --cwd ./packages/app src/index.ts -o ../dist/app.hash
```

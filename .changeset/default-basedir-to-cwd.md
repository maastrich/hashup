---
"@maastrich/hashup": minor
---

Default `baseDir` is now the current working directory, not the
config file's directory.

Globs and relative entry paths in `hashup.json` anchor at `cwd` unless
an explicit `baseDir` is set (top-level or per-entry). Running
`hashup --cwd ./pkg` or `cd pkg && hashup` both resolve `src/**/*.ts`
against `./pkg/`, which is what most users expect when invoking from
a subdirectory.

**To keep the old config-relative behavior**, add `"baseDir": "."` to
`hashup.json`:

```json
{
  "baseDir": ".",
  "entries": { "app": { "entry": "src/**/*.ts" } }
}
```

Explicit `baseDir` values (top-level or per-entry) still resolve
against the config file's directory. The CLI `--base-dir` flag still
resolves against the real cwd and wins over both.

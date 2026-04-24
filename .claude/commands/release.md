---
description: Cut a new release of @maastrich/hashup from the current main
allowed-tools: Bash(git:*), Bash(vp:*), Bash(gh run:*), Bash(cat:*), Bash(ls:*)
---

# Release @maastrich/hashup

Consume all pending `.changeset/*.md` files, bump the version, push the
release commit to `main`, then create and push the matching tag so
`.github/workflows/release.yml` can publish to npm and GitHub Releases.

## Hard rule

**The release commit must be on `main` before the tag is created.** The
release workflow triggers on tag push (`v*.*.*`) and checks out the
tag's ref — if the release commit is only on a branch or local, the
workflow either runs against the wrong tree or publishes nothing. Never
tag first and push later.

## Preconditions

Before starting, verify all of:

1. `git branch --show-current` → `main`
2. `git status` → clean working tree
3. `git fetch origin && git status` → up to date with `origin/main`
4. `ls .changeset/*.md | grep -v README.md | grep -v config.json` → at
   least one pending changeset exists. If none, stop and tell the user
   there is nothing to release.
5. `gh run list --workflow=ci.yml --branch main --limit 1` → last CI run
   on main is green.

If any precondition fails, stop and report — do not try to fix it as
part of the release.

## Steps

1. **Bump version and consume changesets**

   ```bash
   vp run version
   ```

   This runs `changeset version`, which updates `package.json`,
   regenerates `CHANGELOG.md`, and deletes the consumed `.changeset/*.md`
   files. Review the diff:

   ```bash
   git diff package.json CHANGELOG.md
   git status  # confirm .changeset/*.md entries are deleted
   ```

   Capture the new version from `package.json` — call it `$VERSION`
   (e.g. `0.4.1`).

2. **Commit the release to `main`**
   Match the existing commit style (see `git log --oneline` — it's
   literally `release X.Y.Z`, no prefix, no body):

   ```bash
   git add -A
   git commit -m "release $VERSION"
   ```

   Do **not** add a `Co-Authored-By` trailer — release commits in this
   repo are bare one-liners.

3. **Push to `main` first**

   ```bash
   git push origin main
   ```

   Wait for this to succeed. If it is rejected (someone pushed while
   you were working), stop: do **not** force-push, do **not** tag. Pull,
   rebase, and restart from step 1.

4. **Tag and push the tag**
   Only after `main` has the release commit:

   ```bash
   git tag "v$VERSION"
   git push origin "v$VERSION"
   ```

   Tag name is `v` + version (see existing tags: `v0.4.0`, `v0.3.0`…).

5. **Watch the release workflow**
   ```bash
   gh run list --workflow=release.yml --limit 1
   gh run watch  # optional — pick the in_progress run
   ```
   The workflow runs `vp check`, `vp test`, `vp pack`, publishes to npm
   with `vp pm publish --no-git-checks --access public`, and creates a
   GitHub Release. If it fails, investigate in the Actions tab — do not
   re-tag; instead fix on a new branch, merge, bump to a new patch, and
   re-release.

## Recovery: tag pushed before main

If you violated the hard rule and pushed the tag without the release
commit on `main`:

1. Delete the remote tag: `git push origin :refs/tags/vX.Y.Z`
2. Delete the local tag: `git tag -d vX.Y.Z`
3. Cancel the in-progress release run (`gh run cancel <run-id>`) if it's
   still running.
4. Push the release commit to `main`, then re-tag and push the tag.

Deleting a tag does not unpublish from npm. If the broken tag already
published a bogus version, bump to the next patch and release again.

## Notes

- Use `vp run version` (not `pnpm version` or `changeset version`
  directly) — the project standardizes on Vite+ per `CLAUDE.md`.
- The `release` script in `package.json` (`vp pack && pnpm schema:generate
&& changeset publish`) is what CI invokes via `vp pm publish`; you
  don't run it locally.
- `changeset` config (`.changeset/config.json`) has `commit: false`, so
  step 2 is not automated — you must commit manually.

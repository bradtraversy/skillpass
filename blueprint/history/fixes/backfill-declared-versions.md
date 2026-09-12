# Fix: Backfill declared versions

**Type:** Fix
**Status:** verified
**Branch:** `fix/backfill-declared-versions`
**Fixes:** GitHub issue #9, existing listings

## The problem

Every publish before the declared-version fix was numbered by the counter, so
a skill that declares `metadata.version: "1.4.0"` still lists as 1.0.0. The fix
only affects publishes from now on; the rows already in the database keep the
counter's number until someone republishes.

## The fix

A one-time backfill, `pnpm db:backfill-versions`, in the same shape as the
other seed backfills. For each published skill it opens the latest version's
snapshot, reads the declared version through the same manifest reader publish
uses, and renames the version row when the declared version is valid semver
and differs from the stored one. Skills that declare nothing keep their
number. A declared version that another row of the same skill already holds
is reported as a conflict and left alone. The script previews by default and
writes only with `--apply`.

Must not break: passports and their links (rows are renamed, not replaced),
the latest-version pointer, publishes that happen after the run.

## Build steps

- [x] 1. Script, package script, and tests for the pure planning helper. Done
  when the helper's cases (nothing declared, same, differs, sibling conflict)
  are covered, the maintainer's real SKILL.md resolves to 1.4.0, and
  `pnpm verify` passes.

## Verify

Brad runs, in Render's API shell: `cd apps/api && pnpm db:backfill-versions`
to preview, then the same with `--apply`. Afterwards
`https://api.skillpass.dev/skills/ai-slop-detection` reports 1.4.0.

## Verification

Six unit tests cover the planning helper and the snapshot reader, including the
maintainer's real frontmatter resolving to 1.4.0. The script itself was not run
against a database here; the preview run in Render's shell is Brad's step, and
its output is the evidence before `--apply`. `pnpm verify` result recorded by
the archive.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":1996,"specSha256":"ddd6ae454cffeaed8994007b96b9cffdd1933c00f09a88eb5ab822408cecb810","branch":"refs/heads/fix/backfill-declared-versions","head":"c784bf496469cfcd404ac40013228d3c0eccd24a","baseRef":"refs/heads/main","baseCommit":"c784bf496469cfcd404ac40013228d3c0eccd24a","sourceTree":"31052a137ad96f017a220bd9dd6aa48437a31ded","absentOptional":[]} -->

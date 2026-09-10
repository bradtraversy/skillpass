# Current Feature

> **Generated file.** Holds the one feature or fix being built right now. Run
> `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
> an ad-hoc fix. Build one thing at a time; `/complete` archives it (to
> `blueprint/history/features/` or `blueprint/history/fixes/`) and resets this file.

## Binary files are silently corrupted on the way through a snapshot

**Type:** Fix

**Branch:** `fix/binary-files-in-snapshots`

### The problem

All three package loaders decode every file as UTF-8: the validator's
directory walk, the GitHub tarball extractor, and the zip extractor. A PNG,
font, or other binary becomes a mangled string in the snapshot, and the CLI
writes that string back to disk on install, so the file arrives corrupt with
no warning anywhere.

Audit P2 item "binary files silently corrupt" from the 2026-09-08 code audit.

### The fix

One `isBinary(bytes)` in the validator (a NUL byte in the first 8 KB or
invalid UTF-8), used by all three loaders. Binary files are left out of the
snapshot instead of decoded. The validator's directory walk records the
dropped paths on `LoadedPackage.binaries`, and the structure rule turns each
into a `binary-dropped` warning so `skillpass scan` says which files an
install will not carry. The API loaders log the dropped path; the snapshot
format is unchanged, so submissions do not surface the warning yet (that
needs a snapshot field and is a follow-up).

Must not break: source hashes for text-only packages (unchanged input, same
hash), the existing loader suites, and the CLI install of text skills.

### Build steps

- [x] **Step 1 - detector, loaders, warning, tests.** Done when `pnpm test`
  and `pnpm typecheck` are green with new tests for `isBinary`, the walk, the
  structure warning, the tarball, and the zip.

### Testing

Pure logic under the Vitest gate; each loader gets a binary-entry case.

### Verify

`pnpm cli scan` on a folder holding a PNG next to `SKILL.md` prints a
`binary-dropped` warning naming the PNG.

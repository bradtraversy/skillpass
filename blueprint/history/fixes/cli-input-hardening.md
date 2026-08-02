# Fix: CLI input-layer hardening

**Type**: Fix (ad-hoc, review-driven)
**Branch**: `fix/cli-input-hardening`
**Date**: 2026-08-02

## What changed

A code review of `packages/cli` (2026-08-01) confirmed six input-handling bugs:
a raw `ENOTDIR` crash when `add --dir` pointed at an existing file, the
install-location picker silently defaulting on out-of-range input, unknown or
typo'd flags silently ignored, `--global` without `--target` silently dropped,
`add` accepting a `--json` it ignored, and a vague `scan` error for
non-directory paths. All input-layer; the verification core (preflight gate,
hash re-verification, traversal checks) had zero findings.

Bad input now fails loud with a clean message and exit code 2:

- `parseCliArgs` records every flag it sees and marks unknown flags and flags
  missing their value invalid instead of routing them into positionals.
- `run()` validates flags per command against an allowed-flags table
  (`scan`/`report`: `--json`; `add`: `--yes --target --dir --global`), so
  `add --json`, `scan --yes`, and typo'd flags all error with usage.
- `runAdd` rejects `--global` without `--target` before any network call, and
  errors cleanly when the install target exists as a file.
- The picker re-prompts on invalid input; blank still means default choice 1.
- `scan`'s unreadable-package error says "(expected a directory)".

## Why it was leaky

The hand-rolled parser was permissive by default, and author-written tests only
fed it intended input. Diff review can't see the missing `else` branch. Found by
adversarial probing, the pass now expected before anything ships externally.

## Verification

- `pnpm test`: 788 passed (777 before, 11 new covering every rejection path
  plus controls that valid invocations still parse).
- `pnpm build` green; ad-hoc `tsc --noEmit` over `packages/cli` clean.
- Real CLI output for each rejection; the review's original crash and
  silent-default probes re-run clean against the fixed code.

## Deliberately out of scope

Binary-file corruption in the snapshot pipeline (API-side decision), client-side
download caps, and npm packaging (tsx runtime dep, localhost default URL) - the
latter two fold into feature 15.

# Current Feature

> **Generated file.** Holds the one feature or fix being built right now. Run
> `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
> an ad-hoc fix. Build one thing at a time; `/complete` archives it (to
> `blueprint/history/features/` or `blueprint/history/fixes/`) and resets this file.

## The CLI install commands copy their scaffolding

**Type:** Fix

**Branch:** `fix/cli-shared-install-helpers`

### The problem

`add`, `update`, and `remove` in `packages/cli/src` each re-implement the same
blocks: the push/done output setup (2 copies), the `--global needs --target`
and `--target or --dir` usage errors (3 and 2), the "is this destination
free" check (2), the receipt literal (4), the pack member plan from a snapshot
(2), the risk confirmation flow (3), and `remove`'s `candidateDirs`, which
walks install areas by hand instead of using `knownAreas`. Each block is small;
together they are where behavior drifts (the receipt shape, the abort wording,
the occupied rule) between commands.

Audit item #7, CLI cluster, from the 2026-09-08 code audit.

### The fix

A new `packages/cli/src/install.ts` holding what the three commands share:
`createOutput`, the two usage-error strings, `isOccupied`, `receiptFor`,
`memberFiles` (moved from `add.ts`) with `planMembers`, and `confirmRisk`.
`remove.ts` builds its candidates from `knownAreas`. The commands keep their
own flow, messages, and exit codes.

Must not break: the add, update, remove, index, and outdated suites, which
pin every message and exit code. They are the gate and stay untouched.

### Build steps

- [x] **Step 1 - `install.ts` with tests, then the three commands on it.**
  Unit tests for each helper (streamed and buffered output, occupied rule
  across absent, empty, file, and non-empty, receipt with and without pack,
  member plans, and the four confirmation outcomes). Done when `pnpm test`
  and `pnpm typecheck` are green with the command suites unchanged and no
  import left unused.

### Testing

Pure logic under the Vitest gate.

### Verify

`pnpm test` green; `git diff --stat` shows the three commands shrinking.

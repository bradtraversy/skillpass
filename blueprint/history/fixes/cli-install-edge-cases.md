# Current Feature

> **Generated file.** Holds the one feature or fix being built right now. Run
> `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
> an ad-hoc fix. Build one thing at a time; `/complete` archives it (to
> `blueprint/history/features/` or `blueprint/history/fixes/`) and resets this file.

## CLI install manager edge cases

**Type:** Fix

**Branch:** `fix/cli-install-edge-cases`

### The problem

Four behavior bugs in `packages/cli`, all from audit item #5 (second half):

1. **`swapTree` orphans `<dir>.new-<pid>`.** It writes the fresh tree, then
   renames the installed folder aside. If that folder is gone (a receipted
   install the user deleted by hand), the rename throws before the `try`, the
   fresh tree is never cleaned up, and the update reports failure while leaving
   junk next to the install area.
2. **Pack `add` writes receipts after the whole loop.** A failure on member N
   leaves members 1..N-1 on disk with no receipt, so `list` shows them
   versionless and `update`/`outdated`/`remove` cannot find the family.
3. **`list` and `outdated` crash on a dangling symlink.** `installedIn` uses
   `statSync`, which follows symlinks and throws `ENOENT` when the target is
   missing, so one dead link in `.claude/skills` kills both commands.
4. **Errors reach stdout and crashes exit 1.** `main` prints every result with
   `console.log`, so a `--json` error line lands in the JSON stream, and an
   uncaught exception exits with Node's default 1, which is the CLI's
   "validation failed" code for `scan`.

### The fix

1. `swapTree` clears any stale fresh tree first, only sets the old folder
   aside when it exists, installs the fresh tree in its place, and on any
   failure restores the old folder (if it was set aside) and removes the fresh
   tree before rethrowing.
2. `recordReceipt` runs inside the member loop, right after each `writeTree`.
3. `installedIn` uses `statSync(path, { throwIfNoEntry: false })` and treats a
   missing target as "not a directory".
4. `main` catches a thrown `run`, prints `error: <message>` to stderr, and
   exits 2. Results with exit code 2 print to stderr; everything else stays on
   stdout. `main` takes an optional `runImpl` so the crash path is testable.

Exit code contract after this: 0 ok, 1 scan found failures, 2 CLI error.

Must not break: the happy paths of `update`, pack `add`, `list`, `outdated`;
the streamed output of `add`/`update` (unchanged); `--json` output for `scan`,
`report`, `search` on stdout.

### Build steps

- [x] **Step 1 - the four fixes with a test each.** `swapTree` on a missing
  folder installs cleanly with no `.new-` sibling; a pack whose second member
  fails to write leaves a receipt for the first; a dangling symlink in an area
  is ignored by `list`; `main` sends an exit-2 result and a thrown error to
  stderr with exit 2 and keeps `--help` on stdout. Done when `pnpm test` and
  `pnpm typecheck` are green and each new test fails on the old code.

### Testing

Pure logic under the Vitest gate; every fix ships with its test.

### Verify

1. `pnpm cli list` in a folder whose `.claude/skills` holds a dead symlink
   prints the other skills instead of a stack trace.
2. `pnpm cli report nope --json 2>/dev/null` prints nothing to stdout and
   exits 2.

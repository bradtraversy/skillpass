# Fix: Init partial scaffold cleanup

**Type:** Fix
**Status:** verified
**Branch:** fix/init-partial-scaffold-cleanup

## The problem

`runInit` in `packages/cli/src/init.ts` creates `./<name>/` and then writes `SKILL.md` and `skill.json` one after the other. If the second write fails (disk full, permissions), the folder and the first file stay behind, and a retry is refused with "already exists". Raised by CodeRabbit on PR #30 (feature 29); confirmed against the code.

## The fix

Wrap the two writes so a failure removes the folder `runInit` just created, then rethrow, so `main` still reports `error: <message>` with exit 2.

- Removal is safe because the folder is new: `runInit` refuses when the path exists, and `mkdirSync` without `recursive` throws if it appears in between, so the only contents are what this run wrote.
- Use `rmSync(dir, { recursive: true, force: true })`.
- Successful runs are unchanged.

## Build steps

- [x] 1. **Remove the folder on a failed write.** Apply the change in `init.ts`; add a test in `init.test.ts` that makes the `skill.json` write throw (a `vi.mock('node:fs')` wrapper that delegates to the real module and fails only for a flagged path) and asserts `runInit` rejects with that error and `./<name>` no longer exists, and that a retry then succeeds. **Done when** `pnpm verify` is green with the new test.

## Verify

- The new test: failed second write leaves nothing behind and a retry scaffolds normally.
- Existing `init` tests still pass, so the successful path is unchanged.

## Evidence

- `pnpm verify` green on `fix/init-partial-scaffold-cleanup`.
- New test in `packages/cli/src/init.test.ts`: with the `skill.json` write forced to throw, `runInit` rejects with the error, `./demo-skill` no longer exists, and a retry scaffolds both files with exit 0.
- The same test fails against the pre-fix `init.ts` (1 failed, 20 passed) and passes with the fix (21 passed).


<!-- blueprint:completion {"schemaVersion":1,"specBytes":1925,"specSha256":"ac270660aa0fb6d76b998e2df690e937e6deacc1ad975bcf493524567f40426d","branch":"refs/heads/fix/init-partial-scaffold-cleanup","head":"6776232e18d198ca90c6521564bb01050b86a466","baseRef":"refs/heads/main","baseCommit":"6776232e18d198ca90c6521564bb01050b86a466","sourceTree":"10dd75b2bd2690ed17b86a48c090578aabd467d3","absentOptional":[]} -->

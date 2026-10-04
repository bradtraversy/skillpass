# Fix: Remove deletes an empty receipt

**Type:** Fix
**Status:** verified
**Branch:** fix/remove-deletes-empty-receipt

## The problem

When `skillpass remove` takes out the last tracked skill in a skills folder, `removeReceipt` in `packages/cli/src/receipts.ts` rewrites `.skillpass.json` as `{}` instead of removing it. The folder is left with a stray file that records nothing. Seen in the 0.7.0 end-to-end run on 2026-10-04 (`add pdf`, then `remove pdf`, left `.claude/skills/.skillpass.json` containing `{}`); carried as a known issue since 2026-10-01.

## The fix

- `removeReceipt` deletes `.skillpass.json` when no receipts remain after the removal, and rewrites it as before when others remain.
- The deletion is wrapped like the write: receipts are bookkeeping, so a failure never fails the remove.
- Folders are not removed; only the receipt file.

## Build steps

- [x] 1. **Delete the receipt file when it empties.** Apply the change; add tests in `receipts.test.ts` that removing the only receipt deletes the file, removing one of two keeps the file with the other, and removing an untracked slug leaves the file untouched. **Done when** `pnpm verify` is green and the built CLI's `add` then `remove` in a scratch folder leaves no `.skillpass.json`.

## Verify

- New receipt tests pass; existing `remove` and `add` tests still pass.
- Built CLI in a scratch folder: `add pdf --target claude-code`, then `remove pdf --target claude-code`, leaves `.claude/skills/` without `.skillpass.json`.

## Evidence

- `pnpm verify` green on `fix/remove-deletes-empty-receipt`.
- New tests in `packages/cli/src/receipts.test.ts`: removing the only receipt deletes `.skillpass.json`; removing an untracked slug leaves the file byte-identical. The existing "removes one receipt and keeps the others" test still passes.
- Built CLI in a scratch folder against production: `add pdf --target claude-code` wrote `pdf/` and `.skillpass.json`; `remove pdf --target claude-code` left `.claude/skills/` empty.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":2003,"specSha256":"f28a5cc06fb5131d3b0366de5a2e5f03565ff04677389f25c776a5daa89a6a02","branch":"refs/heads/fix/remove-deletes-empty-receipt","head":"1ab33b76ac5e6ab5f5b6455af503eaacab722454","baseRef":"refs/heads/main","baseCommit":"1ab33b76ac5e6ab5f5b6455af503eaacab722454","sourceTree":"dd3492c77178047ffe81367c62e1f454efff2930","absentOptional":[]} -->

# Fix: Pre-flight notes dropped binaries

**Type:** Fix
**Status:** verified
**Branch:** fix/preflight-notes-dropped-binaries

## The problem

Snapshots are text-only: since 2026-09-10 (`62a1dbc`) ingest leaves binary files out and the validator records a `binary-dropped` warning for each. The CLI's directory pre-flight (`renderPreflightReport`, used by `report`, `add`, `use`, and `update`) never shows those warnings, so a directory install of a skill with fonts, images, or archives finishes as "verified" with no sign that files are missing. Only `add github:` (local validation) lists them. Found in the 0.7.0 end-to-end run on 2026-10-04.

## The fix

- `renderPreflightReport` adds a "Not included" block when the version's passport (`detail.passport.warningsSummary`) has `binary-dropped` findings: the count, up to three paths, "and N more" for the rest, and where to get them (`detail.githubRepoUrl` when present, otherwise "the skill's source").
- One place, so `report`, `add`, `use`, and `update` all show it. Nothing else changes: no exit-code change, no prompt.

## Build steps

- [x] 1. **Show dropped binaries in the pre-flight.** Apply the change; add `render.test.ts` cases: no block without `binary-dropped` findings; one finding shows its path and the repo URL; five findings show three paths and "and 2 more"; a null repo URL falls back to "the skill's source". **Done when** `pnpm verify` is green.

## Verify

- New render tests pass; existing `report`, `add`, `use`, `update` tests still pass (their fixtures have no such findings).
- No listing on production has `binary-dropped` findings today (checked 2026-10-04), so the live check waits for the legacy re-snapshot (build-plan item 31, proposed).

## Evidence

- `pnpm verify` green on `fix/preflight-notes-dropped-binaries`.
- New `renderDroppedBinaries` tests in `packages/cli/src/render.test.ts`: no block without `binary-dropped` findings (an unrelated finding is ignored); one finding prints its path and the repo URL; five findings print three paths and "and 2 more"; a null repo URL falls back to "the skill's source".
- Existing `report`, `add`, `use`, and `update` tests pass unchanged.
- Live check: none possible yet. A scan of all 592 production passports on 2026-10-04 found no `binary-dropped` findings; the 7 listings with binary content are pre-2026-09-10 snapshots that stored it as corrupted text instead (canvas-design, web-artifacts-builder, deploy-to-vercel, theme-factory, playwright, figma-implement-design, ai-blueprint).


<!-- blueprint:completion {"schemaVersion":1,"specBytes":2527,"specSha256":"369216e0c4479f5b47f8ecf349e254c19b140300155ed3819d4f643f0accc969","branch":"refs/heads/fix/preflight-notes-dropped-binaries","head":"f4d0c8245154d321174edeabf12a6da1f4c7cf41","baseRef":"refs/heads/main","baseCommit":"f4d0c8245154d321174edeabf12a6da1f4c7cf41","sourceTree":"5537a0328680f7f34eb9635e3ad082abec237af6","absentOptional":[]} -->

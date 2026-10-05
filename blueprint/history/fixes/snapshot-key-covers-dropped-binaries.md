# Fix: Snapshot key covers dropped binaries

**Type:** Fix
**Status:** verified
**Branch:** fix/snapshot-key-covers-dropped-binaries

## The problem

Snapshot keys are content-addressed by the text-only source hash (`snapshotKey(sourceHash)`, `apps/api/src/storage/r2.ts`). Since #40 the snapshot document also carries the `binaries` list, so two packages with identical text files but different dropped binaries map to one key, and the later write replaces the earlier document's list. A submission validated or re-validated after that overwrite reports the wrong `binary-dropped` warnings. Raised by CodeRabbit on #40 and recorded there as a known limit.

## The fix

- `snapshotKey(sourceHash, binaries = [])` keeps today's key, `snapshots/<hash hex>.json`, when `binaries` is empty, so every existing key and every text-only package is unchanged. With binaries it appends a SHA-256 of the paths joined by NUL: `snapshots/<hash hex>-<binaries hex>.json`. The list arrives sorted from the extractors, the same list the document stores.
- The three ingest call sites pass `pkg.binaries`: GitHub submit and zip submit in `apps/api/src/routes/submissions.ts`, and `curateSkill` in `apps/api/src/seed/curate.ts`.

Must not break: reads, which all use the key stored on the submission or version row (`/source`, `/download`, `/preflight`, publish, the validation job, AI review, backfills). Nothing recomputes a key from a hash.

## Build steps

- [x] 1. **Key binary-dropping snapshots by their binaries too.** Apply the change. Tests in `r2.test.ts`: no binaries gives the existing key; a binaries list gives a suffixed key that is stable for the same list and differs for a different list. Update the submit-route test that stores a binaries list to expect the suffixed key, and assert `curateSkill` passes `pkg.binaries` to `snapshotKey`. **Done when** `pnpm verify` is green.

## Verify

- The tests above pass, and the existing route, seed, and storage tests pass unchanged for text-only packages.

## Evidence

- `pnpm verify` green on `fix/snapshot-key-covers-dropped-binaries`: lint, format check, typecheck, 1310 tests (104 files), and the build.
- New `snapshotKey` tests in `r2.test.ts`: an empty list keeps `snapshots/abc123.json`; a binaries list gives `snapshots/abc123-<64 hex>.json`, stable for the same list and different for a different list.
- Both submit-route binary tests now expect the suffixed key (computed independently in the test) in the stored document and the submission row; the `curateSkill` test asserts `snapshotKey` receives `pkg.binaries`.
- Existing text-only route, seed, and storage tests pass unchanged with the plain key.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":2661,"specSha256":"938184baf793a6688a68cadd2b0a54d188df815dc8baaa2e1d7a01b2bd7004fa","branch":"refs/heads/fix/snapshot-key-covers-dropped-binaries","head":"d152e06d3af7f7b3a58b7f61f0d907fa62e6a7c2","baseRef":"refs/heads/main","baseCommit":"d152e06d3af7f7b3a58b7f61f0d907fa62e6a7c2","sourceTree":"7285162be74d5b03f5b6a97b030d3290365b2e47","absentOptional":[]} -->

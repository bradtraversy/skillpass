# Fix: Report dropped binaries on submissions

**Type:** Fix
**Status:** verified
**Branch:** fix/report-dropped-binaries-on-submissions

## The problem

Server ingest leaves binary files out of snapshots but never tells the validator. `extractTarball` (`apps/api/src/github/snapshot.ts:101`) and `extractZip` (`apps/api/src/uploads/zip.ts:88`) only `console.warn` the path, and the snapshot document (`apps/api/src/storage/r2.ts`) has no field for it. Validation runs later from that document (`processValidationJob`, `apps/api/src/queue/processor.ts:82`), so `binary-dropped` never reaches a server report or passport. A skill submitted or seeded since 2026-09-10 with fonts, images, or archives publishes as if complete, and the CLI's "Not included" notice (#39) can never fire for a listed skill. `62a1dbc` deferred this ("needs a snapshot field and is a follow-up").

## The fix

- Both extractors return `{ files, binaries }` (one shared shape), each dropped path relative to the package root: after the tarball subpath strip and the zip shared-root strip. The list replaces the `console.warn` calls.
- The snapshot document gains an optional `binaries: string[]`, written only when non-empty so text-only documents stay byte-identical. The read schema accepts documents with or without it. `version` stays `1`.
- The three ingest paths store the list in the document: GitHub submit and zip submit in `apps/api/src/routes/submissions.ts`, and `curateSkill` in `apps/api/src/seed/curate.ts`.
- `processValidationJob` passes `snapshot.data.binaries ?? []` to `loadPackageFromFiles`, so the existing structure rule adds one `binary-dropped` warning per path.

Must not break:

- Source hashes and snapshot keys: binaries stay outside the hash and text files are unchanged.
- Existing snapshot documents and the 592 published passports. They are immutable and nothing re-validates them.
- Callers that read only `files`: `/source`, `/download`, `/preflight`, publish, AI review, and the backfill scripts.

Consequence to accept: `binary-dropped` is a warning, so a new submission that drops a binary validates as `warning` with risk `medium`. That is the verdict `skillpass scan` already gives the same package locally, and `skillpass add` will ask for confirmation.

Known limit: snapshot keys are content-addressed by the text-only source hash, so two packages with identical text files but different dropped binaries share one document, and the later write's list wins. Rare, limited to the warning list, and not addressed here.

## Build steps

- [x] 1. **Carry dropped paths from ingest to the report.** Apply the changes above. Tests: the tarball binary case (with a subpath) and the zip binary case (with a shared root folder) assert the returned `binaries`; `r2.test.ts` covers a document with `binaries` written and parsed back, and a text-only document written without the key and still parsing; `processor.test.ts` asserts a document with `binaries: ['logo.png']` yields a `warning` report with one `binary-dropped` finding at `logo.png`; `submissions.test.ts` and `curate.test.ts` move to the new extractor shape and assert the stored document carries the list. **Done when** `pnpm verify` is green.

## Verify

- The tests above pass, and the existing ingest, processor, route, and seed tests pass.
- Optional local check with the API running: submit a zip holding a PNG next to `SKILL.md` and see `binary-dropped` in the validation report.
- Live: the next submission or seed that drops a binary shows `binary-dropped` on its passport, and the CLI pre-flight prints the "Not included" block.

## Evidence

- `pnpm verify` green on `fix/report-dropped-binaries-on-submissions`: lint, format check, typecheck, 1308 tests (104 files), and the build.
- New tests: the tarball case reports `logo.png` under the `skills/demo` subpath and ignores a binary outside it; the zip case reports `assets/logo.png` with the shared root stripped; `snapshotDocument` lists binaries and omits the key for text-only packages (same JSON bytes as before); `getSnapshotDocument` reads a document with `binaries`; the processor turns `binaries: ['logo.png']` into a `warning`/`medium` report with one `binary-dropped` finding and a `warn` structure step; both submit routes and `curateSkill` store the list in the snapshot document.
- Existing extractor, route, seed, and processor tests pass after moving to the `{ files, binaries }` shape.
- Not run: the optional local submit check (needs the API dev server) and the live check, which waits for the next submission or seed that drops a binary.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":4590,"specSha256":"00b52dfa433ca74d64810df9032ec0a1466f34f5b8d5fdc808ef3f7350df9c82","branch":"refs/heads/fix/report-dropped-binaries-on-submissions","head":"49200fd81dfcc45a7105d9dc570245158ec14712","baseRef":"refs/heads/main","baseCommit":"49200fd81dfcc45a7105d9dc570245158ec14712","sourceTree":"d9f6a7aceff47fcf07237b7d25c291c16481c2fc","absentOptional":[]} -->

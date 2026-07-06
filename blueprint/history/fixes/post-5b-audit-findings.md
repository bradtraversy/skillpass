# Fix: post-5b audit findings

**Type:** Fix
**Status:** not started

## Goal

Close out the /audit findings on the 5b submission intake: meter the bytes the
tarball extractor is allowed to stream (not just the bytes it keeps), stop
reporting every GitHub 403 as rate limiting, dedupe two drifting one-liners, and
pin the zip-hardening note where 5c's spec will find it.

## In scope

- **Download budget (P2)**: count every tarball entry's bytes - kept or skipped -
  against a generous `MAX_DOWNLOAD_BYTES` (100 MB) budget, separate from the
  10 MB kept-files cap so monorepo subpaths keep working; exceed -> `too-large`.
- **403 mapping (P3)**: `rate-limited` only for 429, or 403 with
  `x-ratelimit-remaining: 0`; other 403s fall through to `upstream` with the
  status visible.
- **Dedupe (P3)**: export `byPath` from the validator and use it in the snapshot
  builder; move `USER_AGENT` to `apps/api/src/lib/http.ts` and import it in both
  GitHub modules.
- **5c note (P3)**: extend the build-plan 5c line so the zip flow specs hardened
  archive entry-name validation.

## Out of scope

- Endpoint rate limiting and duplicate-submission dedup (deferred by the 5b spec).
- Any zip-handling code (5c builds it).

## Build steps

- [x] **Step 1 - apply the four fixes** - budget metering + tests, 403 header
  check + test updates, the two dedupes, the build-plan line. *Done when:* new
  tests prove the skipped-bytes budget and the 403 split; `pnpm test` and
  `pnpm typecheck` green; no behavior change for kept-file caps (existing tests
  untouched and passing).

## Files / areas

- `apps/api/src/github/snapshot.ts` (+ test) - download budget.
- `apps/api/src/github/pin.ts` (+ test) - 403/429 split.
- `packages/validator/src/load.ts`, `apps/api/src/lib/http.ts` (new),
  `apps/api/src/auth/github.ts` - dedupes.
- `blueprint/build-plan.md` - 5c line note.

## Testing

- Budget: a skipped-entry tarball over a small injected budget -> `too-large`;
  under it -> success. 403 with/without the ratelimit header -> `rate-limited` /
  `upstream`. All existing caps tests stay green unchanged.

## Notes for the AI

- The budget must not change behavior for the existing fixtures (kept caps stay
  the sole limit there); make the budget injectable for tests, defaulting to the
  exported constant.

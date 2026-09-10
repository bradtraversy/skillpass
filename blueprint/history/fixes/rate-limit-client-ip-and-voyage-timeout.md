# Current Feature

> **Generated file.** Holds the one feature or fix being built right now. Run
> `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
> an ad-hoc fix. Build one thing at a time; `/complete` archives it (to
> `blueprint/history/features/` or `blueprint/history/fixes/`) and resets this file.

## Spoofable rate-limit key and an unbounded Voyage call

**Type:** Fix

**Branch:** `fix/rate-limit-client-ip-and-voyage-timeout`

### The problem

- `clientKey` in `apps/api/src/routes/rate-limit.ts` buckets on the first hop
  of `x-forwarded-for`. Render fronts the API with Cloudflare, which appends
  the real client address to whatever `x-forwarded-for` the client sent, so
  the first hop is caller-controlled: a caller can dodge the limit or pin it
  on someone else's address. Cloudflare supplies the real address as
  `cf-connecting-ip` (and `true-client-ip`).
- `embedTexts` in `apps/api/src/search/embeddings.ts` calls Voyage with no
  timeout, and `res.json()` sits outside the `try`, so a hung or malformed
  provider response either stalls the user-facing search request or throws
  through it. Every other outbound call in the API already uses
  `AbortSignal.timeout`.

Audit item #6 from the 2026-09-08 code audit.

### The fix

- `clientKey` takes a header lookup and prefers `cf-connecting-ip`, then
  `true-client-ip`, then the **last** hop of `x-forwarded-for` (the one the
  trusted edge appended), then the shared `unknown` bucket.
- The Voyage request gets `signal: AbortSignal.timeout(30_000)` matching the
  GitHub and R2 calls, and the body parse moves inside the `try`, so a
  timeout or bad body returns `{ success: false }` like any other provider
  failure.

Must not break: the limiter's window logic and its tests; the existing
embedding tests (order, chunking, no-key path).

### Build steps

- [x] **Step 1 - both changes with tests.** `clientKey` tests for the two
  edge headers, the last-hop fallback, and the shared bucket; `embedTexts`
  tests that the request carries an abort signal and that a malformed body is
  a failed result, not a throw. Done when `pnpm test` and `pnpm typecheck` are
  green and the new tests fail on the old code.

### Testing

Pure logic under the Vitest gate; tests ship in the diff.

### Verify

1. `pnpm test` green.
2. On production, a request with a forged `x-forwarded-for` is bucketed by
   its real `cf-connecting-ip`.

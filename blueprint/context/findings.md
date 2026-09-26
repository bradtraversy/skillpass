# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-01 [P2] fixed - A rejected archive body read escapes fetchRepoFiles as an exception

**File:** packages/cli/src/github.ts:107
**Found:** 2026-09-26 by /audit (scope: current; lens: quality, security)
**Why it matters:** `fetchRepoFiles` awaits `readCapped(res.body, ...)` outside its try/catch. The request carries `AbortSignal.timeout(30_000)`, and undici errors the response stream when that timer fires or the connection drops after the headers arrive, so a large archive on a slow link (100 MB budget, 30 s timeout) makes `reader.read()` reject and the rejection propagates through `repoSource` and `runAdd`. `main` (packages/cli/src/index.ts:275) catches it and exits 2, so nothing is written and the exit code holds, but the user sees the raw runtime message ("The operation was aborted due to timeout" or "terminated") instead of the CLI's own GitHub error line. The spec's contract for this path ("never throw for a network or archive problem") and the `add.ts` pattern (`push` then `done(2)`) both rule that out. `github.test.ts` covers a fetch that rejects, not a body that fails after the headers.
**Suggested fix:** Wrap the `readCapped` call in try/catch and return `{ ok: false, message: 'the archive download from <url> was interrupted or timed out; nothing was installed' }` (or reuse the existing `cannot reach GitHub at <url>` line). Add a `fetchRepoFiles` test whose stubbed `Response` body is a `ReadableStream` that errors on its first `pull`, asserting the `{ ok: false }` result. No shipped behavior is lost.
**Resolution:** fixed 2026-09-26 by /implement (spec step 7): `fetchRepoFiles` awaits `readCapped` inside try/catch and returns `{ ok: false, message: 'the repository archive download was interrupted; nothing was installed' }`; `github.test.ts` covers a body stream that errors on its first pull. Awaiting /audit closure.

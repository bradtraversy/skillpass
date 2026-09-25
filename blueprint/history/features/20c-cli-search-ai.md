# Feature: CLI search --ai

**From build-plan:** feature 20c
**Build attempt:** 1
**Status:** verified
**Branch:** `feature/cli-search-ai`

## Goal

`skillpass search --ai "<what you need>"` searches by meaning from the terminal,
using the same free, ungated `GET /skills/search?q=` endpoint the homepage AI
toggle uses (feature 20b). Results render through the existing search table.
This closes parent feature 20 and is the last item meant to ship in the next
npm release alongside feature 21.

## In scope

- **`--ai` flag on `search`.** A boolean flag; the query is required with it
  (`error: search --ai needs a query`, exit 2). Without `--ai`, `search` is
  unchanged.
- **Endpoint call.** `GET <api>/skills/search?q=<encoded query>`, parsed with the
  existing `publicSkillListSchema` (the endpoint returns `PublicSkillSummary[]`
  in relevance order, top 20). The query is trimmed; the endpoint caps it at 500
  characters and answers 400 beyond that.
- **Filters keep their meaning, order stays the server's.** `--target`,
  `--category`, and `--packs` apply client-side to the ranked list without
  re-sorting, mirroring the site (sidebar filters apply, tabs do not).
- **Rendering.** Reuse `renderRows` (wide table, narrow two-line, piped plain).
  Footer: `<N> skills by meaning - skillpass report <slug> shows the passport`.
  Empty: `No skills match by meaning - try other words` (exit 0). `--json`
  prints the ranked array.
- **Honest errors.** The endpoint's statuses map to plain messages: 429 `AI
  search is rate limited (20 requests a minute per address); try again in a
  moment`, 503 `AI search is not configured on this API`, 502 `AI search is
  temporarily unavailable; try again shortly`, 400 the API's own message, and
  any other failure the existing `getParsed` wording. All exit 2.
- **`getParsed` carries the status.** Its failure outcome gains optional
  `status` and `apiError` (the API's `error` string when the body has one).
  Existing callers and messages are unchanged; this is the seam the mapping
  above reads. Root cause, not a new layer: today every non-2xx collapses to
  `the API returned an error (<status>)`.
- **Help and docs.** `USAGE` (search line and an `--ai` flag line), the `search`
  entry in `COMMAND_FLAGS`, the Find sections of `packages/cli/README.md` and
  `apps/web/src/pages/docs/cli.astro`, and the Skills CLI line in `AGENTS.md`.

## Out of scope

- A similarity threshold or "no good matches" cutoff (20b deferred it).
- Query caching, retries, or client-side rate limiting.
- Mixing keyword and AI results, or an interactive picker.
- The npm release and version bump (the separate release chore).

## Build loop

Build one small step at a time. `blueprint/config.json` is absent: defaults are
`workflow.stepReview: feature` (one review packet after all steps) and no
checkpoint commits. Independent review runs only if `when-sensitive` selects it.
`/complete` makes the final feature commit.

## Build steps

- [x] **Step 1 - Status-aware fetch outcome** - in `packages/cli/src/api.ts`,
  the `ok: false` outcome of `getParsed` gains `status?: number` and
  `apiError?: string` (set when the JSON body has a string `error`); no message
  changes. Tests in `api.test.ts`. *Done when:* a stubbed 429 body with
  `{ success: false, error: 'Too many requests, slow down.' }` yields
  `status: 429` and that `apiError`, a network failure yields neither, and the
  existing `api.test.ts` cases still pass.
- [x] **Step 2 - `search --ai`** - `SearchOptions.ai?: boolean`; with it,
  `runSearch` requires a query, calls the search endpoint, filters the ranked
  list in place, renders with `renderRows`, uses the by-meaning footer and
  empty text, and maps 429/503/502/400 to the messages above. Tests in
  `search.test.ts`. *Done when:* tests prove the encoded URL, payload order
  preserved with a filter applied, the empty text, `--json` passthrough, the
  missing-query error, and each status message; `pnpm exec vitest run
  packages/cli` passes.
- [x] **Step 3 - Flag, help, docs** - `parseCliArgs` accepts `--ai` (boolean),
  `COMMAND_FLAGS.search` lists it, `USAGE` shows `search [query] [--ai] ...`
  and an `--ai` flag line, `run()` passes `ai` through; README, docs page, and
  the AGENTS.md command line describe it with one example. Test in
  `index.test.ts`. *Done when:* `search --ai` parses, `add --ai` is rejected as
  a flag `add` does not take, and `pnpm verify` passes.

## Files / areas

- `packages/cli/src/api.ts`, `api.test.ts`
- `packages/cli/src/search.ts`, `search.test.ts`
- `packages/cli/src/index.ts`, `index.test.ts`
- `packages/cli/README.md`, `apps/web/src/pages/docs/cli.astro`, `AGENTS.md`

## Data / contracts

- Request: `GET /skills/search?q=<query>` with `encodeURIComponent`. No auth.
- Response: `{ success: true, data: PublicSkillSummary[] }` in relevance order;
  parse with `publicSkillListSchema` (strip-unknown, per the tolerant-contracts
  fix), so future fields never break installed CLIs.
- Errors: 400 (`q must be 1-500 characters`), 429 (`Too many requests, slow
  down.`), 502, 503, each `{ success: false, error }`.
- Exit codes unchanged: 0 results or clean empty, 2 usage/network/contract.
- No API, schema, or database change.

## Testing

- Vitest is configured. Logic under test: the `getParsed` outcome fields (step
  1), the AI search branch's URL, ordering, filters, messages (step 2), and
  the parser (step 3). Existing tests stub `fetchImpl` with `Response` objects;
  follow that.
- Verify observed this session: `pnpm verify` passed through the pre-push hook
  on the tree that became `89a1fdb` (lint, format, typecheck, 1104 tests,
  build), and the GitHub Verify run on main at `89a1fdb` passed.
- Manual: `pnpm cli search --ai "turn a video into an article"` against the
  production API; `SKILLPASS_API=http://localhost:8787` for a local API with
  `VOYAGE_API_KEY` set, or without it to see the 503 message.

## Notes for the AI

- Keep keyword search byte-for-byte as it is; `--ai` is a branch inside
  `runSearch`, sharing validation of `--target` and `--category` and the
  renderer.
- Do not re-sort AI results; the server order is the answer.
- Run `pnpm format` before the review packet; lint and format are gates.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":6253,"specSha256":"afde4a00e03a9fe0f74aa0e66443b0c5f55298d74e56127a1c594e33e4f3e2da","branch":"refs/heads/feature/cli-search-ai","head":"89a1fdbcce04e445bf9d1bb2c2a01902ba3a833c","baseRef":"refs/heads/main","baseCommit":"89a1fdbcce04e445bf9d1bb2c2a01902ba3a833c","sourceTree":"b527f2004010aafbd11e12222dcd8d3edbcc5601","absentOptional":[]} -->

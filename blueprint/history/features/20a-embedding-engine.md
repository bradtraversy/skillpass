# Feature: Embedding engine + storage + backfill


**From build-plan:** feature 20a
**Status:** shipped

## Goal

Every published skill gets a vector embedding of its listing copy, stored in
Postgres (pgvector on Neon), generated at publish and backfillable for the 243
existing listings. This is the backend half of AI semantic search: 20b's
`GET /skills/search` endpoint just embeds a query and cosine-matches against
what this feature stores. No user-visible change ships in 20a.

## In scope

- The pgvector extension + a `skill_embeddings` table (Drizzle migration).
- A provider module calling the embeddings API over plain fetch (no SDK).
- A pure input builder assembling the text that gets embedded per skill.
- An `ensureEmbedding` hook in both publish paths (submit + curate), same
  discipline as `ensureAiReview`: optional key, cached, never blocks a publish.
- A `db:backfill-embeddings` script for existing published skills.

## Out of scope

- The search endpoint, rate limiting, and query-time embedding (20b).
- The homepage Keyword | AI toggle and all UI (20b).
- The CLI `search --ai` flag (20c).
- Re-embedding automatically when an admin edits curation copy (`displayName`)
  outside a publish - the content hash makes the next backfill run catch it;
  a `setSkillCuration` hook is deliberately deferred.

## Decisions

- **Provider: Voyage AI** (`voyage-3.5-lite`), Anthropic's recommended
  embeddings partner - ~$0.02 per million tokens, so the full backfill is under
  a cent and each publish adds a fraction of that. Plain REST via fetch,
  keyed by a new optional `VOYAGE_API_KEY` env var. OpenAI
  `text-embedding-3-small` is the drop-in alternative if Brad prefers an
  account he already has - flip it at review time; the provider module is the
  only file that would change. Needs a Voyage account + key before verify.
- **Retrieval-tuned inputs.** Voyage distinguishes `input_type: "document"`
  (stored skills) from `"query"` (searches) - the module takes it as a
  parameter so 20b reuses the same function for queries.
- **One embedding per skill, not per version.** Search matches listings, and a
  listing's copy comes from its latest published version. `skill_embeddings`
  keys on `skillId` (unique) with a `contentHash` (sha256 of model + input
  text) so unchanged copy is never re-embedded and changed copy re-embeds on
  the next publish or backfill run.
- **Vector dimension is locked in DDL.** `vector(N)` is fixed at migration
  time; N comes from the voyage-3.5-lite docs during step 2 (verify, don't
  recall). The `model` column is stored per row so a future model swap is a
  detectable migration + re-embed, not silent corruption.
- **Embedding input** - the same fields site search matches, plus the display
  copy: name, displayName, tagline, summary (HTML-stripped, like
  `metaDescription()`), category, integrations, pack member names. Capped in
  length so an oversized readme-derived summary can't blow the provider's
  token limit.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan the step, implement just that step, show the diff.
2. Review, approve, optional checkpoint commit, next step.

## Build steps

- [x] **Step 1 - provider module + input builder.** `apps/api/src/search/embeddings.ts`:
  `embedTexts(env, texts, inputType)` returning `{ success, data | error }` via
  fetch to Voyage - **batched** (array in, vectors out, chunked to the
  provider's per-request cap) so the backfill is a couple of requests instead
  of 243 rate-limited calls; single-text embedding is the one-element case.
  Plus a pure `embeddingInput(fields)` builder (strips HTML, joins fields, caps
  length). No DB, no wiring. *Done when:* `pnpm test` passes with mocked-fetch
  tests covering success, chunking over the cap, HTTP error, missing key, and
  input-builder edge cases (null copy fields, HTML summary, pack names, cap).
- [x] **Step 2 - pgvector migration + storage.** Enable the `vector` extension,
  add `skill_embeddings` (id, `skillId` unique FK, `embedding vector(N)`,
  `contentHash`, `model`, timestamps) in the Drizzle schema + generated
  migration (extension line added to the migration SQL), and a
  `upsertSkillEmbedding` / `findEmbeddingBySkill` dao. *Done when:* migration
  applies to the dev DB and `pnpm test` passes with a test on the
  contentHash-skip decision logic.
- [x] **Step 3 - publish wiring.** `ensureEmbedding(env, db, skill)` - no key
  or unchanged contentHash is a no-op, errors are logged and swallowed - called
  at the end of both publish paths, after category/display-copy/integrations
  generation so it embeds final copy. *Done when:* `pnpm test` passes with
  tests showing publish calls it, an absent key no-ops, and a publish failure
  path never throws from it.
- [x] **Step 4 - backfill script.** `db:backfill-embeddings` following the
  `backfill-ai-reviews` pattern: collect published skills needing work (missing
  or stale contentHash), embed them in batches via `embedTexts`, upsert, log a
  summary count. *Done when:* `pnpm test` passes with a test on the
  skip/refresh decision, and a dev-DB run (with a real key) reports
  embedded/skipped counts.

## Files / areas

- `apps/api/src/search/embeddings.ts` (+ test) - provider + input builder.
- `apps/api/src/db/schema.ts`, `apps/api/drizzle/00NN_*.sql` - table + extension.
- `apps/api/src/db/embeddings.ts` (+ test) - dao.
- `apps/api/src/search/ensure.ts` (+ test) or alongside the module - publish hook.
- `apps/api/src/publish/publish.ts`, `apps/api/src/seed/curate.ts` - wiring.
- `apps/api/src/seed/backfill-embeddings.ts` (+ test), `apps/api/package.json` - script.
- `apps/api/src/env.ts` - optional `VOYAGE_API_KEY`.

## Data / contracts

- **`skill_embeddings` is load-bearing for 20b** - the search endpoint reads
  `embedding` (cosine via pgvector `<=>`), joins `skillId` to published skills,
  and trusts `model` consistency. Locked here: one row per skill, vector
  dimension fixed to the chosen model, `contentHash = sha256(model + input)`.
- No public payload change - published CLIs strict-parse `GET /skills`, and
  this feature adds nothing to it (the featured-tab lesson).

## Testing

- Vitest is the declared gate; every step above is logic-bearing and ships its
  test in the same diff (provider result handling, input builder, hash-skip
  decision, publish hook no-op paths, backfill skip logic). Mock fetch and the
  DB per the existing `vi.mock` patterns; no live API calls in tests.
- Manual verify: run the backfill against the dev DB with a real key and spot
  a `skill_embeddings` row count matching published skills.

## Notes for the AI

- Mirror the `ensure*` discipline in `apps/api/src/review/ensure.ts` exactly:
  optional env key, cached, try/catch with a console.error, publishing never
  blocks. Same graceful degradation contract.
- All DB access stays in `apps/api` per the standards; nothing crosses into
  `apps/web` or the CLI in this sub-feature.
- Drizzle migration must include `CREATE EXTENSION IF NOT EXISTS vector;` -
  drizzle-kit won't generate it; add it to the generated SQL file by hand and
  confirm Neon accepts it (it supports pgvector).
- The Render deploy auto-runs migrations (`preDeployCommand`); prod embedding
  rows come from running the backfill against prod post-deploy - a separate
  approved ops step, same as the featured-tab ranks.

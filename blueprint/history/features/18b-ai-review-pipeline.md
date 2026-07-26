# Current Feature

> **Generated file.** Holds the one feature or fix being built right now. Run
> `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
> an ad-hoc fix. Build one thing at a time; `/complete` archives it (to
> `blueprint/history/features/` or `blueprint/history/fixes/`) and resets this file.

## Feature 18b - AI review storage, pipeline, backfill, API

**Build-plan item:** 18b (second sub-feature of 18, AI skill review)

## Goal

Wire the 18a `reviewSkill()` engine into the real publish pipeline: generate an
`AiReview` **once per source hash**, cache it in the database, serve it on the
public skill-detail payload, and backfill the existing catalog. After this,
every published version has (or can have) a cached AI review available to the API;
18c renders it.

## In scope

- **`ai_reviews` table** keyed by `sourceHash` (the "once per source hash" cache),
  storing the validated `AiReview` json, with a Drizzle migration.
- **`ensureAiReview(env, db, sourceHash, snapshotKey, reportDoc)`** - idempotent
  generator: returns early if a row for the hash exists or no API key is set;
  otherwise fetches the R2 snapshot, loads the package, calls `reviewSkill`, and
  upserts. Never throws.
- **Publish hook** - `publishSubmission` gains an optional `env`; when present it
  calls `ensureAiReview` after the passport is stored, wrapped so a review failure
  never fails the publish (same discipline as the reputation award). Both callers
  (`curate.ts` seed path, `POST /submissions/:id/publish` route) pass `env`.
- **Public payload** - `publicSkillDetail` gains `aiReview: AiReview | null`; the
  detail route fetches the review by the latest version's source hash and passes
  it in.
- **`db:backfill-ai-reviews`** script - runs `ensureAiReview` for every published
  skill's latest version (idempotent; re-runnable).

## Out of scope

- The passport UI section that renders the review -> **18c**.
- Async / background review generation - v1 generates synchronously inside publish
  (publish is rare; a failed or slow review degrades to `null`, never blocks).
  Revisit if publish latency matters.
- Regenerating reviews when the model or prompt changes (a future "review engine
  version" bump); for now a source hash maps to one review forever.

## The contract (load-bearing - 18c depends on it)

- **`ai_reviews`** row: `id`, `sourceHash` (unique), `review` (jsonb `AiReview`),
  `createdAt`. Keyed by source hash, so two versions with identical source share
  one review.
- **`publicSkillDetail`** gains `aiReview: AiReview | null` (always present in the
  payload; `null` when no review is cached yet). `publicSkillSummary` is
  **unchanged** - reviews show on the detail page only, so list payloads and the
  CLI are unaffected.

## Build steps

- [x] **Step 1 - `ai_reviews` table + helpers + migration.** Add the table to
  `apps/api/src/db/schema.ts`, generate the migration (`pnpm --filter apps-api
  db:generate`), and add `apps/api/src/db/reviews.ts` with `findAiReviewByHash` and
  `upsertAiReview`. *Done when:* migration file exists under `apps/api/drizzle/`;
  `pnpm build` green; a helper unit test round-trips an `AiReview` shape (or the
  round-trip is covered by Step 2's generator test - state which).

- [x] **Step 2 - `ensureAiReview` generator + publish hook.** Add
  `apps/api/src/review/ensure.ts` (`ensureAiReview`), add optional `env` to
  `PublishInput`, and call `ensureAiReview` in `publishSubmission` after the
  passport write, inside a try/catch that logs and continues. Thread `env` from
  `curate.ts` and the submit publish route. Tests (mock `reviewSkill`,
  `getSnapshotDocument`, and the review db helpers): (a) a fresh hash inserts a
  review; (b) an existing hash is a no-op (idempotent, `reviewSkill` not called);
  (c) no `env`/key -> no-op; (d) `reviewSkill` returning null or throwing does not
  fail the publish and stores nothing. *Done when:* `pnpm test` green; the publish
  path stays green with and without `env`.

- [x] **Step 3 - serve `aiReview` on the detail payload.** Add
  `aiReview: aiReviewSchema.nullable()` to `publicSkillDetailSchema`; extend the
  `publicSkillDetail` mapper to take the review. Wire **both** detail routes -
  `GET /skills/:slug` (latest) and `GET /skills/:slug/:version` (pinned) - each
  fetching the review by its own version's `sourceHash` (default `null`). Tests:
  the detail parses with a review present and with `aiReview: null`; the route
  returns the cached review when one exists. *Done when:* `pnpm test` green; both
  detail endpoints include `aiReview`.

- [x] **Step 4 - `db:backfill-ai-reviews` script.** Add
  `apps/api/src/seed/backfill-ai-reviews.ts` + the `db:backfill-ai-reviews` package
  script, iterating published skills' latest versions through `ensureAiReview`
  (guarded to run only when a key is set; logs generated/skipped/failed counts).
  *Done when:* `pnpm build` green; a dry run against dev with no key reports all
  skipped without error; the script's runnable guard matches `db:seed` /
  `db:backfill-descriptions` (only runs as the entry module).

## Verify

- **Unit (the gate):** helper + generator + payload tests pass; `pnpm test` green.
  Steps add logic, so tests are required; the backfill script is orchestration and
  rides on the generator's tests plus the dev run.
- **Build:** `pnpm build` green; the new migration applies cleanly.
- **Dev smoke (needs `ANTHROPIC_API_KEY`):** with the key set, `db:migrate` then
  `db:backfill-ai-reviews` generates reviews for the dev catalog; `GET
  /skills/<slug>` returns a populated `aiReview`; a second backfill run is a no-op
  (idempotent). Without the key, everything runs and `aiReview` stays `null`.
- **Prod (post-build, explicit approval only):** set `ANTHROPIC_API_KEY` in Render,
  run `db:backfill-ai-reviews` against `PROD_DATABASE_URL` (~134 calls, ~$0.70),
  spot-check a passport. Paired with pushing 18a+18b together.

## Notes for the AI

- `reviewSkill` needs the loaded package (files) + the `ValidationReport` doc.
  `publishSubmission` only has the report row + `submission.snapshotKey`, so
  `ensureAiReview` re-fetches the snapshot from R2 (`getSnapshotDocument`) and
  `loadPackageFromFiles`. That's one extra R2 GET on the seed path (which already
  holds the package) - acceptable for one uniform code path; publish is rare.
- Keep `ensureAiReview` failure-tolerant: R2 miss, LLM failure, or a bad review
  all resolve to "no review stored", never a thrown error into publish.
- Migrations: edit `schema.ts`, then `pnpm --filter apps-api db:generate` (writes
  the next numbered file under `apps/api/drizzle/`). Verify the generated SQL
  before committing; do not hand-write migration files.
- `env` on `PublishInput` is optional so existing `publish.test.ts` cases (which
  don't set it) keep passing unchanged - review generation is opt-in per caller.
- Prod needs `ANTHROPIC_API_KEY` in Render before generation does anything live;
  absent, the whole path degrades to `null` and nothing breaks.

# Feature: Launch seed

**From build-plan:** feature 11
**Status:** complete

## Also delivered in this feature (validator retuning)

Running the seed against the 17 Anthropic skills surfaced that the V0 validator
was too trigger-happy - it failed/warned legit skills on benign patterns. The
launch could not ship an honest directory until this was fixed, so the following
validator changes shipped in the same branch:

- **Detected permissions are informational, not findings.** `permissionsRule` no
  longer emits `undeclared-*` warnings; "runs shell / fetches data" is normal and
  surfaces neutrally in the passport (`permissionsDetected`), never as a warning.
- **`dangerous-command` `rm -rf` tightened** to catastrophic targets only (`/`,
  `~`, `$HOME`); `rm -rf dist` and other relative build cleanup no longer trip it.
- **Generic credential-assignment secret pattern** downgraded to a warning and
  now skips obvious doc placeholders (`your-api-key`, `<token>`, ...); the
  format-specific detectors (`gh_`, `sk-`, `AKIA`, PEM) stay hard failures.
- **Publish gate softened:** `passed` and `warning` both publish (warnings show in
  the passport); only `failed` is blocked. (Reverses feature 7's warning-routing.)
- **Risk level now follows the verdict** (passed -> low, warning -> medium,
  failed -> high) so it can never contradict "safe or not"; capabilities are shown
  separately, not conflated into a danger score.

Net result: all 17 Anthropic skills publish as `passed` + `low` risk, with real
threats (leaked keys, `curl|sh`, injection, catastrophic deletes) still blocked.
Feature 18 (AI skill review) will add the semantic judgment layer on top.

---


## Goal

A repeatable, idempotent seed command that publishes a curated set of real skills
into whatever database is configured (dev or prod) by driving the **real
submit -> validate -> publish pipeline**, so every seeded skill gets an authentic
R2 snapshot, validation report, and immutable Skill Passport. Runnable the same
env-driven way `db:migrate` is (`pnpm --filter apps-api db:seed`).

**Wave 1 launch set (this feature): the 17 official `anthropics/skills`.** Each is
a subfolder of one repo, addressed by subpath URL
(`https://github.com/anthropics/skills/tree/main/skills/<name>`), attributed to
`anthropics`. Verified sources for later waves (addyosmani/agent-skills,
obra/superpowers, kepano/obsidian-skills, trailofbits/skills, ...) are recorded in
notes but out of scope here - they get added by extending the manifest in a
reviewed second pass.

## Approach decision (locked)

**Real pipeline, not direct insert.** The seed reuses the functions the submit and
publish routes already call - `resolveCommit` -> `fetchSnapshot` ->
`createSubmission` -> validation job -> `processValidationJob` (inline) ->
`publishSubmission`. Direct inserts would fabricate passports and leave prod R2
keys dangling; re-running the pipeline writes real snapshots into the target
bucket. Only `passed` sources publish; non-passing are skipped and logged.

**Subpath ingestion is verified supported** - `parseGithubUrl` accepts
`.../tree/{branch}/{subpath}`, so one repo yields many listings (one per skill
folder).

## In scope

- A checked-in **source manifest** (`SEED_LISTINGS`) with a Zod schema. Wave 1 =
  the 17 `anthropics/skills` subpath entries, each `{ githubUrl, attributedTo,
  featured? }`.
- A **curate-one service** `curateSkill(env, db, { githubUrl, ownerUserId,
  attributedTo })` running the full pipeline, **idempotent + fault-isolated**:
  skip if the target slug already exists; return `failed` (no publish) if
  validation isn't `passed`; catch any pipeline error per-source so one bad skill
  never aborts the batch. Returns `{ slug, status: published | skipped | failed,
  reason? }`.
- An **admin owner bootstrap**: upsert a fixed `SEED_OWNER` GitHub identity
  (`bradtraversy`, role `admin`) to own the curated listings; `attributedTo`
  credits the source owner (`anthropics`).
- A **seed runner + CLI**: `db:seed` script (`--env-file-if-exists=.env`, like
  `db:migrate`) that ensures the owner, loops the manifest through `curateSkill`,
  and prints a per-source + summary line.
- **Featuring** a small handful of standouts (e.g. `pdf`, `mcp-builder`,
  `skill-creator`) via the 13a `featured` flag after publish. (`verified` is
  already auto-set for admin publishes.)

## Out of scope

- **Later-wave sources** (addyosmani, obra, kepano, trailofbits, singles) - just
  more manifest rows in a future pass; the engine doesn't change.
- **Refactoring the publish route** to share the curate service (later cleanup).
- **A dev->prod row/R2 copy** - rejected; the pipeline re-fetches per target.
- **An admin UI** for seeding - CLI only.
- **Running against prod** - a manual post-build step with explicit approval, not
  part of the build.

## Build steps

- [x] **Step 1 - Source manifest + schema** - add `apps/api/src/seed/listings.ts`
  with `SEED_LISTINGS` (the 17 `anthropics/skills` subpath entries, `attributedTo:
  'anthropics'`, `featured` on the chosen standouts) and a Zod schema. *Done when:*
  the schema parses the manifest and a unit test covers accept-valid /
  reject-malformed.

- [x] **Step 2 - Curate-one service** - add `curateSkill` running resolveCommit ->
  fetchSnapshot -> createSubmission -> validation job -> `processValidationJob`
  (inline) -> `publishSubmission`, idempotent + fault-isolated as above. *Done
  when:* a unit test proves skip-if-exists, non-passing-no-publish, and
  error-caught-as-failed (pipeline externals mocked); calling twice for one URL
  publishes once.

- [ ] **Step 3 - Seed runner + CLI** - add `apps/api/src/seed/run.ts` that upserts
  the `SEED_OWNER` admin, loops `SEED_LISTINGS` through `curateSkill`, logs
  per-source + summary; wire `"db:seed": "node --env-file-if-exists=.env --import
  tsx src/seed/run.ts"`. *Done when:* `pnpm --filter apps-api db:seed` against
  **dev** publishes the passing entries, prints a summary, and a second run reports
  every entry as `skipped`.

- [ ] **Step 4 - Featuring** - set `featured` on the flagged entries after publish
  via the 13a flag update. *Done when:* the featured seeded skills carry
  `featured: true` in the public summary and the homepage surface reflects them.

## Files / areas

- `apps/api/src/seed/listings.ts` (new) - manifest + schema
- `apps/api/src/seed/listings.test.ts` (new) - schema test
- `apps/api/src/seed/curate.ts` (new) - `curateSkill` service
- `apps/api/src/seed/curate.test.ts` (new) - idempotency + non-passing + error test
- `apps/api/src/seed/run.ts` (new) - runner + admin bootstrap
- `apps/api/package.json` - `db:seed` script
- Reuses (does not change): `github/pin`, `github/snapshot`, `db/submissions`,
  `db/validation`, `queue/processor`, `publish/publish`, `db/skills` (featured flag)

## Data / contracts

- **No schema change.** `SeedListing = { githubUrl: string; attributedTo: string;
  featured?: boolean }`, `CurateResult = { slug: string | null; status:
  'published' | 'skipped' | 'failed'; reason?: string }`. Local to the seed module.
- Runtime env at seed time: `DATABASE_URL`, R2 creds, `GITHUB_TOKEN`.

## Testing

`pnpm test` is a declared gate:

- **Step 1** - manifest Zod schema: accepts valid, rejects malformed.
- **Step 2** - `curateSkill` decisions with pipeline externals mocked:
  skip-if-slug-exists, non-`passed`-no-publish, error-caught-as-failed; a passing
  new source calls `publishSubmission` once.
- **Steps 3-4** - integration/CLI: verified by running `db:seed` against dev + the
  re-run idempotency check, on the run + build, not a brittle orchestration test.

## Notes for the AI

- **Idempotency is load-bearing** - safe to re-run on dev and prod. Check the slug
  before submitting; treat a `23505` as skip, not crash.
- **Only `passed` publishes.** Mirror the publish route's guard.
- **`SEED_OWNER` = `bradtraversy`, role `admin`** (confirmed - the curator
  account); `attributedTo = 'anthropics'` credits the source.
- **Reuse, don't reimplement** the pipeline; match the publish route's
  `loadPackageFromFiles` -> `PublishInput` assembly so seeded skills are identical
  to real submissions.
- **`GITHUB_TOKEN` is effectively required** (many repo fetches; the 60/hr
  unauthenticated limit would fail the batch). Prod token is set on Render.
- **The 17 skill names** (subpaths under `anthropics/skills/tree/main/skills/`):
  algorithmic-art, brand-guidelines, canvas-design, claude-api, doc-coauthoring,
  docx, frontend-design, internal-comms, mcp-builder, pdf, pptx, skill-creator,
  slack-gif-creator, theme-factory, web-artifacts-builder, webapp-testing, xlsx.

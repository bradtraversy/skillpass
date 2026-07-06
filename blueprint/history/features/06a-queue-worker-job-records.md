# Feature: Queue, worker, and job records

**From build-plan:** feature 6a
**Status:** complete

## Goal

Connect the validator (feature 4) to real submissions: every new draft gets a
queued validation job, a worker validates the R2 snapshot, stores the report,
and the submission's status finally moves - `draft -> validating -> passed /
warning / failed`. After this, the product thesis runs end to end on the
backend; 6b makes it visible in the UI.

## Prerequisite (decide before step 4)

A Redis instance for BullMQ. Nothing is installed on this machine (no
`redis-server`, no Docker); `apt install redis-server` for dev (localhost:6379).
Production provider is an open deploy-time decision - candidates are Upstash
(proven with BullMQ on Vidpipe, but per-command pricing meets BullMQ's idle
polling) vs Redis colocated with wherever the API/worker is hosted. Keep the
code provider-neutral: everything through `REDIS_URL`, connection options that
work for both (notably `maxRetriesPerRequest: null`, TLS-capable).

## In scope

- **Validator in-memory validation**: `validateLoadedPackage(pkg, opts)`
  exported from `packages/validator` (the fs `validatePackage` becomes a
  wrapper), plus stepwise access so the worker can report per-rule progress.
- **R2 reads**: `getJson` in `storage/r2.ts` (deferred from 5b - this is the
  first consumer) with a Zod parse of the snapshot document on the way in.
- **Tables**: `validation_jobs` (state, progress step rows, bullJobId, error,
  timestamps) and `validation_reports` (status, riskLevel, sourceHash,
  engineVersion, full report as jsonb), both FK'd to submissions.
- **Queue module**: BullMQ queue + typed enqueue helper, `REDIS_URL` env
  (required), job payload is `{ submissionId }` only - the worker re-reads
  everything from the DB so payloads can't go stale.
- **Enqueue on create**: both submission routes insert a job row and enqueue
  after the draft lands. A Redis outage must not fail the submission: the
  draft still returns 201 and the job row records the error.
- **The worker**: separate entry (`apps/api/src/worker.ts`, `pnpm dev:worker`
  root script, AGENTS.md updated) processing jobs: mark running + submission
  `validating` -> fetch snapshot from R2 -> run rules stepwise, updating the
  job's progress rows -> store the report -> set submission status from the
  report -> mark job done. Terminal worker errors (after BullMQ retries) set
  job `error` and put the submission back to `draft` so it can be retried.

## Out of scope

- The job-status API endpoint and the /submit progress panel (feature 6b).
- Publishing, passports, and normalized Warning/Failure tables - the report
  jsonb carries findings until feature 7 needs them relational.
- Re-validation of old drafts, scheduled re-scans, admin requeue (feature 10).
- Production Redis provisioning.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - validator in-memory validation** - refactor `validate.ts`:
  export `validateLoadedPackage(pkg, opts)` and a `RULES`-driven stepwise path
  (`runRule(rule, pkg)` or equivalent) so callers can observe per-rule
  progress; `validatePackage(dir)` delegates unchanged. *Done when:* a test
  proves dir-load and in-memory validation of the same files produce identical
  reports (minus timestamps), and all existing validator tests stay green.
- [x] **Step 2 - R2 getJson + snapshot parse** - `getJson(env, key)` beside
  `putJson`, plus `snapshotDocumentSchema` (Zod) so a fetched snapshot is
  validated before the worker trusts it. *Done when:* tests cover a signed GET,
  a 404, a non-JSON body, and a shape mismatch, all mapped to `Result`.
- [x] **Step 3 - job + report tables** - Drizzle schema + migration:
  `validation_jobs` (id, submissionId FK, state enum `queued|running|done|error`,
  progress jsonb, bullJobId, error text, startedAt/finishedAt, createdAt) and
  `validation_reports` (id, submissionId FK, status, riskLevel, sourceHash,
  engineVersion, report jsonb, createdAt). *Done when:* migration applied to
  the Neon dev branch; typecheck green.
- [x] **Step 4 - env + queue module** - `REDIS_URL` (required) in env +
  `.env.example`; `apps/api/src/queue/` with the BullMQ queue, a typed
  `enqueueValidation(submissionId)`, and shared connection options. Deps:
  `bullmq`, `ioredis`. *Done when:* env tests cover the new key; queue module
  unit tests (mocked bullmq) cover the enqueue call shape.
- [x] **Step 5 - enqueue on create** - both `POST /submissions` routes create a
  `queued` job row and enqueue after the insert; a failed enqueue marks the job
  row `error` but the response stays 201 with the draft. *Done when:* route
  tests cover happy enqueue and Redis-down degradation for both routes.
- [x] **Step 6 - the worker** - `src/worker.ts` + processor module: the full
  pipeline with progress-row updates after each rule, report storage, status
  transitions, and terminal-failure handling (job `error`, submission back to
  `draft`). Processor is a plain function unit-tested with mocked R2/db; the
  BullMQ shell around it stays thin. *Done when:* processor tests cover pass,
  warning, failed, missing snapshot, and R2-down paths; typecheck green.
- [x] **Step 7 - live smoke** - Redis running locally, worker up via
  `pnpm dev:worker`, submit a real skill and a real non-skill through the API,
  and watch both land: reports stored, submission statuses flipped
  (`passed`/`failed`), job rows `done` with full progress trails. *Done when:*
  the DB shows both terminal states and AGENTS.md documents the worker command.

## Files / areas

- `packages/validator/src/validate.ts` (+ test) - in-memory + stepwise API.
- `apps/api/src/storage/r2.ts` (+ test) - `getJson`, snapshot schema.
- `apps/api/src/db/schema.ts`, `drizzle/` - two new tables.
- `apps/api/src/db/validation.ts` (new, + test) - job/report data access.
- `apps/api/src/queue/` (new, + test) - queue + connection.
- `apps/api/src/worker.ts` + `apps/api/src/queue/processor.ts` (new, + test).
- `apps/api/src/routes/submissions.ts` (+ test) - enqueue wiring.
- `apps/api/src/env.ts`, `.env.example`, root `package.json`, `AGENTS.md`.

## Data / contracts

- **Progress step rows (load-bearing - 6b renders them):**
  `{ key: string, label: string, state: 'pending' | 'running' | 'ok' | 'warn' | 'fail' }[]`
  stored on `validation_jobs.progress`, updated as the worker moves.
- **Job states:** `queued | running | done | error` (per the overview model).
- **Report storage:** the full feature-4 `ValidationReport` as jsonb plus
  denormalized `status`/`riskLevel`/`sourceHash` columns for querying; the
  report's `sourceHash` must equal the submission's (hash-parity by
  construction, again).
- **Status mapping:** report `passed|warning|failed` writes straight onto
  `submissions.status`; those values already exist in the enum from 5b.
- **Queue payload:** `{ submissionId: number }`, queue name
  `validate-submission`.

## Testing

- Logic ships tests per step: validator refactor parity, getJson mapping,
  enqueue degradation, and the processor's five outcome paths (mock R2, db,
  and the queue - never require live Redis in unit tests).
- Step 7 is the integration evidence: live Redis + worker + two real
  submissions reaching opposite terminal states.

## Notes for the AI

- The worker must be resilient to junk: the snapshot Zod parse and the
  validator's own malformed-manifest handling are the guards; a worker crash
  on any single job must never take the process down (BullMQ handles retries;
  cap attempts ~3 with backoff).
- Retries must be idempotent: one report per submission - the processor
  replaces (upserts) any existing report for that submission rather than
  inserting a duplicate, and progress rows reset at the start of each attempt.
- Scope every job/report row by submission; 6b's endpoint will be owner-scoped
  like the submission reads, so nothing here should assume public access.
- Reports are NOT public yet - no route exposes them in 6a; secret snippets
  are already redacted by the validator, but the publish gate is feature 7.
- Reuse the DI patterns: processor takes `(env, db, deps)` so tests inject
  fakes; the BullMQ wiring stays in the thin shell.
- `ioredis` connection: BullMQ needs `maxRetriesPerRequest: null` on the
  connection - set it in one shared place.
- Follow the `..env` rule: `REDIS_URL` goes in `apps/api/.env` only.

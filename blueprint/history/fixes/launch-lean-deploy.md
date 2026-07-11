# Fix: Launch-lean deploy - inline validation mode + trimmed render.yaml

**Type:** Fix

## The problem

The committed `render.yaml` runs **four services** - static site, API, worker, and
a Key Value (Redis) store. Three of those exist only to run validation
*asynchronously at scale*: the worker is a separate process, and Redis backs the
BullMQ queue that feeds it. At launch (low volume, especially curated-only
submissions) that is expensive, over-provisioned infrastructure for a queue that
processes a handful of jobs.

The validator is a fast, in-process function. At launch we can run it **inline**
in the API request and drop the worker + Redis entirely - taking the hosting
footprint from four services to two (static + API), with Neon and R2 on their free
tiers. **Validation itself is unchanged** - same rules, same passport, same
pass/fail. Only *where* it runs changes, and the queue code stays in the repo,
dormant, for the day real submission volume needs it.

## The fix

Add a `VALIDATION_MODE` switch (`inline` | `queue`), default `inline`:

- **inline** (launch): on submit, create the job row and run `processValidationJob`
  in-process. No Redis, no worker.
- **queue** (later): today's behavior - enqueue to BullMQ, the worker validates.

The reusable `processValidationJob(env, db, submissionId)` is exactly what the
worker already calls, so inline mode reuses it verbatim. Because it still creates
and completes a `validation_jobs` row, the existing `/submissions/:id/validation`
polling endpoint and the submit-page progress panel keep working with **no
frontend change** - the job is simply already done (or completing in-process) when
the panel polls.

Then trim `render.yaml` to static + API.

**Must not break:** queue mode stays fully intact and default-off, not deleted -
`worker.ts`, `queue/*`, and the BullMQ path remain so a single env var + two
re-added services bring async validation back at scale.

## Build steps

- [x] **Step 1 - `VALIDATION_MODE` env + conditional Redis.** In `apps/api/src/env.ts`
  add `VALIDATION_MODE: z.enum(['queue', 'inline']).default('inline')`, make
  `REDIS_URL` optional, and `superRefine` so `queue` mode requires `REDIS_URL`
  (inline does not). Set `VALIDATION_MODE: 'queue'` in `testing/env.ts` so existing
  queue-mode tests are unaffected. *Done when:* `pnpm test` green; loading env in
  `queue` mode without `REDIS_URL` fails, `inline` without `REDIS_URL` succeeds
  (unit tests for both).

- [x] **Step 2 - Inline validation path.** In `routes/submissions.ts`, branch
  `queueValidation` on `env.VALIDATION_MODE`: `queue` keeps the enqueue path;
  `inline` creates the job row then runs `processValidationJob(env, db, id)`
  in-process (fire-and-forget with `.catch` logging, mirroring the current
  best-effort behavior, so a validation error never fails the 201). In `index.ts`
  build the BullMQ queue only in `queue` mode and pass `null` otherwise; widen
  `createApp`/`submissionRoutes` to accept `ValidationQueue | null` (the queue is
  only touched in queue mode). *Done when:* `pnpm test` green; an inline-mode
  submission runs `processValidationJob` (not `enqueueValidation`) and its
  `/validation` response carries the finished report; queue-mode tests unchanged.

- [x] **Step 3 - Trim `render.yaml`.** Remove the `worker` and `keyvalue` services,
  drop `REDIS_URL` from the API service, add `VALIDATION_MODE: inline` to the API.
  Leave `worker.ts` and `queue/*` in the repo. *Done when:* `render.yaml` declares
  exactly two services (static web + API), references no Redis, and is valid YAML.
  (Config only - no deploy.)

## Verify

- **Unit (the gate):** env tests (queue requires `REDIS_URL`, inline does not) and
  submission-flow tests (inline runs the processor, queue enqueues). `pnpm test`
  green.
- **End to end, local, no Redis:** run the API with `VALIDATION_MODE=inline` and no
  `REDIS_URL`, **no worker and no `redis-server` running** (restart the API - it
  doesn't hot-reload, see [[api-dev-server-no-hot-reload]]). Submit a skill; it
  validates in-process, the progress panel resolves, and the passport is produced -
  proving the worker + Redis are unnecessary in this mode.
- **Config:** `render.yaml` shows two services; the queue code is still present in
  the repo (dormant).

## Notes

- No product change and no data-model change - this is deploy topology + one code
  branch. The passport, rules, and "never blindly trust" promise are identical.
- `processValidationJob` already updates progress and marks the job done, so the
  inline path needs no new job/reporting logic and the existing polling UI is
  untouched.
- Inline fire-and-forget means a process restart mid-validation could leave a job
  `running` (the queue had retries for this). Acceptable at launch scale and
  re-submittable; queue mode restores retry semantics when turned back on.
- Deploying the API to an edge/serverless host later (Hono runs on Cloudflare
  Workers) is a further cost lever but out of scope here; this fix just removes the
  worker + Redis requirement.
- Parked: the **infer-manifest** fix spec is saved in the session scratchpad
  (`parked-infer-manifest-spec.md`) and will return to `current-feature.md` after
  this one merges.

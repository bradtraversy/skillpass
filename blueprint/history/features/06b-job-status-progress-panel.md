# Feature: Job-status API and validation progress panel

**From build-plan:** feature 6b
**Status:** complete

## Goal

Make 6a's validation run visible: an owner-scoped endpoint that reports a
submission's job progress, and the inline panel on `/submit` that polls it -
step rows ending in a check, warning, or x - so a submitter watches their
draft move `draft -> validating -> passed/warning/failed` without opening the
database. This closes feature 6.

## In scope

- **Shared wire contract** (`packages/skill-schema/src/validation.ts`):
  `PROGRESS_STEP_STATES`, `ProgressStep`, `VALIDATION_JOB_STATES`,
  `ValidationJobState`, and `PublicValidation` (+ Zod schema). The API's
  `db/schema.ts` re-derives its types from these so DB and wire cannot drift
  (same pattern as the submission enums).
- **Endpoint**: `GET /submissions/:id/validation` on the existing authed
  submissions router. Owner-scoped exactly like the other submission reads
  (scope by user id in the query; another user's id and a nonexistent id are
  the same 404). Returns the latest job's state + progress rows + error, the
  submission's current status, and - when a report exists - a
  `{ status, riskLevel }` summary only. Findings stay unexposed until
  feature 7's publish gate.
- **Panel**: after a successful submit, the result card polls the endpoint
  every 2s and renders the progress rows (pending dot / running spinner /
  ok check / warn triangle / fail x, inline SVGs per existing convention),
  ending in a final status line. Polling stops on job `done`/`error`, and
  gives up after 60 attempts (2 min) with a "still running - check back
  later" line so it never polls forever.
- **API client**: `getValidation(id)` in `apps/web/src/lib/api.ts`.

## Out of scope

- Rendering report findings/warnings to the owner (feature 7 decides what
  failed submissions show; the panel shows only status + risk).
- A submissions list / dashboard to revisit past runs (feature 10); reloading
  `/submit` mid-run loses the panel, and that's fine for now.
- Re-running validation, admin requeue (feature 10).
- WebSockets/SSE - polling a 2s interval is plenty at this scale.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.

Never accept a step you haven't read. If a diff is too big to review, the step
was too big, so split it.

## Build steps

- [x] **Step 1 - shared validation wire contract** - new
  `packages/skill-schema/src/validation.ts`: the two state enums,
  `ProgressStep`, `PublicValidation` `{ job: { state, progress, error } | null,
  submissionStatus, report: { status, riskLevel } | null }`, a
  `publicValidationSchema` (Zod), exported from the package index;
  `apps/api/src/db/schema.ts` re-derives `ProgressStep`/state types from it
  (drizzle generate confirms no migration). *Done when:* a schema parse test
  covers a running job, a null job, and a done-with-report payload; all
  existing tests and both typechecks stay green.
- [x] **Step 2 - owner-scoped validation endpoint** -
  `GET /submissions/:id/validation`: `findSubmissionForUser` (404 on miss, no
  existence leak), `findValidationJobForSubmission`, a new
  `findValidationReportForSubmission` in `db/validation.ts`, mapped into
  `PublicValidation`. *Done when:* route tests cover 401 unauthenticated,
  404 for another user's submission, a running job with progress rows, a
  missing job row (`job: null`), and done-with-report including the
  status/risk summary - and assert findings never appear in the payload.
- [x] **Step 3 - polling progress panel** - `ValidationProgress.tsx` island
  component used inside `SubmitForm`'s success card, `getValidation` in
  `lib/api.ts`: poll every 2s while `queued`/`running` (cleanup on unmount,
  reset on re-submit), stop on `done`/`error`, cap at 60 polls with a
  check-back-later line; a transient failed poll keeps the last rendered rows
  and counts toward the cap, 5 consecutive failures stop with "can't reach the
  API"; rows render the five step states as inline SVGs; a final line shows
  passed/warning/failed (+ risk) or the job error; the result card's stale
  "validation runs in an upcoming release" sentence is replaced by the panel.
  *Done when:* submitting a clean zip through the running app shows rows flipping
  pending -> running -> ok and ends "passed"; a prompt-injected zip ends with
  an x row and "failed"; proven via `/check`-style screenshots (UI step - no
  unit tests, build + screenshots are the evidence).

## Files / areas

- `packages/skill-schema/src/validation.ts` (+ test, new) - wire contract.
- `packages/skill-schema/src/index.ts` - export it.
- `apps/api/src/db/schema.ts` - derive the local types from skill-schema.
- `apps/api/src/db/validation.ts` (+ test coverage via routes) - report read.
- `apps/api/src/routes/submissions.ts` (+ test) - the GET route.
- `apps/web/src/lib/api.ts` - `getValidation`.
- `apps/web/src/components/submit/ValidationProgress.tsx` (new) +
  `SubmitForm.tsx` - the panel.

## Data / contracts

- **`PublicValidation` is load-bearing** - feature 10's dashboard and any
  future admin queue reuse it:
  `{ job: { state: 'queued'|'running'|'done'|'error', progress: ProgressStep[],
  error: string | null } | null, submissionStatus: SubmissionStatus,
  report: { status: ValidationStatus, riskLevel: RiskLevel } | null }`
- `ProgressStep` stays `{ key, label, state }` exactly as 6a stores it -
  the endpoint returns the stored rows untouched.
- Timestamps (`startedAt`/`finishedAt`) deliberately left off the wire until
  something renders them.
- Route shape: nested under `/submissions/:id/` so it inherits `requireAuth`
  and the island can use the draft id it already holds (the bull job id never
  leaves the API).

## Testing

- Logic gates: the Zod contract test (step 1) and the route tests (step 2) -
  mocked db modules, same style as the existing submissions route tests.
- Step 3 is UI: build + screenshots of a live passed run and a live failed
  run; the worker and Redis are already running locally.

## Notes for the AI

- Reports stay private-by-default: the endpoint maps the report row to
  `{ status, riskLevel }` only - never spread the jsonb report into the
  response, and the tests should assert its absence.
- An enqueue-failure job row (`state: 'error'`, submission still `draft`)
  is a normal payload: the panel should show the error line and not spin.
- Poll with `setTimeout` chaining (not `setInterval`) so a slow response
  can't stack requests; clear on unmount and on mode switch/resubmit.
- The `progress` jsonb defaults to `[]` for a queued job that hasn't started -
  the panel shows a single "Queued..." placeholder row until rows arrive.
- Follow the DI + module-mock test patterns already in
  `routes/submissions.test.ts`; no live Redis/DB in unit tests.

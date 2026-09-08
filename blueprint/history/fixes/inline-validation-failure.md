# Current Feature

> **Generated file.** Holds the one feature or fix being built right now. Run
> `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
> an ad-hoc fix. Build one thing at a time; `/complete` archives it (to
> `blueprint/history/features/` or `blueprint/history/fixes/`) and resets this file.

## Inline validation errors strand submissions at `validating`

**Type:** Fix

### The problem

`startValidation` in `apps/api/src/routes/submissions.ts` runs the validator
fire-and-forget in inline mode (the production setting, `VALIDATION_MODE=inline`
in `render.yaml`). Its only failure handling is:

```ts
void processValidationJob(env, db, submissionId).catch((err) =>
	console.error('inline validation failed', err),
);
```

`processValidationJob` marks the job `running` and the submission `validating`
before it does any work, then throws on retryable errors (a non-missing R2
failure, any DB error after that point). In queue mode `worker.ts` catches the
terminal failure and calls `handleValidationFailure`, which records the error on
the job and puts the submission back to `draft`. Inline mode never does, so:

- the job row stays `running` forever,
- the submission stays `validating`,
- `POST /submissions/:id/publish` answers 409 "validation is still running"
  indefinitely,
- there is no re-validate route, so the only recovery is a database edit.

The inline error path has no test. `submissions.test.ts` only exercises a
resolved `processValidationJob` in inline mode.

### The fix

Route the inline rejection through the same terminal handler the worker uses:

```ts
void processValidationJob(env, db, submissionId).catch((err) => {
	console.error('inline validation failed', err);
	return handleValidationFailure(db, submissionId, errorMessage(err));
});
```

`handleValidationFailure` already exists in `apps/api/src/queue/processor.ts`
and is exported. If it throws in turn (the DB is down), log that too rather than
surfacing an unhandled rejection.

Must not break:

- The submission `POST` still returns 201 before validation finishes
  (fire-and-forget stays).
- Queue mode is untouched.
- The panel behaviour: a job in `error` state already renders the "check back
  later" copy and the submission is back to `draft`, so a resubmit works.

### Build steps

- [x] **Step 1 - handle the inline rejection.** In `startValidation`, chain
  `handleValidationFailure(db, submissionId, message)` onto the inline
  `.catch`, guarding its own failure with a second log. Add a route test in
  `submissions.test.ts` beside "inline mode validates in-process and never
  enqueues": mock `processValidationJob` to reject, `POST /submissions` on
  `inlineApp`, assert 201, then flush the microtask queue and assert
  `handleValidationFailure` (or its effects: `markValidationJobError` with the
  error message and `setSubmissionStatus(..., 'draft')`) was called for
  submission 1.
  **Done when:** `pnpm test` is green with the new case, and the existing
  inline test still asserts `enqueueValidation` was never called.

### Verify

- `pnpm test` passes (960 tests, one new).
- `pnpm typecheck` passes.
- Manual, optional: with `VALIDATION_MODE=inline` and `R2_BUCKET` pointed at a
  bucket the key cannot read, submit a GitHub URL; the panel ends in the error
  state and `GET /submissions/:id` reports `status: "draft"` instead of
  `validating`.

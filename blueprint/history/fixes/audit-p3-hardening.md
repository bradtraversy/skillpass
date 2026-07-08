# Fix: Audit P3 hardening - version uniqueness + status-aware API failures

**Type:** Fix
**Status:** complete

## Problem

Two accepted findings from the feature-7 audit:

1. Version numbering is only code-enforced: two concurrent re-publishes of the
   same skill can both compute the same next version and insert duplicate
   `(skill_id, version)` rows - nothing in the DB forbids it.
2. The detail island detects not-found by matching the API's error copy
   (`res.error === 'not found'`); rewording the message would misrender
   unknown skills as an API outage, and feature 8 would copy the pattern.

## Fix

1. Composite unique constraint on `skill_versions (skill_id, version)`
   (migration 0005). The publish route's 23505 handler gains a branch mapping
   this constraint to a retryable 409 ("publish conflict; try again") - unlike
   the submissionId conflict, a retry here succeeds.
2. `request()` in `apps/web/src/lib/api.ts` returns failures with the HTTP
   `status` attached (`ApiResult<T>`); `SkillDetail` branches on
   `status === 404` instead of the message string.

## Build steps

- [x] **Step 1 - composite unique** - schema constraint + migration applied to
  Neon dev; publish-route 23505 branch + test for the new constraint name.
  *Done when:* migration applied, no drizzle drift, route test green.
- [x] **Step 2 - status-aware failures** - `ApiResult` with `status` on
  failures, island branches on 404. *Done when:* api client tests cover the
  status passthrough, island uses status, suite + build green.

## Files

- `apps/api/src/db/schema.ts`, `drizzle/0005_*`,
  `src/routes/submissions.ts` (+ test).
- `apps/web/src/lib/api.ts` (+ test),
  `src/components/skill/SkillDetail.tsx`.

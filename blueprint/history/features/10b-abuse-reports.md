# Feature: Abuse reports

**From build-plan:** feature 10b
**Status:** complete

## Goal

Anyone signed in can flag a listing they believe is malicious or misrepresented:
a report button on the skill page opens an inline form, the API stores the
report against the skill with an `open` status, and the reporter gets a visible
confirmation. This feeds 10c's admin holding queue (review/action states and
reputation consequences live there).

## In scope

- **`abuse_reports` table** (migration 0008, per the overview's AbuseReport
  model): id, skillId FK, reporterId FK -> users, reason text, status enum
  `open | reviewed | actioned` (default `open`), createdAt. Skill-level, not
  version-level - reports are about the listing.
- **Wire contracts** in `packages/skill-schema/src/abuse.ts`:
  - `abuseReportInputSchema` - `{ reason: string }`, trimmed, 10-1000 chars;
    the API validates with it and the form mirrors the limits.
  - `publicAbuseReportSchema` - `{ status, createdAt }` - the reporter's
    confirmation; no ids, no reporter echo.
- **`POST /skills/:slug/report`** (in `routes/skills.ts`, `requireAuth` on
  this route only - the router stays otherwise anonymous):
  - 401 anonymous, 404 unknown/unpublished slug, 400 invalid reason (zod
    message in the envelope), 409 when the same reporter already has an
    `open` report on this skill ("you already have an open report for this
    skill"), 201 + `PublicAbuseReport` on success.
  - Dupe guard is check-then-insert; a race would only produce a second row
    for the same reporter, which is harmless noise for the admin queue - not
    worth a partial unique index.
- **Web report flow** (inside the `SkillDetail` island):
  - A quiet "Report this skill" link under the maintainer section opens an
    inline `ReportPanel` (same expanding-panel pattern as pre-flight).
  - Panel checks the session (`getMe`): signed out -> "sign in with GitHub to
    report" linking to `signInUrl()`; signed in -> textarea (with the 10-1000
    guidance), submit, error line on 400/409 (server message), success state
    ("Report received - an admin will review it") on 201.
  - `reportSkill(slug, reason)` in `lib/api.ts`.

## Out of scope

- Admin queue, review/action state changes, reputation consequences
  (`report_actioned` stays unwired) - all 10c.
- Reporting a specific version, evidence URLs / categories (reason text is
  enough for v1).
- Email/notifications to admins (holding queue is the surface, 10c).
- Rate limiting beyond the one-open-report-per-skill guard (feature 10c/abuse
  hardening if volume ever demands it).

## Build steps

- [x] **Step 1 - table + contracts** - migration 0008, `db/schema.ts` table,
  `skill-schema/src/abuse.ts` (+ index export), `db/abuse.ts` with
  `createAbuseReport` + `findOpenReportBySkillAndReporter` (thin Drizzle
  wrappers, covered through step 2's route tests per repo pattern). *Done
  when:* schema tests cover reason trim/min/max and confirmation-shape
  strictness; migration applied to Neon dev, no drift; suite green.
- [x] **Step 2 - report endpoint** - the authed route with all five outcomes.
  *Done when:* route tests cover 401 anon, 404 unpublished, 400 short/long
  reason, 409 duplicate open report, 201 parsing with the locked contract,
  and no-leak (reporterId, skillId, internal ids off the wire); suite green.
- [x] **Step 3 - report panel** - `ReportPanel.tsx`, the link under the
  maintainer block, `reportSkill` helper. *Done when:* build green;
  headless-Chrome evidence (session cookie injected, same technique as 6b)
  shows the signed-in flow submitting a real report against the live API
  with the success state rendered, plus the signed-out prompt without a
  cookie; the DB shows the `open` row.

## Files / areas

- `apps/api/drizzle/0008_*`, `src/db/schema.ts`, `src/db/abuse.ts` (new),
  `src/routes/skills.ts` (+tests).
- `packages/skill-schema/src/abuse.ts` (+test, new), `src/index.ts`.
- `apps/web/src/components/skill/ReportPanel.tsx` (new),
  `components/skill/SkillDetail.tsx`, `lib/api.ts`.

## Data / contracts

- **Reports are append-only from the public side**: reporters create them;
  only 10c's admin actions change `status`. No public read endpoint exists -
  reports never render publicly.
- **The confirmation leaks nothing**: `{ status, createdAt }` only.
- `report_actioned` reputation stays dormant until 10c wires the admin
  action.

## Testing

- Steps 1-2 are logic: schema tests + mocked-db route tests in the same
  diffs.
- Step 3 is UI: rides on build + headless-Chrome evidence with a real
  signed-in submit.

## Notes for the AI

- Register `POST /:slug/report` before the `GET /:slug` param routes is not
  needed (different method), but keep it grouped with the other specific
  routes for readability.
- `requireAuth` is per-route middleware here: `routes.post('/:slug/report',
  requireAuth(env, db), handler)` - the rest of the router must stay
  cookie-free.
- Reuse `findPublishedSkillBySlug` for the 404 gate - reports only exist for
  published listings.
- Session cookie for the evidence run: mint it with hono's `setSignedCookie`
  against the dev `SESSION_SECRET` (same trick as the route tests / 6b),
  inject via CDP `Network.setCookie` for localhost.
- Keep the panel's textarea uncontrolled-ish and simple - plain useState,
  disable submit while in flight, no libraries.

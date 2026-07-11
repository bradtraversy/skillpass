# Feature: Admin queue + review states (10c)

**From build-plan:** feature 10c
**Status:** built - all 6 steps done, ready for /complete

## Goal

Give admins a working holding queue and the manual review actions that close the
loop opened by 10a/10b. An admin-only `/admin` page surfaces open abuse reports,
failed submissions, and flagged skills; from it an admin can resolve a report
(dismiss, or uphold it and dock the maintainer's reputation), flag or unflag a
skill (which hides or restores it from the public directory), and read a skill's
full validation history. This is the last piece of feature 10 and the first time
the dormant `report_actioned` reputation weight actually fires.

## Design reference

No visual target - the admin surface is a plain, dense utility page reusing the
existing type/spacing tokens (mirror `Profile.tsx` / `Row.tsx`). No mockup needed.

## In scope

- `requireRole('admin')` gate (composes with the existing `requireAuth`).
- Admin API mounted at `/admin`, all routes admin-gated:
  - `GET /admin/queue` - open abuse reports, failed submissions, flagged skills.
  - `POST /admin/reports/:id/resolve` - `{ status: 'reviewed' | 'actioned' }`;
    actioning docks the skill maintainer's reputation once.
  - `POST /admin/skills/:slug/flag` and `.../unflag` - published <-> flagged.
  - `GET /admin/skills/:slug/history` - every version's validation verdict + findings.
- `packages/skill-schema/src/admin.ts` - admin-facing types and the resolve input schema.
- `/admin` page: a client-gated island that renders the queue and wires the actions.

## Out of scope

- **No new migration.** 10a/10b already shipped every column 10c needs: the
  `flagged` skill status, the `open|reviewed|actioned` abuse status, and the
  `report_actioned` reputation type. 10c is pure logic over the existing schema.
- Exposing `role` on `/me` or adding an "Admin" nav link - the page self-gates on
  the API's 403, so this isn't needed. (Deferred; note below.)
- Auto-flagging a skill when its report is actioned - flag and resolve stay
  independent actions the admin composes deliberately.
- Email/notification to the maintainer on action - not in v1.
- Reputation weight tuning - the v1 `-25` placeholder stands (tuning is its own pre-launch task).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.

Never accept a step you haven't read. If a diff is too big to review, split it.

## Build steps

- [x] **Step 1 - Admin gate + queue read endpoint.** Add `requireRole(role)` to
  `auth/middleware.ts` (reads the `user` set by `requireAuth`, 403s a non-match).
  Add `packages/skill-schema/src/admin.ts` with `AdminAbuseReport`,
  `AdminSubmission`, `AdminSkillRef`, and `AdminQueue` types (+ `resolveReportInputSchema`
  for step 2), exported from `index.ts`. Add db helpers `listOpenAbuseReports`
  (join skill + reporter), `listFailedSubmissions` (join user + report findings),
  `listFlaggedSkills`. Add `adminRoutes(env, db)` mounted at `/admin` behind
  `requireAuth` + `requireRole('admin')`, with `GET /admin/queue` returning
  `{ reports, failedSubmissions, flaggedSkills }`. *Done when:* `pnpm test` green;
  as an admin `GET /admin/queue` returns the seeded open report (abuse_reports row 1)
  and any failed submissions; a signed-in non-admin gets 403; anon gets 401.
  *(Largest step - if the diff runs big at implement time, land the middleware +
  schema types + gated `GET /admin/queue` returning empty lists first, then wire
  the three db helpers as a second commit.)*

- [x] **Step 2 - Resolve reports + reputation consequence.** `POST /admin/reports/:id/resolve`
  with `resolveReportInputSchema` (`{ status: 'reviewed' | 'actioned' }`). Add
  `findAbuseReportById` and `setAbuseReportStatus` to `db/abuse.ts`. Only an `open`
  report resolves (409 otherwise) so reputation can never be docked twice. On
  `actioned`, call `awardReputation(skill.maintainerId, 'report_actioned')`; on
  `reviewed`, no reputation change. Return the updated `AdminAbuseReport`.
  *Done when:* `pnpm test` green; actioning report id 1 sets it `actioned` and
  drops the maintainer's reputation by exactly 25; reviewing sets `reviewed` with
  no change; re-resolving a non-open report 409s; non-admin 403.

- [x] **Step 3 - Flag / unflag a skill.** `POST /admin/skills/:slug/flag`
  (`published` -> `flagged`, 409 otherwise) and `POST /admin/skills/:slug/unflag`
  (`flagged` -> `published`). Add `setSkillStatus` to `db/skills.ts`; look the
  skill up with `findSkillBySlug` (not the published-only helper). *Done when:*
  `pnpm test` green; flagging a published skill makes its public detail 404 and
  drops it from `GET /skills`; unflagging restores both; illegal transitions 409;
  non-admin 403.

- [x] **Step 4 - Per-skill validation history.** `GET /admin/skills/:slug/history`
  -> newest-first list of every version joined to its submission's validation
  report: `{ version, publishedAt, validationStatus, riskLevel, warnings, failures,
  sourceHash, resolvedCommitSha }`. Add `listSkillValidationHistory(skillId)` to
  `db/skills.ts` (versions -> submissions -> reports). *Done when:* `pnpm test`
  green; history for a multi-version skill lists each version's verdict and
  findings, newest first; non-admin 403; unknown slug 404.

- [x] **Step 5 - `/admin` page: gated read-only view.** `apps/web/src/pages/admin.astro`
  + `components/admin/AdminDashboard.tsx` (`client:load`). Add `getAdminQueue` and
  `getSkillHistory` to `lib/api.ts`. The island fetches the queue: 401 -> sign-in
  link, 403 -> "You do not have admin access", error -> API-unreachable copy, 200 ->
  render three sections (open reports with skill/reporter/reason/date; failed
  submissions with user + failure findings; flagged skills). Each section shows an
  empty state when its list is empty (mirror `Profile.tsx`'s "Nothing published
  yet."). Each skill row (reported or flagged) has an expandable "validation
  history" panel that lazy-fetches `getSkillHistory`. Reuse existing type tokens.
  *Done when:* build passes; screenshots show the queue rendering the seeded open
  report and an expanded history panel as an admin, the empty-queue state, and the
  "no admin access" state for a non-admin.

- [x] **Step 6 - Wire admin actions into the dashboard.** Add `resolveReport`,
  `flagSkill`, `unflagSkill` to `lib/api.ts`. Each report row gets Dismiss
  (`reviewed`) and Uphold (`actioned`) buttons; each flagged skill gets Unflag;
  add a Flag control reachable from a report (by its skill slug). After a
  successful action, refetch the queue so the row leaves. Surface API errors
  inline. *Done when:* build passes; as an admin I can uphold the seeded report
  (it disappears, maintainer reputation drops 25), flag then unflag a skill
  (verified by the public detail 404-ing then returning), and a failed action
  shows an inline message. Screenshot the before/after.

## Files / areas

**API (`apps/api/src`)**
- `auth/middleware.ts` - add `requireRole(role)`.
- `routes/admin.ts` (new) + `routes/admin.test.ts` - all admin endpoints.
- `db/abuse.ts` - `listOpenAbuseReports`, `findAbuseReportById`, `setAbuseReportStatus`.
- `db/skills.ts` - `listFailedSubmissions` (or in `db/submissions.ts`),
  `listFlaggedSkills`, `setSkillStatus`, `listSkillValidationHistory`.
- `app.ts` - mount `adminRoutes` at `/admin`.

**Schema (`packages/skill-schema/src`)**
- `admin.ts` (new) + `admin.test.ts`; export from `index.ts`.

**Web (`apps/web/src`)**
- `pages/admin.astro` (new).
- `components/admin/AdminDashboard.tsx` (new).
- `lib/api.ts` - `getAdminQueue`, `getSkillHistory`, `resolveReport`, `flagSkill`, `unflagSkill`.

## Data / contracts

**No DB migration.** Existing enums cover everything (`skill_status.flagged`,
`abuse_report_status.open|reviewed|actioned`, `reputation_input_type.report_actioned`).

**New types (`skill-schema/admin.ts`)** - admin-only, so unlike `PublicAbuseReport`
these *do* carry ids and cross-references:

```
AdminAbuseReport   = { id, reason, status, createdAt,
                       skill: { slug, name }, reporter: { username } }
AdminSubmission    = { id, sourceType, githubUrl | null, status, createdAt,
                       user: { username },
                       report: { status, riskLevel, warnings, failures } | null }
AdminSkillRef      = { slug, name, maintainer: { username } }
AdminQueue         = { reports: AdminAbuseReport[],
                       failedSubmissions: AdminSubmission[],
                       flaggedSkills: AdminSkillRef[] }
AdminVersionHistory = { version, publishedAt | null, validationStatus, riskLevel,
                        warnings, failures, sourceHash, resolvedCommitSha | null }
resolveReportInput = { status: 'reviewed' | 'actioned' }   // zod strictObject
```

- Reuse `warnings`/`failures` shapes from the existing validation report type (as
  `report.warnings` / `report.failures` on `ValidationReportRow.report`).
- Envelope stays the project standard `{ success, data } | { success, error }`.

**Load-bearing:** `AdminQueue` and `resolveReportInput` are the contract the
`/admin` island renders and posts against - lock them in step 1/2.

## Testing

`test` is a declared gate command, so every logic-bearing step ships its test in
the same diff; UI steps (5, 6) ride on build + screenshot.

- **Step 1** (`routes/admin.test.ts`, mocking db helpers per the `skills.test.ts`
  pattern - `vi.mock` the db modules, inject `{} as Db`): 401 anon, 403 signed-in
  non-admin, 200 admin returns the three lists; `requireRole` unit behavior.
- **Step 2**: actioning calls `awardReputation(maintainerId, 'report_actioned')`
  exactly once and sets `actioned`; reviewing sets `reviewed` and never calls
  `awardReputation`; resolving a non-`open` report 409s (no reputation call);
  invalid body 400; non-admin 403. Mock `awardReputation` and assert call args.
- **Step 3**: flag guards `published`-only and unflag guards `flagged`-only
  (409 on illegal transition); `setSkillStatus` writes the right status; non-admin 403.
- **Step 4**: history maps versions -> reports newest-first with findings; 404 unknown slug.
- **Schema** (`admin.test.ts`): `resolveReportInputSchema` accepts the two valid
  statuses and rejects anything else / extra keys.
- **Steps 5-6** (UI): `pnpm build` green + screenshots - admin queue rendering the
  seeded report, the non-admin "no access" state, and a before/after of upholding
  a report (row gone) and flag -> public detail 404 -> unflag -> detail returns.

## Notes for the AI

- **Admin is server-enforced, never client-trusted.** Every `/admin` route sits
  behind `requireAuth` + `requireRole('admin')`; the web page self-gates on the
  API's 403 (no need to leak `role` to the client). Do not gate on any
  client-supplied value.
- **Reputation is docked at most once per report** - the `open`-only guard on
  resolve is the safety; actioning an already-actioned report must not re-award.
  The ledger row keeps its awarded weight (existing `awardReputation` behavior);
  do not edit past rows.
- **The dock lands on `skills.maintainerId`, not `attributedTo`** - attribution is
  display-only (10a), so the account that actually owns the listing takes the hit,
  which is correct even for admin-curated skills.
- **Flag uses the by-slug lookup, not the published-only one** - a flagged skill
  is no longer `published`, so `findPublishedSkillBySlug` won't see it; use
  `findSkillBySlug` for flag/unflag and history.
- **Here the reputation dock IS the action**, unlike publish where 10a made the
  award best-effort. Keep the status update and the award together; if the award
  throws, surface an error rather than leaving `actioned` on record with no dock.
- Match existing route conventions: `Number.isInteger` id guards, `{ success, error }`
  envelopes, specific-before-generic route order, `console.error` for server-side failures.
- Web island mirrors `Profile.tsx`: a `LoadState` union (loading/notauth/error/ready),
  `credentials: 'include'` fetches via `lib/api.ts` helpers, existing tokens.

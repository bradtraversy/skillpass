# Current Feature

> **Generated file.** Holds the one feature or fix being built right now. Run
> `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
> an ad-hoc fix. Build one thing at a time; `/complete` archives it (to
> `blueprint/history/features/` or `blueprint/history/fixes/`) and resets this file.

## Feature 16: Maintainer dashboard

**Type:** Feature (build-plan 16)

## What

Authed `/dashboard` where a maintainer manages their own listings: their skills
with status, their submissions with validation state, unlist/relist actions, and
abuse reports filed against their skills. The private counterpart to the public
`/u/[username]`.

## Decisions (spec-time calls, veto at review)

- **Delete = withdraw, collapsed into unlist.** The build plan defers delete
  semantics to spec time. Passports, versions, and snapshots are immutable, so
  a "deleted" listing keeps all artifacts either way; v1 therefore ships one
  withdraw action: **Unlist** (published -> `private`, public page 404s, CLI
  blocked, slug stays reserved) and **Relist** (private -> published). A
  distinct terminal `withdrawn` status needs a pg enum migration and a real
  need; deferred and noted in the history entry.
- **Owner scoping, not a role gate.** `requireAuth` + filter every query by
  `c.get('user').id` (the submissions-routes pattern). `requireRole` is
  exact-match and would lock admins out of their own dashboards.
- **Reporter identity is never shown to the maintainer** - reports against
  your skills expose reason/status/date/skill only.
- **Flagged skills get no maintainer actions.** Unlist requires `published`,
  relist requires `private`; anything else is a 409, so flag/unflag stays
  admin-only.
- **Submissions section reuses what exists**: `GET /submissions`,
  `GET /submissions/:id/validation`, and the existing publish endpoint for
  passed submissions. No new submission API.

## Build steps

- [x] **1. Shared wire shapes** - `maintainerSkillSchema` (slug, displayName,
  status, version, validationStatus, riskLevel, updatedAt) and
  `maintainerReportSchema` (id, skillSlug, skillName, reason, status,
  createdAt) in `packages/skill-schema`, exported types, schema tests.
  **Done when:** schema tests pass (`pnpm test`).
- [x] **2. API: my skills and my reports** - `routes/me.ts` mounted at `/me`
  with `GET /me/skills` (all statuses; new `listSkillsByMaintainer` db helper
  with a left join so version-less rows survive) and `GET /me/reports` (new
  `listReportsAgainstMaintainer` helper joining via `skills.maintainerId`).
  Route tests: anon 401, rows scoped to the session user, no reporter fields
  in the reports JSON.
  **Done when:** route tests pass; curl with a signed session cookie returns
  my rows.
- [x] **3. API: unlist and relist** - `POST /skills/:slug/unlist`
  (published -> private) and `POST /skills/:slug/relist`
  (private -> published) in `routes/skills.ts`, owner-scoped (someone else's
  slug is a 404, no existence leak), 409 on any other state, reusing
  `setSkillStatus`. Route tests for 401/404/409/success.
  **Done when:** route tests pass; curl proves a full unlist -> 404 public ->
  relist -> 200 public cycle.
- [x] **4. Web API wrappers and status tints** - `getMySkills`, `getMyReports`,
  `getMySubmissions`, `unlistSkill`, `relistSkill` in `lib/api.ts` with
  `api.test.ts`-style tests; a pure `statusTint` map (skill + submission
  statuses -> verdict tint classes) in `lib/` with a unit test.
  **Done when:** web lib tests pass.
- [x] **5. Dashboard island: skills section + page + nav** - `/dashboard`
  page (noindex, AdminDashboard page conventions) mounting a `client:load`
  `Dashboard` island: AdminDashboard's LoadState pattern (401 -> sign-in
  prompt), "Your skills" cards with status chip, validation stamp, version,
  and Unlist/Relist via the `useAction` pattern; Unlist uses a two-step
  inline confirm (first confirm affordance in the codebase - no modal).
  Dashboard link added to the AccountMenu dropdown.
  **Done when:** build green; signed-out state verified in the browser;
  signed-in section renders (manual pass for the authed view).
- [x] **6. Island: submissions + reports sections** - "Your submissions"
  (status chip, source, date, Publish action on `passed` via the existing
  endpoint) and "Reports against your skills" (reason, skill, status, date,
  no actions).
  **Done when:** build green; sections render with data; `pnpm test` green
  across the repo.

## Testing

Route handlers and schema shapes are the logic (gate on): steps 1-4 ship tests
in the same diff. The island and page are UI (exempt): build + browser
evidence.

## Verify

- API: test suite green; curl cycle with a signed dev cookie (unlist -> public
  404 -> relist -> public 200; reports JSON has no reporter fields).
- Web: `/dashboard` signed out shows the sign-in prompt; signed in (manual)
  shows skills with correct chips and working unlist/relist; AccountMenu shows
  the Dashboard link; page is noindexed.
- `pnpm test`, `pnpm typecheck`, `pnpm build` all green (build with the dev
  server stopped).

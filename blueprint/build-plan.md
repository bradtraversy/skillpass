# Build Plan

The features that make up this project, in rough build order, one line each.
Reconciled from `project-plan.md` §3 and `blueprint/context/project-overview.md`.

Run `/feature` with no number to spec the **next unchecked** item, or
`/feature 3` / `/feature "validator"` to pick a specific one. Completed features
get checked off here, so this doubles as the progress tracker. Items 5, 6, and 10
are bundles; `/feature` splits them into sub-items (5a, 5b, ...) at spec time.

- [x] 1. **Static directory shell** - Astro homepage, layout, nav, seeded skills, and search/filter/featured UI on fixture data. The directory shows immediately, not a marketing page.
- [x] 2. **Skill detail and passport UI** - detail pages with a static Skill Passport, permissions summary, install panel, versions, maintainer block, and expandable findings.
- [x] 3. **Manifest and report schemas** - define `skill.json`, the validation report schema, permission taxonomy, status values, risk levels, package targets, variants, and multi-skill packs (in `packages/skill-schema`).
- [x] 4. **Validator V0 with fixtures** - `packages/validator` parses local fixture packages, reads `SKILL.md` and manifests, detects basic risks, and emits pass/warning/failed reports.
- [x] 5. **Submission draft flow** - GitHub OAuth, maintainer profile, GitHub-URL submission (primary) and zip upload (fallback), Neon draft records, R2 snapshot storage.
  - [x] 5a. **API scaffold + GitHub sign-in** - stand up `apps/api` (Hono) with Drizzle + Neon, the `User` table, GitHub OAuth login/callback, a session cookie, and `GET /me`.
  - [x] 5b. **GitHub-URL submission to draft** - authed `POST /submissions`: validate the URL, pin the commit, snapshot to R2 with a source hash, create the draft record, read endpoints.
  - [x] 5c. **Zip upload + submit page** - zip fallback through the same snapshot path with hardened archive entry-name validation (reject `..` and backslash paths in user zips - audit follow-up), plus the `/submit` static shell and React island form wired to the API.
- [x] 6. **Queue-backed upload validation** - Redis + BullMQ + a worker service, job progress records, a job-status API, and the inline validation progress panel wired to real jobs.
  - [x] 6a. **Queue, worker, and job records** - Redis + BullMQ wiring, `validation_jobs` and `validation_reports` tables, enqueue on submission create, and the worker that validates the R2 snapshot and moves the submission draft -> validating -> passed/warning/failed.
  - [x] 6b. **Job-status API + progress panel** - owner-scoped job-status endpoint and the inline validation progress panel on /submit (step rows ending in check/warning/x), polling real jobs.
- [x] 7. **Publishable skill flow** - passed submissions publish, failed stay private, warnings route to draft/review, and each published version gets a public immutable Skill Passport plus a readable source view (SKILL.md and package files rendered from the validated snapshot, pinned to the source hash).
  - [x] 7a. **Publish backend** - `skills`/`skill_versions`/`skill_passports` tables, slug + version rules, owner-scoped `POST /submissions/:id/publish` (passed only), immutable passport generated from the stored report, curated attribution to the source repo owner, and the Publish button on the /submit result card.
  - [x] 7b. **Public read API + live directory** - public list/detail endpoints over published data, the static-data-freshness decision (rebuild-on-publish vs client-fetch), homepage/browse swapped off fixture data.
  - [x] 7c. **Passport + source view pages** - `/skills/[slug]` and version permalinks rendering real passports, plus the source view (SKILL.md rendered, package files viewable) from the pinned snapshot.
- [x] 8. **Download pre-flight** - endpoint + UI showing current validation, source hash, permissions, permission diffs, and blocking of failed versions.
- [x] 9. **CLI scan and report** - `packages/cli` with `skillpass scan` and `skillpass report`, sharing the validator, readable + JSON output.
- [x] 10. **Reputation and admin** - maintainer reputation, user profiles, abuse reports, admin holding queue, validation history, manual review states.
  - [x] 10a. **Profiles + reputation** - `reputation_inputs` table rolling up into `users.reputation`, publish events wired as the first inputs, public `GET /users/:username`, and the `/u/[username]` profile page (listed skills + reputation), maintainer links from skill pages.
  - [x] 10b. **Abuse reports** - signed-in report flow on skill pages, `abuse_reports` table (open/reviewed/actioned), owner-visible confirmation.
  - [x] 10c. **Admin queue + review states** - admin-only `/admin` holding queue (failed/flagged submissions, open abuse reports), manual review states (flag/unflag skill, resolve reports with reputation consequences), per-skill validation history.
- [ ] 11. **Launch seed** - seed real listings via the admin-curate path, and feature the AI Blueprint pack and Memcrate. (Started: 8 Anthropic skills live in dev Neon; not on prod yet.)
- [x] 12. **Navigation & shell wiring** - resolved by removing the `#` placeholder nav links (Browse/Validator/Docs/CLI) entirely: none had a real, non-redundant destination (Browse duplicated the logo, Validator shouldn't be a public tool, Docs/CLI live in 14). Nav is now logo + Submit CTA + account. Menu items and the footer are deferred to feature 14, where their pages exist.
- [ ] 13. **Homepage ranking & curation** - back the homepage tabs with real logic and wire the active tab into the filter (currently dead - `activeTab` is set but never applied). Resolved: Featured (admin-curated) | New (recency) | Verified (admin-curated) | Workflow packs (multi-skill packs).
  - [x] 13a. **Featured / New / Verified** - admin-set `featured` and `verified` flags on skills, exposed in the public summary, with admin toggle endpoints, and auto-verify on admin publish. Homepage ships **New-only** at launch scale (static "Latest" list); the tab logic + flags stay wired but dormant for when the catalog grows.
  - [ ] 13b. **Workflow packs** - persist an `isPack` signal at publish time (from `manifest.skills[]`), expose it in the summary, and add the Workflow-packs tab; pairs with publishing the first multi-skill pack (the AI Blueprint, feature 11).
- [ ] 14. **Docs & CLI onboarding** - docs pages (what a Skill Passport and validation mean, the permission taxonomy, how to submit) plus the `skillpass` install-and-usage guide that the skill detail page's `skillpass add` command already assumes.
- [ ] 15. **CLI install lifecycle** - ship `skillpass` (npm or a documented install path) and round out the command set into a local install manager: `add`, `remove` (mirror add's target resolution and delete `<target>/<slug>`), and a simple `list` of installed skill names.
- [ ] 16. **Maintainer dashboard** - authed `/dashboard` to manage your listings: your skills and their status (published/draft/private/flagged), your submissions and validation state, publish/unlist/delete actions, and abuse reports filed against you; the private counterpart to the public `/u/[username]`. (Delete withdraws the listing; spec its effect on the immutable passports/snapshots.)
- [ ] 17. **Category/tag browse** (optional) - surface the existing Category and Tag models as browse and filter affordances.

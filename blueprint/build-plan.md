# Build Plan

The features that make up this project, in rough build order, one line each.
Reconciled from `project-plan.md` §3 and `blueprint/context/project-overview.md`.

Run `/feature` with no number to spec the **next unchecked** item, or
`/feature 3` / `/feature "validator"` to pick a specific one. Completed features
get checked off here, so this doubles as the progress tracker. Items 5, 6, and 10
are bundles; `/feature` splits them into sub-items (5a, 5b, ...) at spec time.

- [ ] 1. **Static directory shell** - Astro homepage, layout, nav, seeded skills, and search/filter/featured UI on fixture data. The directory shows immediately, not a marketing page.
- [ ] 2. **Skill detail and passport UI** - detail pages with a static Skill Passport, permissions summary, install panel, versions, maintainer block, and expandable findings.
- [ ] 3. **Manifest and report schemas** - define `skill.json`, the validation report schema, permission taxonomy, status values, risk levels, package targets, variants, and multi-skill packs (in `packages/skill-schema`).
- [ ] 4. **Validator V0 with fixtures** - `packages/validator` parses local fixture packages, reads `SKILL.md` and manifests, detects basic risks, and emits pass/warning/failed reports.
- [ ] 5. **Submission draft flow** - GitHub OAuth, maintainer profile, GitHub-URL submission (primary) and zip upload (fallback), Neon draft records, R2 snapshot storage.
- [ ] 6. **Queue-backed upload validation** - Redis + BullMQ + a worker service, job progress records, a job-status API, and the inline validation progress panel wired to real jobs.
- [ ] 7. **Publishable skill flow** - passed submissions publish, failed stay private, warnings route to draft/review, and each published version gets a public immutable Skill Passport.
- [ ] 8. **Download pre-flight** - endpoint + UI showing current validation, source hash, permissions, permission diffs, and blocking of failed versions.
- [ ] 9. **CLI scan and report** - `packages/cli` with `aiskills scan` and `aiskills report`, sharing the validator, readable + JSON output.
- [ ] 10. **Reputation and admin** - maintainer reputation, user profiles, abuse reports, admin holding queue, validation history, manual review states.
- [ ] 11. **Launch seed and docs** - seed first-party listings, feature AI Blueprint and Memcrate, author docs, and the bradtraversy.dev project page.

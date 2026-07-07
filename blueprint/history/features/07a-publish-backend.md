# Feature: Publish backend

**From build-plan:** feature 7a
**Status:** complete

## Goal

A passed submission can become a published skill: the owner clicks Publish on
the /submit result card, and the backend creates the logical `Skill` listing,
an immutable `SkillVersion` pinned to the validated snapshot, and the public
`SkillPassport` generated from the stored report. Failed submissions cannot
publish; warnings stay in draft (review lands in feature 10). After 7a the
directory's core promise exists in the database; 7b/7c make it visible.

## In scope

- **Tables** (Drizzle + migration):
  - `skills` - id, slug (unique), name, summary, maintainerId FK users,
    attributedTo (text, nullable - GitHub login of the source repo owner when
    an admin curates someone else's repo), status enum
    `published|draft|private|flagged` (model-complete now, only `published`
    written by 7a), latestVersionId (nullable FK, set after version insert),
    createdAt, updatedAt.
  - `skill_versions` - id, skillId FK, version (semver string), sourceType
    (`github|zip`), githubRepoUrl + resolvedCommitSha (nullable),
    sourceHash, snapshotKey, submissionId (unique FK - one version per
    submission, ever), publishedAt, createdAt.
  - `skill_passports` - id, skillVersionId (unique FK), passport jsonb (the
    full feature-3 `SkillPassport` document) plus denormalized
    validationStatus/riskLevel columns for querying, generatedAt. No update
    path exists - immutability by omission.
- **Slug + version rules** in `packages/skill-schema` (pure, tested):
  - `slugForSkill(name)` - kebab, collapse repeats, trim hyphens, max 60.
  - Version assignment: first publish of a slug is `1.0.0`; each re-publish
    by the same maintainer bumps the major (`2.0.0`, `3.0.0`). A future
    manifest `version` field can override later; flagged, not built.
- **Passport generation** (pure, tested): report row + submission row ->
  `SkillPassport` object that parses with the locked `skillPassportSchema`
  (declared/detected permissions, warningsSummary = report warnings,
  sourceHash, optional resolvedCommitSha, engineVersion, generatedAt).
- **Endpoint**: `POST /submissions/:id/publish` - requireAuth + owner-scoped
  submission read (404, no leak). Guards, in order: submission status must be
  `passed` (409 otherwise - failed/warning/draft all refuse with a
  state-specific message); not already published (the version table's unique
  submissionId makes a retry a 409, not a duplicate). Then it **fetches the
  snapshot from R2 and parses the manifest** - the skill's name and summary
  live only there (`getSnapshotDocument` + `loadPackageFromFiles`; passed
  implies the manifest is valid). R2 failure -> 502, publish stays retryable.
  Slug owned by another maintainer -> 409 "name taken". Same maintainer +
  same slug -> new version on the existing skill, latestVersionId moves.
  Response: `{ slug, version }` (locked wire shape `PublishResult` in
  skill-schema).
- **Attribution**: for an admin-submitted `github_url` submission whose repo
  owner differs from the submitter's login, set `skills.attributedTo` to the
  repo owner's login (parsed from the stored githubUrl). Zip curation gets no
  attribution (no owner to verify).
- **Publish button**: on the /submit result card when the panel lands on
  `passed` - posts, then swaps to "Published as {slug} v{version}". No link
  yet (the detail page swaps to real data in 7c).

## Out of scope

- Public read endpoints, directory/detail pages off fixtures (7b/7c).
- The relational `Manifest` table (report + snapshot carry what 7 needs;
  feature 8 revisits if permission diffing wants it).
- Categories and tags (`categoryId` deferred with them), reputation inputs.
- Unpublish/delete, re-validation, manual review states (feature 10).
- Passport `signature` (schema carries it optional; signing is future work).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.

Never accept a step you haven't read. If a diff is too big to review, the step
was too big, so split it.

## Build steps

- [x] **Step 1 - slug, version, and publish wire contract** - in
  `packages/skill-schema`: `slugForSkill(name)`, `nextVersion(current)` (null
  -> `1.0.0`, else major bump), and `PublishResult` `{ slug, version }` (+
  Zod schema). *Done when:* unit tests cover kebab edge cases (spaces,
  symbols, repeats, long names, non-latin -> fallback), the version sequence,
  and the schema parse; suite green.
- [x] **Step 2 - passport builder** - `buildPassport(report, submission)` in
  `apps/api` (pure): maps the stored report row + submission row to a
  `SkillPassport` and self-checks with `parsePassport`. *Done when:* tests
  cover github (with commit sha) and zip (without) sources, warnings carried
  into warningsSummary, and a riskLevel/status passthrough; suite green.
- [x] **Step 3 - tables + migration** - the three tables above + `skill_status`
  enum. *Done when:* migration applied to the Neon dev branch; typecheck
  green; drizzle generate shows no drift after.
- [x] **Step 4 - publish data access** - `apps/api/src/db/skills.ts`:
  findSkillBySlug, findVersionBySubmission, latest version lookup,
  createSkill/createVersion/createPassport, setLatestVersion, and a
  `publishSubmission` composition that sequences them (neon-http has no
  transactions - ordering + the unique submissionId FK make retries safe:
  version insert is the commit point, see Notes). *Done when:* composition
  unit-tested with a mocked db for first-publish and re-publish sequences;
  suite green.
- [x] **Step 5 - the endpoint** - `POST /submissions/:id/publish` with the
  guard ladder and the snapshot/manifest fetch. *Done when:* route tests
  cover 401, foreign 404, 409 for draft/warning/failed states, 409
  already-published, 502 when R2 is down (with no rows written), 409 slug
  taken by another maintainer, happy first publish (returns
  `{ slug, version }`, submission flips to `published`, passport row
  written), re-publish bumps the version and moves latestVersionId, and
  admin-curated attribution lands; suite green.
- [x] **Step 6 - publish button** - result-card wiring: `publishSubmission(id)`
  in `lib/api.ts`, button on the `passed` outcome, success swaps to
  "Published as {slug} v{version}", error renders inline. *Done when:* a live
  clean-zip run ends with the button, clicking publishes, and the DB shows
  skill + version + passport rows (screenshot + build evidence; UI step).

## Files / areas

- `packages/skill-schema/src/publish.ts` (+ test, new) - slug, version,
  `PublishResult`.
- `apps/api/src/publish/passport.ts` (+ test, new) - passport builder.
- `apps/api/src/db/schema.ts`, `drizzle/` - three new tables + enum.
- `apps/api/src/db/skills.ts` (new) - data access. As built, the
  `publishSubmission` composition lives in `apps/api/src/publish/publish.ts`
  (+ test) so it can mock the data-access module, per the repo's test pattern.
- `apps/api/src/routes/submissions.ts` (+ test) - the publish route.
- `apps/web/src/lib/api.ts`, `apps/web/src/components/submit/ValidationProgress.tsx`.

## Data / contracts

- **`PublishResult` `{ slug, version }` is load-bearing** - 7b/7c and the CLI
  echo it.
- **`skills.slug` is the public identity** (routes, installs, passport
  permalinks). Unique across the site; same name from a different maintainer
  is a 409 in 7a (nicer resolution can come with namespacing later).
- **`skill_versions.submissionId` unique FK** - the idempotency anchor: a
  submission publishes at most once, retries conflict instead of duplicating.
- **Passport jsonb parses with `skillPassportSchema`** - generated once at
  publish, never updated; 7c renders it verbatim, feature 8 diffs
  `permissionsSummary` between versions.
- **Publish keeps the snapshot key**: `skill_versions.snapshotKey` copies the
  submission's - 7c's source view and feature 8's downloads read the same
  pinned object the validator saw (hash parity end to end).
- Deviation from the overview sketch: the link lives on
  `skill_versions.submissionId` rather than `submissions.skillVersionId` -
  immutable-side foreign key, no submissions migration. Update the overview
  at /complete.

## Testing

- Steps 1, 2, 4, 5 are logic and ship tests in the same diff (pure functions
  and mocked-db route tests, per the existing patterns).
- Step 3 is schema-only (migration evidence); step 6 is UI (screenshot +
  build + live DB rows).

## Notes for the AI

- **No transactions on neon-http.** Sequence writes so each prefix is
  consistent: find-or-create skill -> insert version (unique submissionId =
  the idempotency gate) -> insert passport -> set latestVersionId -> flip
  submission status. A crash mid-sequence leaves a version without passport;
  the retry 409s on the version insert - surface "already published,
  contact support if the listing looks incomplete" rather than duplicating.
  Log every partial-failure path server-side.
- Publish-only-when-passed gives a free invariant: passed implies a valid
  manifest (missing/invalid manifest can never reach `passed`), so
  `manifest.name`/`description` exist - no defensive fallbacks needed for
  skill name/summary.
- Re-read the validation report row at publish time and require
  `report.status === 'passed'` as defense in depth alongside the submission
  status check.
- `attributedTo` derives from the stored `githubUrl` via the existing
  `parseGithubUrl` - never from client input; the publish request body is
  empty.
- Scope every read by the authenticated user id per the standards; admins get
  no special publish powers in 7a (they publish their own curated
  submissions like anyone else).
- The button goes in the existing `Outcome` component's `passed` branch; keep
  the island's state machine pattern (no new libraries).

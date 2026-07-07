# Feature: Public read API + live directory

**From build-plan:** feature 7b
**Status:** complete

## Goal

Published skills become visible: a public (no-auth) read API serves the
directory listing and skill detail from the real tables, and the homepage swaps
off fixture data to client-fetch that listing. Freshness decision (made with
Brad): **client-fetch** - the static shell stays, islands fetch live data at
runtime; rebuild/hybrid can come at deploy time for SEO. Re-publish now also
refreshes the listing's name/summary (audit P3 closed).

## In scope

- **Wire contracts** in `packages/skill-schema` (load-bearing for 7c + CLI):
  - `PublicSkillSummary` - slug, name, summary, targets, validationStatus,
    riskLevel, version (latest), maintainer (username), attributedTo (nullable),
    publishedAt (ISO). What a directory row renders.
  - `PublicSkillDetail` - summary fields + `passport` (the full feature-3
    `SkillPassport`), `maintainerInfo` { username, displayName, avatarUrl },
    and `versions[]` { version, validationStatus, riskLevel, publishedAt }.
    7c renders this page; the endpoint ships now.
- **`skill_versions.targets`** (jsonb, `Target[]`) - new column + migration.
  Targets live only in the manifest today; publish already parses it, so store
  them on the version for the listing. Backfill: dev has one row (smoke-clean,
  `["claude-code"]`) - update it manually in the migration step.
- **Publish refresh**: on a same-maintainer re-publish, `publishSubmission`
  updates `skills.name`/`summary` from the new manifest alongside
  `latestVersionId` (Brad's call - the listing describes the latest version).
- **Endpoints** (new public router `routes/skills.ts`, mounted without auth):
  - `GET /skills` - published skills only, newest publish first: skill row +
    latest version + its passport denorm columns + maintainer username ->
    `PublicSkillSummary[]`.
  - `GET /skills/:slug` - one published skill -> `PublicSkillDetail` (passport
    jsonb verbatim, versions newest-first); unknown or unpublished slug -> 404.
  - Read-only, anonymous by design; leak nothing beyond the contracts
    (no snapshotKey, no internal ids, no maintainer githubId).
- **Live directory** (`apps/web`):
  - `getSkills()` in `lib/api.ts`.
  - Port `Stamp.astro` -> `Stamp.tsx` (Astro renders React statically, so the
    fixture detail page keeps working; no duplicate component).
  - Port `Row.astro` -> `Row.tsx` rendering `PublicSkillSummary`: rank,
    monogram, name, target chips, summary, stamp, risk dot; right column shows
    latest version + time since publish (no installs - first-party metrics
    only, per the metrics strategy).
  - `filterSkills` filters `PublicSkillSummary` (haystack: name, summary,
    maintainer, targets; drop fixture category/tags).
  - `Directory.tsx` fetches on mount and renders rows itself (replaces the
    hidden-row toggling over server HTML); loading, error ("can't reach the
    API"), and empty ("No skills published yet") states; stats line shows the
    real count instead of fixture numbers.
  - `pages/index.astro` drops the fixture import and server-rendered rows;
    delete `Row.astro` (dead after the port).
  - `timeAgo(iso)` helper in `lib/format.ts` for the published column.

## Out of scope

- Detail/passport pages off the real API, source view, version permalinks (7c
  next - `pages/skills/[slug].astro` stays on fixtures until then).
- Rebuild-on-publish/hybrid freshness, SEO prerendering (deploy-time call).
- Categories, tags, install counts, trending logic (features 10/11; tabs stay
  cosmetic).
- Search beyond the existing client-side filter.

## Build steps

- [x] **Step 1 - wire contracts** - `publicSkillSummarySchema` +
  `publicSkillDetailSchema` (+ types, parse helpers) in
  `packages/skill-schema/src/public.ts`, exported from the index. *Done when:*
  tests cover a valid summary/detail parse, attributedTo nullability, and
  rejection of extra keys (strict objects); suite green.
- [x] **Step 2 - targets + listing refresh** - migration 0004 adds
  `skill_versions.targets` jsonb default `[]`; `publishSubmission` input gains
  `targets` (route passes `pkg.manifest.data.targets`) and re-publish updates
  `skills.name`/`summary`; backfill smoke-clean's row. *Done when:* publish
  tests assert targets stored and name/summary refreshed on re-publish;
  migration applied to Neon dev; no drizzle drift; suite green.
- [x] **Step 3 - public read endpoints** - list/detail queries in
  `db/skills.ts`, new `routes/skills.ts` mounted in `app.ts` without auth.
  *Done when:* route tests cover empty list, published-only filtering, summary
  shape (contract parse), detail shape with passport + versions, 404 for
  unknown/unpublished slug, and no-leak assertions (snapshotKey, githubId);
  suite green.
- [x] **Step 4 - live homepage** - Stamp/Row ports, filterSkills swap,
  Directory client-fetch with the three states, index.astro off fixtures,
  `timeAgo` + tests. *Done when:* build green, filterSkills/timeAgo tests
  green, and a headless-Chrome screenshot shows the live directory rendering
  smoke-clean from the API.

## Files / areas

- `packages/skill-schema/src/public.ts` (+ test, new), `src/index.ts`.
- `apps/api/src/db/schema.ts`, `drizzle/0004_*`, `src/publish/publish.ts`
  (+ test), `src/routes/submissions.ts` (targets pass-through).
- `apps/api/src/db/skills.ts` (+ test), `src/routes/skills.ts` (+ test, new),
  `src/app.ts`.
- `apps/web/src/lib/api.ts`, `lib/filterSkills.ts` (+ test), `lib/format.ts`
  (+ test), `components/skill/Stamp.tsx` (new, replaces `.astro`),
  `components/skill/Row.tsx` (new, replaces `.astro`),
  `components/home/Directory.tsx`, `pages/index.astro`,
  `pages/skills/[slug].astro` (Stamp import swap only).

## Data / contracts

- **`PublicSkillSummary` / `PublicSkillDetail` are load-bearing** - 7c pages
  and the feature-9 CLI consume them; strict schemas in skill-schema.
- **Public endpoints are anonymous** - no session read, no user scoping; they
  serve only `status = 'published'` skills.
- **Passport travels verbatim** - detail returns the stored jsonb untouched;
  7c renders it, feature 8 diffs it.
- `skill_versions.targets` defaults `[]`; rows published before the column
  exist only on dev (smoke-clean) and get backfilled by hand in step 2.

## Testing

- Steps 1-3 are logic: schema tests, publish composition tests, mocked-db
  route tests in the same diffs.
- Step 4 is UI + two pure helpers: filterSkills/timeAgo get unit tests; the
  page rides on build + screenshot.

## Notes for the AI

- Mount `routes/skills.ts` before any auth middleware; it must work with no
  cookie at all.
- The list query joins on `skills.latestVersionId` (not max(version)) - the
  pointer is the published truth.
- Keep the island's state machine pattern (plain useState, no libraries).
- `Stamp.tsx` must render identically in Astro static context (detail page)
  and hydrated context (rows) - no hooks, pure props.
- Delete `Row.astro` in the same step that stops using it; no dead files.

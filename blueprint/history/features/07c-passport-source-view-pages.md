# Feature: Passport + source view pages

**From build-plan:** feature 7c
**Status:** complete

## Goal

The directory's detail pages go real: `/skills/[slug]` and the version
permalink `/skills/[slug]/[version]` render live Skill Passports from the
public API (client-fetch, per the 7b decision), and every version gets a
readable source view - SKILL.md rendered, other package files viewable - from
the pinned snapshot the validator saw. Fixture data and the fixture-typed
detail components are deleted. This closes feature 7.

## In scope

- **API** (`apps/api` + contracts):
  - `PublicSkillDetail` gains `githubRepoUrl` (string | null) - the header
    links the source repo for github-sourced skills; zip stays null.
  - `GET /skills/:slug/:version` - version-pinned detail: same shape, but
    version/passport/validationStatus/riskLevel/publishedAt come from the
    requested version; full versions list still included. 404 for unknown
    version or unpublished skill.
  - `GET /skills/:slug/:version/source` - `PublicSkillSource`
    `{ version, sourceHash, files: [{ path, content }] }` served from the
    version's pinned R2 snapshot (`getSnapshotDocument`); 502 when R2 is
    down. New contract in skill-schema.
  - db: `findVersionWithPassport(db, skillId, version)`.
- **Markdown mini-renderer** (`apps/web/src/lib/markdown.tsx`, pure):
  renders untrusted SKILL.md to React elements - headings, paragraphs,
  bullet/numbered lists, fenced code, inline code, bold/italic, links
  (http/https only, `rel="noreferrer noopener"`). No HTML pass-through, no
  dangerouslySetInnerHTML, no new dependencies - XSS-safe by construction.
- **Detail island** (`components/skill/SkillDetail.tsx` + ported pieces):
  - Ports of the fixture Astro components to React, markup preserved:
    `DetailHeader`, `InstallBar` (copy button becomes React state),
    `Passport`, `PermissionRow`, `Finding`.
  - Data mapping: passport verdict/risk/sourceHash/commit/generatedAt;
    permissions = declared ∪ detected from `permissionsSummary`, described
    via the skill-schema taxonomy with a per-key level badge
    (`permissionLevel` helper, same thresholds as the validator's
    `riskLevelFor`); findings = `warningsSummary` (code as title, message as
    body, path:line + redacted snippet); versions list links to permalinks;
    maintainer block shows the real avatar/displayName, plus a "curated from
    {attributedTo}'s repo" line when attributed. Fixture-only Usage section
    drops.
  - Loading / not-found / API-unreachable states per the island pattern.
- **Pages**: `skills/[slug].astro` becomes `skills/[slug]/index.astro` +
  `skills/[slug]/[version].astro`. Both are thin shells rendering the island
  (`client:load` - the page is the content). `getStaticPaths` fetches
  slugs/versions from the API at build time and returns `[]` if the API is
  unreachable (build never fails on it); in dev, Astro re-runs
  `getStaticPaths` per request, so new publishes get pages immediately.
  Pre-render-at-deploy remains the deploy-time upgrade path.
- **Source view**: a Source section on the detail page listing the snapshot
  files (name + size), click to expand; SKILL.md renders through the
  markdown renderer, other files show in a `<pre>` block. Fetched lazily
  from the source endpoint on first expand.
- **Fixture teardown**: delete `lib/skills.ts`, `lib/skill-details.ts` (+
  its test), and the replaced `.astro` components; `lib/verdict.ts` retypes
  to skill-schema's `ValidationStatus`.

## Out of scope

- Download pre-flight (the InstallBar button stays a dead link until 8).
- Maintainer reputation/joined/skill-count (feature 10 - block shows what
  the API has).
- Declared-vs-detected permission diffing UI (feature 8).
- Syntax highlighting in the source view; SEO pre-rendering.

## Build steps

- [x] **Step 1 - API: pinned detail + source** - contract changes
  (`githubRepoUrl`, `publicSkillSourceSchema`), `findVersionWithPassport`,
  the two routes, `skillRoutes` gains `env`. *Done when:* route tests cover
  pinned-version shape (parses with the contract), 404 unknown
  version/slug, source happy path (files + hash, parses), R2-down 502, and
  the existing no-leak assertions extended to the new payloads; suite
  green.
- [x] **Step 2 - markdown renderer + permission level** -
  `lib/markdown.tsx` + `permissionLevel` in a web lib. *Done when:* tests
  cover headings/lists/paragraphs/fenced+inline code/bold/links,
  script/HTML pass-through rendered inert as text, non-http(s) link schemes
  neutralized, and the level thresholds; suite green.
- [x] **Step 3 - detail island + pages** - component ports, the island
  state machine, page restructure with resilient `getStaticPaths`, fixture
  teardown. *Done when:* build green with the API stopped (empty paths) and
  with it running; live screenshot of `/skills/smoke-clean` showing the
  real passport; version permalink renders pinned data; unknown slug shows
  the not-found state in dev.
- [x] **Step 4 - source view** - Source section wired to the source
  endpoint, SKILL.md rendered, other files in `<pre>`. *Done when:* live
  screenshot shows smoke-clean's SKILL.md rendered and its skill.json
  viewable; full gates green (suite + typecheck + build).

## Files / areas

- `packages/skill-schema/src/public.ts` (+ test) - detail extension +
  source contract.
- `apps/api/src/db/skills.ts` (+ test via routes), `src/routes/skills.ts`
  (+ test), `src/app.ts` (env into skillRoutes).
- `apps/web/src/lib/markdown.tsx` (+ test, new), `lib/permission-level.ts`
  (+ test, new), `lib/verdict.ts`, `lib/api.ts` (getSkill, getSkillSource).
- `apps/web/src/components/skill/`: `SkillDetail.tsx` (island, new),
  `DetailHeader.tsx`, `InstallBar.tsx`, `Passport.tsx`, `PermissionRow.tsx`,
  `Finding.tsx`, `SourceView.tsx` (new); delete the `.astro` versions.
- `apps/web/src/pages/skills/[slug]/index.astro`,
  `[slug]/[version].astro`; delete `pages/skills/[slug].astro`,
  `lib/skills.ts`, `lib/skill-details.ts` (+ test).

## Data / contracts

- **`PublicSkillSource` is load-bearing** - feature 8's pre-flight and the
  CLI read the same pinned snapshot; hash parity end to end.
- The source endpoint serves exactly what the validator validated (same
  snapshot object); it never re-fetches from GitHub.
- Version permalinks are immutable views: pinned passport + pinned source.
- The markdown renderer never emits raw HTML from input - untrusted
  content stays text.

## Testing

- Steps 1-2 are logic: route tests and pure renderer/threshold tests in
  the same diffs.
- Steps 3-4 are UI: build + live screenshots; the data-mapping helpers
  inside the island stay thin enough to ride on the route contracts.

## Notes for the AI

- Register the more specific routes first in `skillRoutes`
  (`/:slug/:version/source`, then `/:slug/:version`, then `/:slug`).
- `permissionLevel` duplicates the validator's thresholds on purpose (web
  must not import the validator); flag it as a future taxonomy-level move.
- `getStaticPaths` fetch failure must `console.warn` and return `[]`, not
  throw - the static build must never depend on a live API.
- Keep the island pattern: plain `useState`/`useEffect`, no libraries.
- Preserve the ported components' markup and classes exactly; this page's
  look was locked in feature 2.

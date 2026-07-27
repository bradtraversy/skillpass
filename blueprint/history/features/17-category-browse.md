# Current Feature

> **Generated file.** Holds the one feature or fix being built right now. Run
> `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
> an ad-hoc fix. Build one thing at a time; `/complete` archives it (to
> `blueprint/history/features/` or `blueprint/history/fixes/`) and resets this file.

## Feature 17 - Category system and directory browse

**Build-plan item:** 17 (reshaped: the plan line says "surface the existing
Category and Tag models", but no category or tag model was ever built - this
feature creates the category system end to end. Tags stay unbuilt and out of
scope.)

## Goal

Break the 134-skill wall into browsable categories so people can find what they
are looking for. A skill gets one category from a fixed taxonomy; the homepage
gets a category filter with counts. Assignment is LLM-classified (Haiku, same
discipline as the AI review) so nobody hand-labels 134 skills.

## In scope

- **Taxonomy** - a fixed category list (slug, label, description) in
  `packages/skill-schema`, shared by API, web, and CLI. Draft list below;
  reviewed at Step 1.
- **Storage** - nullable `category` text column on `skills` + migration.
- **Classifier** - `classifyCategory(env, {name, summary})`: one cheap Haiku
  call, injection-hardened, output constrained to taxonomy slugs, `null` on any
  failure. Called at publish (skip when already set, never blocks) and by the
  backfill.
- **`db:backfill-categories`** - classifies every published skill with a null
  category; idempotent; logs the per-category distribution.
- **Public payload** - `category` on `publicSkillSummary` (detail inherits).
- **Directory UI** - a collapsible filter sidebar: categories with counts plus
  the relocated tool filter, sliding in and out via a toggle whose state
  persists in `localStorage`; each result row shows its category label.

## Out of scope

- **Tags** - the many-to-many Tag model stays unbuilt.
- **Category landing pages** (`/category/[slug]`) and nav entries - the homepage
  filter is the browse surface for now.
- **Server-side `?category=` param** - the directory fetches the full list and
  filters client-side today; keep that.
- **Admin recategorization UI** - corrections happen by SQL or re-running the
  backfill after a taxonomy tweak.
- **Folding category into `AiReview`** - tempting (one LLM call), but the 134
  cached reviews are keyed by source hash and would all need regeneration.
  Category is a separate, lighter call that needs no R2 snapshot.

## Draft taxonomy (review at Step 1)

| Slug | Label | Fits (examples from the live catalog) |
| --- | --- | --- |
| `security-review` | Security Review | c-review, rust-review, semgrep, codeql, insecure-defaults, supply-chain-risk-auditor |
| `fuzzing` | Fuzzing | aflpp, libfuzzer, cargo-fuzz, atheris, harness-writing, coverage-analysis |
| `blockchain` | Blockchain | solana/ton/cosmos/cairo/algorand scanners, token-integration-analyzer |
| `cryptography` | Cryptography | constant-time-testing, wycheproof, zeroize-audit, mermaid-to-proverif |
| `code-analysis` | Code Analysis | trailmark family, sarif-parsing, variant-analysis, diagramming-code |
| `testing` | Testing & QA | test-driven-development, mutation-testing, property-based-testing, webapp-testing |
| `agent-workflow` | Agent Workflow | superpowers set, skill-creator, writing-skills, context-engineering |
| `dev-practices` | Dev Practices | planning, git-workflow, ci-cd, api-design, code-review-and-quality, debugging |
| `docs-writing` | Docs & Writing | docx, pdf, pptx, xlsx, doc-coauthoring, internal-comms |
| `design-creative` | Design & Creative | canvas-design, brand-guidelines, algorithmic-art, frontend-design |
| `knowledge-notes` | Notes & Knowledge | obsidian-*, json-canvas, defuddle |
| `dev-tooling` | Dev Tooling | modern-python, gh-cli, devcontainer-setup, claude-api, mcp-builder |

Twelve categories; the largest lands around 20 skills. The classifier decides
membership; the Step 4 distribution log is the check that nothing is lumpy.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.

## Build steps

- [x] **Step 1 - taxonomy + contract in `skill-schema`.** Add `CATEGORIES`
  (slug, label, description - the table above), `categorySlugSchema`, and
  `category: categorySlugSchema.nullable().optional()` on
  `publicSkillSummarySchema` (optional for deploy-skew tolerance, same as
  `noteCount`). Export `CategorySlug`. *Done when:* `pnpm test` green; tests
  cover a valid slug parsing, an unknown slug rejected, and the summary parsing
  with and without `category`.

- [x] **Step 2 - DB column + API payload.** Add nullable `category` text to
  `skills` in `schema.ts`, generate the migration, thread it through
  `db/skills.ts` list/detail queries and the `publicSkillSummary` /
  `publicSkillDetail` mappers, and return it from `GET /skills` and both detail
  routes. *Done when:* migration file exists under `apps/api/drizzle/`;
  `pnpm test` green; route tests show `category` present (value and `null`).

- [x] **Step 3 - classifier + publish hook.** Add
  `apps/api/src/review/classify.ts`: `classifyCategory(env, {name, summary})`
  calls Haiku with content-as-data framing and structured output whose enum is
  the taxonomy slugs; any API failure, missing key, or out-of-taxonomy answer
  resolves to `null`, never a throw. Add `ensureCategory` (skip when the skill
  already has a category) and call it from `publishSubmission` next to
  `ensureAiReview`, failure-tolerant. Tests (mock the client): fresh skill gets
  classified and stored; already-categorized is a no-op; no key is a no-op;
  classifier throwing or returning junk stores nothing and publish stays green.
  *Done when:* `pnpm test` green with and without `env`.

- [x] **Step 4 - `db:backfill-categories` script.** Iterate published skills
  with `category` null through `classifyCategory` and update; log
  generated/skipped/failed plus a per-category distribution table; entry-module
  guard matching `db:backfill-ai-reviews`. Run it against dev and eyeball the
  distribution. *Done when:* `pnpm build` green; keyless run reports all
  skipped; with a key the dev catalog is categorized, the distribution prints,
  and a second run is a no-op.

- [x] **Step 5 - filter sidebar + category filter.** Add `category` to
  `SkillFilters` (`CategorySlug | 'all' | 'uncategorized'`) in `filterSkills`.
  New `FilterSidebar.tsx` rendered beside the results in a two-column layout:
  a Categories group (All + each nonempty category with a count; Uncategorized
  only when its count is nonzero) and the tool filter moved in from the header
  row, styled to the existing mono/muted/accent idiom. Desktop layout only in
  this step; the sidebar is statically visible. *Done when:* `pnpm test` green
  (filterSkills cases for the new param); `pnpm build` green; screenshot of the
  sidebar filtering the list.

- [x] **Step 6 - slide toggle, persistence, mobile, row label.** A Filters
  toggle in the list header slides the sidebar in and out (CSS transition, no
  layout jump - results expand to full width when collapsed); the open/closed
  choice persists in `localStorage` (default: open on desktop). On mobile the
  sidebar renders as a slide-in overlay drawer from the same toggle, closed by
  default. Show the category label in each `Row`'s meta line. *Done when:*
  `pnpm build` green; screenshots collapsed and expanded, desktop and mobile;
  the choice survives a page reload.

## Files / areas

- `packages/skill-schema/src/` - new `categories.ts`, `public.ts`, tests
- `apps/api/src/db/schema.ts`, `apps/api/drizzle/` - column + migration
- `apps/api/src/db/skills.ts`, `apps/api/src/routes/skills.ts` - payload
- `apps/api/src/review/classify.ts` (+ test), `apps/api/src/publish/publish.ts`
- `apps/api/src/seed/backfill-categories.ts`, `apps/api/package.json`
- `apps/web/src/lib/filterSkills.ts` (+ test),
  `apps/web/src/components/home/Directory.tsx`,
  `apps/web/src/components/home/FilterSidebar.tsx` (new),
  `apps/web/src/components/skill/Row.tsx`

## Data / contracts (load-bearing)

- **`CATEGORIES`** in `packages/skill-schema`: `{ slug, label, description }[]`.
  Slugs are stored in the DB as plain text - renaming a slug later is a data
  migration, so treat slugs as frozen once the backfill runs. Labels are free to
  change.
- **`publicSkillSummary.category`**: `CategorySlug | null`, optional in the
  schema for skew tolerance. The CLI (feature 15) and detail pages inherit it.
- Deliberate deviation from `project-overview.md`: no `categories` DB table and
  no `Tag` model - the taxonomy is a shared code constant with no admin CRUD.
  Reconcile the overview's data model at the next `/overview` run.

## Testing

- Logic gate applies: Steps 1-4 and the `filterSkills` change ship tests in the
  same diff (schema parse/reject, payload mapping, classifier guard rails,
  filter param). The chip row itself is UI and rides on build + screenshot.
- Dev smoke: with `ANTHROPIC_API_KEY`, `db:backfill-categories` fills the dev
  catalog and the sidebar filters it; without the key everything runs and every
  skill stays uncategorized (single Uncategorized entry).
- Prod (at `/complete`, explicit approval): push applies the migration via
  Render pre-deploy; run the backfill against `PROD_DATABASE_URL` (~134 calls,
  well under $0.10); spot-check the homepage.

## Notes for the AI

- Mirror the established `ensure.ts` / `backfill-ai-reviews.ts` patterns for
  Step 3/4 - same failure tolerance, same entry-module guard, same env handling.
- `classifyCategory` needs only `name` + `summary` (already on the skill row and
  in the manifest at publish) - no R2 fetch, unlike `ensureAiReview`.
- Skill names and summaries are untrusted content: keep the content-as-data
  framing and validate the model's answer against the taxonomy before storing.
- The sidebar's counts come from the loaded list client-side; no new API
  endpoint. Sidebar state is presentation only - keep it out of `filterSkills`
  (which stays a pure function) and in the island's React state +
  `localStorage`. Guard `localStorage` reads for SSR/prerender safety (read in
  an effect or lazy initializer, never at module scope).
- `publicSkillSummarySchema` is a `strictObject`: keep `category` optional so a
  web build deployed alongside an older API still parses (the `noteCount`
  precedent).

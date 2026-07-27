# Current Feature

> **Generated file.** Holds the one feature or fix being built right now. Run
> `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
> an ad-hoc fix. Build one thing at a time; `/complete` archives it (to
> `blueprint/history/features/` or `blueprint/history/fixes/`) and resets this file.

## Feature 19 - Works-with integrations facet

**Build-plan item:** 19

## Goal

Let people find skills by the external tool or service they touch ("show me the
Obsidian skills", "anything that drives GitHub") - an axis categories cannot
express, since a skill has one category but may integrate with several tools.
A fixed integration vocabulary, Haiku-classified per skill like categories,
filterable from a "Works with" sidebar group.

## In scope

- **Vocabulary** - `INTEGRATIONS` (slug, label, description) in
  `packages/skill-schema`; descriptions double as classifier guidance. Draft
  list below; reviewed at Step 1. Slugs frozen once stored; additions are fine
  later, renames are a data migration.
- **Storage** - nullable `integrations` text-array column on `skills`.
  **`null` = never classified, `[]` = classified as "no integrations"** - the
  distinction is what keeps the backfill idempotent.
- **Classifier** - `classifyIntegrations(env, {name, summary})`: one Haiku
  call, content-as-data hardening, structured array output; every element must
  be in the vocabulary or the whole answer resolves to `null` (mirror
  `classifyCategory`'s strictness); `[]` is a valid "none" answer. Separate
  call from the category classifier - all 134 skills already have categories,
  so a merged call would save nothing on the backfill and would tangle
  `ensureCategory`'s skip-if-set logic.
- **Publish hook** - `ensureIntegrations` (skip when `integrations` is not
  null, never throws) called from `publishSubmission` beside the others.
- **`db:backfill-integrations`** - classifies published skills where
  `integrations` is null; logs generated/skipped/failed plus a per-integration
  distribution; idempotent; entry-module guard.
- **Public payload** - `integrations` optional-nullable array on
  `publicSkillSummary` (detail inherits), the `noteCount`/`category` skew
  precedent.
- **Filter UI** - `integration: IntegrationSlug | 'all'` in `filterSkills`
  (single-select, AND-ed with the category filter); a "Works with" group in
  `FilterSidebar` listing only nonzero integrations with counts, hidden
  entirely when every count is zero (keyless envs); "Works with" chips on the
  detail header meta line.

## Out of scope

- **Freeform or author-declared tags** - the vocabulary is curated code
  constant; no Tag DB model. Ongoing deliberate deviation from the overview's
  Tag many-to-many; reconcile at the next `/overview`.
- **Server-side `?integration=` param** - client-side filtering over the full
  list, same as category.
- **Row display** - the minimal 2-line row stays as is; the facet lives in the
  sidebar and on the detail page.
- **Multi-select filtering** - one integration at a time, like category.
- **Re-classification tooling** - vocabulary additions only classify new
  publishes; a bulk re-classify (null the column, re-run) stays a manual SQL
  step.

## Draft vocabulary (review at Step 1)

| Slug | Label | Likely members today |
| --- | --- | --- |
| `github` | GitHub | gh-cli, git-workflow, pr/issue skills |
| `obsidian` | Obsidian | obsidian-cli, kepano set, json-canvas |
| `office-files` | Office files | docx, pptx, xlsx |
| `pdf` | PDF | pdf, doc pipelines |
| `browser` | Browser | webapp-testing, screenshot-driven skills |
| `docker` | Docker | devcontainer-setup |
| `mcp` | MCP | mcp-builder |
| `anthropic-api` | Anthropic API | claude-api |
| `gmail` | Gmail | (future submissions) |
| `google-calendar` | Google Calendar | (future) |
| `google-drive` | Google Drive | (future) |
| `slack` | Slack | (future) |
| `notion` | Notion | (future) |
| `jira` | Jira | (future) |
| `aws` | AWS | (future) |
| `kubernetes` | Kubernetes | (future) |
| `postgres` | Postgres | (future) |
| `redis` | Redis | (future) |

Empty entries cost nothing in the UI (zero-count rows are hidden) and prime the
classifier for incoming submissions. Expect most catalog skills to land `[]` -
the facet filters, it does not partition.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.

## Build steps

- [x] **Step 1 - vocabulary + contract in `skill-schema`.** `integrations.ts`:
  `INTEGRATIONS` (table above), `integrationSlugSchema`, `IntegrationSlug`;
  `integrations: z.array(integrationSlugSchema).nullable().optional()` on
  `publicSkillSummarySchema`; export from the index. *Done when:* `pnpm test`
  green; tests cover valid slug, unknown slug rejected, summary parsing with a
  list / `null` / absent, and an unknown element in the list rejected.

- [x] **Step 2 - DB column + API payload.** Nullable `integrations`
  text-array on `skills` (typed `IntegrationSlug[]`), migration, threading
  through `db/skills.ts` mappers, `setSkillIntegrations` helper, route tests
  showing value and `null`. `SkillRow` fixtures gain `integrations: null`.
  *Done when:* migration exists under `apps/api/drizzle/`; `pnpm test` green.

- [x] **Step 3 - classifier + publish hook.**
  `apps/api/src/review/classify-integrations.ts`: `classifyIntegrations` with
  structured output (array of vocabulary enums), strict validation (any
  unknown element -> `null`), `[]` allowed, `null` on missing key / refusal /
  malformed / API error - never a throw. `ensureIntegrations` in
  `review/ensure.ts` (skip when not null), publish hook call. Tests mirror the
  category set: injection stays in the data turn, valid list stored, `[]`
  stored, unknown element -> nothing stored, no key / throw -> no-op, publish
  stays green. *Done when:* `pnpm test` green with and without `env`.

- [x] **Step 4 - `db:backfill-integrations`.** Mirror `backfill-categories`
  with the null-vs-`[]` select; log distribution. Run against dev, eyeball the
  spread; immediate second run reports zero to classify. *Done when:*
  `pnpm build` green; keyless run reports nothing to classify; with a key the
  dev catalog is classified and a re-run is a no-op.

- [x] **Step 5 - filter + sidebar + detail chips.** `filterSkills` gains
  `integration` (tests: match, 'all', no-integrations skill excluded from a
  slug filter); `FilterSidebar` gets the "Works with" group (nonzero counts
  only, group hidden when empty); detail header meta line shows "Works with"
  labels when present. *Done when:* `pnpm test` green; `pnpm build` green;
  screenshots of the sidebar filtering by an integration and of the detail
  chips.

## Files / areas

- `packages/skill-schema/src/integrations.ts` (new, +test), `public.ts`
  (+test), `index.ts`
- `apps/api/src/db/schema.ts`, `apps/api/drizzle/` (migration),
  `apps/api/src/db/skills.ts`, route tests
- `apps/api/src/review/classify-integrations.ts` (new, +test),
  `review/ensure.ts` (+tests), `publish/publish.ts`
- `apps/api/src/seed/backfill-integrations.ts` (new), `apps/api/package.json`
- `apps/web/src/lib/filterSkills.ts` (+test),
  `apps/web/src/components/home/FilterSidebar.tsx`,
  `apps/web/src/components/skill/DetailHeader.tsx`

## Data / contracts (load-bearing)

- **`INTEGRATIONS`**: `{ slug, label, description }[]` - slugs stored in the
  DB as text array elements, frozen once the backfill runs; labels free.
- **`publicSkillSummary.integrations`**: `IntegrationSlug[] | null`, optional
  in the strict schema for skew tolerance. CLI and detail inherit.
- **`null` vs `[]`** on the column is the classified-or-not signal; the
  backfill and `ensureIntegrations` key on it. Do not collapse them.

## Testing

- Logic gate applies: Steps 1-4 and the `filterSkills` change ship tests in
  the same diff. Sidebar group and detail chips are UI, riding on build +
  screenshot.
- Dev smoke: with `ANTHROPIC_API_KEY`, backfill classifies the catalog and the
  sidebar filters by `obsidian`/`github`; without the key everything runs,
  every skill stays `null`, and the "Works with" group does not render.
- Prod (at `/complete`, explicit approval): push applies the migration via
  Render pre-deploy; run `db:backfill-integrations` against
  `PROD_DATABASE_URL` (~134 calls, ~$0.05); spot-check the live sidebar.

## Notes for the AI

- Mirror the category patterns file for file: `classify.ts` for the
  classifier, `ensureCategory` for the hook, `backfill-categories.ts` for the
  script - same env handling, same failure tolerance, same strictness.
- Skill names and summaries are untrusted; keep the content-as-data framing
  and validate every returned element against the vocabulary before storing.
- Drizzle text arrays: `text('integrations').array().$type<IntegrationSlug[]>()`;
  check how the migration renders and that `$inferSelect` fixtures across the
  test suite gain `integrations: null` (the feature 17 lesson).
- Classifier prompt should say "return an empty list when none apply" -
  without it, models overreach and tag everything.
- Sidebar counts come from the loaded list client-side; no new endpoint. The
  category filter and integration filter AND together in `filterSkills` -
  keep it a pure function.
- Counts in both sidebar groups derive from the full unfiltered list (the
  existing category behavior) - do not recompute them against the other
  active facet; consistency beats cleverness here.
- Selecting a category + integration pair with zero matches must show the
  existing "no results" state, not an empty white void - it already exists
  for search, just confirm it triggers.

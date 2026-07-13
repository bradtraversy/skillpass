# Feature: 13a - Featured / New / Verified

**From build-plan:** feature 13a (split from 13, Homepage ranking & curation)
**Status:** not started

## Goal

Make the homepage tabs real. Today `Trending | New | Verified | Workflow packs`
render, the active tab highlights on click, but `activeTab` is never applied - the
list never changes. This feature backs three of them with real logic: **Featured**
and **Verified** as admin-set flags on a skill, **New** by recency, and wires the
active tab into the directory filter. Workflow packs is deferred to 13b (it needs
an `isPack` signal persisted at publish, and no packs are published yet).

## In scope

- Two new admin-set boolean flags on `skills`: `featured` and `verified` (both
  default false).
- Exposing `featured` and `verified` on the public skill summary (and therefore
  detail, which extends it).
- Admin-only endpoints to toggle `featured` and `verified` on a published skill,
  following the 10c flag/unflag pattern.
- Wiring the homepage tabs to the filter: rename `Trending` -> `Featured`; apply
  the active tab (Featured / New / Verified) to the rendered list.
- A minimal admin control to set the flags without curl.

## Out of scope

- **Workflow packs / `isPack`** - deferred to 13b (needs publish-path persistence
  and pairs with publishing the first pack).
- **Traffic / install-based "trending"** - no usage ranking exists; Featured is
  curated, per the metrics strategy.
- **Maintainer-verification concept** - `verified` is an admin flag on the skill
  ("the directory vouches for this"), not a badge on the User.
- **Category / tag filters** - feature 17.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan the step before any code.
2. Implement just that step.
3. Show the diff; you read and approve it.
4. Optional checkpoint commit; `/complete` makes the real feature commit.

## Build steps

- [x] **Step 1 - `featured` + `verified` columns + migration** - add two
  `boolean('...').notNull().default(false)` columns to the `skills` table in
  `apps/api/src/db/schema.ts`; generate the Drizzle migration and apply it to dev.
  *Done when:* `pnpm db:generate` produces a migration adding both columns with a
  `false` default (existing rows backfill), the dev DB has the columns, and
  `pnpm typecheck` passes. The app behaves exactly as before.

- [x] **Step 2 - expose the flags in the public summary** - add
  `featured: z.boolean()` and `verified: z.boolean()` to `publicSkillSummarySchema`
  (`packages/skill-schema/src/public.ts`), and set them from `r.skill.featured` /
  `r.skill.verified` in `publicSkillSummary()` (`apps/api/src/db/skills.ts`).
  `publicSkillDetail` inherits them via its existing spread. Update any test
  fixtures / builders that construct a summary. *Done when:* `GET /skills` and
  `GET /skills/:slug` responses include `featured` and `verified`; the mapping
  test asserts pass-through; build + typecheck green.

- [x] **Step 3 - admin toggle endpoints** - add `POST /admin/skills/:slug/feature`
  and `POST /admin/skills/:slug/verify` (body `{ value: boolean }`) in
  `apps/api/src/routes/admin.ts`, guarded by the existing `requireRole('admin')`;
  each looks up the skill, requires `status === 'published'`, and sets the flag via
  a small `setSkillCuration` helper in `db/skills.ts`. Mirror the flag/unflag
  shape. *Done when:* as admin, `feature {value:true}` sets `skills.featured` and
  returns `{ slug, featured: true }` (same for verify); non-admin -> 403; unknown
  slug -> 404; non-published -> 409. Handler tests cover set + each guard.

- [x] **Step 4 - wire the tabs into the filter** - in
  `apps/web/src/lib/filterSkills.ts`, take a `tab` ('featured' | 'new' | 'verified')
  and apply it: **New** = all, newest first; **Featured** = `featured` only, newest
  first, but fall back to all (newest first) when nothing is featured; **Verified** =
  `verified` only. In `Directory.tsx`, rename the `Trending` tab to `Featured`,
  remove the `Workflow packs` tab (returns in 13b), and pass the active tab into
  `filterSkills`. *Done when:* clicking Featured / New / Verified changes the list
  as specified (the tabs are no longer dead); `filterSkills` tab logic has tests;
  the UI rides on a screenshot + build.

- [x] **Step 5 - admin-published skills default to verified** - when an admin
  publishes a skill, set `verified: true` at publish time (an admin's curated adds
  are vouched-for by definition, so "anything we add" comes in verified). Add an
  optional `verified` to `PublishInput`, pass `verified: input.verified ?? false`
  into the `createSkill` insert, and have the publish route pass
  `verified: c.get('user').role === 'admin'`. Featured stays a manual spotlight.
  *Done when:* an admin publish creates a skill with `verified: true`; a maintainer
  publishing their own skill stays `verified: false`; tests cover both.

- [x] **Step 6 - minimal admin curation control** - give the admin a way to set the
  flags without curl: a small Featured / Verified toggle per published skill in the
  admin surface (`apps/web/src/components/admin/AdminDashboard.tsx`), reading the
  published list from `GET /skills` and calling the step-3 endpoints. *Done when:*
  from `/admin`, an admin toggles Featured / Verified on a skill and the homepage
  Featured / Verified tabs reflect it. UI-only: screenshot + build.

## Files / areas

- `apps/api/src/db/schema.ts` - `skills.featured`, `skills.verified` columns.
- `apps/api/drizzle/` (generated migration).
- `packages/skill-schema/src/public.ts` - summary schema gains two booleans.
- `apps/api/src/db/skills.ts` - `publicSkillSummary` mapping + `setSkillCuration`.
- `apps/api/src/routes/admin.ts` - feature / verify endpoints.
- `apps/web/src/lib/filterSkills.ts` - tab-aware filtering.
- `apps/web/src/components/home/Directory.tsx` - rename tab, drop packs tab, wire `activeTab`.
- `apps/web/src/components/admin/AdminDashboard.tsx` - toggle control.
- Test files alongside the changed logic.

## Data / contracts

- **`skills` table (load-bearing):** add `featured boolean not null default false`
  and `verified boolean not null default false`.
- **`PublicSkillSummary` (load-bearing contract):** gains `featured: boolean` and
  `verified: boolean`. Consumed by the web directory/rows, `publicSkillDetail`
  (via spread), and the CLI's summary reads. It's a `strictObject`, so every
  producer must set both fields and every fixture that builds a summary must be
  updated, or the build fails.
- **Admin endpoints:** `POST /admin/skills/:slug/feature` and
  `POST /admin/skills/:slug/verify`, body `{ value: boolean }`, admin-only,
  published-only. Response `{ slug, featured }` / `{ slug, verified }`.

## Testing

`pnpm test` is a declared gate, so logic-bearing steps ship a test in the same diff:

- **Step 2** - `publicSkillSummary` mapping: `featured` / `verified` pass through
  from the row.
- **Step 3** - admin feature / verify handlers: sets the flag; 403 non-admin; 404
  unknown slug; 409 non-published.
- **Step 4** - `filterSkills` tab logic: New = recency; Featured = featured-only
  with recency fallback when none featured; Verified = verified-only.
- **Steps 1 and 5** are schema/UI - they ride on build + a screenshot, no unit test.

## Notes for the AI

- Follow the existing 10c flag/unflag idiom in `admin.ts` for the curation
  endpoints (look up by slug, guard `published`, guarded transition), for
  consistency.
- The migration must be `NOT NULL DEFAULT false` so existing published rows
  backfill cleanly.
- `PublicSkillSummary` is a `strictObject`; adding required booleans breaks every
  summary producer and fixture until updated - do that in the same step.
- `filterSkills` stays pure and client-side; the list API already orders by
  `publishedAt desc`, but sort explicitly in the New/fallback paths so the tab
  behavior doesn't depend on server order.
- Featured falls back to recency when nothing is featured so the default homepage
  tab is never empty before curation happens.
- Do not touch `isPack` / Workflow packs here - that's 13b.
- **Launch refinement (post-build):** at ~9 listings the Featured/New/Verified tabs
  converge (Featured is a tiny arbitrary subset, Verified ≈ New), so the homepage
  ships **New-only** - a static "Latest" list, newest-first, keeping the Verdict/Tool
  filters. The tab logic stays in `filterSkills` (dormant, tested) and the
  featured/verified flags + endpoints + admin toggle stay wired; re-add the tabs when
  the catalog grows and there are flagship packs worth featuring. Demo featured flags
  were cleared (0 featured, 8 verified in dev).

# Fix: Featured tab with curated ranking

**Type:** Fix

## The problem

The homepage has no real tabs: `Directory.tsx` hardcodes `tab: 'new'` and renders
a static "Latest" label. `filterSkills` already supports a `featured` tab, but
nothing in the UI can reach it. And featured ordering is newest-`publishedAt`-first,
so Brad's packs sit at #1/#2 only by publish-date accident - featuring anything
published after them (Stripe Pack, the 8/03 wave picks) would displace them.
Curated order needs to be deliberate, not chronological.

## The fix

Add a **Featured / Latest** tab row to the homepage directory and an explicit
**featured rank** so the featured list has a curated order, with the roster
driven from the seed manifest.

Design decisions:

- **`featuredRank`** - nullable integer column on `skills` (Drizzle migration in
  `apps/api/drizzle/`). Ranked featured sort by rank ascending; featured without a
  rank (e.g. admin-dashboard toggles) sort after ranked, newest-first. The
  `featured` boolean stays; rank is additive, so the admin feature toggle and
  existing payloads keep working.
- **`FEATURED_SLUGS`** - one ordered array in `apps/api/src/seed/listings.ts`
  (index + 1 = rank) replaces the scattered per-entry `featured: true` flags and
  the `featured` field in the seed schema. `run.ts` applies `featured` + rank for
  matching slugs after each listing (publish and skip paths, so re-runs converge)
  and warns about any `FEATURED_SLUGS` entry with no matching skill, so a slug
  typo can't fail silently. Additive only: removing a slug from the list doesn't
  unfeature it (that stays an admin-dashboard action).
- **No payload change - curated order travels as row order.** The published CLI
  (0.2.0 on npm) `safeParse`s `GET /skills` and detail responses against bundled
  `strictObject` schemas, so any new response field breaks every installed CLI
  (verified empirically: zod strict parse fails on unknown keys). Instead,
  `listPublishedSkills` orders rows server-side: featured first (rank asc, nulls
  last), then unranked featured, then the rest newest-first. `PublicSkillSummary`
  is untouched. Carried follow-up: loosen the CLI's response parsing before any
  future payload addition.
- **Tab semantics** in `filterSkills.ts`:
  - `featured` - featured rows only, preserving server (curated) order. Keep the
    existing fallback to the full list when nothing is featured.
  - `new` - pure newest-first (client sort; "Latest" should mean latest).
  - `verified` - unchanged (still unused by the UI).
  - blended default / search override - server order as-is.
- **Directory UI** - the static "Latest" span becomes two tab buttons, **Featured**
  (default) and **Latest**, reusing the existing active-tab styling. Featured
  default keeps the homepage leading with the curated picks (the point of the
  8/03 featured-first change). Tab changes reset pagination to page 1.
- **Search overrides the tab** - an active query searches the whole catalog
  (featured-first blended), not just the active tab, so searching "flutter" on
  Featured can't return a bogus empty state. Sidebar filters stay tab-scoped.
- **The featured 20, in rank order:** `ai-blueprint`, `editorial-workflow-skill`,
  `skill-creator`, `pdf`, `mcp-builder`, `frontend-design`, `humanizer`,
  `ui-ux-pro-max`, `last30days`, `ponytail`, `systematic-debugging`,
  `vercel-react-best-practices`, `web-design-guidelines`, `security-review`, `tdd`,
  `code-review-and-quality`, `dev-browser`, `obsidian-markdown`, `seo-audit`,
  `stripe-agent-toolkit`. (Keeps all 9 currently featured, adds 11; every author
  capped at 2 listings.)

Must not break: the CLI's parsing of `GET /skills` (field is optional), the admin
feature/unfeature toggle, category/integration/type filters, pagination, and the
seed run's idempotency.

## Build steps

- [x] **Step 1 - rank column and directory order.** Add `featuredRank` to the
  `skills` table (+ generated migration) and `setSkillCuration`, and order
  `listPublishedSkills` by featured/rank/date. No payload change. Done when
  `pnpm test` passes and apps/api introduces no new type errors.
- [x] **Step 2 - order-aware tab filtering.** Update `filterSkills`: featured tab
  filters featured preserving server order, `new` becomes pure newest-first,
  blended default preserves server order, active query overrides the tab. Done
  when tests cover each tab's semantics and the query override.
- [x] **Step 3 - tab row UI.** Featured/Latest tabs in `Directory.tsx`, Featured
  default, query overrides tab scope, page resets on tab switch. Done when the
  homepage shows both tabs working against the dev API (screenshot + build; UI
  step, no unit tests).
- [x] **Step 4 - seed manifest roster.** Replace per-entry `featured` flags with
  the ordered `FEATURED_SLUGS` list, apply rank + warn on unmatched slugs in
  `run.ts`. Done when `pnpm test` passes with listings tests updated and a test
  covering the rank application/warning logic.

## Verify

- Local: with dev API + web running (Brad starts them; web pinned to the port the
  API's live `WEB_ORIGIN` expects), re-run the seed against the dev DB, then check
  the homepage: Featured tab is default and lists the ranked 20 in order with
  `ai-blueprint` #1 and `editorial-workflow-skill` #2; Latest shows pure
  newest-first; searching on Featured returns whole-catalog matches; tab switch
  resets to page 1.
- `pnpm test` and `pnpm build` green.
- Prod: after merge/deploy, re-running the seed against prod applies the ranks
  (migration auto-runs via `preDeployCommand`). This is a separate, explicitly
  approved ops step - not part of `/implement`.

# Current Feature

> **Generated file.** Holds the one feature or fix being built right now. Run
> `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
> an ad-hoc fix. Build one thing at a time; `/complete` archives it (to
> `blueprint/history/features/` or `blueprint/history/fixes/`) and resets this file.

## Fix - Humanize the directory listing

**Type:** Fix

## The problem

Every row in the directory shows a repo slug for a name (`zeroize-audit`,
`aflpp`) and the raw SKILL.md frontmatter `description` truncated at 46
characters. That description is agent-facing trigger text ("Use when writing,
reviewing...") - it was never storefront copy, so a visitor scanning the list
can't tell what a skill is or why they'd want it. The tiles are 134 identical
gray monograms, and the strongest trust cue in the catalog (author:
`anthropics`, `trailofbits`) never appears on the row.

## The fix

Give each skill human display copy, generated the same way categories were,
plus three row-level presentation upgrades:

- **`displayName` + `tagline` columns** on `skills`, filled by one
  injection-hardened Haiku call per skill (`generateDisplayCopy`, mirroring
  `classifyCategory`: content-as-data framing, structured output, length-capped
  validation, `null` on any failure, never a throw). `ensureDisplayCopy`
  publish hook (skip-if-set, failure-tolerant) plus a
  `db:backfill-display-copy` script. Not folded into `AiReview` (would
  invalidate 134 cached reviews - the category lesson).
- **Payload**: both fields optional-nullable on `publicSkillSummarySchema`
  (the `noteCount` / `category` precedent for deploy skew).
- **Row copy**: display name big with the slug in small mono beside it (the
  slug is still the `skillpass add` handle); below it the tagline, falling
  back to the first sentence of `summary`, full column width with a two-line
  clamp instead of the 46ch truncate.
- **Row identity**: the monogram tile picks up a per-category tint (static
  class map in the web app - presentation only, not schema); author
  (`attributedTo ?? maintainer`) shown on the row. Detail header shows the
  display name too so the click-through doesn't land back on the slug.

Must not break: keyless environments (everything renders from the fallback
copy), older-API parsing (strict schema keeps new fields optional), the
`skillpass add` slug affordance, and the existing card/filter behavior.

## Build steps

- [x] **Step 1 - schema, columns, payload.** `displayName` + `tagline`
  (nullable text) on `skills` in `schema.ts` + migration; both fields
  `z.string().min(1).nullable().optional()` on `publicSkillSummarySchema`;
  thread through `db/skills.ts` mappers (list + detail + version-pinned) and a
  `setSkillDisplayCopy` helper. *Done when:* migration file exists; `pnpm test`
  green; schema tests parse with and without the fields; route tests show both
  fields (value and `null`).

- [x] **Step 2 - generator, publish hook, backfill.**
  `apps/api/src/review/display-copy.ts`: `generateDisplayCopy(env, {name,
  summary})` - one Haiku call, structured output `{displayName, tagline}`,
  answers trimmed and length-capped (displayName <= 48 chars, tagline <= 120),
  `null` on missing key, API failure, or out-of-bounds output.
  `ensureDisplayCopy` next to `ensureCategory` in `review/ensure.ts`, called
  from `publishSubmission`; `db:backfill-display-copy` script matching
  `backfill-categories` (idempotent, entry-module guard, logs
  generated/skipped/failed). *Done when:* `pnpm test` green with and without
  `env` (mocked client: fresh skill stored, already-set no-op, no key no-op,
  junk output stores nothing, publish stays green); keyless backfill run
  reports all skipped.

- [x] **Step 3 - row and detail UI.** *(Iterated at review: the first pass kept
  slug + tool chips inline and read cramped. Final row is minimal 2-line - name
  alone, full-width tagline, right column stacks check/version/time, category
  label, author. Slug, tool chips, note count, and version left to the detail
  page - versions are all 1.0.0 at seed scale, so the column carried no signal.)* `Row.tsx`: display name (fallback
  `name`) with slug in mono beside it; meta line shows the tagline or the
  first sentence of `summary` (`firstSentence` helper in `lib/format.ts`),
  `line-clamp-2` at full column width; tile tinted via a
  category-to-classes map; author `by {attributedTo ?? maintainer}` on the
  row. `DetailHeader.tsx`: display name with slug beneath/beside.
  *Done when:* `pnpm test` green (`firstSentence` cases: one sentence,
  trigger-clause second sentence, no period); `pnpm build` green; screenshot
  of the listing with generated copy (dev backfill) and one uncategorized/
  fallback row.

## Verify

- `pnpm test` and `pnpm build` green at every step.
- Dev: run `db:backfill-display-copy` with `ANTHROPIC_API_KEY`; listing shows
  human names and taglines; a second run is a no-op; without the key rows
  render the slug + first-sentence fallback (no blanks, no crashes).
- Screenshots: desktop listing (tinted tiles, display names, taglines,
  authors), one row without display copy proving the fallback.
- Prod (at `/complete`, explicit approval): push applies the migration via
  Render pre-deploy, then `db:backfill-display-copy` against
  `PROD_DATABASE_URL` (~134 calls, ~$0.05-0.10).

## Files / areas

- `packages/skill-schema/src/public.ts` (+tests)
- `apps/api/src/db/schema.ts`, `apps/api/drizzle/` (migration),
  `apps/api/src/db/skills.ts`, `apps/api/src/routes/skills.ts` (+tests)
- `apps/api/src/review/display-copy.ts` (new, +test),
  `apps/api/src/review/ensure.ts` (+tests), `apps/api/src/publish/publish.ts`
- `apps/api/src/seed/backfill-display-copy.ts` (new), `apps/api/package.json`
- `apps/web/src/lib/format.ts` (+test), `apps/web/src/components/skill/Row.tsx`,
  `apps/web/src/components/skill/DetailHeader.tsx`

## Notes for the AI

- Mirror the category-feature patterns exactly: `classifyCategory` for the
  generator shape, `ensureCategory` for the hook, `backfill-categories.ts`
  for the script. Same env handling, same failure tolerance.
- Skill names and summaries are untrusted content - keep the content-as-data
  prompt framing and validate/cap the model output before storing.
- Category tint map lives in the web app as static Tailwind class strings
  (JIT needs literal classes); uncategorized keeps the current gray.
- Adding nullable columns doesn't break typed fixtures, but any
  `$inferSelect`-typed test fixtures may still need the new keys - check
  `SkillRow` fixtures like feature 17 did.

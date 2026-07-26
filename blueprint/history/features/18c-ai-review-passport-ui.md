# Current Feature

> **Generated file.** Holds the one feature or fix being built right now. Run
> `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
> an ad-hoc fix. Build one thing at a time; `/complete` archives it (to
> `blueprint/history/features/` or `blueprint/history/fixes/`) and resets this file.

## Feature 18c - AI review passport UI

**Build-plan item:** 18c (third sub-feature of 18, AI skill review)

> Logged retrospectively: 18c was built and dev-verified in the same session as
> 18b (the payload it renders), on the same branch, without a separate spec pass.
> This entry records what shipped.

## Goal

Render the cached AI review on the skill detail passport: the plain-English
"what this skill does" summary and the clear/caution/concern verdict, framed
explicitly as an AI-generated starting point, not a guarantee.

## What shipped

- **`apps/web/src/components/skill/AiReview.tsx`** - a self-contained section
  below the passport: an "AI Review" header with a verdict chip (Clear/Caution/
  Concern, dot colored by the existing `risk-low/med/high` tokens), the summary
  under a "What this skill does" label, the model's reasoning, and a footer
  disclaimer ("AI-generated from the skill's source, not a guarantee... read the
  source yourself before installing").
- **`apps/web/src/components/skill/SkillDetail.tsx`** - renders
  `<AiReview review={detail.aiReview} />` after `<Passport />` on both the
  latest and version-pinned detail views (both flow through this component).
- **Null-tolerant by design** - the component returns nothing when `aiReview`
  is `null` (no key set, review not yet generated, or generation failed), so
  the detail page is unchanged for unreviewed skills.

## Verify

- UI component, so it rides on build + dev smoke per the testing scope rule
  (no unit tests for presentation).
- `pnpm build` green.
- Dev smoke with `ANTHROPIC_API_KEY` set and the 18b backfill run: detail pages
  showed the populated review section with the correct verdict chip; skills
  without a cached review rendered no section (verified in the 2026-07-26 dev
  session alongside 18b's smoke).

# Fix: Seed wave 6 - popular broad-appeal skills

**Type**: Fix (ad-hoc, chat-driven)
**Branch**: `chore/seed-wave-6`
**Date**: 2026-07-28

## What changed

Extended `apps/api/src/seed/listings.ts` with 34 curated listings (catalog
134 -> 168) chosen for immediate broad appeal, plus the manifest test updates.

- **Viral singles**: blader/humanizer (featured), mvanhorn/last30days (featured),
  OthmanAdi/planning-with-files (default branch is `master`, URL pinned there),
  ayghri/i-have-adhd, and the DietrichGebert/ponytail 6-skill pack (main skill
  featured).
- **Official vendor packs, cherry-picked**: Vercel (4), Google Workspace CLI
  (8 core service skills of ~95 total), Notion (notion-cli), Supabase (2),
  Cloudflare (5), Expo (4, nested `plugins/expo/skills/...`).
- **Dropped**: op7418/guizang-ppt-skill - root skill bundles a >1MB showcase
  image, rejected by the snapshot pipeline's file cap (noted in the manifest).

## Rollout

- Dev: `pnpm db:seed` - 34 published, 0 failed, idempotent re-run skips 168.
- Prod: same runner via the accepted `PROD_DATABASE_URL` Node wrapper - 34
  published, 0 failed; verified on api.skillpass.dev (168 skills, categories,
  display copy, integrations, AI reviews all populated at publish).
- "Works with" facet gains real members: gmail, notion, postgres, mcp.

## Evidence

- `pnpm test` 749/749 green (manifest length/counts/URL-shape/featured tests
  updated: 169 entries, six waves).
- Dev API and prod API spot checks for humanizer, last30days, ponytail,
  gws-gmail, notion-cli, supabase, expo-router.

## Notes

- Haiku classifier is nondeterministic across environments: last30days is
  `knowledge-notes` on dev but `code-analysis` on prod. A versioned
  review-engine regeneration path (already an open question) would fix drift.

# Fix: Seed wave 7 - big-name community skills + official AWS

**Type**: Fix (ad-hoc, chat-driven)
**Branch**: `chore/seed-wave-7`
**Date**: 2026-07-28

## What changed

Extended the seed manifest with 26 curated listings (catalog 168 -> 194).

- **Big-name community**: mattpocock/skills engineering picks (code-review,
  diagnosing-bugs, domain-modeling, prototype, tdd), multica-ai's
  karpathy-guidelines (fan-distilled, attributed to multica-ai),
  nextlevelbuilder's ui-ux-pro-max (featured) + design-system (nested under
  `.claude/skills/`), Leonxlnx taste-skill (publishes as
  `design-taste-frontend` - slug comes from SKILL.md, not the folder).
- **Marketing/SEO**: 8 picks from coreyhaines31/marketingskills (copywriting,
  cro, seo-audit, content-strategy, analytics, pricing, launch, emails) plus
  AgriciDaniel/claude-seo's umbrella `seo` skill - first non-dev-audience
  content in the catalog.
- **Browser automation**: SawyerHood/dev-browser and browser-act - the
  `browser` works-with slug gains real members.
- **Official AWS**: 6 core skills from aws/agent-toolkit-for-aws (aws-cdk,
  aws-serverless, aws-iam, aws-database, aws-deployment, amazon-bedrock).
- **Skipped on format**: calesthio/OpenMontage (loose director .md files, no
  SKILL.md), shanraisshan/claude-code-best-practice (guide repo),
  microsoft/skills (docs-site shaped).

## Rollout

- Pre-checks: default branch and SKILL.md presence verified per repo before
  seeding (the wave-6 lessons).
- Dev seed: 26 published, 0 failed. Prod seed via the PROD_DATABASE_URL
  wrapper: 26 published, 0 failed. Verified on api.skillpass.dev (194 skills,
  enrichment populated).

## Evidence

- `pnpm test` 749/749 green (manifest tests: 195 entries, seven waves, new
  per-source counts, ui-ux-pro-max added to featured).
- Prod API spot checks for code-review, karpathy-guidelines, ui-ux-pro-max,
  copywriting, seo, dev-browser, aws-cdk, design-taste-frontend.

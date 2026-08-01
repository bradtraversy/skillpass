# Fix: Curated listings attribute to the repo owner

**Type**: Fix (ad-hoc, chat-driven)
**Branch**: `fix/curated-attribution`
**Date**: 2026-08-01

## What changed

Curated listings (admin submits someone else's repo) led the detail page's
Maintainer block with the curator's avatar and username; the real author only
appeared as a faint "curated from X's repo" suffix. A vercel skill read as
"maintained by bradtraversy". Data was always correct (`attributedTo` set at
publish; directory rows already led with it) - display only.

`SkillDetail.tsx`: when `attributedTo` is set, the section heads "Author" and
leads with the repo owner - GitHub avatar (`github.com/<owner>.png?size=76`),
name linking to their GitHub profile - with "curated by <username>" as the
faint second line linking to the curator's SkillPass profile. Non-curated
listings keep the previous "Maintainer" rendering, minus the now-redundant
suffix.

Blast radius (intentional): all current listings are curated seeds, so every
detail page flips to leading with its source owner (anthropics, vercel, obra,
...) once deployed.

## Verification

- `pnpm build`: green (`astro check` 0 errors). UI-only change, no logic - no
  new tests per the testing scope rule; `pnpm test` green before the commit.
- Headless screenshots on dev: `list-npm-package-content` leads with vercel,
  `pdf` leads with anthropics, both showing "curated by bradtraversy" beneath.
- The non-curated branch has no live specimen (all 195 dev listings are
  curated); it is the prior markup verbatim and type-checked.

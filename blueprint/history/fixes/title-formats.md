# Fix: Title format optimization

**Type:** Fix

## The problem

The SEO baseline shipped titles that spend their weight on the wrong words.
"AI Skills Directory" collides with the human-upskilling meaning of "AI skills",
skill pages say "Skill Passport" (internal vocabulary nobody searches) and omit
the brand entirely, and generic skill names ("Amazon Bedrock", "AWS IAM") get no
qualifier telling search engines or SERP readers what the page actually is.

## The fix

Retitle the four page types; docs and submit stay as they are.

| Page | New title |
|---|---|
| Home | `Validated AI Agent Skills Directory - SkillPass` (keyword-first: targets the category phrase, keeps the brand) |
| Skill | `{name} - AI Agent Skill - SkillPass` |
| Version | `{name} v{version} - SkillPass` |
| Profile | `{displayName} - Skills on SkillPass` |

Fallbacks when the head fetch fails keep the same shapes with the raw
slug/username. Copy-only change: no logic, no new tests; rides on build plus
view-source evidence.

## Build steps

- [x] **1. Retitle the four pages** - `index.astro`, `skills/[slug]/index.astro`,
  `skills/[slug]/[version].astro`, `u/[username].astro`.
  **Done when:** view-source shows the new formats on all four page types
  (including a fetch-failure fallback), `pnpm build` green.

## Verify

- View-source titles on `/`, a real skill page, a version page, a profile page,
  and a bogus slug for the fallback shape.
- `pnpm build` green.

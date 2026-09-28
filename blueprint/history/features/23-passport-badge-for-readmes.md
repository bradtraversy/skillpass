# Feature: Passport badge for READMEs

**From build-plan:** feature 23
**Build attempt:** 1
**Status:** verified

**Branch:** `feature/passport-badge-for-readmes`

## Goal

A skill author can paste one markdown line into their README and show a live SkillPass badge:
the latest published version's validation status and risk level, rendered as an SVG by the
API and linking back to the skill page. It shows trust, never install counts. The detail
page and the docs hand out the snippet.

## In scope

- `GET /skills/:slug/badge.svg` on the API: looks up the published skill by slug, reads the
  latest published version's passport, and answers an SVG badge with
  `Content-Type: image/svg+xml; charset=utf-8` and
  `Cache-Control: public, max-age=300, s-maxage=300` (GitHub's image proxy and browsers
  re-fetch after five minutes, so a new publish shows up within minutes and a README view
  never costs more than one query per five minutes per proxy node).
- A pure badge renderer in `apps/api/src/badge/render.ts`: shields-style flat badge, three
  segments (`skillpass`, the status, `<risk> risk`), 20px tall, Verdana 11px text with the
  usual shadow, `role="img"`, an `aria-label` and `<title>` reading
  `skillpass: <status>, <risk> risk`. Status colors: passed green, warning yellow, failed
  red. Risk colors: low green, medium yellow, high orange, critical red (the shields
  palette, so it sits naturally beside other badges). Segment widths come from a small
  Verdana width estimate plus padding, and every text run carries `textLength` so the
  glyphs fit the box on any renderer.
- Unknown or unpublished slug: the same JSON 404 every other skill route returns. A badge
  disappears from a README when the listing is unlisted, which is the honest signal.
- Detail page: a "README badge" section after Versions showing the live badge image from the
  API and the markdown snippet in a copy box:
  `[![SkillPass](<API_URL>/skills/<slug>/badge.svg)](https://skillpass.dev/skills/<slug>)`.
  The snippet builder lives in `apps/web/src/lib/badge.ts`; the site origin comes from
  `import.meta.env.SITE` (Astro's `site` setting) so the link always points at the public
  site, and the image URL uses `API_URL` like every other API link.
- `CopyBox` moves from `InstallBar.tsx` to `components/ui/CopyBox.tsx` with an optional
  `prefix` (the install bar keeps its `$`) and a `label` for the copy button, so the badge
  section and the install bar share one copy control.
- Docs: a "README badge" section on `/docs/submitting` under "After you publish" with the
  snippet, what the badge shows, the five-minute refresh, and that an unlisted skill's
  badge 404s.

## Out of scope

- Per-version badges (`/skills/:slug/:version/badge.svg`), badge styles, custom labels,
  or a skill name on the badge. The badge never renders user-controlled text.
- Install or download counts on the badge (the build plan rules them out).
- An in-process response cache or a rate limiter on the badge route: it costs one indexed
  query, the same as `GET /skills/:slug`, and the cache headers do the rest.
- A pack member badge; a pack's badge is the pack listing's passport.
- Public API docs for the endpoint (feature 28 covers the read endpoints).
- A CLI change or npm release.

## Build loop

Build one small step at a time. `blueprint/config.json` is absent, so defaults apply:
`workflow.stepReview: feature` (one review packet after all steps) and checkpoint commits
disabled. Independent review runs only if the `when-sensitive` gate selects it; this
feature adds a read-only, anonymous, enum-only render with no auth, secrets, user data,
persistence, or user-controlled text, so it is not selected. `/complete` makes the final
feature commit.

## Build steps

- [x] 1. **Badge renderer** - add `apps/api/src/badge/render.ts` exporting
  `renderBadge({ validationStatus, riskLevel }): string` plus the color maps and the width
  estimator. Done when: `render.test.ts` proves the output is one `<svg>` with `role="img"`,
  the aria-label and title `skillpass: passed, low risk`, three text runs (`skillpass`,
  `passed`, `low risk`) each with a `textLength`, the total width equal to the sum of the
  three segment widths, the status and risk fills for every enum value (passed/low green,
  warning/medium yellow, high orange, failed/critical red), and a wider badge for
  `critical risk` than for `low risk`; `pnpm test` is green.
- [x] 2. **Badge route** - register `GET /:slug/badge.svg` in `apps/api/src/routes/skills.ts`
  before the `/:slug/:version` routes, using `findPublishedSkillBySlug` and the record's
  passport status and risk. Done when: `skills.test.ts` proves an unknown or unpublished
  slug 404s with the JSON envelope, a published slug answers 200 with
  `image/svg+xml; charset=utf-8`, the five-minute `Cache-Control`, and a body equal to
  `renderBadge` for that passport, that the response needs no session, and that a
  `warning` passport with `medium` risk renders those words; `pnpm test` is green.
- [x] 3. **Snippet helpers and the detail section** - add `apps/web/src/lib/badge.ts`
  (`badgeUrl(slug)`, `badgeMarkdown(slug)`), move `CopyBox` to
  `apps/web/src/components/ui/CopyBox.tsx` with `prefix` and `label` props, add
  `components/skill/BadgeSnippet.tsx`, and render it from `SkillDetail.tsx` after Versions.
  Done when: `badge.test.ts` proves the URL and the markdown for a plain slug and for a slug
  needing encoding, and the markdown links to `https://skillpass.dev/skills/<slug>`;
  `pnpm test` is green; `pnpm build` is green; the detail page shows the badge image and
  the snippet with a working copy button (manual check against a running API and web).
- [x] 4. **Docs** - add the "README badge" section to `apps/web/src/pages/docs/submitting.astro`.
  Done when: `pnpm build` is green and `/docs/submitting` renders the section with the
  snippet in a code block.

- [x] 5. **Show the badge where authors decide** - a "What you get" block on the submit page
  (`components/submit/SubmitGuide.astro`) with a live example badge from the API and one line, a
  sentence under "The Skill Passport" on `/docs` linking to the README badge section, and an
  `id="readme-badge"` anchor on that section, and the publish confirmation in
  `components/submit/ValidationProgress.tsx` shows the new skill's badge with an "Add the badge
  to your README" link to its page. Done when: `pnpm build` is green and `/submit` renders the
  example badge and the line.

## Files / areas

- `apps/api/src/badge/render.ts`, `apps/api/src/badge/render.test.ts` - new.
- `apps/api/src/routes/skills.ts`, `apps/api/src/routes/skills.test.ts` - the route.
- `apps/web/src/lib/badge.ts`, `apps/web/src/lib/badge.test.ts` - new.
- `apps/web/src/components/ui/CopyBox.tsx` - new, extracted from `InstallBar.tsx`.
- `apps/web/src/components/skill/InstallBar.tsx` - imports the shared `CopyBox`.
- `apps/web/src/components/skill/BadgeSnippet.tsx` - new.
- `apps/web/src/components/skill/SkillDetail.tsx` - renders the section.
- `apps/web/src/pages/docs/submitting.astro` - the docs section.
- `apps/web/src/components/submit/SubmitGuide.astro`, `apps/web/src/pages/docs/index.astro`, `apps/web/src/components/submit/ValidationProgress.tsx` - the badge promo (step 5, added on review).

## Data / contracts

- `GET /skills/:slug/badge.svg` -> 200, `Content-Type: image/svg+xml; charset=utf-8`,
  `Cache-Control: public, max-age=300, s-maxage=300`, body: the SVG. 404 with
  `{ success: false, error: 'not found' }` for an unknown or unpublished slug. No auth, no
  query parameters, no new schema.
- The badge reads `passport.validationStatus` and `passport.riskLevel` from the
  `skill_passports` row of `skills.latestVersionId`, the same row `GET /skills/:slug`
  reports, so the badge and the page never disagree.
- Badge text is fixed vocabulary only (`skillpass`, `passed | warning | failed`,
  `low | medium | high | critical` + ` risk`). Nothing from the skill row reaches the SVG.
- Markdown snippet: `[![SkillPass](<API_URL>/skills/<slug>/badge.svg)](<SITE>/skills/<slug>)`
  with the slug `encodeURIComponent`-ed in both URLs.

## Testing

- `render.test.ts` - structure, labels, colors per enum value, widths.
- `skills.test.ts` - 404, 200 headers and body, no session, warning/medium wording, route
  order (a published slug returns SVG, not the JSON detail the `/:slug/:version` route
  would give).
- `badge.test.ts` - URL and markdown builders.
- UI and docs ride on `pnpm build` plus the manual check in the review packet.

## Notes for the AI

- Register the badge route before `/:slug/:version`, the way `/search` sits before
  `/:slug`; Hono runs handlers in registration order and `badge.svg` would otherwise be
  taken for a version.
- Keep `renderBadge` free of any skill-derived string. If a later feature adds one, it must
  escape it for XML first.
- The shields flat layout scales text by `.1` with `font-size="110"` for sub-pixel
  placement; copy that shape rather than inventing a new one.
- `import.meta.env.SITE` is public in Astro and set from `site` in `astro.config.js`; fall
  back to `https://skillpass.dev` so the builder is testable under Vitest.
- No em dashes anywhere, `pnpm format` before presenting the diff.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":9265,"specSha256":"0b0d80b022d3bd5fc4b83dec19cd799a93e8b7b5d2a26618b8c98bbb900420bc","branch":"refs/heads/feature/passport-badge-for-readmes","head":"54db2ec3e638799082ace5ef3d4429f4cfc0f05d","baseRef":"refs/heads/main","baseCommit":"54db2ec3e638799082ace5ef3d4429f4cfc0f05d","sourceTree":"a010c8a08ae7755e58b77e4666fd9a40e2a49c25","absentOptional":[]} -->

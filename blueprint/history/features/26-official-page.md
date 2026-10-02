# Feature: Official page

**From build-plan:** feature 26
**Build attempt:** 1
**Status:** verified
**Branch:** feature/official-page

## Goal

A `/official` page listing the organizations that build the technology their skills teach (Anthropic, Google, Microsoft, Vercel, Stripe, and the like): one row per GitHub owner with its published skill count, the way skills.sh/official does. It reads the existing public list endpoint and adds no data. The per-maker skill lists belong to the owner pages of feature 27; this page is the index.

The plan line says the page is "driven by the existing `verified` flag". On prod, 590 of 592 published skills carry `verified: true` because `apps/api/src/seed/curate.ts` sets it on every curated listing, and nothing on the web renders it. So `verified` alone cannot define "official". Decision for this build: official = a verified skill whose owner login is in a web-side `OFFICIAL_OWNERS` table, the same pattern as `INSTALL_TOOLS` (feature 25) and the seed's `FEATURED_SLUGS`. The `verified` requirement stays so an unverified or flagged listing never appears here even when its owner is official.

## In scope

- `OFFICIAL_OWNERS`: a typed table of `{ login, name }` for the 36 owners below, and `groupOfficial(skills)`, a pure function that returns one entry per owner with that owner's published skill count.
- `/official`: a server-rendered Astro page with zero client JS of its own. Heading, one paragraph of intro copy, a runline (makers and skills), then one row per owner: avatar, name, login, count. Each row links to the owner's GitHub org until feature 27 gives it an owner page.
- Links: `Official` in the footer, one link line under the hero paragraph on the homepage, and `/official` in the sitemap.
- SEO: keyword-first title and a meta description, following the feature 17 convention.

Owner table for this build (login: display name). 36 owners, 247 published skills on prod today:

anthropics: Anthropic; google: Google; googleworkspace: Google Workspace; google-labs-code: Google Labs; firebase: Firebase; flutter: Flutter; genkit-ai: Genkit; microsoft: Microsoft; MicrosoftDocs: Microsoft Docs; larksuite: Lark; cloudflare: Cloudflare; vercel-labs: Vercel Labs; vercel: Vercel; prisma: Prisma; firecrawl: Firecrawl; remotion-dev: Remotion; greensock: GSAP; aws: AWS; getsentry: Sentry; expo: Expo; openai: OpenAI; huggingface: Hugging Face; get-convex: Convex; supabase: Supabase; stripe: Stripe; neondatabase: Neon; shadcn-ui: shadcn/ui; mastra-ai: Mastra; nrwl: Nx; better-auth: Better Auth; browser-use: Browser Use; makenotion: Notion; solana-foundation: Solana Foundation; higgsfield-ai: Higgsfield; momentic-ai: Momentic; ScrapeGraphAI: ScrapeGraphAI.

Rule applied: the GitHub org of the company or project whose own product the skills teach. Individuals (mattpocock, obra, addyosmani, kepano, emilkowalski) and community collections (prime-skills, coreyhaines31) are out; they get their own pages in feature 27. 23 of the 36 also appear on skills.sh/official (checked 2026-10-01).

## Out of scope

- Any change to the `verified` flag, its seed default, the admin toggle, or the API payload. No new column, endpoint, or query parameter.
- Per-owner pages (`/<owner>` or similar), the per-maker skill lists, and an owner filter in the directory: feature 27. Review on 2026-10-02 dropped the inline skill lists from this page (248 rows on one page was the wrong shape); 27 re-points the rows at the owner pages.
- An "Official" badge on skill rows, skill pages, or in the CLI.
- A top-nav link. Nav placement is still open for `/install` and is decided together, later.
- Changing which skills are listed, re-seeding, or editing the seed manifest.

## Build loop

`blueprint/config.json` is absent, so defaults apply: `workflow.stepReview: "feature"` (one review packet after both steps) and checkpoint commits disabled. `/complete` creates the single feature commit. `pnpm verify` must be green before the review packet.

## Build steps

- [x] 1. **Owner table and grouping** - add `apps/web/src/lib/official.ts` exporting `OFFICIAL_OWNERS` (the 36 entries above, in the order listed) and `groupOfficial(skills: PublicSkillSummary[]): OfficialGroup[]`. A skill counts for an owner when `skill.verified` is true and `(skill.attributedTo ?? skill.maintainer)` equals the owner's login, compared case-insensitively. Entries carry `login`, `name`, and `count`, sorted by count descending, then name ascending. Owners with zero matching skills are omitted. Tests in `official.test.ts` next to it.
  Done when: `pnpm test` is green with the new tests covering the verified filter, the maintainer fallback, case-insensitive login matching, omission of empty owners, the sort order, and that `OFFICIAL_OWNERS` has unique lowercase-distinct logins.
- [x] 2. **Page, links, sitemap** - add `apps/web/src/pages/official.astro` with `export const prerender = false`, fetching `getSkills` through `headFetch(Astro.response, ...)` and rendering `groupOfficial(data)`. Title `Official AI Agent Skills from the Makers - SkillPass`, description through `metaDescription`. Layout: `BaseLayout` plus `Nav`, `main` at `max-w-[760px]` (the profile and skill page width), `BackLink` to `/` labelled `Skills`, an `h1`, the intro paragraph, a `SECTION_HEADING` runline "<n> makers, <m> skills", then one row per owner as a link to `https://github.com/<login>` (new tab): the GitHub avatar (`https://github.com/<login>.png?size=76`, the `SkillDetail` pattern), the name, the login, and the count. States: fetch failure renders the heading, the intro, and an inline notice "Can't reach the API right now. Try again in a moment." with no owner list; an empty result renders the heading, the intro, and "No official skills are published yet." Add `/official` to `STATIC_ROUTES` in `apps/web/src/lib/sitemap.ts` and extend its test; add `Official` to `Footer.astro` between `Install` and `Submit`; add one line under the hero paragraph in `Hero.astro` linking to `/official` ("Browse the official skills from Anthropic, Google, Microsoft, Vercel and more").
  Done when: `pnpm build` is green, `/official` on the dev server shows one row per maker with its count and the runline totals, the footer and hero links open it, `/sitemap.xml` contains `/official`, and the page adds no island of its own (the only `astro-island` is the shared Nav account menu, as on every page).

## Files / areas

- `apps/web/src/lib/official.ts`, `apps/web/src/lib/official.test.ts` (new)
- `apps/web/src/pages/official.astro` (new)
- `apps/web/src/lib/sitemap.ts`, `apps/web/src/lib/sitemap.test.ts`
- `apps/web/src/components/nav/Footer.astro`
- `apps/web/src/components/home/Hero.astro`
- Read only: `apps/web/src/lib/api.ts` (`getSkills`), `apps/web/src/lib/ssr.ts` (`headFetch`), `apps/web/src/lib/seo.ts` (`metaDescription`), `apps/web/src/lib/classes.ts` (`SECTION_HEADING`), `apps/web/src/components/nav/BackLink.astro`, `apps/web/src/pages/u/[username].astro` (the on-demand page pattern)

## Data / contracts

- Input: `PublicSkillSummary[]` from `GET /skills` (`packages/skill-schema/src/public.ts`): `verified: boolean`, `attributedTo: string | null`, `maintainer: string`, `displayName`, `name`, `slug`. Unchanged.
- `OfficialOwner = { login: string; name: string }`; `OfficialGroup = { login: string; name: string; count: number }`. Web-side only; nothing is serialized to clients beyond the rendered HTML.
- Owner identity is the GitHub login as the manifest records it (the manifest test enforces canonical casing); matching is case-insensitive so a login typed in another case still groups.
- Route: `/official`, server-rendered on demand, one `GET /skills` per request with the 4 s `headFetch` timeout. No caching layer; `sitemap.xml` already does the same fetch per request.

## Testing

- `official.test.ts` (logic, gated): fixtures of summaries covering a verified official skill, an unverified official skill (excluded), a verified non-official skill (excluded), `attributedTo` null with an official `maintainer` (included), mixed-case login (included, canonical login kept), ordering by count then name, empty input returning `[]`, and the table's logins being unique when lowercased.
- `sitemap.test.ts`: `/official` present in the generated XML.
- Step 2 is UI: build plus a browser screenshot of `/official` on dev, the footer and hero links, and a `GET /sitemap.xml` check. No browser test harness exists, so none is added.

## Notes for the AI

- Plain Astro markup only. Do not add a `client:` directive or a React island for this page.
- Follow `u/[username].astro` for the on-demand pattern and `install/index.astro` for static copy tone. The docs shell is wrong for this page: it is a browse page, not documentation.
- Keep `OFFICIAL_OWNERS` the single place the list lives. The seed manifest comments in `apps/api/src/seed/listings.ts` describe the vendor waves but are not imported.
- Match on `attributedTo ?? maintainer`, the same expression `Row.tsx` uses for its "by" line, so the page agrees with what rows already display.
- Prettier: tabs, single quotes, 120 columns; run `pnpm format` before the review packet. No em or en dashes anywhere, including page copy.
- Dev evidence needs `pnpm dev:api` and `pnpm dev` (web on 4321 because the API's CORS allows only that origin); Brad starts them.

## Open questions

- Borderline owners left out: trailofbits (75 skills: their security methodology plus tools like trailmark and vector-forge), browser-act (2), squirrelscan, nozomio-labs, typesafe-ai, genmedia-labs. Adding any is one table entry. Say so at review and step 1 includes them.


## Verification

- `pnpm verify` green on the branch after the roll-up revision: lint, format check, typecheck (0 errors), 1245 tests (1234 + 11 new), build.
- Dev servers (API 8787, web 4321): `GET /official` 200 with title `Official AI Agent Skills from the Makers - SkillPass`, canonical `https://skillpass.dev/official`, runline "36 makers, 248 skills" (dev DB), 36 maker rows from Anthropic (31) to Stripe (1), each linking to the GitHub org, page height 2956 px, the only island the shared Nav account menu, avatars loading with none failed. `/sitemap.xml` lists `/official`; the homepage carries the hero link and the footer link.
- Not exercised live: the API-failure and empty states (reviewed in the template; each renders a single notice under the intro).


<!-- blueprint:completion {"schemaVersion":1,"specBytes":10418,"specSha256":"72c6f5a24ff337ebb5a2fde21db72b5f9b8c0d769e7a37b93f3692d99c19f4f1","branch":"refs/heads/feature/official-page","head":"8916683d527b35abd705ba65cc6f1011b4decab5","baseRef":"refs/heads/main","baseCommit":"8916683d527b35abd705ba65cc6f1011b4decab5","sourceTree":"3cc180c9c91dd1766966ffde8a30d49b9c27f4b2","absentOptional":[]} -->

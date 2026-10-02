# Feature: Source-owner pages

**From build-plan:** feature 27
**Build attempt:** 1
**Status:** verified
**Branch:** feature/source-owner-pages

## Goal

A page per GitHub owner at `/by/<login>` listing every published skill shown as "by <login>" in the directory, so the Official page rows and the skill page's Author block link into SkillPass instead of out to GitHub. It reads the existing public list endpoint and adds no data.

Route decision: `/by/<login>`. It reads as the rows already do ("by anthropics"), covers orgs and users alike, and avoids root-level paths that would collide with `/official`, `/docs`, `/install`, and future pages. The URL carries the owner's recorded GitHub login.

Owner rule: a skill belongs to `<login>` when `(attributedTo ?? maintainer)` equals it, compared case-insensitively. This is the expression the rows and the Official page already use. The plan's "attributed to or maintained by them" is read as: the maintainer counts only when nothing is attributed, because `/u/<username>` already lists everything a maintainer curated, and `/by/bradtraversy` should not repeat all 590 curated listings.

## In scope

- `skillsByOwner(skills, login)` and `ownerLogins(skills)` in `apps/web/src/lib/owner.ts`: the owner's canonical login (the `OFFICIAL_OWNERS` entry's login when present, else the login as recorded on the first matching skill), the official name or null, and the owner's published skills sorted by display title; and the distinct canonical logins for the sitemap.
- `/by/<login>`: a server-rendered Astro page with zero client JS of its own. Header with the GitHub avatar, the official name or the login, the login linking to GitHub, and the skill count; then the skills rendered with the existing `Row` component. All skills on one page (the largest owner today has 75). No `verified` filter: published is the gate, as the plan says.
- States: unknown owner responds 404 and renders the shell with "No published skills by <login>."; API failure keeps 200 and renders "Can't reach the API right now. Try again in a moment."; a login whose casing differs from the recorded one renders the page with the canonical URL in the canonical tag.
- Links in: the Official page rows open `/by/<login>` in the same tab; the skill page Author block links the login to `/by/<attributedTo>` and adds a small `GitHub` link beside it (the `curated by` line stays). Rows keep their plain "by <owner>" text because a link cannot nest inside the row link.
- Sitemap: `/by/<login>` for every owner with a published skill.
- SEO: title `<Name> AI Agent Skills - SkillPass`, a meta description with the count, canonical `/by/<canonical login>`.

## Out of scope

- An owner filter or owner facet in the homepage directory.
- An "Official" badge on owner pages, rows, or skill pages; the official name from the table is the only reuse.
- Pagination on owner pages, a dedicated API endpoint, or any API or schema change.
- Linking the "by <owner>" text inside directory rows.
- Changing `/u/<username>` maintainer profiles.

## Build loop

`blueprint/config.json` is absent, so defaults apply: `workflow.stepReview: "feature"` (one review packet after both steps) and checkpoint commits disabled. `/complete` creates the single feature commit. `pnpm verify` must be green before the review packet.

## Build steps

- [x] 1. **Owner lookup and sitemap** - add `apps/web/src/lib/owner.ts` exporting `skillsByOwner(skills: readonly PublicSkillSummary[], login: string): OwnerPage | null` and `ownerLogins(skills: readonly PublicSkillSummary[]): string[]`. `OwnerPage = { login: string; name: string | null; skills: PublicSkillSummary[] }`. Matching is case-insensitive on `attributedTo ?? maintainer`; `login` is the `OFFICIAL_OWNERS` login when the owner is official, else the owner string as recorded on the first matching skill; `name` is the official name or null; skills are sorted by `displayName ?? name` (locale compare, base sensitivity); null when no skill matches. `ownerLogins` returns the distinct canonical logins in first-seen order. Extend `buildSitemap(site, skillSlugs, ownerLogins = [])` in `apps/web/src/lib/sitemap.ts` to append `/by/<encodeURIComponent(login)>` per owner, and pass `ownerLogins(result.data)` from `apps/web/src/pages/sitemap.xml.ts`. Tests in `owner.test.ts` and `sitemap.test.ts`.
  Done when: `pnpm test` is green with tests for the match, the case-insensitive lookup returning the canonical login, the official name, the maintainer fallback, exclusion of other owners, null for an unknown login, the title sort, distinct canonical logins from `ownerLogins`, and `/by/` routes (encoded) in the sitemap XML.
- [x] 2. **Page and links** - add `apps/web/src/pages/by/[login].astro` with `export const prerender = false`, `headFetch(Astro.response, (init) => getSkills(init))`, then `skillsByOwner`. Layout: `BaseLayout` (title, description, `canonicalPath`), `Nav`, `main` at `max-w-[760px]`, `BackLink` to `/official` labelled `Official`, a header with the avatar (`https://github.com/<login>.png?size=76`), an `h1` with the name or login, the login as a GitHub link, and "<n> skills", then the rows (`Row`, rank 1..n, no `client:` directive). Unknown owner: set `Astro.response.status = 404` and render the shell with the not-found notice; API failure: the API notice. Point the Official page rows at `/by/<login>` (remove `target` and `rel`), and in `SkillDetail.tsx` change the Author login link to `/by/<attributedTo>` and add a `GitHub` link after it.
  Done when: `pnpm build` is green; on the dev server `/by/anthropics` shows the Anthropic header, 31 rows, and the only island is the shared Nav account menu; `/by/ANTHROPICS` renders the same page with canonical `/by/anthropics`; `/by/nobody-here` returns 404 with the notice; `/official` rows open `/by/<login>`; a curated skill page's Author link opens `/by/<owner>`; `/sitemap.xml` contains `/by/anthropics`.

## Files / areas

- `apps/web/src/lib/owner.ts`, `apps/web/src/lib/owner.test.ts` (new)
- `apps/web/src/pages/by/[login].astro` (new)
- `apps/web/src/lib/sitemap.ts`, `apps/web/src/lib/sitemap.test.ts`, `apps/web/src/pages/sitemap.xml.ts`
- `apps/web/src/pages/official.astro` (row href)
- `apps/web/src/components/skill/SkillDetail.tsx` (Author block links)
- Read only: `apps/web/src/lib/official.ts` (`OFFICIAL_OWNERS`), `apps/web/src/lib/api.ts`, `apps/web/src/lib/ssr.ts`, `apps/web/src/lib/seo.ts`, `apps/web/src/components/skill/Row.tsx`, `apps/web/src/layouts/BaseLayout.astro` (`canonicalPath`), `apps/web/src/pages/u/[username].astro`

## Data / contracts

- Input: `PublicSkillSummary[]` from `GET /skills`: `attributedTo: string | null`, `maintainer: string`, `displayName`, `name`, `slug`. Unchanged.
- Route `/by/<login>`: `login` is a GitHub login (letters, digits, hyphens); it is only ever used as a lookup key and as text, and the avatar and GitHub hrefs interpolate the canonical login from data, not the raw URL segment.
- `OwnerPage = { login; name: string | null; skills }`, web-side only.
- Status codes: 200 with rows; 404 with the shell for an unknown owner; 200 with the API notice on fetch failure (the `headFetch` contract).
- Sitemap: one `GET /skills` per request as today; owner URLs derive from the same response.

## Testing

- `owner.test.ts` (logic, gated): fixtures covering an attributed match, the maintainer fallback, case-insensitive lookup returning the canonical official login, a non-official owner keeping its recorded casing, exclusion of other owners, null for an unknown login, title ordering, and `ownerLogins` distinctness and order.
- `sitemap.test.ts`: `/by/<login>` routes present, encoded, and the url count including owners.
- Step 2 is UI: build plus browser evidence on dev for `/by/anthropics`, the uppercase variant, the 404, the Official row link, and the skill page Author link.

## Notes for the AI

- Plain Astro markup with `Row` rendered without hydration, as `/official` does. No React island.
- Reuse `OFFICIAL_OWNERS` for the name lookup; do not duplicate the table.
- The not-found path must set the status on `Astro.response` before rendering; `headFetch` only sets 404 when the API itself returns one.
- `decodeURIComponent` is not needed: Astro provides `Astro.params.login` decoded.
- Prettier: tabs, single quotes, 120 columns; `pnpm format` before the review packet. No em or en dashes.
- Dev evidence needs both dev servers; they are running in the Browser pane from the feature 26 session, restart them only if asked.

## Open questions

- Route name `/by/<login>` is my call; `/makers/<login>` and root-level `/<login>` were the alternatives. Veto at review if you want a different shape, nothing else depends on it yet.

## Verification

- `pnpm verify` green on the branch: lint, format check, typecheck (0 errors), 1255 tests (1245 + 10 new), build.
- Dev servers (API 8787, web 4321): `/by/anthropics` 200, title `Anthropic AI Agent Skills - SkillPass`, h1 Anthropic, 31 rows, canonical `/by/anthropics`, the only island the shared Nav account menu; `/by/ANTHROPICS` 200 with the same 31 rows and canonical `/by/anthropics`; `/by/microsoftdocs` renders "Microsoft Docs" with canonical `/by/MicrosoftDocs`; `/by/bradtraversy` lists the 2 maintainer-fallback skills; `/by/nobody-here` 404 with the notice and noindex. `/official` has 36 `/by/` row links and no external row links. `/skills/pdf` Author block links to `/by/anthropics` with a GitHub link beside it. `/sitemap.xml` lists 82 `/by/` URLs including `/by/anthropics`.
- Not exercised live: the API-failure state (reviewed in the template; it keeps 200 and shows the notice).
- Dev note: a web server restart that overlapped `pnpm verify`'s build left Vite serving a stale `zod` optimized dep (504 Outdated Optimize Dep) and the skill island would not hydrate; a clean restart of the web server fixed it. Not a code change.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":9897,"specSha256":"12e41a7aaa94801350d8be472dd8ba8ed743beef0fea5850509f0ccce4d206df","branch":"refs/heads/feature/source-owner-pages","head":"9a9930c5dde5b8ba71afa64ac631c91632a7ba23","baseRef":"refs/heads/main","baseCommit":"9a9930c5dde5b8ba71afa64ac631c91632a7ba23","sourceTree":"c72608db9dd114581db906689cd0c2bb3e238206","absentOptional":[]} -->

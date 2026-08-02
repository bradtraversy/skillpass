# Fix: SEO baseline

**Type:** Fix

## The problem

The site ships with almost no SEO surface. Audit findings (2026-08-02):

- `BaseLayout.astro` renders only `<title>` - no meta description, no canonical,
  no OG/Twitter tags. Nothing anywhere in `apps/web` emits any of these.
- `astro.config.mjs` has no `site`, so absolute URLs (canonical, OG, sitemap)
  cannot be built.
- The homepage title is the bare default `SkillPass` - no keywords, no
  description. Shared links (X, Discord, Slack) unfurl with nothing.
- Skill detail pages (`/skills/[slug]`, `/skills/[slug]/[version]`) and profile
  pages (`/u/[username]`) title from the raw slug and are already SSR
  (`prerender = false`), but never fetch the skill server-side, so the head has
  no real name or summary. These 195+ pages are the main SEO surface.
- No `robots.txt`, no sitemap. Crawlers have no route list and `/admin` is
  indexable.

## The fix

Add a proper head to `BaseLayout` (description, canonical, OG/Twitter, noindex
flag) driven by a `site` config, give every page a unique title and description,
fetch skill/profile data server-side on the SSR pages for real head metadata,
and serve `robots.txt` plus a `sitemap.xml` endpoint that includes one URL per
published skill from `GET /skills`.

Must not break: the island architecture stays as decided at 7b - page content is
still client-fetched; only head metadata is fetched server-side. A dynamic page
whose API fetch fails still renders (fall back to the slug-based title, never
500). A branded 1200x630 OG card has been generated (Geist type, site theme
colors, logo, hero copy, Skill Passport stamp) and ships as `public/og.png`;
its generator HTML is kept in `prototypes/og-card.html` so it can be
re-rendered with headless Chrome. Out of scope: JSON-LD, a custom 404 page,
server-rendering island content.

## Build steps

- [x] **1. Head foundation in BaseLayout** - set `site: 'https://skillpass.dev'`
  in `astro.config.mjs`; extend `BaseLayout` props with `description` and
  `noindex`; render meta description, canonical (`Astro.site` + pathname),
  `og:title/description/type/url/site_name/image`, and
  `twitter:card` (`summary_large_image`). Add the generated 1200x630 card as
  `apps/web/public/og.png` (og:image default, absolute URL) plus
  `prototypes/og-card.html` as its source. Homepage passes a real title
  (`SkillPass - AI Skills Directory`) and description.
  **Done when:** view-source on `/` shows the new title, description, canonical
  `https://skillpass.dev/`, and OG tags; `pnpm build` green.
- [x] **2. Static page metadata** - unique title + description on `/submit` and
  the four docs pages (`DocsShell` gains a `description` prop); `/admin` passes
  `noindex`.
  **Done when:** each page's source shows its own title and description;
  `/admin` source shows `<meta name="robots" content="noindex">`.
- [x] **3. Dynamic page metadata (SSR head fetch)** - `/skills/[slug]` and
  `/skills/[slug]/[version]` call `getSkill` in frontmatter and title
  `${name} - Skill Passport` with the summary (truncated ~160 chars) as
  description; the version page's canonical points at the unversioned URL;
  `/u/[username]` does the same via `getProfile`. Fetch failure falls back to
  today's slug-based title.
  **Done when:** view-source on a live skill page shows the skill's real name
  and summary in title/description/OG; a bogus slug still renders the shell.
- [x] **4. robots.txt and sitemap** - `public/robots.txt` (allow all, disallow
  `/admin`, `Sitemap:` line); `src/pages/sitemap.xml.ts` SSR endpoint listing
  the static routes plus `/skills/[slug]` for every skill from `getSkills()`.
  Sitemap XML building is pure logic - ship a Vitest test (empty list, entry
  escaping, static routes present).
  **Done when:** `curl /sitemap.xml` returns valid XML with static routes and
  skill URLs; `curl /robots.txt` serves the file; `pnpm test` green.

## Verify

- View-source (not devtools) on `/`, `/submit`, `/docs/cli`, a real skill page,
  and `/admin`: unique titles, descriptions, canonical, OG tags, admin noindex.
- `curl http://localhost:4321/sitemap.xml` and `/robots.txt` against the dev
  server with the API running - skill slugs appear in the sitemap.
- Paste a skill URL into a share-preview checker (or Discord) after deploy to
  confirm the unfurl.
- `pnpm test`, `pnpm typecheck`, `pnpm build` all green.

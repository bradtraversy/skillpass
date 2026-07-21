# Fix: Server-render the dynamic skill pages

**Type:** Fix

## The problem

`skillpass-web` is a fully static Astro build. The three per-entity pages -
`/skills/[slug]`, `/skills/[slug]/[version]`, and `/u/[username]` - use
`getStaticPaths()`, which enumerates every URL **at build time** by calling the
API. Any skill or profile published after the last build has **no page** until
the site rebuilds:

- It shows on the homepage (that list is client-fetched, always live).
- But its own page 404s until a rebuild.

We currently patch this with a rebuild-on-publish deploy hook, which means a
publisher waits ~1-2 minutes for a full site rebuild before their skill's page
exists. That lag is the thing we're removing.

## The fix

Convert only those three pages to **on-demand (server-rendered)** using Astro's
Node adapter, so any slug/username renders instantly at request time. Everything
else (homepage, `/submit`, `/admin`, static shells) stays prerendered and fast.
Because the pages already render `client:load` islands that fetch their own data,
the change is small: drop `getStaticPaths`, mark the route `prerender = false`,
read the param from `Astro.params`. The web service moves from a static site to a
small always-on Node service on Render Starter (no spin-down on paid).

Must not break:

- The homepage and static pages must stay prerendered (no perf regression).
- `PUBLIC_API_URL` (client-facing) is unchanged; islands keep client-fetching.
- The SSR shell rendering for a non-existent slug is fine - the island shows its
  own not-found/empty state (same as today's behavior when the API returns 404).

## Build steps

- [x] **Step 1 - Node adapter + SSR-capable config** - add `@astrojs/node`
  (standalone) to `apps/web`, wire it in `astro.config.mjs`, keep `output`
  default so only opted-out routes are on-demand. *Done when:* `pnpm build`
  succeeds and emits a server entry (`dist/server/entry.mjs`), and static pages
  still prerender.

- [x] **Step 2 - Make the 3 pages on-demand** - in `/skills/[slug]/index.astro`,
  `/skills/[slug]/[version].astro`, `/u/[username].astro`: remove
  `getStaticPaths`, add `export const prerender = false`, read params from
  `Astro.params`. *Done when:* the build succeeds and running the built server
  locally serves an arbitrary slug (not present at build) with the island shell
  instead of a 404.

- [x] **Step 3 - Web becomes a Node service on Render** - in `render.yaml` switch
  `skillpass-web` from `runtime: static` to `runtime: node`, `plan: starter`,
  build `pnpm build`, start `cd apps/web && node ./dist/server/entry.mjs`, drop
  `staticPublishPath`; keep `PUBLIC_API_URL`. *Done when:* the blueprint validates
  and the service serves both static assets and the on-demand routes.

- [x] **Step 4 - Remove the now-redundant rebuild-on-publish hook** - delete the
  `triggerRebuild` call in the publish handler, `apps/api/src/deploy/rebuild.ts`
  (+ its test), `RENDER_DEPLOY_HOOK_URL` from `env.ts`, `render.yaml`, and
  `.env.example`. *Done when:* no references remain and `pnpm test` is green.

## Verify

- **Local:** `pnpm build` succeeds with a server entry; run the built server and
  hit `/skills/does-not-exist-at-build` - it renders the shell (island handles the
  empty/not-found state), not a static 404. Homepage still prerendered.
- **Deployed** (after merge + redeploy of web as Node/Starter): seed or publish a
  skill, then open its `/skills/<slug>/` page immediately - it loads with no
  rebuild and no wait. Homepage still fast.
- **Tests:** UI/config change, so it rides on build + screenshot, not new unit
  tests. Step 4 removes `rebuild.ts` and its test; `pnpm test` must stay green.

## Notes for the AI

- Only the 3 dynamic pages go on-demand; leave the homepage, `/submit`, `/admin`,
  and other static pages prerendered.
- The pages already use `client:load` islands that client-fetch - do **not**
  server-fetch data in this fix. Rendering the data server-side for SEO is a
  separate, later enhancement, out of scope here. The goal is only that the page
  exists on demand.
- Keep the web service on a **paid instance (Starter)** so it never spins down.
- After deploy, the `RENDER_DEPLOY_HOOK_URL` env var can also be deleted from the
  Render dashboard (dashboard cleanup, not code).

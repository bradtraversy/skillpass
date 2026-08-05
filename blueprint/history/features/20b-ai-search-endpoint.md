# Feature: AI search endpoint + homepage toggle


**From build-plan:** feature 20b
**Status:** shipped

## Goal

"Describe what you need" search goes live: a rate-limited `GET /skills/search`
endpoint that embeds the query and cosine-matches the vectors 20a stores, and a
Keyword | AI mode toggle on the homepage search box. Keyword mode stays the
instant client-side filter exactly as today; AI mode fires on Enter. Free and
ungated - the differentiator vs skillrepo's account-walled semantic search.

## In scope

- `GET /skills/search?q=` - embed the query (`input_type: "query"`), pgvector
  cosine match over published skills, top 20 as `PublicSkillSummary[]`.
- A small in-memory per-IP rate limiter (pure logic + middleware use).
- The Keyword | AI toggle on the search box with loading, error, and empty
  states; AI results respect the sidebar filters, bypass the tabs.
- `searchSkills(q)` helper in the web api lib.

## Out of scope

- The CLI `search --ai` flag (20c).
- A similarity threshold / "no good matches" cutoff - v1 returns the ranked
  top 20 and lets weak matches rank low; tune later with real usage.
- Persistent/distributed rate limiting (single Render instance; in-memory is
  honest today and swaps for Redis if the API ever scales out).
- Query-embedding caching.

## Decisions

- **Response reuses `publicSkillSummary`** - a brand-new endpoint has no
  installed-CLI compat constraint (the 20a/featured-tab lesson applied in
  reverse), and identical row shape means the web Row component renders results
  unchanged.
- **Result order is relevance order** - rows come back cosine-ranked; the UI
  must preserve payload order (same trust-the-server-order contract as the
  featured directory).
- **Sidebar filters apply, tabs don't.** Extract the field predicates from
  `filterSkills` into a shared `matchesFilters(skill, filters)` so AI results
  can be filtered client-side without re-sorting; `filterSkills` keeps its
  behavior by delegating to it.
- **Degradation is explicit**: missing `VOYAGE_API_KEY` -> 503 with a clear
  error; provider failure -> 502; empty/overlong `q` (cap 500 chars) -> 400;
  rate limited -> 429. The UI maps any failure to an inline "AI search is
  unavailable right now" message.
- **Route order matters**: `/search` registers before the `/:slug` routes in
  `skills.ts` so it can't be captured as a slug.
- **Rate limit: 20 requests/min per IP** (fixed window, `x-forwarded-for`
  first hop, fallback to a shared bucket) - generous for humans, blocks
  hammering; each request costs an embed call.

## Build loop

One step at a time; diff, review, checkpoint, next.

## Build steps

- [x] **Step 1 - rate limiter.** `apps/api/src/routes/rate-limit.ts`: a pure
  fixed-window limiter (`allow(key, now)` on a configurable window/max) and a
  tiny Hono middleware wrapper reading the client IP. *Done when:* `pnpm test`
  passes with tests for allow/deny at the boundary, window reset, per-key
  isolation, and the shared-bucket fallback for a missing IP header.
- [x] **Step 2 - vector query + endpoint.** `searchSkillsByEmbedding(db, vector)`
  (cosine order, published-only, joined like `listPublishedSkills`, limit 20)
  and `GET /skills/search` wired before `/:slug` with validation, the limiter,
  `embedTexts(..., 'query')`, and the `publicSkillSummary` mapping. *Done when:*
  `pnpm test` passes with route tests (mocked embed + db) for success mapping,
  400 empty/overlong q, 503 no key, 502 provider failure, and 429.
- [x] **Step 3 - matchesFilters extraction.** Pull the field predicates out of
  `filterSkills` into an exported `matchesFilters`; `filterSkills` delegates.
  *Done when:* `pnpm test` passes with the existing filterSkills suite
  untouched plus direct `matchesFilters` cases (order-preserving filtering of
  a pre-ranked list).
- [x] **Step 4 - toggle + AI mode UI.** `searchSkills(q)` in `lib/api.ts`;
  Directory gains a Keyword | AI toggle on the search box - AI mode changes the
  placeholder, fires on Enter, shows loading, renders results in payload order
  through the existing Row list with sidebar filters applied via
  `matchesFilters`, and maps failures/empties to inline messages; switching
  modes or clearing restores the normal directory. *Done when:* the running
  dev app shows the toggle, the AI request firing on Enter, and a rendered
  result list or the unavailable state (screenshot + build; UI step).

## Files / areas

- `apps/api/src/routes/rate-limit.ts` (+ test) - limiter.
- `apps/api/src/db/embeddings.ts` (+ existing test file) - vector query.
- `apps/api/src/routes/skills.ts` (+ test) - the endpoint.
- `apps/web/src/lib/filterSkills.ts` (+ test) - `matchesFilters` extraction.
- `apps/web/src/lib/api.ts` - fetch helper.
- `apps/web/src/components/home/Directory.tsx` - toggle + AI mode states.

## Data / contracts

- Endpoint returns `{ success: true, data: PublicSkillSummary[] }` in relevance
  order - locked for 20c (the CLI flag calls the same endpoint).
- Error statuses locked: 400 invalid query, 429 rate limited, 502 provider
  failure, 503 unconfigured. The UI and CLI both key off them.

## Testing

- Steps 1-3 are logic-bearing and ship tests in the same diff (limiter windows,
  route status matrix with mocked embed/db, predicate extraction). Step 4 is
  UI and rides on screenshot + build per the standards.
- Full live path (real Voyage key, backfilled vectors, restarted dev API) is a
  manual verify; without the key the UI's 503 "unavailable" state is the
  demonstrable live behavior - show it in the screenshot evidence if the key
  isn't present yet.

## Notes for the AI

- Drizzle ships `cosineDistance` for pgvector ordering - use it rather than
  raw SQL; keep the query in `db/embeddings.ts` with the other vector access.
- The web island calls the API over HTTP only (`lib/api.ts` patterns); no
  server-only imports in `apps/web`.
- Preserve payload order in AI mode - no `byNewest` re-sort on results.
- Don't touch `GET /skills` or its payload; published CLIs strict-parse it.
- The dev API process runs stale code until Brad restarts it - endpoint
  verification happens through route tests (`app.request`), not the live :8787.

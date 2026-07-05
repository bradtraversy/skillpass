# Feature: API scaffold + GitHub sign-in (5a)

**From build-plan:** feature 5a (first sub-feature of 5, Submission draft flow)
**Status:** complete

## Goal

Stand up `apps/api` - the Hono backend the overview has been promising - with
just enough surface to know who a user is: GitHub OAuth sign-in, a `User` row
in Neon via Drizzle, a signed session cookie, and `GET /me`. This clears the
"apps/api not scaffolded" blocker and gives 5b/5c an authenticated user to hang
submissions off. No submissions, no R2, no validation here.

## Prerequisites (Brad provisions - the AI cannot create these)

- **Neon**: a project + database; its connection string becomes `DATABASE_URL`.
- **GitHub OAuth app** (github.com -> Settings -> Developer settings): callback
  URL `http://localhost:8787/auth/github/callback` for dev; yields
  `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET`.
- **`SESSION_SECRET`**: any long random string (e.g. `openssl rand -hex 32`).

Values go in `apps/api/.env` (gitignored); `.env.example` documents them.
Steps 1 and 3-4 build and test fine without real values (external calls are
mocked); step 2's migration and step 5's live sign-in need the real ones.

## In scope

- `apps/api` package (`apps-api`): Hono + `@hono/node-server`, strict TS,
  `tsx watch` dev script, Zod-validated env loading, `GET /health`.
- Root `dev:api` script and an updated Commands section in `AGENTS.md`.
- Drizzle + Neon (`@neondatabase/serverless` HTTP driver): the `users` table
  per the overview's User model, a generated migration under
  `apps/api/drizzle/`, and `drizzle-kit` scripts.
- Hand-rolled GitHub OAuth (no auth library): `GET /auth/github` redirects
  with a CSRF `state` cookie; `GET /auth/github/callback` verifies state,
  exchanges the code, fetches the GitHub user, upserts `User` by `githubId`,
  sets the session cookie, and redirects back to the web origin.
- Session = signed httpOnly cookie (`aiskills_session`, hono signed cookies,
  30 days, `sameSite=lax`, `secure` outside dev). No session table in v1.
- `GET /me` (public user shape or 401) behind an auth middleware that loads
  `c.get('user')` from the cookie; `POST /auth/logout` clears it.
- CORS for the web origin with credentials.
- Vitest coverage for the OAuth helpers (mocked `fetch`), the auth routes
  (mocked GitHub + user repo via `vi.mock`), and the session middleware.

## Out of scope

- **Submissions, R2, zip upload** - 5b/5c.
- **The `/submit` page and any web UI** - 5c. `apps/web` is untouched; nothing
  in the static site calls the API yet.
- **Maintainer profile page (`/u/[username]`)** - features 5c/10; 5a only
  stores the profile fields on `User`.
- **Admin role enforcement** - the `role` enum exists; admin-only routes come
  with feature 10.
- **Storing the GitHub access token** - it's used once in the callback and
  discarded; no token persistence in v1.
- **Session revocation / a sessions table** - stateless signed cookie for v1;
  revisit if revocation is ever needed.

## Design rulings

- **New sign-ins default to `role: 'maintainer'`.** The only reason to sign in
  is to submit and manage skills (anonymous users browse freely), so the
  overview's user|maintainer|admin enum keeps `user` for future demotion
  rather than as the default.
- **Hand-rolled OAuth over a library.** GitHub's flow is two fetches; a
  library would bring more surface than the flow itself. CSRF is covered by
  the `state` cookie check.
- **Stateless signed cookie** carrying only the user id - no server-side
  session state, nothing sensitive in the cookie, tamper-proof via signature.
- **DB access behind small repo functions** (`src/db/users.ts`) so route tests
  mock the repo module, not Drizzle internals.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Hono scaffold + env + health (logic-light).** Create
  `apps/api/`: `package.json` (hono, `@hono/node-server`, zod, tsx + types as
  dev deps), strict `tsconfig.json`, `src/env.ts` (Zod schema: `DATABASE_URL`,
  `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SESSION_SECRET`, `WEB_ORIGIN`,
  `PORT` default 8787), `src/app.ts` (Hono app, `GET /health` ->
  `{ success: true, data: { status: 'ok' } }`), `src/index.ts` (serve). Root
  `dev:api` script; AGENTS.md Commands updated. Test: health via
  `app.request()`, env schema rejects missing vars. *Done when:* `pnpm test`
  green and `pnpm dev:api` answers `curl localhost:8787/health`.
- [x] **Step 2 - Drizzle + Neon + users table.** Add `drizzle-orm`,
  `@neondatabase/serverless`, `drizzle-kit`; `drizzle.config.ts`;
  `src/db/client.ts`; `src/db/schema.ts` - `users` per the overview (id
  identity, `githubId` unique, `username` unique, `displayName`, `avatarUrl`,
  `role` enum user|maintainer|admin, `reputation` int default 0, `createdAt`);
  `src/db/users.ts` repo (`findByGithubId`, `upsertFromGithub`,
  `publicUser()` mapper). Generate the initial migration and apply it to Neon.
  Test: `publicUser()` strips internal fields (pure). *Done when:* migration
  files exist, `drizzle-kit migrate` has run against Neon (output shown), and
  `pnpm test` is green.
- [x] **Step 3 - GitHub OAuth helpers (logic).** `src/auth/github.ts`:
  `buildAuthorizeUrl(state)`, `exchangeCode(code)` -> access token,
  `fetchGithubUser(token)` -> `{ githubId, username, displayName, avatarUrl }`,
  each returning `{ success, data, error }`. Tests with mocked global `fetch`:
  happy paths, GitHub error responses, malformed JSON. *Done when:*
  `pnpm test` green with those cases.
- [x] **Step 4 - Auth routes + session middleware (logic).** Routes:
  `GET /auth/github` (random state -> short-lived httpOnly cookie ->
  redirect), `GET /auth/github/callback` (state check -> exchange -> upsert ->
  signed `aiskills_session` cookie -> redirect to `WEB_ORIGIN`),
  `POST /auth/logout`, `GET /me`; `src/auth/middleware.ts` resolves the signed
  cookie to a user (else 401); CORS with credentials for `WEB_ORIGIN`. The
  callback must also handle the unhappy paths without a 500: GitHub sending
  `?error=access_denied` (user hit Cancel on consent) and a failed code
  exchange both redirect to `WEB_ORIGIN/?auth=failed`. Tests via
  `app.request()` with `vi.mock` on the github helpers and users repo:
  callback happy path sets the cookie and redirects, mismatched state -> 403,
  consent-denied and exchange-failure both redirect to `?auth=failed` with no
  cookie set, `/me` 401 bare / 200 with a valid signed cookie, logout clears.
  *Done when:* `pnpm test` green with those cases.
- [x] **Step 5 - Live end-to-end sign-in (behavioral).** With real env values:
  browser -> `localhost:8787/auth/github` -> GitHub consent -> callback ->
  redirected to the web origin with the cookie set; `GET /me` returns the
  real user; row visible in Neon; `POST /auth/logout` then `/me` -> 401.
  *Done when:* that flow is demonstrated against the running API (screenshots
  / curl transcript), `pnpm build` and `pnpm test` green.

## Files / areas

- `apps/api/package.json`, `tsconfig.json`, `.env.example`,
  `drizzle.config.ts`, `drizzle/` (generated migrations).
- `apps/api/src/{index,app,env}.ts`, `src/db/{client,schema,users}.ts`,
  `src/auth/{github,middleware}.ts`, `src/routes/auth.ts` (or inline in app),
  colocated `*.test.ts`.
- Root `package.json` (`dev:api`), `AGENTS.md` (Commands).
- **No changes to `apps/web`.**

## Data / contracts

Load-bearing for 5b/5c/7/10:

```ts
// users table (Drizzle, Neon) - mirrors the overview's User model
{ id, githubId (unique), username (unique), displayName, avatarUrl,
  role: 'user' | 'maintainer' | 'admin' (default 'maintainer'),
  reputation: int = 0, createdAt }

// public user shape returned by GET /me (and later embedded in submissions)
interface PublicUser {
  id: number; username: string; displayName: string; avatarUrl: string;
  role: 'user' | 'maintainer' | 'admin'; reputation: number; createdAt: string;
}

// every API response: { success: true, data } | { success: false, error }
// session cookie: 'aiskills_session' (signed, httpOnly, lax, 30d) = user id
// auth middleware contract: c.get('user') is the full user row or the route 401s
// env names: DATABASE_URL, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET,
//            SESSION_SECRET, WEB_ORIGIN, PORT
```

## Testing

- In-scope logic ships tests in the same diff: env schema, `publicUser`,
  OAuth helpers (mocked fetch), routes + middleware (`app.request()` with
  mocked modules). No real network or DB in tests, per the standards
  (`vi.mock` for external deps).
- Step 2's migration and step 5's sign-in are integration surfaces: evidence
  is command output and the live flow (that's the `/check`-style proof), not
  unit tests.
- Suite: `pnpm test` (root glob already covers `apps/**`).

## Notes for the AI

- Follow the standards: strict TS, no `any`, Zod on all external input
  (env, GitHub responses), `{ success, data, error }` from helpers, scope
  user-owned queries by the authenticated user id (from the session, never a
  client-supplied id).
- Secrets stay in `.env` (verify `.gitignore` covers it before writing one);
  only `.env.example` with placeholder values is committed.
- Use hono's `getSignedCookie`/`setSignedCookie` with `SESSION_SECRET`; state
  cookie for CSRF is short-lived (10 min) and single-use (clear on callback).
- The GitHub user fetch needs the `User-Agent` header set or GitHub rejects it.
- GitHub `name` can be null - fall back to the login for `displayName`.
- Upsert refreshes `username`/`displayName`/`avatarUrl` on every sign-in so
  GitHub renames stay current (identity is `githubId`, never the username).
  A cross-user username collision (A renames, B claims A's old name) is an
  accepted v1 edge; the unique constraint will surface it loudly if it happens.
- Port 8787; web dev stays 4321. CORS must allow credentials from
  `WEB_ORIGIN` only - no wildcard.
- pnpm may need `--store-dir /home/brad/.local/share/pnpm/store/v11`.
- Uncommitted planning-doc edits (feature-7 source view, this split) ride
  along and land in this feature's commit at `/complete`.

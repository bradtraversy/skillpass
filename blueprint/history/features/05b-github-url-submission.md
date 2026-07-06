# Feature: GitHub-URL submission to draft

**From build-plan:** feature 5b
**Status:** implemented - all steps done, ready for /complete

## Goal

An authenticated maintainer can POST a GitHub URL and get back a draft
submission: the API resolves and pins the commit, snapshots the normalized
source to R2, computes the source hash, and stores a draft record in Neon.
This is the intake half of the submission flow; validation (feature 6) and
publishing (feature 7) consume exactly what this feature stores.

## In scope

- `POST /submissions` (auth required): accepts `{ githubUrl }`, supports
  `https://github.com/{owner}/{repo}` plus optional `/tree/{ref}` and
  `/tree/{ref}/{subpath}` forms (skills often live in a subfolder of a repo).
- Commit pinning: resolve the ref (or default branch) to a commit sha via the
  GitHub API, with an optional server-side `GITHUB_TOKEN` for rate limits.
- Snapshot: download the tarball at the pinned sha, extract in memory under
  caps, normalize to a sorted file list, compute the source hash with the
  validator's hash function, store the snapshot JSON in R2 content-addressed.
- A new `submissions` table (Drizzle migration) holding the draft record.
- Read endpoints: `GET /submissions` (own list) and `GET /submissions/:id`
  (owner-scoped; others' ids return 404).
- Validator package gains an in-memory entry point (`loadPackageFromFiles`) so
  the API and the future queue worker share one load/hash implementation.

## Out of scope

- Zip upload and the `/submit` page island (feature 5c).
- Running the validator on submissions and job progress (feature 6).
- Publishing, `skill_versions`, passports (feature 7) - so no `skillVersionId`
  column yet; it gets added when that table exists.
- Download pre-flight (feature 8).
- Deleting or canceling submissions, resubmission dedup UX, endpoint rate
  limiting beyond auth. All deferred.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - validator in-memory load** - export `loadPackageFromFiles(files: PackageFile[], name?: string): LoadedPackage` from `packages/validator`; `loadPackage(dir)` becomes a thin fs wrapper around it. No behavior change on disk loads. *Done when:* a test proves the same file list produces an identical `sourceHash` through both paths, and all existing validator tests stay green.
- [x] **Step 2 - GitHub URL parser + commit pinning** - new `apps/api/src/github/` module: parse the three accepted URL forms into `{ owner, repo, ref?, subpath? }` (reject anything else), resolve ref/default branch to a commit sha via the GitHub API, map failures to typed errors (`bad-url`, `not-found` [covers private], `rate-limited`, `upstream`). Optional `GITHUB_TOKEN` added to env as `z.string().optional()`. *Done when:* unit tests cover all URL forms, rejects, and each error mapping with mocked fetch.
- [x] **Step 3 - tarball snapshot builder** - fetch `codeload.../tar.gz/{sha}`, gunzip + extract in memory (`tar-stream`), strip the tarball's top-level dir, apply `subpath` filter, skip non-file entries (symlinks, dirs), reject path-traversal entries and cap breaches (max 500 files, 1 MB/file, 10 MB total - reject, don't skip), decode utf8, sort by path into `PackageFile[]`, hash via Step 1. A result of zero files (empty repo, or `subpath` matching nothing) is a typed `empty-package` error, never an empty snapshot. *Done when:* tests against a small fixture tarball produce the expected file list and a stable hash; cap, traversal, and empty-package cases return typed errors.
- [x] **Step 4 - R2 storage module + env** - add `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` to `env.ts` and `.env.example`; new `apps/api/src/storage/r2.ts` using `aws4fetch` with `putJson` and the content-addressed key builder `snapshots/{sha256hex}.json` (reads land in feature 6, which is the first consumer). *Done when:* env tests cover the new keys; storage tests (mocked fetch) verify the request URL/key and body; key builder is pure and tested.
- [x] **Step 5 - submissions table** - Drizzle schema + migration: `id`, `userId` -> users, `sourceType` enum (`github_url` | `zip`), `githubUrl`, `uploadedZipKey` (nullable, for 5c), `status` enum (`draft` | `validating` | `passed` | `warning` | `failed` | `published`, default `draft`), `resolvedCommitSha`, `sourceHash`, `snapshotKey`, `createdAt`. *Done when:* migration generated and applied to the Neon dev branch; `pnpm typecheck` green.
- [x] **Step 6 - POST /submissions** - authed route: Zod-validate the body, orchestrate parse -> pin -> snapshot -> hash -> R2 put -> insert draft row, map each typed error to a 4xx/5xx with the `{ success, error }` shape. Response data is the locked submission shape (below). *Done when:* route tests (mocked github/storage/db modules, per the auth.test.ts pattern) cover happy path, bad URL, not-found, cap breach, and R2 failure; a live curl with a session cookie creates a Neon row and an R2 object.
- [x] **Step 7 - read endpoints** - `GET /submissions` returns the authed user's submissions newest-first; `GET /submissions/:id` returns own or 404 (404 for other users' ids too, no existence leak). *Done when:* tests prove user A cannot read user B's submission and both endpoints return the locked shape.

## Files / areas

- `packages/validator/src/load.ts` (+ test) - in-memory entry point.
- `apps/api/src/github/` (new) - URL parser, pinning client, tarball snapshot builder, tests.
- `apps/api/src/storage/r2.ts` (new, + test) - the only R2 access point; feature 6 reuses it.
- `apps/api/src/db/schema.ts`, `apps/api/drizzle/` - submissions table + migration.
- `apps/api/src/routes/submissions.ts` (new, + test), wired in `apps/api/src/app.ts`.
- `apps/api/src/env.ts` (+ test), `apps/api/.env.example` - R2 keys + optional `GITHUB_TOKEN`.
- `apps/api/package.json` - add `tar-stream` (+ `@types/tar-stream`), `aws4fetch`, `validator` workspace dep.

## Data / contracts

- **Snapshot JSON (load-bearing, R2 object):** `{ "version": 1, "files": [{ "path": string, "content": string }] }`, files sorted by path, posix separators, utf8. Feature 6's worker validates from it; feature 7's source view renders from it. Stored at `snapshots/{sha256hex}.json` (content-addressed - resubmits of identical content dedupe in storage).
- **Source hash (load-bearing):** always computed by the validator package's hash over the same `PackageFile[]` that goes into the snapshot, so `submission.sourceHash` equals the future validation report's `sourceHash` by construction (features 6 and 8 depend on that equality).
- **Submissions row:** the table shape in Step 5. `skillVersionId` deliberately absent until feature 7 creates `skill_versions`.
- **API response shape (locked - 5c's island consumes it):** `{ id, sourceType, githubUrl, status, resolvedCommitSha, sourceHash, createdAt }`. `snapshotKey` and `userId` stay internal. Errors are `{ success: false, error }` with a message that says "not found or private" for GitHub 404s.

## Testing

- A `test` command is declared, and this feature is nearly all in-scope logic,
  so every step above ships its test in the same diff: URL parsing, error
  mapping, tar extraction/normalization/caps, hash parity, key builder, env,
  route handlers, and user-scoping. Mock GitHub/R2/db with `vi.mock` following
  `apps/api/src/routes/auth.test.ts`.
- Integration evidence for `/check`: sign in at `http://localhost:8787/auth/github`,
  then curl `POST /submissions` with the session cookie and a real public repo
  URL; confirm the draft row in Neon and the snapshot object in
  `ai-skills-snapshots-dev`, and that `GET /submissions` lists it.

## Notes for the AI

- Follow the existing DI pattern: `createApp(env, db)` stays the seam; inject
  or `vi.mock` the github/storage modules like auth does. Keep `Result<T>`
  (`src/lib/result.ts`) as the return shape of fallible helpers.
- Scope every submissions query by `c.get('user').id` from the session
  middleware; never trust a client-supplied user id.
- `GITHUB_TOKEN` is a server PAT for rate limits only. We do not store users'
  OAuth tokens - do not be tempted to reuse them here.
- All secrets stay in `apps/api/.env`. Watch for the editor resurrecting a
  root `..env`; never create env files outside `apps/api`.
- GitHub returns 404 for both missing and private repos - the user-facing
  error must say so. Use `AbortSignal.timeout` (~30s) on GitHub/codeload
  fetches; the POST runs synchronously in-request (no queue until feature 6).
- Don't name test fixtures after gitignored dirs (`build`, `dist`).
- Tabs for indentation (match the existing api/package code style); no em
  dashes anywhere.

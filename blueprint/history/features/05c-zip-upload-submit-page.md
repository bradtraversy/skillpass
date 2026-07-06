# Feature: Zip upload + submit page

**From build-plan:** feature 5c
**Status:** implemented - all steps done, ready for /complete

## Goal

Complete the submission draft flow: a zip fallback through the same snapshot
path as GitHub URLs, and the `/submit` page whose React island is the first
real web-to-API wiring. After this, a signed-in maintainer can submit a skill
from the site itself - by URL or by zip - and get a draft back.

## In scope

- **Zip extraction** with the hardened entry-name validation pinned in the
  build plan: reject `..` and `.` segments, backslashes, and absolute paths;
  skip directory entries; strip a shared root folder (GitHub "Download ZIP"
  layout) when every entry has one; same caps as the tarball path
  (500 files / 1 MB per file / 10 MB total), enforced against the zip's declared
  sizes before decompression and re-checked against actual bytes after.
- **Compressed upload cap**: reject zips over 10 MB (`MAX_ZIP_BYTES`) from
  `File.size` before buffering anything.
- **`POST /submissions/zip`** (auth required, multipart field `file`): store the
  original zip in R2 content-addressed (`uploads/{sha256hex}.zip` ->
  `uploadedZipKey`), snapshot + hash through `loadPackageFromFiles` exactly like
  5b, insert a draft row (`sourceType: 'zip'`, `githubUrl`/`resolvedCommitSha`
  null).
- **Shared response type**: move `PublicSubmission` (and the
  `{ success, data | error }` envelope type) into `packages/skill-schema` so the
  API and the web client share one contract instead of duplicating it.
- **Web API client** (`apps/web/src/lib/api.ts`): `PUBLIC_API_URL` base
  (default `http://localhost:8787`), `credentials: 'include'`, helpers for
  `/me`, URL submission, and zip submission, all returning the envelope.
- **`/submit` page + `SubmitForm` island** (`client:load` - the form is the
  page): auth check via `/me` with a sign-in card when logged out, a mode
  toggle (GitHub URL primary / zip fallback), submitting state, success card
  (status, pinned sha, source hash, "validation runs in a later release"),
  and API error messages shown inline. Styled with the existing `@theme`
  tokens to match the site.

## Out of scope

- Validation jobs and the inline progress panel (feature 6) - drafts just land.
- Any dashboard or "my submissions" list on the page (dashboard comes later).
- OAuth return-to: after sign-in the callback still redirects to the site root,
  not back to `/submit`. Accepted papercut; fixing it touches the auth flow.
- Ownership verification for zips - there is no repo owner to check. Zip
  uploads are honor-system under the vault ToS ("own or have permission");
  abuse reports (feature 10) are the backstop.
- Drag-and-drop upload UI; a plain file input is enough for v1.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - shared submission contract** - add `PublicSubmission` and
  `ApiEnvelope<T>` types to `packages/skill-schema`; `apps/api` imports them
  (mapper stays in the API). *Done when:* both apps typecheck against the one
  definition and the whole suite stays green untouched.
- [x] **Step 2 - zip extraction module** - `apps/api/src/uploads/zip.ts` using
  `fflate`: hardened entry names, declared-size pre-check + actual-size
  re-check, shared-root strip, `empty-package` for zero files, `bad-archive`
  for corrupt input; returns sorted `PackageFile[]` like the tarball path.
  *Done when:* tests (fixture zips built in-test with fflate's `zipSync`) cover
  happy path, root-strip on/off, every hardening reject, caps, empty, corrupt.
- [x] **Step 3 - R2 bytes + upload key** - `putBytes(env, key, bytes, contentType)`
  and `uploadKey(sha256hex)` -> `uploads/{hex}.zip` in `storage/r2.ts`.
  *Done when:* tests verify the signed PUT URL, content type, and body; key
  builder pure and tested.
- [x] **Step 4 - POST /submissions/zip** - multipart parse, `File.size` cap
  before buffering, extract -> hash -> store zip -> store snapshot -> draft row.
  *Done when:* route tests cover 401, happy path (locked response shape,
  `uploadedZipKey` never leaks), missing/non-file field, over-cap file (413,
  nothing stored), corrupt zip (422); a live curl with a session cookie creates
  the row and both R2 objects.
- [x] **Step 5 - web API client** - `apps/web/src/lib/api.ts` with
  `PUBLIC_API_URL`, credentialed fetch helpers, and network-failure mapping to
  the envelope shape. *Done when:* unit tests (mocked fetch) cover ok, API
  error, non-JSON response, and network failure; `pnpm build` green.
- [x] **Step 6 - /submit page, URL mode** - `submit.astro` + `SubmitForm.tsx`
  island: auth states (checking / signed-out card linking
  `{API}/auth/github` / form), URL input, submit, success and error cards.
  *Done when:* build green; live in the browser signed in, submitting a real
  repo URL renders the success card with sha + hash (screenshot), and the
  signed-out state shows the sign-in card (screenshot).
- [x] **Step 7 - zip mode** - file input in the island posting multipart via
  the client helper, same result cards. *Done when:* live browser zip upload
  of a small skill zip succeeds end-to-end (screenshot); a >10 MB file shows
  the 413 message without uploading.

## Files / areas

- `packages/skill-schema/src/` - `PublicSubmission`, `ApiEnvelope<T>` (new types + index export).
- `apps/api/src/uploads/zip.ts` (new, + test) - fflate extraction, `fflate` dep.
- `apps/api/src/storage/r2.ts` (+ test) - `putBytes`, `uploadKey`.
- `apps/api/src/routes/submissions.ts` (+ test) - the zip route.
- `apps/api/src/db/submissions.ts` - import the shared type.
- `apps/web/src/lib/api.ts` (new, + test) - API client.
- `apps/web/src/pages/submit.astro`, `apps/web/src/components/submit/SubmitForm.tsx` (new).

## Data / contracts

- **`PublicSubmission` moves to `skill-schema` (load-bearing):** same locked
  shape as 5b - `{ id, sourceType, githubUrl, status, resolvedCommitSha,
  sourceHash, createdAt }`. The web island renders it; feature 6 adds job info
  alongside it, not inside it.
- **`POST /submissions/zip` (load-bearing):** multipart/form-data, field name
  `file`, responds 201 with the envelope + `PublicSubmission`. Errors reuse the
  `SourceErrorCode` -> status map (413 too-large, 422 bad-archive/empty).
- **R2 keys:** original zips at `uploads/{sha256-of-zip-bytes}.zip`; snapshots
  unchanged at `snapshots/{sourceHash-hex}.json` - one snapshot format for both
  source types is the point of the shared path.
- **`PUBLIC_API_URL`:** Astro public env var, default `http://localhost:8787`;
  the only knob the static site needs to find the API.

## Testing

- Logic ships tests per step: zip hardening/caps/root-strip, key builder,
  route error paths, client envelope mapping. UI (page + island) rides on
  build + screenshots per the gate.
- Live `/check` evidence: browser flow signed-in URL submit, signed-out card,
  and a real zip upload landing a row + two R2 objects.

## Notes for the AI

- First real browser -> API traffic: JSON POSTs trigger a CORS preflight (the
  existing `cors()` middleware handles OPTIONS); multipart POSTs don't. The
  session cookie is SameSite=Lax, which rides fine here because
  localhost:4321 -> localhost:8787 is same-site (ports don't split a site) -
  same story for `ai-skills.directory` -> an api subdomain in production.
- Check `File.size` before `arrayBuffer()` - never buffer an over-cap upload.
- Zip declared sizes can lie: filter on metadata first, then verify actual
  decompressed lengths; both failures are `too-large`.
- Reuse `SourceResult`/`sourceError` from `github/errors.ts` for the zip module
  so the route's status map keeps working unchanged.
- Match `Directory.tsx` island conventions (typed Props, tokens like
  `border-border`, `text-muted`, `bg-surface`, focus ring pattern) and the
  existing form styling from the homepage search bar.
- The island never imports server code; everything crosses HTTP via
  `lib/api.ts`. Pass no secrets - `PUBLIC_API_URL` is public by definition.
- The zip's `File.name` (minus `.zip`) is only the fallback skill name for
  manifest-less packages - sanitize to a slug-safe string, don't trust it.

# Feature: Download pre-flight

**From build-plan:** feature 8
**Status:** complete

## Goal

Downloading a skill becomes a deliberate, informed act: a public pre-flight
endpoint reports the version's validation status, source hash (re-verified
against the pinned R2 snapshot), permissions in plain English, and the
permission diff against the previous published version - and the actual
download endpoint serves a zip of the validated snapshot, refusing failed
versions and hash mismatches outright. The "Download & pre-flight" button on
the detail page opens a confirmation panel wired to the real endpoint, closing
the loop the MVP spec calls "no auto-install without a pre-flight report".

## In scope

- **Wire contracts** in `packages/skill-schema` (feature-9 CLI reuses both):
  - `diffPermissions(current, previous)` - pure helper returning
    `{ added, removed }` of permission keys, order-stable.
  - `PublicPreflight` - version, validationStatus, riskLevel, sourceHash,
    sourceVerified (boolean), resolvedCommitSha (nullable), generatedAt,
    permissions `{ declared, detected }`, diff
    `{ previousVersion, declared: {added, removed}, detected: {added, removed} } | null`
    (null when this is the first published version), blocked (boolean),
    blockedReason (nullable).
- **`download_events` table** (migration 0006): id, skillVersionId -> FK,
  userId nullable FK, source enum `web | cli`, createdAt. Insert helper
  `recordDownload` in `db/downloads.ts`. This is the overview's
  Download/InstallEvent model; feature 8 is where downloads first exist, and
  the first-party metrics strategy counts installs from exactly this table.
- **`GET /skills/:slug/:version/preflight`** (public, anon, in
  `routes/skills.ts`): resolves the published skill + pinned version/passport
  (404 otherwise), fetches the pinned snapshot from R2, recomputes the source
  hash with the validator's own `loadPackageFromFiles` and sets
  `sourceVerified`; diffs the passport's permissionsSummary against the
  previous published version's passport (previous = the row after the pinned
  one in the existing newest-first `listVersionsWithPassports`); `blocked` is
  true when validationStatus is `failed` (blockedReason says so). R2 failure
  -> 502 envelope. Leak nothing beyond the contract.
- **`GET /skills/:slug/:version/download`** (public, anon): same resolution;
  refuses `failed` versions (403 envelope) and hash-mismatched snapshots (502
  envelope - never serve bytes that don't match the pinned hash); otherwise
  zips the snapshot files with fflate `zipSync`, returns
  `application/zip` with `Content-Disposition: attachment;
  filename="<slug>-<version>.zip"`, and records a `web` download event
  (userId from a valid session cookie when present, else null - no auth
  required).
- **Pre-flight UI** (`apps/web`, inside the existing `SkillDetail` island):
  - `getPreflight(slug, version)` + `downloadUrl(slug, version)` in
    `lib/api.ts`.
  - `InstallBar` gains the pinned version prop; its "Download & pre-flight"
    button opens a `PreflightPanel` that fetches the pre-flight and shows:
    validation stamp + risk, source hash with a verified/mismatch indicator,
    permissions as plain-English labels (taxonomy `getPermission` from
    skill-schema), the diff vs the previous version (added highlighted, "no
    permission changes" otherwise, "first published version" when diff is
    null), and a Download button linking to the download URL. Blocked
    versions show the reason and no Download button. Loading / can't-reach-API
    states follow the existing island pattern.

## Out of scope

- CLI downloads and `source: 'cli'` events (feature 9 - the enum value ships
  now, unused).
- Re-running full validation on download (the passport + hash re-verification
  is the "lightweight re-check"; a full re-scan is a feature-10 concern).
- Displaying install counts anywhere (metrics strategy: collect first, show
  later).
- Rate limiting / abuse controls on the download endpoint (feature 10).
- Permission diffs across arbitrary version pairs (only current vs previous).

## Build steps

- [x] **Step 1 - contracts + diff helper** - `publicPreflightSchema` (+ type,
  parse helper) and `diffPermissions` in
  `packages/skill-schema/src/preflight.ts`, exported from the index. *Done
  when:* tests cover added/removed/unchanged/empty diffs, a valid preflight
  parse, null diff + nullable fields, strict rejection of extra keys; suite
  green.
- [x] **Step 2 - download_events** - migration 0006 (`download_source` enum +
  table), `db/downloads.ts` with `recordDownload`. *Done when:* migration
  applied to Neon dev with no drizzle drift; the insert helper is a thin
  Drizzle wrapper covered through the step-4 route tests (same pattern as the
  other `db/*` create helpers); suite green.
- [x] **Step 3 - preflight endpoint** - route in `routes/skills.ts`
  (registered before the `/:slug/:version` catch), composing existing db
  helpers + R2 fetch + hash re-verify + diff. *Done when:* route tests cover
  contract parse, diff vs previous version, null diff for a first version,
  404 unknown slug/version, blocked=true for a failed passport,
  sourceVerified=false on hash mismatch, 502 on R2 failure, and no-leak
  (snapshotKey, submissionId, githubId); suite green.
- [x] **Step 4 - download endpoint** - zip + refusals + event recording.
  *Done when:* route tests cover a round-trippable zip (unzip the response
  bytes, compare files), correct headers, 403 for failed, 502 for hash
  mismatch (no bytes served), event row recorded with null userId when
  anonymous and the user id when a valid session cookie rides along; suite
  green.
- [x] **Step 5 - pre-flight panel** - api helpers, `PreflightPanel.tsx`,
  `InstallBar` wiring. *Done when:* build green; headless-Chrome evidence
  shows the panel open with real pre-flight data (stamp, hash verified,
  permissions, diff line) and a working download of the zip; blocked and
  API-down states exercised via the island's state handling.

## Files / areas

- `packages/skill-schema/src/preflight.ts` (+ test, new), `src/index.ts`.
- `apps/api/src/db/schema.ts`, `drizzle/0006_*`, `src/db/downloads.ts`
  (+ test, new).
- `apps/api/src/routes/skills.ts` (+ tests).
- `apps/web/src/lib/api.ts`,
  `components/skill/PreflightPanel.tsx` (new),
  `components/skill/InstallBar.tsx`, `components/skill/SkillDetail.tsx`
  (version prop pass-through).

## Data / contracts

- **`PublicPreflight` is load-bearing** - the feature-9 CLI renders the same
  object; strict schema in skill-schema.
- **The download serves exactly the validated snapshot** - bytes come from
  the pinned R2 object, and a hash mismatch refuses the download rather than
  serving unverified content. Hash parity uses `loadPackageFromFiles`, the
  same function the validator and submission flow use.
- **Blocking is status-based**: only `failed` blocks. Today nothing failed
  can publish, so the block path is proven in tests with a mocked failed
  passport; feature 10's manual states will make it reachable in production.
- `download_events.userId` is attribution, not authorization - the endpoints
  stay anonymous.

## Testing

- Steps 1-4 are logic: schema/diff tests, mocked-db helper test, mocked
  db+R2 route tests, all in the same diffs.
- Step 5 is UI: rides on build + headless-Chrome evidence per the testing
  scope rule.

## Notes for the AI

- Register the new routes before `GET /:slug/:version` in `routes/skills.ts`
  - specific routes first, same reason `/source` is where it is.
- Reuse `findPublishedSkillBySlug` + `findVersionWithPassport` +
  `listVersionsWithPassports`; no new queries needed for the previous-version
  lookup.
- Snapshot size is bounded by the feature-5 caps (10 MB), so `zipSync` in
  memory is fine.
- For the optional session read in the download route, verify the existing
  session cookie with the same primitives `requireAuth` uses, but never 401 -
  fall back to null.
- The panel lives inside the already-hydrated `SkillDetail` island; plain
  useState, no new libraries, no portal - an inline expanding panel is fine
  (matches the inline validation panel pattern).
- Download via a plain anchor to the API URL - the browser handles the
  attachment; no blob plumbing.

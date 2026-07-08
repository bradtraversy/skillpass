# Feature: Profiles + reputation

**From build-plan:** feature 10a
**Status:** complete

## Goal

Maintainers become visible people instead of a username string: publishing
earns reputation through an auditable `reputation_inputs` ledger that rolls up
into `users.reputation`, a public API serves a maintainer profile (identity,
reputation, published skills), and `/u/[username]` renders it - with skill
pages linking to their maintainer. This is the trust layer 10b (abuse reports)
and 10c (admin consequences) will write into.

## In scope

- **`reputation_inputs` table** (migration 0007, per the overview's
  ReputationInput model): id, userId FK, type (enum `skill_published` |
  `version_published` | `report_actioned`), weight int, createdAt. The
  `report_actioned` value ships now (enum churn is worse than an unused
  value) and gets wired by 10c.
- **Reputation module** (`apps/api/src/reputation/reputation.ts`):
  - `REPUTATION_WEIGHTS` - v1 taxonomy, deliberately small and tunable:
    `skill_published` +10 (first publish of a listing), `version_published`
    +2 (each re-publish), `report_actioned` -25 (10c wires it).
  - `awardReputation(db, userId, type)` - inserts the ledger row and
    atomically increments `users.reputation` by the weight (stored roll-up,
    per the data model).
- **Publish wiring**: `publishSubmission` awards `skill_published` when it
  creates the skill, `version_published` when it re-publishes an existing
  one. Reputation is derived data - an award failure logs and never fails
  the publish (same rule as download events).
- **`PublicProfile` contract** in `packages/skill-schema/src/profile.ts`:
  username, displayName, avatarUrl, reputation, joinedAt (ISO), skills
  (`PublicSkillSummary[]`, published only, newest first). No githubId, no
  role, no internal ids.
- **`GET /users/:username`** (public, anon, new `routes/users.ts`): unknown
  username 404s; a user with no published skills still resolves (empty
  skills array).
- **Web profile page**:
  - `pages/u/[username].astro` - static shell + `Profile` island
    (client-fetch, same LoadState pattern as `SkillDetail`), rendering
    avatar, display name, reputation, joined date, and the published skills
    as the existing `Row` component.
  - `getProfile(username)` in `lib/api.ts`.
  - `SkillDetail`'s maintainer block links to `/u/[username]`. (`Row` shows
    no maintainer text and is itself an anchor - nothing to link there.)

## Out of scope

- Abuse reports (10b), admin queue / manual review states / validation
  history (10c).
- Maintainer dashboard widgets (`/dashboard`) - rides with 10c or 11 when
  there is something maintainer-actionable to show.
- Reputation display beyond the number (badges, levels, verified flag - the
  MVP's `verified` is a launch-curation concern).
- Reputation for downloads/installs (metrics stay metrics; the ledger only
  records deliberate acts).
- Backfilling reputation for already-published dev rows (dev data only; not
  worth a script).

## Build steps

- [x] **Step 1 - ledger + publish wiring** - migration 0007, `db/schema.ts`
  table, reputation module, `publishSubmission` wiring. *Done when:* publish
  tests assert a `skill_published` award on first publish and
  `version_published` on re-publish (and that an award failure doesn't fail
  publish); migration applied to Neon dev, no drizzle drift; suite green.
- [x] **Step 2 - profile contract + endpoint** - `publicProfileSchema` (+
  type, parse helper) exported from skill-schema; `db/users.ts` gains
  `findByUsername`; `db/skills.ts` gains a published-by-maintainer list;
  `routes/users.ts` mounted anonymously. *Done when:* route tests cover the
  contract parse (skills as summaries, newest first), empty-skills profile,
  404 unknown username, and no-leak (githubId, role, snapshotKey); suite
  green.
- [x] **Step 3 - profile page + links** - `/u/[username].astro`, `Profile`
  island, `getProfile`, maintainer link from `SkillDetail`.
  *Done when:* build green; headless-Chrome evidence shows the live profile
  page for bradtraversy rendering reputation and the published skill row,
  and the skill-detail maintainer block navigating to it; loading/404/API
  -down states follow the island pattern.

## Files / areas

- `apps/api/drizzle/0007_*`, `src/db/schema.ts`, `src/reputation/reputation.ts`
  (+test, new), `src/publish/publish.ts` (+tests).
- `packages/skill-schema/src/profile.ts` (+test, new), `src/index.ts`.
- `apps/api/src/db/users.ts` (+helper), `src/db/skills.ts` (+query),
  `src/routes/users.ts` (+test, new), `src/app.ts`.
- `apps/web/src/pages/u/[username].astro` (new),
  `components/profile/Profile.tsx` (+ island, new), `lib/api.ts`,
  `components/skill/SkillDetail.tsx`.

## Data / contracts

- **The ledger is the truth, the column is the cache**: every reputation
  change writes a `reputation_inputs` row AND increments `users.reputation`;
  nothing edits the column directly. 10c's negative events reuse
  `awardReputation` unchanged.
- **Weights are v1 placeholders** - constants in one module, flagged for
  tuning before launch; changing a weight later does not rewrite history
  (ledger rows store the weight they were awarded with).
- **`PublicProfile` reuses `PublicSkillSummary`** - the profile's skill list
  is the same shape the directory renders, so `Row` works unchanged.
- Curated listings (admin-submitted, `attributedTo` set) still award the
  publishing maintainer (the admin) - attribution is display-only; revisit
  if curation volume ever matters.

## Testing

- Steps 1-2 are logic: reputation module test (award + roll-up call),
  publish wiring tests, contract tests, mocked-db route tests, all in the
  same diffs.
- Step 3 is UI: rides on build + headless-Chrome evidence.

## Notes for the AI

- `awardReputation` uses `sql\`reputation + ${weight}\`` - style increment, not
  read-modify-write, so concurrent publishes can't lose an award.
- Mount `routes/users.ts` like `routes/skills.ts` - no auth, no session
  read.
- The profile skills query is `listPublishedSkills` filtered by maintainer -
  same joins, same ordering; share the record shape rather than duplicating
  the mapper.
- Keep the `/u/[username].astro` shell consistent with
  `pages/skills/[slug]/index.astro` (getStaticPaths from the API with the
  unreachable-API `[]` fallback so builds stay hermetic).

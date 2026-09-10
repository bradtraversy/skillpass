# Current Feature

> **Generated file.** Holds the one feature or fix being built right now. Run
> `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
> an ad-hoc fix. Build one thing at a time; `/complete` archives it (to
> `blueprint/history/features/` or `blueprint/history/fixes/`) and resets this file.

## Two contracts typed on both sides of the wire

**Type:** Fix

**Branch:** `fix/single-source-contracts`

### The problem

- The `GET /me` payload is an interface in `apps/api/src/db/users.ts`
  (`PublicUser`) and again, by hand, in `apps/web/src/lib/api.ts`
  (`CurrentUser`). Nothing ties them together, and the web copy already
  dropped three fields silently.
- `apps/api/src/db/schema.ts` spells `skill_status` and `user_role` as string
  literals in `pgEnum(...)` while every other enum column reads its values
  from `skill-schema`. `SKILL_STATUSES` already exists there; a new status
  added to the schema package would not reach the database enum.

Audit item #7, "contracts typed twice", from the 2026-09-08 code audit.

### The fix

- `packages/skill-schema/src/user.ts`: `USER_ROLES`, `userRoleSchema`, and
  `publicUserSchema` (a read contract, so it strips unknown keys) with
  `PublicUser` and `parsePublicUser`, exported from the package index.
- The API's `db/users.ts` imports the type instead of declaring it;
  `schema.ts` builds `user_role` from `USER_ROLES` and `skill_status` from
  `SKILL_STATUSES`.
- The web imports `PublicUser` from `skill-schema` in `lib/api.ts`,
  `AccountMenu.tsx`, and `SubmitForm.tsx`; the local `CurrentUser` goes.

Must not break: the `/me` payload (unchanged fields), the `publicUser` test
that proves `githubId` never leaks, and the generated enum values (the same
literals, so no migration).

### Build steps

- [x] **Step 1 - schema module, API and web imports, tests.** `user.test.ts`
  covers accept, reject (bad role, bad date, missing name), and strip. Done
  when `pnpm test` and `pnpm typecheck` (which includes `astro check`) are
  green.

### Testing

Pure schema logic with tests; the rest is type wiring caught by `tsc` and
`astro check`.

### Verify

`pnpm test` green; `git grep CurrentUser` returns nothing.

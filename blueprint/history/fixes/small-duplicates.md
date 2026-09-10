# Current Feature

> **Generated file.** Holds the one feature or fix being built right now. Run
> `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
> an ad-hoc fix. Build one thing at a time; `/complete` archives it (to
> `blueprint/history/features/` or `blueprint/history/fixes/`) and resets this file.

## Small duplicates across packages

**Type:** Fix

**Branch:** `chore/small-duplicates`

### The problem

- The `{ success, data } | { success, error }` result type is declared
  three times: `skill-schema`'s `ParseResult`, its `ApiEnvelope`, and the
  API's `lib/result.ts`.
- The validator's `slugify` is `slugForSkill` from `skill-schema` minus the
  length cap, so an inferred name can differ from the slug it publishes as.
- `ENGINE_VERSION` in `validate.ts` repeats the validator's `package.json`
  version by hand.
- Four route test files each mint a signed session cookie with the same
  ten-line helper.
- Six backfill scripts repeat the env/db setup and the entry-point guard.
- `GET /me` is defined in `app.ts` while its sub-routes live in `me.ts`.
- Four `tsconfig.json` files are identical copies.
- `astro check` warns twice that `FormEvent` is deprecated in the submit form.

Audit item #8 (convention drift, code) from the 2026-09-08 code audit.

### The fix

One `Result<T>` in `skill-schema` (`ParseResult` and `ApiEnvelope` alias it;
the API imports it); the validator uses `slugForSkill`; `ENGINE_VERSION`
reads `package.json`; `testing/session.ts` mints cookies for the four
suites; `seed/runner.ts` owns the backfill entry point with a test; `GET /me`
moves into `me.ts`; a root `tsconfig.base.json` that the four packages
extend; the form handler types its event from the element instead of the
deprecated alias.

Must not break: every suite, `pnpm typecheck` (now with zero hints in
`apps/web`), the CLI bundle (which inlines the JSON import), and
`pnpm build`.

### Build steps

- [x] **Step 1 - the eight changes.** Done when tests, typecheck, and build
  are green and `astro check` reports no hints.

### Testing

`runner.test.ts` covers the entry guard; the rest is exercised by existing
suites and the type checker.

### Verify

`pnpm typecheck` shows 0 hints for `apps/web`; `pnpm cli scan` on a fixture
prints `engineVersion` equal to the validator package version.

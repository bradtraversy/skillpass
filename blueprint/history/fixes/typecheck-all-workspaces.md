# Current Feature

> **Generated file.** Holds the one feature or fix being built right now. Run
> `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
> an ad-hoc fix. Build one thing at a time; `/complete` archives it (to
> `blueprint/history/features/` or `blueprint/history/fixes/`) and resets this file.

## The types gate skips three of the five workspaces

**Type:** Fix

**Branch:** `fix/typecheck-all-workspaces`

### The problem

Root `pnpm typecheck` runs `astro check` in `apps/web` and `tsc --noEmit` in
`packages/cli`. `apps/api`, `packages/validator`, and `packages/skill-schema`
have a strict `tsconfig.json` each but no `typecheck` script and no TypeScript
dependency, so nothing ever type-checks them. Running `tsc` by hand shows four
errors that have been sitting there unnoticed, all in test files, with a fifth
(an `aiReview: null` key the passport type never had) hidden behind the third:

| File | Error |
|---|---|
| `apps/api/src/review/ensure.test.ts:44` | mocked `SnapshotDocument` is missing `version: 1` |
| `apps/api/src/routes/me.test.ts:88` | `permissionsSummary: []` where the type is `{ declared, detected }` |
| `apps/api/src/routes/me.test.ts:91` | `resolvedCommitSha: null` where the type is `string \| undefined`; behind it, an `aiReview` key that is not in `SkillPassport`, and the required `schemaVersion`, `distribution`, `manifestInferred`, `engineVersion` fields missing |
| `packages/validator/src/validate.test.ts:71` | passes `NOW` (a `Date`) where `{ now?: Date }` is expected, so the option is silently dropped |

The last one is a real test defect: the test believes it pins the clock and does
not. The API ones mean the fixtures drift from the contract without anyone
noticing.

Audit item #4 from the 2026-09-08 code audit.

### The fix

- Add `"typecheck": "tsc --noEmit"` and a `typescript` devDependency (same
  `^6.0.3` range `apps/web` and `packages/cli` already declare) to `apps/api`,
  `packages/validator`, and `packages/skill-schema`, matching the existing
  per-package convention.
- Change the root script to `pnpm -r typecheck`, which runs the script in every
  workspace package that defines it (root excluded) and stops on the first
  failure.
- Fix the errors in place: add `version: 1` to the mocked snapshot, rebuild the
  `me.test.ts` passport fixture to the full `SkillPassport` shape the users route
  test already uses, and pass `{ now: NOW }` in the validator test.
- Update the Typecheck line in the Commands section of `AGENTS.md` so it
  describes what the script now covers.

Must not break: `pnpm build` (still `astro check && astro build` in `apps/web`),
`pnpm test`, and `pnpm -C packages/cli typecheck` behave exactly as before. No
runtime code changes.

### Build steps

- [x] **Step 1 - wire the gate and fix the type errors.** Package scripts and
  devDependencies, root script, the three test files, `AGENTS.md`, and the
  lockfile update from `pnpm install --offline`. Done when `pnpm typecheck` runs
  all five workspaces and exits 0, `pnpm test` is green, and `tsc --noEmit -p
  apps/api` fails on the pre-fix test files (proving the gate would have caught
  them).

### Testing

No logic-bearing code changes; the diff is test fixtures, scripts, and
dependencies. The gate is the test: `pnpm typecheck` green across five
workspaces, `pnpm test` green.

### Verify

1. `pnpm typecheck` prints five workspace runs (`apps/web`, `apps/api`,
   `packages/skill-schema`, `packages/validator`, `packages/cli`) and exits 0.
2. Introduce a deliberate type error in any `apps/api` source file, run
   `pnpm typecheck`, and confirm it fails; revert.

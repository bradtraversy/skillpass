# Current Feature

> **Generated file.** Holds the one feature or fix being built right now. Run
> `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
> an ad-hoc fix. Build one thing at a time; `/complete` archives it (to
> `blueprint/history/features/` or `blueprint/history/fixes/`) and resets this file.

## Installed CLIs hard-fail on the next additive API field

**Type:** Fix

**Branch:** `fix/cli-tolerant-contracts`

### The problem

`getParsed` in `packages/cli/src/api.ts` validates every API response with the
shared read contracts from `skill-schema`: `publicSkillListSchema`,
`publicSkillDetailSchema` (with its nested passport, pack member entries, AI
review, findings, and maintainer block), and `publicPreflightSchema`. All of
them are `z.strictObject`, so any key the API adds later, anywhere in those
trees, makes every installed CLI answer `the API response did not match the
expected contract` (exit 2) for `search`, `report`, `add`, `update`, and
`outdated`. The API has already grown fields this way five times (`noteCount`,
`category`, `displayName`, `tagline`, `integrations`, `packSkills`, each marked
optional to dodge the problem on the next side). Because the CLI bundles
`skill-schema` at build time, the constraint is frozen into whatever version a
user has installed.

Nothing else validates with these schemas at runtime: the web never parses
API responses, and the API uses `parsePassport` and `aiReviewSchema` only as
self-checks on objects it just built.

Audit item #5 (first half) from the 2026-09-08 code audit.

### The fix

Wire-read contracts strip unknown keys instead of rejecting them; input
contracts stay strict.

- `z.strictObject` becomes `z.object` (strip) in `public.ts`, `preflight.ts`,
  `passport.ts`, `ai-review.ts`, and `reportFindingSchema` in `report.ts`,
  including every nested object literal in those trees.
- `manifest.ts` keeps `skillEntrySchema` strict because it also validates the
  author's `skill.json`; the detail contract's `packMembers` uses
  `z.object(skillEntrySchema.shape)`, the strip form of the same shape.
- `validationReportSchema`, the admin, abuse, maintainer, profile, and manifest
  schemas are untouched: they validate input or are producer self-checks.
- The five `rejects extra keys` tests flip to `strips extra keys` (success, key
  absent from the parsed data), plus one passport case and one CLI `getParsed`
  case proving a future field in a detail response no longer breaks `report`.

Must not break: every other assertion in those suites (unknown targets,
permissions, statuses, and enum values still reject); `parsePassport` and the
AI review self-check still pass for the objects the API builds; the validator's
manifest parsing behavior is unchanged.

Installed CLIs only benefit once a new `skillpass` version is published to npm;
that release is a separate, explicit step.

### Build steps

- [x] **Step 1 - strip instead of reject on the read contracts.** Schema edits
  in the five files, the flipped and added tests. Done when `pnpm test` and
  `pnpm typecheck` are green and the new CLI test fails on the old schemas.

### Testing

Pure logic under the Vitest gate; the flipped and added tests ship in the diff.

### Verify

1. `pnpm test` green.
2. Point the CLI at a response with an invented key: `pnpm cli report
   ai-blueprint` still renders (the production API has no extra keys today, so
   the unit test is the proof).

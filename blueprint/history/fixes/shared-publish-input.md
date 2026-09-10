# Current Feature

> **Generated file.** Holds the one feature or fix being built right now. Run
> `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
> an ad-hoc fix. Build one thing at a time; `/complete` archives it (to
> `blueprint/history/features/` or `blueprint/history/fixes/`) and resets this file.

## Publish input is mapped from the manifest in two places

**Type:** Fix

**Branch:** `fix/shared-publish-input`

### The problem

The submit route (`apps/api/src/routes/submissions.ts`) and the curate seed
(`apps/api/src/seed/curate.ts`) each map a loaded manifest onto
`PublishInput` field by field, and both, plus `detectPackage`, spell out the
"a pack is two or more member skills" rule as a bare `>= 2`. A new manifest
field or a change to the pack threshold has to land in three places.

Audit item #7, fourth cluster, from the 2026-09-08 code audit.

### The fix

`publishFieldsFrom(manifest, inferred)` and `MIN_PACK_SKILLS` (with
`packSkillsOf`) in `apps/api/src/publish/publish.ts`. Both publish callers
spread the shared fields and override only what differs (curate's optional
name, attribution, verified). `detectPackage` reads the constant.

Must not break: the publish, submissions, and curate suites, which assert the
exact `PublishInput` passed through (including `packSkills: null` for singles
and the member list for packs).

### Build steps

- [x] **Step 1 - helper, three call sites, tests.** Unit tests for
  `publishFieldsFrom` (field mapping, one entry is a single, two is a pack,
  inferred flag). Done when `pnpm test` and `pnpm typecheck` are green.

### Testing

Pure logic under the Vitest gate; the callers are covered by their suites.

### Verify

`pnpm test` green; both callers shrink to a spread plus their differences.

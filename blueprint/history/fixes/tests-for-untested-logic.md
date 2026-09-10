# Current Feature

> **Generated file.** Holds the one feature or fix being built right now. Run
> `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
> an ad-hoc fix. Build one thing at a time; `/complete` archives it (to
> `blueprint/history/features/` or `blueprint/history/fixes/`) and resets this file.

## Logic that escaped the test gate

**Type:** Fix

**Branch:** `fix/tests-for-untested-logic`

### The problem

Vitest is a declared gate, yet five pieces of real logic have no test because
they live inside components or DB-bound functions:

- `detectionSummary` in `SubmitForm.tsx` (the five detection outcomes).
- The facet counts in `FilterSidebar.tsx` (category, integration, tool, pack).
- The permission diff union in `PreflightPanel.tsx`.
- `awardReputation` in `apps/api/src/reputation/reputation.ts`, whose input
  type also re-lists the `reputation_input_type` enum by hand.
- The rollback paths of `writeTree` and `swapTree` in the CLI.

Audit item #7, "untested logic", from the 2026-09-08 code audit.

### The fix

Move the three web pieces into pure `lib/` modules the components import
(`detection-summary.ts`, `facets.ts`, `permission-diff.ts`) and test them.
Test `awardReputation` against a fake db that records the insert and update,
and derive `ReputationInputType` from a `REPUTATION_INPUT_TYPES` const shared
with the `pgEnum`. Add rollback tests for `writeTree` (staging file blocks
the write: target untouched, staging removed) and `swapTree` (setting the old
folder aside fails: old folder intact, no `.new-` sibling).

Must not break: rendered output of the three components (same values, moved
computation); `pnpm build` and a homepage screenshot prove the sidebar counts.

### Build steps

- [x] **Step 1 - extractions, tests, enum const.** Done when `pnpm test` and
  `pnpm typecheck` are green and `pnpm build` passes with the homepage sidebar
  counts unchanged.

### Testing

Every new module ships a test; the rollback tests fail on any regression of
the cleanup paths.

### Verify

`pnpm test` green; the homepage filter sidebar shows the same counts.

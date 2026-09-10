# Current Feature

> **Generated file.** Holds the one feature or fix being built right now. Run
> `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
> an ad-hoc fix. Build one thing at a time; `/complete` archives it (to
> `blueprint/history/features/` or `blueprint/history/fixes/`) and resets this file.

## Dead code and exports nothing imports

**Type:** Fix

**Branch:** `chore/dead-code-sweep`

### The problem

Verified with a usage scan across the monorepo (definition-only or same-file
uses only):

- `findByGithubId` in `apps/api/src/db/users.ts` has no caller.
- `SkillFilters.verdict` and the `verified` directory tab in
  `apps/web/src/lib/filterSkills.ts`: no component can set either; the
  directory always passes `verdict: 'all'` and offers Featured and Latest.
- `LoadedPackage.dir` and `ManifestState.raw` in the validator are written
  and never read.
- `DetectedPermission.description` and `.location` are written and never
  read; every consumer maps straight to `.permission`.
- `EMBEDDING_DIMENSIONS` is exported and unused while the schema hardcodes
  `1024` for the vector column.
- The validator index re-exports the three rule modules nobody imports.
- Eleven `export`s are used only inside their own file: the five content
  pattern tables and `PatternRow`, `PERMISSION_SIGNALS` and `PermissionSignal`,
  `MAX_DOWNLOAD_BYTES`, `R2_TIMEOUT_MS`, `snapshotDocumentSchema`,
  `packSkillsOf`, `packChoices`, `renderDiff`, `installAreas`.

Audit item #8 (dead code) from the 2026-09-08 code audit. The `parseX`
helpers and inferred types in `skill-schema` stay: they are the package's
uniform surface, not dead code.

### The fix

Delete the dead function, field, and filter paths (with their tests), make
`detectPermissions` return the deduplicated permission keys it is used for,
move `EMBEDDING_DIMENSIONS` next to the column it sizes, trim the validator
index, and drop `export` from the same-file-only names.

Must not break: every remaining test; `pnpm typecheck` across all workspaces
proves no import is left dangling.

### Build steps

- [ ] **Step 1 - the sweep.** Done when `pnpm test` and `pnpm typecheck` are
  green and the usage scan reports none of the listed names as unused.

### Testing

Removals are covered by the existing suites (adjusted where they tested the
removed paths); the permission detector keeps its tests on the new shape.

### Verify

`pnpm test` green; `git grep findByGithubId` and `git grep "tab: 'verified'"`
return nothing.

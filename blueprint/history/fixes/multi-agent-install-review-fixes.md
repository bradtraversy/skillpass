# Fix: Multi-agent install review fixes

**Type:** Fix
**Status:** verified
**Branch:** `fix/multi-agent-install-review-fixes`

## The problem

CodeRabbit raised four valid findings on PR #12 (feature 21) after it merged:

1. **`installPack` under-reports on a mid-way failure.** In
   `packages/cli/src/add.ts` the `written` list resets per area, so when
   `--target claude-code --target cursor` fully installs the first area and the
   second area's first write fails, the error says `installed before the
   failure: none` and never names the failing folder. The first area is on disk
   with receipts. `installSingle` already reports its `landed` list correctly.
2. **Inherited property names pass the unknown-target check.** `resolveTargetArea`
   in `packages/cli/src/targets.ts` reads `INSTALL_TOOLS[target]` with plain
   property access, so `--target constructor` (or `toString`, `__proto__`) is
   treated as a tool and `join` throws on its missing `project` field instead of
   returning the unknown-target error.
3. **Project and user folders that coincide lose the user scope.** When the CLI
   runs from the home directory, `resolve(cwd, '.agents/skills')` equals
   `join(home, '.agents/skills')`. `knownAreas` dedupes by folder and keeps only
   the first (project) entry, so `remove --target x --global` and
   `update --target x --global` filter on `global === true`, match nothing, and
   report the install as missing. Before feature 21 both entries existed, so
   this is a regression in that edge case.
4. **`list.test.ts` hard-codes forward slashes** for headings that `knownAreas`
   builds with `join`, so the tests fail on Windows. `targets.test.ts` and
   `add.test.ts` already use `join`.

## The fix

- **Areas carry both scopes.** `KnownArea` gains `project: boolean` beside
  `global: boolean`; a folder that serves both scopes has both true. `knownAreas`
  sets the flag for each scope it merges and labels the area `(project)`,
  `(user)`, or `(project, user)`. `remove` and `update` filter with
  `opts.global ? area.global : area.project`. `resolveArea`, `installChoices`,
  `list`, and `outdated` need no logic change: one folder, one entry.
- **Own-property lookup.** A small `lookupTool(name)` in `targets.ts` returns the
  registry entry only for `Object.hasOwn` keys; `resolveTargetArea` and
  `layoutTarget` use it. Unknown names, inherited or not, get the existing
  unknown-target message.
- **Honest pack failure report.** `installPack` tracks what landed across areas
  and reports `error: could not write <member> in <folder>; installed before the
  failure: <folder>: a, b; <folder>: c` (or `none`). The single-area wording keeps
  its existing shape so current tests still read naturally.
- **`join` in list test expectations.** Replace the literal `.claude/skills` and
  `.agents/skills` headings with `join(...)`.

Nothing else changes: no schema, API, receipt, or exit-code change.

## Build steps

- [x] **Step 1 - Registry hardening** - `lookupTool` with `Object.hasOwn`,
  `project` flag on `KnownArea` with merged labels, `remove` and `update`
  filters by scope flag. Tests in `targets.test.ts` (inherited names rejected,
  `knownAreas(HOME, HOME)` yields three areas each with both flags and a
  `(project, user)` label) and `remove.test.ts` (a `--global` pack removal from
  a cwd that equals home). *Done when:* those tests pass with the existing CLI
  suite (`pnpm exec vitest run packages/cli`).
- [x] **Step 2 - Pack failure report and Windows-safe list test** - `installPack`
  landed tracking across areas, `join` in `list.test.ts`. Test in `add.test.ts`:
  a two-area pack install where the second area's write fails reports the first
  area's members and the failing folder. *Done when:* that test passes, the CLI
  suite passes, and `pnpm verify` is green.

## Verify

- `pnpm exec vitest run packages/cli` for the focused suite, `pnpm verify` at
  the end.
- Manual: from your home directory, `pnpm cli add pdf --target cursor --global`
  then `pnpm cli remove pdf --target cursor --global` removes it (this was the
  failing case); `pnpm cli add pdf --target constructor` prints the unknown-target
  list instead of crashing. Run trial installs from a scratch directory when not
  testing the home-directory case, so nothing lands in this repo's `.agents/skills`.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":4334,"specSha256":"af0fb6800a33113a5ac591bd9ebc06253d20ea29a30761dc121c88be454f8a1e","branch":"refs/heads/fix/multi-agent-install-review-fixes","head":"31c043af50cb7b8b6bf1d759bcc6d3217404ed94","baseRef":"refs/heads/main","baseCommit":"31c043af50cb7b8b6bf1d759bcc6d3217404ed94","sourceTree":"ea3ac5f214e3597dd75bd87e8e8fe44e0aad893d","absentOptional":[]} -->

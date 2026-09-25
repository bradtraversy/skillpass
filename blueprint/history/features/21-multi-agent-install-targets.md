# Feature: Multi-agent install targets

**From build-plan:** feature 21
**Build attempt:** 1
**Status:** verified
**Branch:** `feature/multi-agent-install-targets`

## Goal

`skillpass add --target <tool>` works for every major agent, not just Claude
Code and Codex. Today the CLI knows two install folders; every other tool errors
out to `--dir`. This feature adds a CLI-local install registry with the folders
each tool documents, user-level installs for all of them, repeatable `--target`
on `add`, and correct behavior in `list`, `outdated`, `remove`, and `update`
when several tools share one folder. It is the biggest practical gap next to
skills.sh, and it is a prerequisite for the Prompt install tab (24) and the
per-agent pages (25).

## In scope

- **Install registry** in `packages/cli/src/targets.ts`: a table of install
  tools, each with a project folder, a user-level folder, and a layout family.
  Paths come from each tool's own docs (checked 2026-09-25):

  | tool | project folder | user-level folder | layout |
  | --- | --- | --- | --- |
  | `agents` | `.agents/skills` | `~/.agents/skills` | `codex` |
  | `claude-code` | `.claude/skills` | `~/.claude/skills` | `claude-code` |
  | `codex` | `.agents/skills` | `~/.agents/skills` | `codex` |
  | `cursor` | `.agents/skills` | `~/.agents/skills` | `codex` |
  | `windsurf` | `.agents/skills` | `~/.agents/skills` | `codex` |
  | `github-copilot` | `.agents/skills` | `~/.agents/skills` | `codex` |
  | `gemini-cli` | `.agents/skills` | `~/.agents/skills` | `codex` |
  | `opencode` | `.agents/skills` | `~/.agents/skills` | `codex` |
  | `cline` | `.cline/skills` | `~/.cline/skills` | `codex` |

  `agents` names the cross-agent folder itself, the answer to "which target do I
  pick" for anyone not on Claude Code or Cline. Codex, Cursor, Windsurf, GitHub
  Copilot, Gemini CLI, and OpenCode all document both `.agents/skills` and
  `~/.agents/skills`, so their slugs resolve to those same two folders. Cline
  documents `.cline/skills` and `~/.cline/skills` and not the shared folder, so
  it keeps its own. `layout` is the declared `Target` whose files a tool reads:
  `claude-code` for Claude Code, the `.agents` standard (`codex`) for everyone
  else. Existing behavior is preserved: `claude-code` and `codex` project folders
  are unchanged, and no existing install moves. `cowork` and `aider` remain
  declared-only targets with no install folder (the `--dir` message still
  applies).
- **Resolution** validates `--target` against the registry, not `TARGETS`. The
  unknown-tool error lists every registry slug. `--global` works for every tool
  (all nine have a user-level folder).
- **Distinct areas.** `knownAreas` returns each folder once, with the list of
  tools that read it and its layout, so `list`, `outdated`, `remove`, and
  `update` never report or scan `.agents/skills` six times. Labels show the
  folder, its scope, and the tools that read it.
- **Layout-aware consumers.** The "does not declare X" warning in `add` is
  satisfied when the skill declares the tool itself or the tool's layout target,
  so a skill inferred as `codex` installs into Cursor without a false warning.
  Pack member selection (`resolvePackMembers`) and pack update use the area's
  layout target, so a pack installed into Gemini CLI gets its `.agents` variants.
  The interactive picker lists distinct areas, not one entry per tool.
- **Repeatable `--target` on `add`.** `add <slug> --target claude-code --target
  codex` installs into both folders: one pre-flight and one risk confirmation,
  every destination checked free before any write, then each area installed in
  turn with its own receipt. Targets that resolve to the same folder install
  once and the output says so. `--global` applies to all given targets. A
  failure mid-way stops and reports which areas landed. `remove` and `update`
  accept one `--target` and treat a second as a usage error (exit 2).
- **Docs and help**: the `--target` and `--global` lines in `USAGE`, the
  Install section of `packages/cli/README.md`, the `Install: add` section of
  `apps/web/src/pages/docs/cli.astro`, and the Skills CLI line in `AGENTS.md`
  Commands list the tools and the shared-folder rule.

## Out of scope

- Changing `TARGETS` in `skill-schema`, the manifest, the public API, the site
  filter, or `search --target` (which filters by declared targets). Install
  tools are a CLI concern; per-agent pages (25) will decide how the site models
  layout compatibility.
- Amp, Antigravity, Kiro, Roo Code, Zed, and other tools: adding one is a
  registry row once its docs are checked.
- `.devin/skills` and `.windsurf/skills` (Windsurf's own folders), `.github/skills`
  (Copilot's), `.gemini/skills`, `.opencode/skills`, `.cursor/skills`: each tool
  also reads the shared folder, and one copy beats several.
- `CLAUDE_CONFIG_DIR` and `CODEX_HOME` overrides; symlinked installs.
- Publishing the new CLI version to npm and bumping `packages/cli` version
  (a release decision, separate approval).

## Build loop

Build one small step at a time. `blueprint/config.json` is absent, so defaults
apply: `workflow.stepReview: feature` (one review packet after all steps) and
checkpoint commits disabled. Independent review runs only if the
`when-sensitive` gate selects it. `/complete` makes the final feature commit.

## Build steps

- [x] **Step 1 - Registry and resolvers** - replace `installAreas` with the
  install-tool table above; `resolveTargetArea` and `resolveTargetDir` validate
  against it and keep their result shapes; add `layoutTarget(tool)`; rework
  `knownAreas(cwd, home)` to return distinct folders with `tools: string[]`,
  `layout`, `global`, `label`, and absolute `dir`; keep `MAPPED_TARGETS` and
  `mappableDeclaredTargets` working over the registry. Update `targets.test.ts`.
  *Done when:* tests prove every tool's project and user-level folder, that
  `cursor --global` resolves to `~/.agents/skills`, that `knownAreas` lists
  `.agents/skills` once with all six tools plus `agents`, that an unknown tool's
  error names every slug, and `pnpm --filter skillpass test` passes.
- [x] **Step 2 - Consumers follow the registry** - `add.ts`: declared-target
  warning via the layout target, `installChoices` and `packChoices` built from
  distinct areas, `installPack` resolves members with the area's layout target;
  `update.ts` and `remove.ts`: `--target` filters by `area.tools.includes`,
  pack members resolve by area layout; `list.ts` and `outdated.ts`: new labels.
  Extend the existing tests in `add.test.ts`, `update.test.ts`, `remove.test.ts`,
  `list.test.ts`, and `outdated.test.ts`. *Done when:* `add x --target cursor`
  on a skill declaring only `codex` installs into `.agents/skills/x` with no
  warning; a pack installed with `--target gemini-cli` uses codex variants;
  `list` prints `.agents/skills` once; `remove x --target opencode` finds the
  install; the package tests pass.
- [x] **Step 3 - Repeatable `--target` on `add`** - `parseCliArgs` collects
  `targets: string[]` (order kept, duplicates dropped); `add` resolves all,
  dedupes by absolute folder, checks every destination free, installs each with
  receipts, and reports collapsed targets; `remove` and `update` reject more than
  one. Tests in `index.test.ts` and `add.test.ts`. *Done when:* two distinct
  targets both install with one pre-flight; `--target codex --target cursor`
  installs once and says so; a pre-existing non-empty destination in any area
  aborts before any write; `remove x --target a --target b` exits 2.
- [x] **Step 4 - Help and docs** - `USAGE` lines for `--target` and `--global`,
  `packages/cli/README.md` Install section, `apps/web/src/pages/docs/cli.astro`
  Install section, and the Skills CLI line in `AGENTS.md`. *Done when:* each
  names the tools and says which share `.agents/skills`; `pnpm verify` passes.

## Files / areas

- `packages/cli/src/targets.ts` and `targets.test.ts` (registry, resolvers, areas)
- `packages/cli/src/add.ts`, `update.ts`, `remove.ts`, `list.ts`, `outdated.ts`
  and their tests
- `packages/cli/src/index.ts` (`USAGE`, `parseCliArgs`) and `index.test.ts`
- `packages/cli/README.md`, `apps/web/src/pages/docs/cli.astro`, `AGENTS.md`

## Data / contracts

- `--target <tool>`: the nine registry slugs above; anything else exits 2 with
  the list. Repeatable on `add` only.
- Exit codes unchanged: 0 installed, 1 blocked, 2 usage/refused/network.
- `.skillpass.json` receipts unchanged; a shared folder has one index that all
  its tools share (already true for `.agents/skills`).
- Not-empty destination check stays all-or-nothing across every target of one
  `add`, mirroring pack installs.
- No API, schema, or database change.

## Testing

- Vitest is configured (`pnpm test`, or `pnpm --filter skillpass test` while
  iterating). Logic under test: registry resolution and area dedupe (step 1),
  layout-aware warning and pack selection, area filters and labels (step 2),
  multi-target parsing and install ordering (step 3). Existing tests inject
  `home`, `cwd`, `fetchImpl`, and temp dirs; follow that pattern.
- Verify command observed this session: `pnpm verify` ran through the pre-push
  hook on the identical tree (commit 1009989, squash-merged as 29b87cd) and
  passed: lint, format check, typecheck in 5 workspaces, 92 test files / 1073
  tests, build. The GitHub Verify run on main at 29b87cd also passed.
- Manual try: `pnpm cli add <slug> --target cursor` in a scratch folder, then
  `pnpm cli list`; repeat with `--target claude-code --target codex`.

## Notes for the AI

- Keep `Target` from `skill-schema` for declared targets and layout values; the
  install-tool slug is a plain string type local to the CLI.
- Tests must never touch the real home directory: keep the `home` seam.
- Preserve the atomic install path (`writeTree`) and the "nothing on disk until
  the hash re-verifies" rule for every area.
- Prettier ignores markdown; the TypeScript changes must pass `pnpm lint` and
  `pnpm format:check`, so run `pnpm format` before the review packet.
- No comments restating the table; one short line on why `agents` exists is
  enough.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":10165,"specSha256":"ce1364acfe7521e9f8fdb710cf75334cc3aeb47535aa4838b63bb9def037ee7f","branch":"refs/heads/feature/multi-agent-install-targets","head":"29b87cd3a1816ab4953438bcc742a9a0bd0f1cdd","baseRef":"refs/heads/main","baseCommit":"29b87cd3a1816ab4953438bcc742a9a0bd0f1cdd","sourceTree":"2c4fb9121e68761dd04a708b1f67841ad24a8753","absentOptional":[]} -->

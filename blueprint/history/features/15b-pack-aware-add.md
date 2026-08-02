# Feature: 15b - Pack-aware add

**From build-plan:** feature 15b
**Branch:** `feature/15b-pack-aware-add`
**Date:** 2026-08-02

## What and why

A pack install now means every member skill lands in the chosen tool's skills
area as its own folder, using that tool's variant files - `add ai-blueprint
--target codex` puts 19 folders in `.agents/skills/` built from the
`.agents/skills/*` variants. The 13b follow-up the `packMembers` detail
contract was locked for; last functional gap before the npm ship (15c).

## Scope decisions (as shipped)

- **Member resolution** (`pack.ts`, pure): for target T the source path is
  `variants[T] ?? entry` when the member supports T (or declares no
  targets); the install folder is the member `name`, the source subtree is
  `dirname(path)`. Unsupported members are skipped with a visible note.
- **Behavior matrix**: `--target [--global]` fans out into the tool's area;
  `--dir` keeps the raw verified snapshot (labeled escape hatch); the
  interactive picker offers tool areas (project + user-level) plus the raw
  current-directory choice; non-TTY defaults to raw `./<slug>` with a
  fan-out tip.
- **All-or-nothing pre-check**: every member destination must be absent or
  an empty directory before anything is written; conflicts abort listing
  the offending paths. Writes are per-member temp+rename (15a atomicity)
  after one snapshot-wide hash verification. If a mid-fan-out write fails,
  already-written members stay and the error names them - full rollback
  judged over-engineering.
- **Shared plumbing**: download/caps/unzip/unsafe-path/hash-verify factored
  into `downloadVerified`, the temp+rename write into `writeTree`; singles
  and packs use the same code, singles behavior unchanged (all
  pre-existing add tests untouched and green).
- **`report` shows members**: `Pack      19 skills: ...` line before install.
- **Deferred**: pack-level `remove` (members remove individually by name),
  local version receipts / update flow.

## Build steps

- [x] **Step 1 - member resolution + report surface** (`15d0dbe`)
- [x] **Step 2 - fan-out install in `runAdd`** (`e2cd049`)
- [x] **Step 3 - proving run and gates** (`a0143dc`)

## Verification

- `pnpm test` 835 passed (824 at branch; +11 covering resolution rules,
  both-target fan-outs, conflict abort, raw `--dir`, pack picker, non-TTY
  default, report line); `pnpm typecheck` and `pnpm build` green.
- Prod proving runs: `add ai-blueprint --target claude-code` installed 19
  skills into a temp `.claude/skills` (hash verified); `--target codex`
  installed the 19 codex variants; `report ai-blueprint` leads with the
  Pack line.

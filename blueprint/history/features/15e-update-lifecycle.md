# Feature: 15e - Update lifecycle

**From build-plan:** feature 15e (closes parent 15 - the CLI install lifecycle)
**Branch:** `feature/15e-update-lifecycle`
**Date:** 2026-08-02

## What and why

The CLI had no memory of what it installed: nothing could say "outdated" and
updating meant manual remove + add. This closed the loop - receipts at install
time, `outdated`, `update` re-running the full trust gate with a permission
diff against the installed version, pack-level update and remove, versions in
`list`. With it, feature 15 is complete: find (search), inspect (report),
validate (scan), install (add), track (list/outdated), update, remove.

## Scope decisions (as shipped)

- **Receipts**: per-area `.skillpass.json` index `{ slug: { version,
  sourceHash, installedAt, pack? } }`. Skill folders stay byte-identical to
  their snapshots; the dotfile is invisible to tools scanning
  `skills/*/SKILL.md`. Known areas only; `--dir` installs update via
  reinstall. Absent/corrupt indexes read as empty entry-by-entry, so
  pre-receipt installs never break a command.
- **`outdated`**: one list fetch, installed vs latest per area, exit 1 when
  updates exist (npm-style, documented). Unreceipted folders whose names
  match a listing are identified by re-hashing against published version
  hashes; folders not in the directory at all are summarized in one count
  line or the area omitted - fixed mid-run after the first proving pass
  nagged 31 hand-made personal skills in the real `~/.claude/skills`.
- **`update <slug>[@version]`**: receipt lookup (hash-identify fallback
  adopts a receipt on success), multi-area disambiguation via
  `--target [--global]`, pre-flight render plus a client-computed permission
  diff vs the installed version (the API's stored diff only covers the
  previous publish), risk reconfirmation, atomic swap (new tree staged, old
  renamed aside, restore on failure), receipt update, friendly no-op when
  current. Downgrades via `@version` work.
- **Pack update**: member walk against one verified snapshot - changed
  members swap, added members install (pre-checked), dropped members are
  removed, receipts follow; member updates route to their pack by name.
- **Pack remove**: `remove <packSlug>` removes the recorded family
  (ai-blueprint: 19 folders + receipts in one command).
- Pre-receipt pack installs cannot be hash-identified (a member subtree is
  not the snapshot) and are never guessed at.

## Build steps

- [x] **Step 1 - receipts** (`d8f6f4b`)
- [x] **Step 2 - `outdated`** (`bfc271a`)
- [x] **Step 3 - `update` for singles** (`7071ef3`)
- [x] **Step 4 - pack update and remove** (`847c956`)

## Verification

- `pnpm test` 870 passed (841 at branch, +29 across receipts, outdated,
  update, remove, list, add); `pnpm typecheck` and `pnpm build` green.
- Prod proving run: installed ai-blueprint (19 members + receipts), doctored
  receipts to 0.9.0, `outdated` flagged `0.9.0 -> 1.0.0 (pack, 19 skills)`
  exit 1, `update` restored 1.0.0 hash-verified, `outdated` reported
  "Everything is current." exit 0, `remove ai-blueprint` cleared the family.

## Known gaps / follow-ups

- The mid-swap rename-failure restore branch is code-reviewed, not
  unit-tested (fs mocking judged too brittle).
- `update --all` deferred.
- npm users receive all of this at the **0.2.0 publish** - a one-command
  follow-up (`pnpm publish` from `packages/cli` after a version bump).

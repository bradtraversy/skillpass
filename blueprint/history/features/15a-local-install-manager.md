# Feature: 15a - Local install manager

**From build-plan:** feature 15a (parent 15 split into 15a/15b/15c at spec time)
**Branch:** `feature/15a-cli-install-manager`
**Date:** 2026-08-02

## What and why

Round the CLI out into a real local install manager and harden the install
path, ahead of pack-aware add (15b) and the npm ship (15c). Before this, `add`
could install but nothing could list or remove, there was no `--version`, a
failed write left a partial install behind, and the CLI trusted whatever
`SKILLPASS_API` returned with no size limits.

## Scope decisions

- `remove` mirrors add's flags (`--target <tool> [--global] | --dir <path>`).
  With no flag it searches the known install areas plus `./<slug>`: one hit
  deletes, several hits list them and ask for a flag, none errors. Before any
  delete it requires a `SKILL.md` or `skill.json` at the directory root, so a
  stray `--dir` path can never be recursively deleted. (15b note: pack layouts
  may lack a root `SKILL.md`; revisit the marker then.)
- `list` is offline and simple: scan the known install areas (project
  `.claude/skills`, project `.agents/skills`, user `~/.claude/skills`) and
  print the skill folder names per area. No flags. `--dir` installs are out of
  its sight by design.
- `--version` prints the version from `package.json`, exits 0.
- Download caps mirror the server snapshot caps (500 files, 1 MB/file, 10 MB
  total, via the fflate filter pattern) plus a 20 MB cap on the zip body.
- Atomic install: extract into a sibling temp dir, rename into place; any
  failure removes the temp dir so nothing partial is left.
- Type gate: `typescript` devDep in `packages/cli`, package `typecheck`
  script, root `pnpm typecheck` chains web then cli; `AGENTS.md` updated.
- Exit codes keep the contract: 0 ok, 2 refused/usage/not-found.
- `targets.ts` install areas take an injectable home dir so tests never touch
  the real `~/.claude`.

## Build steps

- [x] **Step 1 - `--version` and `list`** (`7225bc3`)
- [x] **Step 2 - `remove`** (`28feb87`)
- [x] **Step 3 - atomic install and download caps in `add`** (`556a1d3`)
- [x] **Step 4 - type-check gate** (`bbb58a8`)

## Verification

- `pnpm test` 806 passed (788 at branch point, +18 across `index.test.ts`,
  `list.test.ts`, `remove.test.ts`, `add.test.ts`); green at every checkpoint.
- `pnpm build` green. Type gate proven: a planted CLI type error failed
  `pnpm typecheck` (exit 2), reverted, clean pass confirmed.
- Real commands: `pnpm cli --version` printed `0.1.0`; `pnpm cli list` found
  the repo's own blueprint skills; `remove --dir` deleted a temp install and
  `remove ghost-skill` refused cleanly; strict flag rejection inherited from
  the input-hardening fix covers both new commands.
- Not run: the live `add -> remove -> list` cycle against the dev API (needs
  the API running); `add` behavior covered by stubbed-fetch tests.

## Out of scope

Pack-aware add (15b), npm packaging/publish and the prod API default (15c),
API-side binary handling (separate decision).

# Feature: `skillpass init`

**From build-plan:** feature 29
**Build attempt:** 1

**Status:** verified
**Branch:** feature/skillpass-init

## Goal

`skillpass init <name>` scaffolds a skill package that passes `skillpass scan` clean (status `passed`, risk `low`) the moment it is written, then runs the scan and shows the result. It prompts for the name, the description, and the permissions the skill will need, so the author declares intent before writing a line, and the passport they will get is visible before they submit. This closes the author loop: init, scan, submit.

Vercel's `npx skills init` already writes a starter `SKILL.md`; the reason this one exists is the declared permissions in `skill.json` and the immediate scan.

## In scope

- New command `skillpass init [name]`, creating `./<name>/` in the current directory with `SKILL.md` and `skill.json`.
- `skill.json` is always written, not optional: without it the validator raises `missing-manifest` (a warning, so status `warning` and risk `medium`), which is not "passes scan out of the box". Shape: `schemaVersion "0.1"`, `name`, `description`, `version "0.1.0"`, `targets ["claude-code", "codex"]` (the validator's own default for a bare `SKILL.md`), `permissions` as chosen.
- `SKILL.md`: frontmatter `name` and `description`, a title from the name (`my-skill` becomes `My Skill`), and short "When to use" and "Instructions" sections with placeholder sentences that trigger no permission signal.
- Prompts, only when stdin is a TTY (the existing `promptViaTty` pattern in `index.ts`):
  - Name, when not given as the argument. Must match the manifest slug rule (`^[a-z0-9]+(-[a-z0-9]+)*$`); an invalid answer is asked again; an empty answer cancels with exit 2.
  - Description; empty uses a placeholder sentence.
  - Permissions: the `PERMISSIONS` list from `skill-schema`, numbered with key and label; the answer is numbers or keys separated by commas or spaces; empty means none; an unrecognized token is asked again.
- Without a TTY (agents, CI): the name argument is required (else exit 2 with a usage error), the description is the placeholder, permissions are empty. No prompts, never hangs.
- A name argument that is not a valid slug is a usage error (exit 2) before anything is written.
- An existing `./<name>` (file or directory) is refused with exit 2; nothing is overwritten.
- After writing, run the existing `runScan` on the new folder and print: the two created paths, the scan report, and a next-step line (edit `SKILL.md`, `skillpass scan <name>`, submit at `https://skillpass.dev/submit`). Exit code is the scan's.
- Description safety in YAML: written as a plain scalar when it is safe, otherwise as a `>-` folded block scalar, so colons, `#`, and quotes survive both real YAML parsers and the validator's frontmatter reader.
- CLI wiring: `init` in `COMMAND_FLAGS` with no flags, the `USAGE` text, more than one positional is a usage error.
- Docs: an "Author: init" section on `/docs/cli` before "Validate: scan", the `packages/cli/README.md` command list and a short section, and the Skills CLI line in `AGENTS.md`.

## Out of scope

- Flags for description, permissions, targets, or output directory (`--dir`); multi-skill pack scaffolds; templates beyond the one starter.
- Choosing targets interactively; editing an existing package.
- Bumping the CLI version or publishing to npm. That is a separate release step with its own approval.

## Build loop

`blueprint/config.json` is absent, so defaults apply: `workflow.stepReview: "feature"` (one review packet after both steps) and checkpoint commits disabled. `/complete` creates the single feature commit. `pnpm verify` must be green before the review packet.

## Build steps

- [x] 1. **`init` module with tests.** Add `packages/cli/src/init.ts` exporting `runInit(name, { cwd, promptImpl, style })` plus the pure helpers it needs (file rendering, YAML-safe description, permission-answer parsing). Add `packages/cli/src/init.test.ts` covering: the scaffold written to a temp directory passes `validatePackage` with status `passed`, risk `low`, no findings, and detected permissions empty; chosen permissions land in `skill.json` as declared and in the scan output; a description with `: `, `#`, and quotes round-trips through the validator's reader; invalid slug argument and existing target are exit 2 with nothing written; no TTY and no name is exit 2; re-ask on an invalid name or permission token; empty name answer cancels. **Done when** `pnpm test` passes with the new tests.
- [x] 2. **CLI wiring and docs.** Wire `init` into `index.ts` (`COMMAND_FLAGS`, `USAGE`, dispatch with `promptViaTty` only on a TTY), add an `index.test.ts` case for the extra-positional and flag errors, and update `/docs/cli`, `packages/cli/README.md`, and `AGENTS.md`. **Done when** `pnpm verify` is green, and `node packages/cli/bin/skillpass.js init demo-skill` run in a scratch directory outside the repo (no TTY) creates both files and prints a scan with status passed and risk low.

## Files / areas

- `packages/cli/src/init.ts`, `packages/cli/src/init.test.ts` (new)
- `packages/cli/src/index.ts`, `packages/cli/src/index.test.ts`
- `apps/web/src/pages/docs/cli.astro`, `packages/cli/README.md`, `AGENTS.md`
- Read only: `packages/validator/src/load.ts` (`readSkillMeta`, `inferTargets`), `packages/validator/src/rules/structure.ts`, `packages/validator/src/rules/permissions.ts`, `packages/skill-schema/src/manifest.ts`, `packages/skill-schema/src/permissions.ts`, `packages/cli/src/scan.ts`

## Data / contracts

- `skill.json` must parse with `manifestSchema` (strict object: no extra keys).
- Name rule is the manifest slug regex; the folder name, frontmatter `name`, and manifest `name` are identical.
- Exit codes follow the CLI contract: 0 for a passed or warning scan, 1 for a failed scan, 2 for usage errors, an existing target, or a cancelled prompt.
- Files are written with `writeFileSync` after `mkdirSync`; the existence check runs first, so a refused run leaves the disk untouched.

## Testing

- Step 1 is logic-bearing: `init.test.ts` with temp directories (the `mkdtempSync(join(tmpdir(), ...))` pattern from `add.test.ts`) and a scripted `promptImpl`.
- Step 2: `index.test.ts` cases for wiring errors, `pnpm verify`, and one real run of the built CLI in a scratch directory outside the repo (memory: running from the repo root would write into the repo).

## Notes for the AI

- The template prose must not match any permission signal in `permissions.ts` (for example "run ... script", "fetch", "download", "deploy", "delete all"); the test asserts detected is empty.
- Keep the CLI zero-dependency: `node:readline/promises` through the existing `promptViaTty`, `node:fs` for writes.
- Keep `scan.ts` unchanged; reuse `runScan` for the closing report.

## Verification

- `pnpm verify` green on `feature/skillpass-init`: lint, format check, typecheck, all tests, build.
- `packages/cli/src/init.test.ts`: the scaffold passes `validatePackage` (passed, low, no findings, nothing detected); the manifest parses with the strict `manifestSchema`; prompted description and permissions land in `skill.json` as declared; six risky descriptions fold and read back unchanged through the validator's `SKILL.md` reader; invalid name, existing target, and missing name without a TTY exit 2 with nothing written; invalid name and permission answers are asked again; an empty name answer cancels.
- `packages/cli/src/index.test.ts`: `init` with two names or with `--json` is a usage error; `USAGE` lists `init`.
- A real YAML parser (`yaml` 2.7.1, one-off) reads the six folded descriptions back unchanged.
- Built CLI, scratch directory outside the repo, no TTY: `skillpass init demo-skill` writes both files and scans PASSED, risk low, no findings, exit 0; a second run is refused ("already exists", exit 2); `skillpass init` with no name exits 2 with the usage hint.
- Built CLI through a pseudo-terminal (`script`): an invalid name and an unknown permission token are both asked again; a description with a colon and quotes is written as a `>-` block; declared `shell.execute` and `network.fetch` land in `skill.json`; the scan shows PASSED, risk low.
- Found, not changed: the validator scans `skill.json` itself for permission signals, so declaring `network.fetch` (or `external.deploy`) also shows it as detected, from the key name alone. Pre-existing in `packages/validator/src/rules/permissions.ts`; a `/fix` candidate that would bump the engine version.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":8515,"specSha256":"1df02152c6f2a86b89bb7bd12794ac68ddfc71c043b1537b991d4065534a805b","branch":"refs/heads/feature/skillpass-init","head":"7a6d2ec5237ac5df3e8bf319198391a2a108722a","baseRef":"refs/heads/main","baseCommit":"7a6d2ec5237ac5df3e8bf319198391a2a108722a","sourceTree":"44b65cf9f261e432a08446dca853ae8dc03fbb24","absentOptional":[]} -->

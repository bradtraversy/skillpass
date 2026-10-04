# Feature: `skillpass use`

**From build-plan:** feature 30
**Build attempt:** 1

**Status:** verified
**Branch:** feature/skillpass-use

## Goal

`skillpass use <slug>[@version]` runs a listed skill once without installing it. It runs the same pre-flight as `add`, unpacks the hash-verified snapshot to a temp folder, and prints a ready-to-run prompt on stdout: the skill's `SKILL.md` plus where its other files are. `claude "$(skillpass use pdf)"` opens Claude Code with the skill loaded; nothing goes into a skills folder and no receipt is written. Vercel's `npx skills use` has no security step; ours puts the passport in front of the run.

## In scope

- New command `skillpass use <slug>[@version] [--yes]`, resolved with the existing `fetchPreflight` (directory skills only).
- The pre-flight report from `renderPreflightReport`, then: a blocked (failed) version stops with exit 1; medium or higher risk needs a yes through the existing `confirmRisk` (or `--yes`); without a TTY and without `--yes` it stops with exit 2, like `add`.
- `downloadVerified` fetches the snapshot and checks it against the pinned source hash (it records a CLI download, as `add` does).
- The files are written with `writeTree` to `<os tmpdir>/skillpass-use-<random>/<slug>/` and left there for the agent to read; the path is printed.
- The prompt, on stdout only: a header line naming the skill, version, and that it was validated by SkillPass, the folder path with an instruction to read referenced files from there, then the `SKILL.md` content.
- stdout carries only the prompt, so `$(...)` and pipes get clean text. The pre-flight report, the risk question, the unpacked-path line, and every error go to stderr.
- Refusals with exit 2 and nothing written: a pack (`detail.packMembers` non-empty; point to `skillpass add`), a `github:` or URL reference (point to `skillpass add github:...`), and a package whose snapshot has no single root `SKILL.md`.
- CLI wiring: `use` in `COMMAND_FLAGS` with `--yes` only, `USAGE`, exactly one positional.
- Docs: a "Run once: use" section on `/docs/cli` after "Install: add", the CLI README, and the `AGENTS.md` Skills CLI line.

## Out of scope

- `--agent` to launch an agent directly; `github:` sources; pack members; a task argument appended to the prompt.
- Cleaning up the temp folder (the agent needs it after `skillpass` exits; the OS temp directory owns it).
- Version bump and npm publish: a separate release step with its own approval.

## Build loop

`blueprint/config.json` is absent, so defaults apply: `workflow.stepReview: "feature"` (one review packet after both steps) and checkpoint commits disabled. `/complete` creates the single feature commit. `pnpm verify` must be green before the review packet.

## Build steps

- [x] 1. **`use` module with tests.** Add `packages/cli/src/use.ts` exporting `runUse(ref, { yes, apiUrl, fetchImpl, confirmImpl, emit, tmpRoot, style })` and a pure `buildPrompt`. `emit` receives everything meant for stderr; the returned `lines` hold only the prompt. Add `packages/cli/src/use.test.ts` with a stubbed `fetchImpl` (the pattern in `add.test.ts`): low-risk skill writes the snapshot under `tmpRoot` and returns a prompt containing the header, the folder path, and the `SKILL.md` body, with the pre-flight report only in emitted text; blocked version exits 1 with nothing written; medium risk without a confirm exits 2, with a "no" exits 2, with a "yes" or `--yes` succeeds; a hash mismatch exits 2 with nothing written; pack, `github:` ref, and not-found slug exit 2. **Done when** `pnpm test` passes with the new tests.
- [x] 2. **CLI wiring and docs.** Wire `use` into `index.ts` with stderr output: the `emit` callback and a risk question that reads stdin and writes to stderr, used only when stdin is a TTY. Add `index.test.ts` cases for the flag and positional errors, and the docs. **Done when** `pnpm verify` is green, and the built CLI run from a scratch directory against the production API prints a prompt on stdout for a low-risk listed skill while stdout stays free of report lines (checked by capturing stdout and stderr separately).

## Files / areas

- `packages/cli/src/use.ts`, `packages/cli/src/use.test.ts` (new)
- `packages/cli/src/index.ts`, `packages/cli/src/index.test.ts`
- `apps/web/src/pages/docs/cli.astro`, `packages/cli/README.md`, `AGENTS.md`
- `blueprint/build-plan.md` (item 30 added) and `blueprint/context/project-overview.md` (refreshed for it)
- Read only: `packages/cli/src/add.ts` (`downloadVerified`, `writeTree`), `packages/cli/src/api.ts` (`fetchPreflight`), `packages/cli/src/install.ts` (`confirmRisk`, `createOutput`), `packages/cli/src/render.ts`, `packages/cli/src/repo.ts` (`isRepoRef`)

## Data / contracts

- Exit codes follow the CLI contract: 0 prompt printed, 1 blocked by validation, 2 usage, network, not found, pack or repo refusal, missing confirmation, or a failed download check.
- The prompt is plain text; nothing about it is parsed by SkillPass.
- No receipt, no write outside the temp folder.

## Testing

- Step 1 is logic-bearing: `use.test.ts` with a stubbed API and a temp `tmpRoot`.
- Step 2: `index.test.ts` wiring cases, `pnpm verify`, and one real run of the built CLI from a scratch directory outside the repo, with stdout and stderr captured to separate files.

## Notes for the AI

- Reuse `fetchPreflight`, `renderPreflightReport`, `confirmRisk`, `downloadVerified`, and `writeTree`; do not fork their logic.
- Keep the CLI zero-dependency.

## Verification

- `pnpm verify` green on `feature/skillpass-use`: lint, format check, typecheck, all tests, build.
- `packages/cli/src/use.test.ts` (stubbed API, temp `tmpRoot`): a low-risk skill unpacks under `tmpRoot` and returns only the prompt (header, folder, `SKILL.md` body) while the report goes to `emit`; a blocked version exits 1 with nothing written; medium risk exits 2 without a confirm or on "no" and succeeds on "yes" or `--yes`, with the exact question text; a hash mismatch exits 2 with nothing written; pack, `github:` ref, and unknown slug exit 2 (the repo ref never calls the API); a snapshot without a root `SKILL.md` exits 2.
- `packages/cli/src/index.test.ts`: `use` with no slug, two slugs, or `--target` is a usage error; `USAGE` lists it; the help column lines up with the other commands.
- Built CLI against the production API from a scratch directory, stdout and stderr captured to separate files: `skillpass use pdf` exits 0, stdout holds only the prompt (no report lines), stderr holds the pre-flight, "Source hash verified" and the unpacked path; the temp folder holds `SKILL.md`, `forms.md`, `reference.md`, `LICENSE.txt`, and `scripts/`.
- Built CLI through a pseudo-terminal with stdout redirected to a file: `skillpass use security-review` (medium risk) shows the question on stderr; "n" exits 2 with an empty stdout file, "y" exits 0 and the file holds the prompt.
- `claude --help` on trav-dev: `claude [prompt]` starts an interactive session with that prompt, so the documented `claude "$(skillpass use pdf)"` form matches the installed CLI.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":7076,"specSha256":"443217b07856a790007ff5077ae819a4196dc214ea41924dbf87a66602844c98","branch":"refs/heads/feature/skillpass-use","head":"486aab3be33a418c95baf5e44b63d2163a4ea354","baseRef":"refs/heads/main","baseCommit":"486aab3be33a418c95baf5e44b63d2163a4ea354","sourceTree":"c96d4aefe791c1986b4a453ddb2909f63b50564a","absentOptional":[]} -->

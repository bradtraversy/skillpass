# AGENTS.md

Instructions for AI coding agents working in this project. This is the cross-tool
entry point: Codex, Cursor, GitHub Copilot, Gemini CLI, Aider, Zed, Windsurf, and
others read `AGENTS.md`. Claude Code reads `CLAUDE.md`, which imports this file, so
there is a single source of truth.

## What this is

A description of your project and the problem it solves.

This project is built with the **AI Coding Blueprint**, a workflow layer, not an
app skeleton. To start a new project, scaffold the app first in an empty folder
(create-next-app, Vite, etc.), then overlay these files on top. Never run a
framework scaffolder inside a directory that already holds the blueprint files
(`AGENTS.md`, `CLAUDE.md`, `.agents/`, `.claude/`, `blueprint/`); it fails
because the directory isn't empty.

New here? `blueprint/README.md` explains the whole workflow.

## Read these when relevant

- `blueprint/config.json` - deterministic project workflow settings
- `blueprint/context/project-overview.md` - the project's source of truth
- `blueprint/context/coding-standards.md` - read before changing code
- `blueprint/context/ai-interaction.md` - read when running the Blueprint workflow
- `blueprint/context/current-feature.md` - the one feature, fix, or rollback being built right now

Reuse relevant context already loaded in the session. Claude Code imports only
this file; its Blueprint skills load the other files on demand.

## Project configuration

`blueprint/config.json` is the user-owned, machine-readable workflow policy for
this project. Workflow skills read the relevant settings before acting. A
missing file means built-in defaults. An invalid file falls back to defaults for
read-only status reporting, but mutating workflow commands stop and point to
`/doctor` instead of guessing.

Configuration can make review or verification stricter and can tune local
branch names and automated-mode limits. It never grants permission to commit,
merge, push, deploy, publish, send, delete data, waive a failing check, or accept
a finding. Those approval and safety boundaries are not configurable.

`qualityGates.regular` controls automatic audit, independent-review, check, and
try-guide behavior for the normal workflow and Autopilot.
`qualityGates.continuous` controls the same per-feature gates for Continuous
Mode. Independent review defaults to `when-sensitive` in both workflows, while
audit, check, and try guide default to `manual`. Sensitive or unusually broad
work therefore selects independent review automatically; ordinary small work
does not. Setting a workflow's independent review to `manual` disables that
automatic selection, while an explicit `/audit independent current` remains
available. The other conditional modes are `when-sensitive` for audit,
`when-behavioral` for check, and `when-user-facing` for try guides. `always`
runs the gate for every work item in that workflow.

`review.independentExecution` controls how a selected independent-review gate
runs. Its default, `automatic`, uses a fresh isolated reviewer child when the
active adapter can prove isolation, exact reviewer identity and model, and
completion. Otherwise it preserves the request and falls back to the manual
handoff. This setting changes execution only; the quality-gate policy still
decides whether review is selected.
The automatic path spawns a generic child through the current runtime and gives
it the installed project-local Audit skill and review contract. It never requires
or discovers global agent roles, skills, prompts, or TraversyFlow components.
New review requests record requested execution and completed receipts record
actual execution. Manual uses `fresh session`; automatic uses `fresh subagent`;
an explicit automatic fallback records actual manual with `fresh session`.

New projects default to one review packet after all small implementation steps
(`workflow.stepReview: "feature"`) with step checkpoint commits disabled. This
keeps the normal loop reviewable without repeating the full session context after
every step. Set `stepReview` to `every` when teaching, pairing closely, or working
on a high-risk change. That restores the per-step approval pauses. To fully
restore the previous workflow, including optional checkpoint prompts after an
approved step, also set `checkpointCommits` to `enabled`. Onboarding presents
these pairs as Efficient and Guided choices, but stores only the two low-level
settings. They can be changed at any time. Both styles end with an optional
read-only code walkthrough. Review cadence controls approval pauses, not whether
the user can ask for an explanation of the finished implementation.

## Workflow

Build one feature, fix, or rollback at a time, behind review gates. Each step's instructions
are plain markdown skills any capable agent can read and follow. The workflow is
exposed through tool-specific adapters:

- Codex: `.agents/skills/<skill>/SKILL.md`
- Claude Code: `.claude/skills/<skill>/SKILL.md`
- GitHub Copilot: `AGENTS.md` plus `.agents/skills/<skill>/SKILL.md`
- OpenCode: `AGENTS.md` plus the compatible `.agents/skills/` or
  `.claude/skills/` tree already installed for the selected tools

Unused adapters can be removed. Codex, GitHub Copilot, and OpenCode can share
`.agents/`. OpenCode can also reuse `.claude/` when Claude Code is selected.
Codex-only, Copilot-only, or OpenCode-only projects can delete `CLAUDE.md` and
`.claude/`. Claude Code-only projects can delete `.agents/`, but should keep
`AGENTS.md` because `CLAUDE.md` imports it. Do not duplicate the same Blueprint
skills under `.opencode/skills/`; OpenCode already discovers the compatible
trees.

When changing shared workflow behavior, update the matching skill in both
adapter folders so Codex, Claude Code, GitHub Copilot, and OpenCode stay aligned.

Core skills:

- `onboard` - tune commands, standards, visibility, ignore rules, and tool adapters after overlaying the Blueprint onto a freshly scaffolded or early project
- `discovery` - optional deep, multi-turn planning conversation that drafts the two user-owned plans only after review and approval; direct plan writing remains fully supported
- `doctor` - Blueprint health check for setup, adapters, plans, overview freshness, dashboard state, and workflow drift; it may offer to reset only malformed generated dashboard state after approval
- `adopt` - bootstrap the Blueprint into an existing brownfield app with shipped features
- `overview` - distill the two planning docs into
  `blueprint/context/project-overview.md`, then offer a reviewed initial planning
  baseline commit before Feature 1
- `brief` - read-only briefing on an upcoming build-plan feature (scope, dependencies, size) before you spec it
- `feature` - turn a build-plan item into a spec, or propose a reviewed plan addition for a genuinely new feature
- `debug` - reproduce and isolate a failure without editing code, then hand the evidence to `fix` or `implement`
- `fix` - document an ad-hoc bug or change into `blueprint/context/current-feature.md`
- `tests` - add or normalize unit testing and turn on the test gate
- `browser-tests` - explicitly add or normalize a repeatable browser test harness and document its command
- `ci` - explicitly set up one project-specific Verify command and matching automatic GitHub checks, with an optional local pre-push hook
- `implement` - build the current spec one small, reviewed step at a time
- `check` - prove the current spec against the running app
- `try` - read-only manual review guide: where to go, what to click, what to expect
- `audit` - branch-aware or full-project review across all concerns or a focused quality, security, performance, or tests lens; `audit independent current` prepares an immutable checkpoint for a fresh reviewer session or configured isolated reviewer child; records findings in `blueprint/context/findings.md` and independent receipts in `blueprint/context/review.md`, where blocking findings or stale review state stop `complete`
- `rollback` - plan a safe reversal of a completed feature from its archive and exact git commit, with later-dependency review before code changes
- `complete` - run the final safety pass, log features, fixes, or rollbacks under `blueprint/history/`, then merge with approval
- `release` - optional Render or Vercel deployment readiness, local config, env review, and smoke-test planning
- `prototype` - optional, pre-build static mockups to lock the look
- `status` - read-only progress summary, workflow drift warning, and suggested next action

In Codex, invoke these as skills (`$onboard`, `$discovery`, `$overview`, `$feature`,
`$implement`, and so on) or ask naturally, such as "run the overview." In Claude
Code, use the slash commands (`/onboard`, `/discovery`, `/overview`, `/feature`,
and so on). In OpenCode or other tools without a dedicated invocation syntax,
ask the agent to run the matching skill or follow its `SKILL.md` manually. The
conventions in `blueprint/context/` apply however a step is invoked. `/discovery`
is never required: users may write detailed plans directly or develop them
through any conversation before running `/overview`.

Optional explicit-only skill: `autopilot` combines `feature` or `fix` with
`implement` in one bounded pass when directly invoked, including the configured
regular quality gates. The normal workflow stops for human approval of the spec
before implementation; Autopilot continues through that review point. It may
create checkpoint commits on the feature or fix branch after passing steps and
repair confirmed P0/P1 findings when its audit gate runs. It stops before
`/complete`, merge, push, deploy, or destructive actions.

Optional explicit-only skill: `continuous` can resume or select the next planned
feature and repeat the complete local feature lifecycle through the configured
limit or end of the build plan. It creates one branch and one local main commit
per feature, applies the Continuous quality gates, archives and merges serially,
and stops on decisions or failed safety gates. It never pushes, deploys,
publishes, sends, or performs destructive actions.

Deployment is also explicit. `/release` can prepare local Render or Vercel config
and run readiness checks, but it must stop before deploy, remote service changes,
push, or publish unless the user gives a separate yes in the current chat.

## Dashboard activity

The dashboard can show the active or most recent substantial Blueprint command
from `blueprint/.state/run.json`. This file is generated local state, ignored by
Git, and never part of a feature commit.

Commands with meaningful progress or a durable handoff should write it when the
state directory exists: `onboard`, `adopt`, `discovery`, `overview`, `feature`,
`fix`, `rollback`, `implement`, `debug`, `check`, `audit`, `tests`,
`browser-tests`, `ci`, `prototype`, `autopilot`, `continuous`, `complete`, and
`release`. Short orientation commands such as `brief`, `try`, `status`, and
`doctor` do not need activity state. Doctor's optional approved reset removes
malformed activity instead of recording another run.

Writing the initial activity record is the first action of a tracked command,
before project inspection, preflight, or other tool calls. This one generated
state write does not authorize product changes or bypass any safety check.

Never create or edit `run.json` directly. From the project root, use the first
helper that exists:

```text
node .agents/skills/doctor/scripts/run-state.mjs <action> <options>
node .claude/skills/doctor/scripts/run-state.mjs <action> <options>
```

Start with `start --command <skill> --summary <truthful-summary> --boundary
<boundary>`. Use `update` at meaningful milestones or for a blocker, with
`--status blocked` and `--resume <exact-command>` when recovery is needed. End
with `finish --status ready|completed --summary <truthful-summary>`. The helper
validates every field before atomically replacing the generated file. If it is
missing or fails, report the activity warning and continue the workflow without
writing a manual fallback.

The helper writes this schema:

```json
{
  "schemaVersion": 1,
  "command": "continuous",
  "status": "running",
  "summary": "Completing the remaining build plan",
  "detail": "Implementing feature 3.",
  "boundary": "local-only",
  "startedAt": "<ISO-8601 timestamp>",
  "updatedAt": "<ISO-8601 timestamp>",
  "resumeCommand": "/continuous resume",
  "progress": { "current": 2, "total": 5, "label": "features" },
  "feature": { "id": "3", "title": "Export reports" }
}
```

`status` must be `running`, `blocked`, `ready`, or `completed`. Use `ready` when
the command reached its intended review handoff, such as Autopilot waiting for
review before `/complete`. Use `blocked` with the exact recovery command when
work can resume. `boundary` must be `read-only`, `reviewed`, or `local-only`.
The progress, feature, detail, boundary, and resume fields are optional. Never
put secrets, raw logs, prompts, or user content in this file. Activity tracking
must not change a command's approval boundaries or turn a reporting failure into
a workflow failure.

## Automatic verification

Automatic GitHub checks are a separate explicit setup. `/onboard` and `/adopt`
only report existing checks and point to `/ci` or `$ci` when none exist. Running
`/ci` inspects the real project and defines one `Verify` command from checks that
already exist. Use this order when available: typecheck, tests, then build. Never
invent a test runner or another check just to fill the command.

For JavaScript and TypeScript projects, prefer a package script such as `verify`
and use the detected package manager. For other stacks, use the native task
runner or exact combined command. Record the exact command under Commands below.

The optional `.github/workflows/verify.yml` must run that same command for pull
requests and pushes to the default branch. Preserve existing workflows, use the
project's real runtime and install command, and grant only `contents: read` by
default. This setup does not add coverage, browser tests, security scans, or
version matrices; those remain later project choices. A local pre-push hook that
runs the same `Verify` command is offered as an opt-in at the end of `/ci`, and
`git push --no-verify` still bypasses it, so the remote ruleset stays the lock.

GitHub branch protection or a ruleset can require the check after the repository
is pushed, but that is a separate remote setting. Missing automatic GitHub
checks do not make the Blueprint unusable.

## Commands

pnpm monorepo (pnpm 11.9.0, Node >= 22.12). Run these from the repo root; they
proxy into `apps/web`.

- Dev server: `pnpm dev` (http://localhost:4321) - file-watch polling on, safe on VM/network filesystems
- Dev server (native watch): `pnpm dev:native` - faster on a local disk, no polling
- API dev server: `pnpm dev:api` (http://localhost:8787, Hono in `apps/api`) - needs `apps/api/.env` (see `apps/api/.env.example`)
- Validation worker: `pnpm dev:worker` (BullMQ worker for submission validation) - needs `apps/api/.env` with `VALIDATION_MODE=queue` and a running Redis (`REDIS_URL`); without that setting the API validates inline and the worker receives nothing
- Dev background control: `pnpm dev:status`, `pnpm dev:stop`, `pnpm dev:logs`
- Typecheck: `pnpm typecheck` (runs `typecheck` in every workspace: `astro check` in
  `apps/web`, `tsc --noEmit` in `apps/api`, `packages/skill-schema`, `packages/validator`,
  and `packages/cli`)
- Build: `pnpm build` (runs `astro check && astro build`, so the build type-checks first)
- Preview production build: `pnpm preview`
- Astro CLI passthrough: `pnpm astro <cmd>` (e.g. `pnpm astro add react`)
- Test (Vitest, run once): `pnpm test`
- Lint: `pnpm lint` (ESLint flat config at the root: typescript-eslint with
  type-aware rules, react-hooks, astro)
- Format: `pnpm format` to write, `pnpm format:check` to verify (Prettier: tabs,
  single quotes, 120 columns, astro plugin)
- Verify: `pnpm verify` (lint, format check, typecheck, tests, then build; the one
  command the pre-push hook and GitHub Actions run)
- Test (watch): `pnpm test:watch`
- Skills CLI: `pnpm cli scan <path>` / `pnpm cli report <slug>[@version]` /
  `pnpm cli add <slug>[@version] [--target <tool> [--global] | --dir <path>] [--yes]` /
  `pnpm cli remove <slug> [--target <tool> [--global] | --dir <path>]` /
  `pnpm cli update <slug>[@version]` / `pnpm cli outdated` /
  `pnpm cli list` / `pnpm cli --version`
  (or `node packages/cli/bin/skillpass.js ...`); `--target claude-code` installs to
  `.claude/skills/`, `--target codex` to `.agents/skills/`; `--json` for machine
  output. `search`, `report`, and `add` default to the production API
  (`https://api.skillpass.dev`); set `SKILLPASS_API=http://localhost:8787` to work
  against the local dev API

`pnpm test` runs Vitest across the monorepo (`apps/*`, `packages/*`) via the root
`vitest.config.ts`. **The `test` command is declared, so tests are a gate:** a
step that adds logic-bearing code must ship a passing test in the same diff, and
`pnpm test` must be green before a checkpoint commit and before `/complete`
merges (see the Testing section of `blueprint/context/coding-standards.md`). UI
(Astro pages, React islands) and integration steps are exempt and ride on the
build plus a screenshot.

**Types are a gate too.** `pnpm build` runs `astro check` before `astro build`, so
a type error fails the build locally and on any deploy that runs the build command
(e.g. Vercel). Keep the `Skill` contract and component props type-clean; run
`pnpm typecheck` for a fast types-only pass without the full build. Lint and
formatting are gates too: `pnpm lint` and `pnpm format:check` run inside
`pnpm verify`, so run `pnpm format` before presenting a diff.

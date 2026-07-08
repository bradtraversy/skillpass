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

## Read these for full context

- `blueprint/context/project-overview.md` - the project's source of truth
- `blueprint/context/coding-standards.md` - conventions to follow
- `blueprint/context/ai-interaction.md` - how to work with the user on this project
- `blueprint/context/current-feature.md` - the one feature or fix being built right now

## Workflow

Build one feature or fix at a time, behind review gates. Each step's instructions
are plain markdown skills any capable agent can read and follow. The workflow is
exposed through tool-specific adapters:

- Codex: `.agents/skills/<skill>/SKILL.md`
- Claude Code: `.claude/skills/<skill>/SKILL.md`

Unused adapters can be removed. Codex-only projects can delete `CLAUDE.md` and
`.claude/`. Claude Code-only projects can delete `.agents/`, but should keep
`AGENTS.md` because `CLAUDE.md` imports it.

When changing shared workflow behavior, update the matching skill in both
adapter folders so Codex and Claude Code stay aligned.

Core skills:

- `onboard` - tune commands, standards, ignore rules, and tool adapters after overlaying the Blueprint onto a freshly scaffolded or early project
- `doctor` - read-only Blueprint health check for setup, adapters, plans, overview freshness, and workflow drift
- `adopt` - bootstrap the Blueprint into an existing brownfield app with shipped features
- `overview` - distill the two planning docs into `blueprint/context/project-overview.md`
- `brief` - read-only briefing on an upcoming build-plan feature (scope, dependencies, size) before you spec it
- `feature` - turn a build-plan item into a spec in `blueprint/context/current-feature.md`
- `tests` - add or normalize unit testing and turn on the test gate
- `fix` - document an ad-hoc bug or change into `blueprint/context/current-feature.md`
- `implement` - build the current spec one small, reviewed step at a time
- `check` - prove the current spec against the running app
- `try` - read-only manual review guide: where to go, what to click, what to expect
- `audit` - read-only code quality review for duplication, dead code, standards drift, and maintainability risks
- `complete` - log it to `blueprint/history/features/` or `blueprint/history/fixes/`, then merge
- `prototype` - optional, pre-build static mockups to lock the look
- `status` - read-only progress summary, workflow drift warning, and suggested next action

In Codex, invoke these as skills (`$onboard`, `$overview`, `$feature`,
`$implement`, and so on) or ask naturally, such as "run the overview." In Claude
Code, use the slash commands (`/onboard`, `/overview`, `/feature`, and so on). In
tools without native skills, follow the matching `SKILL.md` manually. The
conventions in `blueprint/context/` apply however a step is invoked.

Optional explicit-only skill: `autopilot` can run one bounded spec/build/check
pass when directly invoked. It may create checkpoint commits on the feature or
fix branch after passing steps. It stops before `/complete`, merge, push, deploy,
or destructive actions.

## Commands

pnpm monorepo (pnpm 11.9.0, Node >= 22.12). Run these from the repo root; they
proxy into `apps/web`.

- Dev server: `pnpm dev` (http://localhost:4321) - file-watch polling on, safe on VM/network filesystems
- Dev server (native watch): `pnpm dev:native` - faster on a local disk, no polling
- API dev server: `pnpm dev:api` (http://localhost:8787, Hono in `apps/api`) - needs `apps/api/.env` (see `apps/api/.env.example`)
- Validation worker: `pnpm dev:worker` (BullMQ worker for submission validation) - needs `apps/api/.env` and a running Redis (`REDIS_URL`)
- Dev background control: `pnpm dev:status`, `pnpm dev:stop`, `pnpm dev:logs`
- Typecheck: `pnpm typecheck` (runs `astro check`)
- Build: `pnpm build` (runs `astro check && astro build`, so the build type-checks first)
- Preview production build: `pnpm preview`
- Astro CLI passthrough: `pnpm astro <cmd>` (e.g. `pnpm astro add react`)
- Test (Vitest, run once): `pnpm test`
- Test (watch): `pnpm test:watch`
- Skills CLI: `pnpm cli scan <path>` / `pnpm cli report <slug>[@version]` (or
  `node packages/cli/bin/aiskills.mjs ...`); `--json` for machine output,
  `AISKILLS_API` overrides the API base URL for `report`

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
`pnpm typecheck` for a fast types-only pass without the full build. No lint command
is configured yet.

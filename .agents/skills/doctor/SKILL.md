---
name: doctor
description: "Run a read-only Blueprint health check for setup, onboarding, required files, tool adapters, commands, Blueprint visibility, ignore rules, planning readiness, overview freshness, and workflow drift. Use when the user runs /doctor, asks whether the Blueprint is installed correctly, wants a health check, setup check, doctor pass, or says something feels off before starting or resuming work."
---

# doctor - Blueprint health check

Where this sits in the workflow:

    any time  ->  [doctor]  ->  reads setup + plans + workflow state + git
                  (read-only)   prints health, warnings, and repair order

This skill answers one question: *is this Blueprint project ready to use?* It is
the diagnostic pass for setup drift, incomplete onboarding, missing files,
placeholder plans, stale generated context, Blueprint visibility, and confusing
workflow state. It never changes anything: no edits, no commits, no installs, no
builds, no branch changes.

Use `/status` when the user mainly wants progress and the next build action. Use
`/doctor` when the user wants to know whether the workflow itself is healthy.

## Input

None. `/doctor` takes no argument.

## What it checks

Gather these, then summarize. Do not dump file contents.

1. **Required Blueprint files**
   - Confirm `AGENTS.md`, `blueprint/`, `blueprint/project-plan.md`,
     `blueprint/build-plan.md`, and `blueprint/context/` exist.
   - Confirm `blueprint/context/coding-standards.md`,
     `blueprint/context/ai-interaction.md`,
     `blueprint/context/current-feature.md`, and
     `blueprint/context/project-overview.md` exist.
   - Confirm `blueprint/history/features/` and `blueprint/history/fixes/` exist.
   - If `.gitignore` marks Blueprint workflow files as local-only, still require
     the files to exist on disk. Ignored but present is healthy; ignored and
     missing means the local workflow needs to be restored.
2. **Tool adapters**
   - Confirm at least one adapter exists: `.agents/skills/` for Codex or
     `.claude/skills/` for Claude Code.
   - If both adapters are present, say that is healthy when both tools are used.
   - If both adapters are present, compare their skill folder names. Warn about
     missing skills on either side.
   - If git shows changes under `.agents/skills/` or `.claude/skills/`, check
     the matching adapter file too. Warn when workflow behavior was updated in
     one adapter but not the other.
   - If only one tool is used, mention the unused adapter can be deleted. Do not
     treat extra adapters as an error.
   - If `CLAUDE.md` exists and still starts with `# Project Name`, flag that
     `/onboard` probably has not finished.
3. **Commands and project setup**
   - Check whether root `README.md` is still the copied Blueprint workflow doc
     by looking for `# AI Coding Blueprint` or opening text that describes the
     Blueprint workflow instead of the app. If so, warn that `/onboard` should
     move it to `blueprint/README.md` and create a project README before
     publishing.
   - If `blueprint/README.md` exists, treat that as the expected home for the
     copied workflow doc inside a consumer project.
   - Check whether `AGENTS.md` has a `## Commands` section with dev and build
     commands.
   - Report missing lint or test commands as informational unless the project has
     real lint or test scripts elsewhere that are not reflected in `AGENTS.md`.
   - If `package.json` exists, compare its scripts against `AGENTS.md` at a high
     level. Do not require every script to be documented.
4. **Ignore rules**
   - Check obvious ignore patterns for the detected stack. For Node or Astro,
     look for `node_modules`, `.env`, `dist`, and framework cache folders such as
     `.astro` or `.next` when relevant.
   - Detect local-only Blueprint mode if `.gitignore` ignores `.agents/`,
     `.claude/`, `blueprint/`, or `CLAUDE.md`. Report it as a visibility choice,
     not a failure, when the local files exist.
   - In local-only mode, check whether tracked `AGENTS.md` still describes the
     Blueprint workflow, points to `blueprint/README.md`, lists hidden adapter
     paths, or exposes the core skill list. If so, warn that `/onboard` should
     make `AGENTS.md` public-safe.
   - If local-only mode is active but those paths are already tracked by git,
     warn that `.gitignore` does not hide tracked files and the user must approve
     any `git rm --cached` cleanup separately.
   - Keep this conservative. If uncertain, report "review" instead of failure.
5. **Planning readiness**
   - Check whether `blueprint/project-plan.md` and `blueprint/build-plan.md` look
     filled in or still template-like. Treat obvious TODO, TBD, example-only text,
     or empty required sections as not ready.
   - Check whether `blueprint/build-plan.md` is a numbered checkbox list. Raw
     bullets are allowed as a first draft, but they should be normalized by
     `/overview` before the build loop starts.
   - Count checked and unchecked leaf items in `blueprint/build-plan.md`.
6. **Overview freshness**
   - Check whether `blueprint/context/project-overview.md` exists and looks
     generated from the current plans.
   - If either planning file appears newer than the overview by filesystem time,
     call the overview possibly stale and suggest `/overview` before feature work.
7. **Current workflow state**
   - Check whether `blueprint/context/current-feature.md` is the reset stub or an
     active feature or fix spec.
   - If a spec is active, report checked and unchecked implementation steps.
   - If `current-feature.md` is the reset stub but git has source or workflow
     changes, warn that work is happening without an active spec.
   - Flag active spec on `main`, all spec steps checked but no completion, or a
     mismatch between the active spec and the next unchecked build-plan item.
8. **Git**
   - Report current branch, clean vs dirty working tree, rough changed-file count,
     last commit subject, and whether the branch is ahead of upstream.
   - If the directory is not a git repo, report that as a setup issue and keep
     going.

## Output

Print a compact health report with these labels:

    Health: Pass | Needs attention | Blocked
    Setup: ...
    Adapters: ...
    Visibility: ...
    Plans: ...
    Workflow: ...
    Git: ...
    Watch: ...
    Repair order: ...

Use `Watch:` only when there are warnings. Use `Repair order:` for the exact next
steps, in order. Keep it short and practical.

Choose the repair order in this priority:

- Required Blueprint files missing -> overlay the Blueprint again, or use
  `/adopt` for a brownfield app.
- No git repo -> initialize git before using the build loop.
- No tool adapter -> restore `.agents/skills/` or `.claude/skills/` for the tool
  being used.
- Onboarding incomplete -> run `/onboard`.
- Root README is still the Blueprint workflow doc -> run `/onboard` or move it
  to `blueprint/README.md` before publishing.
- Local-only visibility selected but ignored Blueprint files are missing ->
  reinstall or restore the Blueprint files locally.
- Local-only visibility selected but Blueprint paths are tracked -> ask whether
  to untrack them with `git rm --cached` while keeping local files.
- Local-only visibility selected but `AGENTS.md` still exposes the workflow ->
  run `/onboard` to make `AGENTS.md` a lightweight public project guide.
- Commands or ignore rules need review -> update the files or run `/onboard` if
  this is an early project.
- Plans are placeholders -> fill `blueprint/project-plan.md` and
  `blueprint/build-plan.md`.
- Overview missing or stale -> run `/overview`.
- Active spec has unchecked steps -> run `/status` or `/implement`, depending on
  whether the user wants orientation or action.
- Active spec is done but not closed -> run `/check`, then `/complete`.
- Everything is healthy -> say so, then suggest `/status` for progress or
  `/feature` for the next planned feature.

## Rules

- **Read-only, always.** This skill never writes files, never commits, never runs
  installs, never runs builds or tests, and never switches branches.
- **Diagnose, then order repairs.** Do not just list problems. End with the
  smallest ordered sequence that gets the project back to a healthy state.
- **Do not over-police adapters.** Extra adapters are optional clutter, not a
  failure.
- **Be conservative with stack-specific checks.** If a command or ignore pattern
  is uncertain, mark it for review instead of inventing a hard failure.
- **Stay concise.** A doctor pass should feel like a checklist, not an audit.

## Formatting

Format the output to match the project's conventions in
`blueprint/context/ai-interaction.md`: concise, scannable markdown, with lists for
enumerations and tables for matrices rather than dense paragraphs.

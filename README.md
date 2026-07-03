# AI Skills Directory

A public, validation-first directory of AI agent skills: discover a skill, see
which tools it targets, and inspect exactly what it asks an agent to do before
you install it.

**Core rule: never blindly trust a skill.**

## Why

AI agent skills (reusable instructions for Codex, Claude Code, Cursor, Cowork,
Aider, and similar tools) are becoming real software artifacts, but they're
scattered across repos, gists, and dotfiles with no way to know what one
actually does to your machine before you install it. A skill can tell an agent
to read files, run shell commands, or send data over the network.

This directory pairs discovery with built-in validation. Every listed skill is
scanned, and every version gets a **Skill Passport**: a public, immutable report
of its status (passed / warning / failed), risk level, declared vs detected
permissions, and findings. The same scanner ships as a CLI, so you can verify
any skill yourself instead of trusting the website.

## Status

Early development, building in the open. Shipped so far:

- Static directory shell (Astro) with search and filtering
- Skill detail pages with the Skill Passport UI
- `skill.json` manifest, validation report, and passport schemas
- Validator V0: loads a skill package, scans for secrets, prompt injection,
  dangerous commands, and undeclared permissions, and emits a report

Next up: the submission flow (GitHub OAuth, drafts), queue-backed validation,
publishing, download pre-flight, and the `aiskills` CLI.

## Layout

pnpm monorepo:

| Path | What it is |
| --- | --- |
| `apps/web` | Static Astro front end (React islands for interactivity) |
| `apps/api` | Node API: auth, submissions, validation jobs (planned) |
| `packages/skill-schema` | Shared Zod schemas: manifest, report, passport, permission taxonomy |
| `packages/validator` | The scan engine ("Skill Authenticator") + fixture packages |
| `packages/cli` | `aiskills scan` / `aiskills report` (planned) |

## Development

Requires Node >= 22.12 and pnpm.

```
pnpm install
pnpm dev        # dev server at http://localhost:4321
pnpm test       # Vitest across the monorepo
pnpm typecheck  # astro check
pnpm build      # typecheck + production build
```

## Built with the AI Coding Blueprint

This project is developed with the [AI Coding Blueprint](https://github.com/bradtraversy/ai-blueprint),
a spec-first, review-gated workflow for building with AI assistants. The
workflow docs live in [blueprint/README.md](blueprint/README.md); build history
is in `blueprint/history/`.

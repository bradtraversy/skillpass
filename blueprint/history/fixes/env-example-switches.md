# Current Feature

> **Generated file.** Holds the one feature or fix being built right now. Run
> `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
> an ad-hoc fix. Build one thing at a time; `/complete` archives it (to
> `blueprint/history/features/` or `blueprint/history/fixes/`) and resets this file.

## The env example hides the switch that decides whether the worker gets jobs

**Type:** Fix

**Branch:** `fix/env-example-switches`

### The problem

`apps/api/src/env.ts` reads `VALIDATION_MODE` (default `inline`),
`ANTHROPIC_API_KEY`, and `VOYAGE_API_KEY`. None appear in
`apps/api/.env.example`. A developer following `AGENTS.md` starts
`pnpm dev:worker` with Redis, but submissions validate inline unless
`VALIDATION_MODE=queue`, so the worker sits idle with no error, and AI
review, classification, display copy, and AI search silently no-op.

Audit item #7, `.env.example`, from the 2026-09-08 code audit.

### The fix

Add the three variables to `.env.example`, commented, with the inline/queue
note next to `REDIS_URL`, and say in the `AGENTS.md` worker line that
`VALIDATION_MODE=queue` is what routes jobs to it.

### Build steps

- [x] **Step 1 - the two files.** Done when the example lists every key
  `env.ts` reads.

### Testing

Documentation only; no code change.

### Verify

`grep -o '^\s*[A-Z_]*:' apps/api/src/env.ts` against the keys in
`.env.example`: every schema key is present.

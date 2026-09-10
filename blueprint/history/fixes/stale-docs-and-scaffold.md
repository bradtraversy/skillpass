# Current Feature

> **Generated file.** Holds the one feature or fix being built right now. Run
> `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
> an ad-hoc fix. Build one thing at a time; `/complete` archives it (to
> `blueprint/history/features/` or `blueprint/history/fixes/`) and resets this file.

## Stale docs, scaffold leftovers, and comments that lie

**Type:** Fix

**Branch:** `chore/stale-docs-and-scaffold`

### The problem

- Root `README.md` still marks `apps/api` and `packages/cli` "(planned)" and
  says typecheck is `astro check`.
- Root `package.json` is named `ai-skills-directory` with `main: index.js`,
  a file that does not exist; the API sends that old name to GitHub as its
  User-Agent.
- `apps/web/README.md` is the Astro starter text; `apps/web/AGENTS.md` and
  `CLAUDE.md` are Astro-generated and tell agents to run `astro dev
  --background`, contradicting the root instructions.
- `apps/web/.vscode` is tracked although `.vscode/` is ignored, and
  `.claude/skills/pdf` (an unrelated Python skill) is tracked with no `.agents`
  mirror.
- `Hero.astro` cites a `prototypes/homepage.html` that no longer exists;
  `listings.ts` claims "every author is capped at two picks", which is false.
- Three docs pages say only a leaked secret hard-fails, but the structure
  rules also fail a package the validator cannot read.
- `r2.ts` and `env.ts` carry "load-bearing contract" and feature-number
  comments that read as a spec instead of code.

Audit item #8 (stale docs and scaffold) from the 2026-09-08 code audit.

### The fix

Fix the README and package metadata, rename the User-Agent to `skillpass`
(tests updated), replace the web README with a pointer to the root, delete
the two Astro agent files, untrack `.vscode` and the pdf skill, correct the
two comments, reword the three docs sentences, and rewrite the two comment
blocks as plain code comments.

Must not break: `pnpm test` (two User-Agent assertions change with the
constant), `pnpm typecheck`, and the docs pages' markup.

### Build steps

- [x] **Step 1 - the sweep.** Done when tests and typecheck are green and
  `git ls-files` no longer lists `.vscode` or `.claude/skills/pdf`.

### Testing

Prose and metadata; the two touched tests keep the User-Agent pinned.

### Verify

`git ls-files apps/web/.vscode .claude/skills/pdf` prints nothing; the docs
pages render the new sentence.

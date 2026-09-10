# Current Feature

> **Generated file.** Holds the one feature or fix being built right now. Run
> `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
> an ad-hoc fix. Build one thing at a time; `/complete` archives it (to
> `blueprint/history/features/` or `blueprint/history/fixes/`) and resets this file.

## File names that drift from the conventions

**Type:** Fix

**Branch:** `chore/file-naming-conventions`

### The problem

- `apps/web/astro.config.mjs`, `packages/cli/bin/skillpass.mjs`, and the
  bundle `dist/cli.mjs` use `.mjs` although every package declares
  `"type": "module"`, so `.js` works and the house rule says never `.mjs`.
- `apps/web/src/lib/filterSkills.ts` and `categoryTints.ts` are camelCase
  while the rest of `lib/` and the coding standards use kebab-case.

Audit item #8 (convention drift, file names) from the 2026-09-08 code audit.

### The fix

Rename the three `.mjs` files to `.js` and update the bin entry, esbuild
outfile, root `cli` script, and the `AGENTS.md` command line; rename the two
lib files (and the test) to kebab-case and update their five imports.

Must not break: `pnpm build` (Astro must pick up `astro.config.js`),
`pnpm cli --version` (the bin still resolves the bundle), and every import.

### Build steps

- [x] **Step 1 - renames and references.** Done when `pnpm test`,
  `pnpm typecheck`, `pnpm build`, and `pnpm cli --version` all pass and
  `git grep '\.mjs'` finds only Astro's own server entry in `render.yaml`
  and the Blueprint template text.

### Testing

Renames only; the build, the CLI smoke run, and the suite are the proof.

### Verify

`pnpm cli --version` prints the version; the dev server starts from
`astro.config.js`.

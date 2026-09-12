# Fix: Lint and format gate

**Type:** Fix
**Status:** verified
**Branch:** `fix/lint-and-format-gate`

## The problem

`pnpm verify` gates on types, tests, and the build, but nothing checks code quality
rules or formatting. Style is held by hand across 260 source files, and bug-class
rules (stale React hook closures, floating promises in async API handlers) have
no tool behind them. `AGENTS.md` records "No lint command is configured yet."

## The fix

Add ESLint (flat config, typescript-eslint, react-hooks, astro) and Prettier
(tabs, single quotes, 120 columns, astro plugin) at the monorepo root, wire
`pnpm lint` and `pnpm format:check` into `pnpm verify` so the pre-push hook and
GitHub Actions run them unchanged, and bring the existing code to a clean pass.
Rule fixes must be mechanical: no behavior changes, no blanket disables. A rule
that produces only noise is turned off in the config with a one-line reason
rather than suppressed inline.

Must not break: `pnpm typecheck`, `pnpm test`, `pnpm build`, the CLI bundle.

## Build steps

- [x] 1. Install the tooling, add `eslint.config.js`, `prettier.config.js`,
   `.prettierignore`, and the root scripts; extend `verify`.
   Done when `pnpm lint` and `pnpm format:check` run and report the baseline.
- [x] 2. Format the tree and fix lint findings.
   Done when `pnpm verify` passes end to end and the diff contains no behavior change.
- [x] 3. Update the Commands section of `AGENTS.md` and the coding standards.
   Done when the docs name the two commands and the "no lint" sentence is gone.

## Verify

`pnpm verify` green locally (this is what the hook and CI run). Spot-check the
formatted diff for anything beyond whitespace, wrapping, and import order.

## Verification

`pnpm verify` passed on the branch: lint clean, Prettier clean, typecheck across all
workspaces, 1042 tests in 91 files, and the Astro build. The CLI bundle rebuilt and
reports 0.3.0. Every file was compared to `main` with whitespace, commas, parens, and
semicolons stripped; the only files with other differences are the hand edits listed
in the commit body plus Prettier's quote and union-type normalizations.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":2156,"specSha256":"586a9db37f5576c437511280e7f9a08bd01e14a70daa37a12dbdd3ea536fac76","branch":"refs/heads/fix/lint-and-format-gate","head":"bf72b3807dae90ce477de69d6a85812e2154b2dc","baseRef":"refs/heads/main","baseCommit":"bf72b3807dae90ce477de69d6a85812e2154b2dc","sourceTree":"a8e1bd68dbf309a849f64f2dbd199eec85f7b2ed","absentOptional":["blueprint/context/findings.md","blueprint/context/review.md"]} -->

# Feature: 15c - Package and ship to npm

**From build-plan:** feature 15c
**Branch:** `feature/15c-npm-ship`
**Date:** 2026-08-02

## What and why

`npm install -g skillpass` now works for anyone: **skillpass@0.1.0 is live on
the npm registry** (published this session with a fresh granular token). The
CLI previously ran raw TypeScript through a `tsx` runtime dependency with a
localhost API default - unusable outside the monorepo. The install panel's
coming-soon chip is gone, replaced with the real install command.

## Scope decisions (as shipped)

- **One esbuild bundle** (`dist/cli.mjs`, ESM, platform node): private
  workspace packages (`skill-schema`, `validator`) plus zod and fflate baked
  in - the published package has **zero runtime dependencies** and a 4-file
  tarball (bin shim, bundle, README, package.json). `tsx` removed entirely;
  root `pnpm cli` builds then runs.
- **Prod API default**: `DEFAULT_API_URL = https://api.skillpass.dev`;
  `SKILLPASS_API` is now the dev override (`AGENTS.md` updated). An empty
  env var is treated as unset - a micro-bug caught during registry
  verification when `SKILLPASS_API=` produced a broken relative URL.
- **Colorized `report`/`scan`** (and `add`'s report): status PASSED/WARNING/
  FAILED green/yellow/red, risk levels colored, BLOCKED red, verified marker
  green / HASH MISMATCH red; TTY-only via the shared styler, `NO_COLOR`
  honored. Search's risk mapping deduplicated into shared `riskColor`.
- **Metadata**: MIT, `files` whitelist, `engines.node >= 20`, repository/
  keywords/description, `prepublishOnly` builds. README documents every
  command, the hash-verification story, `SKILLPASS_API`, exit codes.
- **Publish path learnings**: a read-scoped granular token passes
  `npm whoami` but 403s on PUT - publish needs Read and write on All
  packages (a first-time publish can't be package-scoped) plus 2FA bypass
  for non-interactive shells. `pnpm publish` (not npm) so `workspace:*`
  ranges rewrite. The interim token that touched the chat transcript is
  flagged for revocation.
- **Chip removal**: `InstallBar.tsx` now shows
  `Needs the CLI: npm install -g skillpass` under the copy box.

## Build steps

- [x] **Step 1 - esbuild bundle and bin** (`7f32944`)
- [x] **Step 2 - prod API default** (`4d54abe`)
- [x] **Step 3 - colorized report and scan** (`f383e20`)
- [x] **Step 4 - metadata, README, tarball proof** (`58b3b6e`)
- [x] **Step 5 - publish gate** (`0395a02`)

## Verification

- `pnpm test` 841 passed (835 at branch; api-url, styled report/scan, empty
  env cases), `pnpm typecheck` and `pnpm build` green.
- Tarball proof: `npm pack` -> global install into a temp prefix ->
  `--version`, `search --packs`, and a hash-verified `add pdf` all ran
  standalone from a random directory.
- Registry proof: `npm view skillpass version` = 0.1.0;
  `npm install -g skillpass` into a clean prefix; `search blueprint` hit
  prod (1 of 195).

## Follow-ups

- 15e (update lifecycle) is the remaining CLI item.
- Chip change reaches prod when this merge deploys.
- Brad: delete the leaked July 19 npm token (id `1cb0fb`).

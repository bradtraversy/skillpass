# Fix: README refresh

**Type:** Fix
**Status:** verified
**Branch:** `fix/readme-refresh`

## The problem

The README's Status section still says the submission flow, validation queue,
publishing, pre-flight, and CLI are "next up", all of which shipped weeks ago.
It has no screenshot, no link to the live site or the npm package, describes
the web app as fully static when the skill and profile pages render on demand,
and its Development section predates `pnpm verify`, lint, and the API dev server.

## The fix

Rewrite the README around what is live: two screenshots captured from
skillpass.dev (the directory and a Skill Passport) stored under `.github/`, a
short trust-chain section, a "What's live" list, a CLI quick start, the corrected
layout table, an architecture summary, current development commands, and a
deploy note pointing at `render.yaml`. Keep the Why and Blueprint sections. Add
the Verify workflow, npm version, and MIT badges, and add the MIT LICENSE file
the root package.json already declares.

Must not break: nothing in code changes.

## Build steps

- [x] 1. Capture the screenshots and rewrite `README.md`. Done when the README
  renders with both images and `pnpm verify` passes (the README is outside
  Prettier's scope, so the gate is unchanged).

## Verify

Open the README on GitHub after the push: both screenshots render, the badges
resolve, and every command in the Development section matches `package.json`.

## Verification

`pnpm verify` passed on this exact code tree (`f39c88e`) earlier in the session;
this branch adds only the README, LICENSE, and two PNGs, none inside the gate's
scope. Every command listed was checked against the root `package.json` scripts
and the CLI's `--help` output. Screenshots were re-captured from skillpass.dev
after the new logo deployed.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":1815,"specSha256":"4e2034e870d593dccc84965b797ea70abe5e90ef658a592f61eece141c68b24f","branch":"refs/heads/fix/readme-refresh","head":"f39c88e573b362896e48f2df791abf69f75cf20a","baseRef":"refs/heads/main","baseCommit":"f39c88e573b362896e48f2df791abf69f75cf20a","sourceTree":"eb0fc5cdd32d2bf170e44264cfbbadf05a9c32b6","absentOptional":[]} -->

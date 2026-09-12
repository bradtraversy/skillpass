# Fix: Dependabot updates

**Type:** Fix
**Status:** verified
**Branch:** `fix/dependabot-updates`

## The problem

Nothing watches dependencies. The API handles OAuth, uploads, and a public
surface, so security releases in Hono, Drizzle, Astro, or the GitHub Actions the
Verify workflow pins only arrive when someone remembers to look.

## The fix

Add `.github/dependabot.yml` with two weekly ecosystems: npm at the repo root
(pnpm lockfile 9.0 is supported) and github-actions. Minor and patch npm updates
land grouped in one pull request so the noise on a solo repo stays low; major
bumps arrive individually because a grouped major that fails would block the
rest. The Verify workflow already runs on pull requests and needs no secrets, so
every Dependabot PR gets the full gate.

Must not break: nothing in the codebase changes.

## Build steps

- [x] 1. Add the config and run the gate. Done when `pnpm verify` passes and
  Prettier accepts the file.

## Verify

After the push, GitHub's Insights, Dependency graph, Dependabot tab lists both
update configurations and opens the first grouped PR on the next weekly run.

## Verification

`pnpm verify` passed on the branch; the only change is the new YAML file.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":1218,"specSha256":"9b67e3feb2e58afe3fdea0ff2511e6aeff8f6dc89b63329af27a1a886de2cf42","branch":"refs/heads/fix/dependabot-updates","head":"926cfb98111734be9517f8b66c8e0ef8f973674e","baseRef":"refs/heads/main","baseCommit":"926cfb98111734be9517f8b66c8e0ef8f973674e","sourceTree":"f4dc04d2a7902c222ef67fc5f07500b2fe0746c9","absentOptional":[]} -->

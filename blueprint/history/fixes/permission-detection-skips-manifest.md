# Fix: Permission detection skips the manifest

**Type:** Fix
**Status:** verified
**Branch:** fix/permission-detection-skips-manifest

## The problem

`detectPermissions` in `packages/validator/src/rules/permissions.ts` scans every file in the package, including the root `skill.json`. That file lists the declared permission keys, and two of the key names match their own signals: `network.fetch` (the `\bfetch\b` signal) and `external.deploy` (`\bdeploy\b`). So declaring either one also reports it as detected, even when no instruction asks for it. The passport's declared-versus-detected gap, which is meant to compare what the author claims with what the content does, is wrong for those keys. Found while testing `skillpass init` (feature 29) through a pseudo-terminal on 2026-10-03.

## The fix

- `detectPermissions` ignores the root `skill.json`. It is the declaration channel, not instructions an agent reads, so it should never count as evidence. Every other file is scanned as before.
- The other rules are unchanged: the content rule still scans `skill.json` for secrets and risky patterns.
- Packages without a `skill.json` are unaffected (manifest inference already runs only when it is missing).
- Bump the engine version in `packages/validator/package.json` from `0.3.0` to `0.3.1` (the version is the engine version; a rule change bumps it) and update the test that pins it.
- `/docs/validation`: say that detection reads the skill's files, not `skill.json` itself.

Published passports are immutable and keep their stored values; only new validations use the fix.

## Build steps

- [x] 1. **Skip the manifest in detection.** Apply the change, the engine bump, and the docs line; add tests in `permissions.test.ts` that a `skill.json` declaring `network.fetch` and `external.deploy` with no matching content detects neither, and that the same words in `SKILL.md` are still detected. **Done when** `pnpm verify` is green, and a `skillpass init` scaffold declaring `network.fetch` scans with it declared and not detected.

## Verify

- New detection tests pass; existing validator, API, and CLI tests still pass.
- Built CLI: scaffold with declared `network.fetch` shows declared `network.fetch`, detected none, engine `0.3.1`.

## Evidence

- `pnpm verify` green on `fix/permission-detection-skips-manifest`.
- New tests in `packages/validator/src/rules/permissions.test.ts`: a root `skill.json` declaring `network.fetch` and `external.deploy` detects nothing; the same words in `SKILL.md` are still detected; a nested `skill.json` is scanned like any other file.
- Engine version 0.3.1: `validate.test.ts` pin updated; `apps/api/src/queue/processor.test.ts` now asserts `ENGINE_VERSION` from `validator` instead of a literal, so the next bump does not break it.
- Built CLI through a pseudo-terminal: `skillpass init detect-demo` declaring `network.fetch` and `external.deploy` scans PASSED, risk low, engine 0.3.1, declared both, detected none.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":2966,"specSha256":"c4f5f47956e29ad34462eb48e10b204ff9a0f6426c350f46acb148cc6edd9553","branch":"refs/heads/fix/permission-detection-skips-manifest","head":"3f8f5b4dd6a756f9a602f1f3bbe9fc7c259612be","baseRef":"refs/heads/main","baseCommit":"3f8f5b4dd6a756f9a602f1f3bbe9fc7c259612be","sourceTree":"476a76ec677c26fc98cfdac58d22ec260bcaed1d","absentOptional":[]} -->

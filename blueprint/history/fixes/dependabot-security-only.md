# Fix: Security-only Dependabot

**Type:** Fix
**Status:** verified
**Branch:** `fix/dependabot-security-only`

## The problem

The version-update config added this morning opened eight pull requests in its
first sweep, two of them failing the gate. Weekly grouped version bumps are more
inbox than a solo repo wants, and the part that matters for an app with OAuth
and uploads is vulnerability fixes, which do not need this file.

## The fix

Delete `.github/dependabot.yml`. Dependabot security updates are a repository
setting (Settings, Code security, Dependabot security updates) and keep working
without a config file; they open a PR only for a dependency with a known
vulnerability. Version drift is handled by hand with `pnpm outdated` when
wanted. The open version-update PRs are closed after this lands, except the
three GitHub Actions bumps that passed, which merge.

Must not break: nothing in the codebase changes.

## Build steps

- [x] 1. Remove the config. Done when `pnpm verify` passes and the file is gone.

## Verify

After the push, the Dependabot tab lists no version-update configuration and
the security-updates toggle is on.

## Verification

`pnpm verify` passed on the branch; the only change is the deleted YAML file.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":1246,"specSha256":"4426be903c135a7f480c247f7a59a3df79b8ea45e89be8da75be4bf02330c841","branch":"refs/heads/fix/dependabot-security-only","head":"a40399cf9e589a8195889183ad819aedce8dbae6","baseRef":"refs/heads/main","baseCommit":"a40399cf9e589a8195889183ad819aedce8dbae6","sourceTree":"a7e4424381a8023f0d64f1baac4582b4a7f32cd3","absentOptional":[]} -->

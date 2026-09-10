# Current Feature

> **Generated file.** Holds the one feature or fix being built right now. Run
> `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
> an ad-hoc fix. Build one thing at a time; `/complete` archives it (to
> `blueprint/history/features/` or `blueprint/history/fixes/`) and resets this file.

## Skill routes repeat the pinned-version and snapshot preludes

**Type:** Fix

**Branch:** `fix/shared-skill-route-helpers`

### The problem

In `apps/api/src/routes/skills.ts` the four version-pinned routes (preflight,
download, source, pinned detail) each open with the same twelve lines: look up
the published skill or 404, look up the pinned version or 404. Three of them
then fetch the R2 snapshot and answer 502 with the same log line and message
when it fails. Any change to how a pinned version resolves or how a snapshot
failure is reported has to be made four and three times.

Audit item #7, third cluster, from the 2026-09-08 code audit.

### The fix

Two module-level helpers in the routes file: `findPinned(db, slug, version)`
returning the record and pinned version or `undefined`, and
`snapshotOr502(c, env, route, hit)` returning the snapshot document or the 502
response. Routes become: resolve, bail, load, bail, do the work.

Must not break: every status, message, and log line the route tests assert
(`404s an unknown or unpublished slug`, `404s an unknown version`, `404s before
touching R2`, `502s when R2 is down`, integrity refusal, no snapshot key
leakage). Those tests are the gate and stay untouched.

### Build steps

- [x] **Step 1 - helpers and four routes.** Done when `pnpm test` and
  `pnpm typecheck` are green with `skills.test.ts` unchanged.

### Testing

Behavior-preserving extraction covered by the existing route suite.

### Verify

`pnpm test` green; the routes file shrinks with no test edits.

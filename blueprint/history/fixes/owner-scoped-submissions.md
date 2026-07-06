# Fix: owner-scoped submissions

**Type:** Fix
**Status:** not started

## Goal

Enforce the submission ownership rule in `POST /submissions`: admins can submit
any repository (curated listings); everyone else can only submit repositories
they own or org repositories where their GitHub org membership is public. Ships
before 5c puts a UI in front of the endpoint.

## In scope

- `verifySubmitPermission(env, user, target)` in `apps/api/src/github/ownership.ts`:
  admin -> allowed; repo owner matching the session username (case-insensitive,
  no API call) -> allowed; otherwise one GitHub public-org-membership check
  (204 -> allowed, 404 -> forbidden), with the pin module's rate-limit/upstream
  mapping.
- New `forbidden` source error code mapped to HTTP 403.
- Route wiring: check runs after URL parse, before commit pinning, so a denied
  submission never costs GitHub calls or storage.
- Flip Brad's user row (id 1) to `role: 'admin'` on the Neon dev branch so
  curated submissions keep working.
- One line in `project-overview.md` recording the rule.

## Out of scope

- Private org membership (needs user OAuth tokens we deliberately do not store);
  the error message tells those users to submit from a repo they own.
- Suggest-a-skill queue for community curation (feature 10 territory).
- Attribution of curated listings to source repo owners (feature 7, where
  `maintainerId` is assigned).

## Build steps

- [x] **Step 1 - ownership check** - the module + error code + route wiring +
  tests, overview line, admin role flip on dev. *Done when:* unit tests cover
  admin bypass, case-insensitive owner match, org 204/404, and rate-limit
  mapping; route tests prove a forbidden submission 403s without pinning; whole
  suite and typecheck green; Brad's row reads `admin`.

## Files / areas

- `apps/api/src/github/ownership.ts` (new, + test)
- `apps/api/src/github/errors.ts` - `forbidden` code
- `apps/api/src/routes/submissions.ts` (+ test) - wiring + 403 mapping
- `blueprint/context/project-overview.md` - the rule, one line

## Testing

- Mocked-fetch unit tests for every branch of the permission check; route test
  proves 403 short-circuits before `resolveCommit`. Existing tests must stay
  green with the check mocked open in the happy path.

## Notes for the AI

- Compare owner/username lowercased; GitHub logins are case-insensitive.
- Do not store or use user OAuth tokens for the org check - public membership
  only, via the server's optional `GITHUB_TOKEN`.

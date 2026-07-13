# Feature 12: Navigation & shell wiring

**Outcome:** resolved by deletion, not by wiring. Shipped 2026-07-13.

## What happened

The build-plan item was "make the top nav and footer real (Browse, Validator,
Docs, CLI) with active states; remove the `#` placeholder links." Speccing it
exposed that none of the four nav items had a real, non-redundant destination:

- **Browse** -> `/`, which is exactly where the logo already points. Redundant.
- **Validator** -> nothing. Investigating it surfaced the real decision below.
- **Docs / CLI** -> pages that don't exist until feature 14.

So wiring the nav would have meant linking to placeholders or 404s. The honest
fix was to delete the menu items entirely. The nav is now **logo (-> `/`) +
"Submit a skill" CTA + account menu**, which achieves the stated goal ("remove
the `#` placeholder links") by removal. The menu items return in feature 14 once
their destination pages are real.

## Decision: no public / standalone validator

The "Validator" nav item implied a public tool to validate any repo on demand.
Rejected, for two reasons:

1. **Operational.** The API fetches GitHub through a single shared `GITHUB_TOKEN`
   (`apps/api/src/github/pin.ts`) - one quota (5,000 req/hr authenticated, 60/hr
   unauthenticated) shared across the whole system, plus `codeload` tarball
   pulls. A public "validate any URL" endpoint lets any anonymous visitor drain
   that shared quota and break validation for every real submission - a DoS on
   the core feature. This is why submission is gated behind GitHub sign-in.
2. **Redundant.** Validation is an ingest-time step. The public "inspect before
   you trust" promise is already delivered without a live fetch: the immutable
   **passport** on every skill page, the **download pre-flight** (reads the
   stored snapshot), and **`aiskills scan`** in the CLI for arbitrary *local*
   repos (cost lands on the user, not the shared token).

The distinction that matters: validation *outside submission* is fine when the
cost is local (the CLI). The bad idea is specifically server-side live validation
of arbitrary repos for anonymous users. "Validator" as a concept becomes a docs
explainer ("how validation / the Skill Passport works") in feature 14, not a tool.

## Deferred to feature 14

- The Docs (and possibly CLI) nav menu items, re-added as real links.
- The site footer, built alongside a real About/Docs to anchor it.

## Files touched

- `apps/web/src/components/nav/Nav.astro` - removed the `links` array and the
  Browse/Validator/Docs/CLI + CLI links; kept logo, Submit CTA, account slot.

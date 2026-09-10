# Current Feature

> **Generated file.** Holds the one feature or fix being built right now. Run
> `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
> an ad-hoc fix. Build one thing at a time; `/complete` archives it (to
> `blueprint/history/features/` or `blueprint/history/fixes/`) and resets this file.

## Three small audit leftovers

**Type:** Fix

**Branch:** `fix/small-audit-leftovers`

### The problem

- `POST /submissions` and `POST /submissions/zip` have no per-user limit, so
  one signed-in account can hammer GitHub, R2, and the validator.
- `/sitemap.xml` is rendered on demand with no cache header, so every crawler
  hit re-queries the API.
- The homepage Filters button reports `aria-expanded` from the desktop
  sidebar state even on mobile, where the drawer is what opens.

Audit "small" items from the 2026-09-08 code audit.

### The fix

- `rateLimitMiddleware` takes an optional key function; the submission
  routes limit each user to 20 submissions per hour by user id.
- The sitemap response carries `Cache-Control: public, max-age=3600`.
- `Directory` tracks the desktop breakpoint with a `matchMedia` listener and
  reports whichever panel that viewport actually toggles.

Must not break: the submission suite (well under the limit), the sitemap
body, and the filter toggle on both breakpoints.

### Build steps

- [x] **Step 1 - the three changes.** Done when tests, typecheck, and build
  are green and `curl -I /sitemap.xml` shows the cache header.

### Testing

The keyed limiter gets a middleware test; the rest is wiring verified by the
build and a header check.

### Verify

`curl -sI http://localhost:3004/sitemap.xml | grep -i cache-control`.

# Current Feature

> **Generated file.** Holds the one feature or fix being built right now. Run
> `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
> an ad-hoc fix. Build one thing at a time; `/complete` archives it (to
> `blueprint/history/features/` or `blueprint/history/fixes/`) and resets this file.

## The three server-rendered pages repeat their prelude and back link

**Type:** Fix

**Branch:** `fix/web-shared-ssr-prelude`

### The problem

`skills/[slug]/index.astro`, `skills/[slug]/[version].astro`, and
`u/[username].astro` each carry the same head-fetch prelude (a 4-second
timeout, unwrap the result, mark the response 404 when the API said so, fall
back to the URL parameter) and the same 20-line back link with an inline
chevron SVG. The only differences are which API call runs and where the link
points.

Audit item #7, SSR pages, from the 2026-09-08 code audit.

### The fix

- `lib/ssr.ts` exports `headFetch(response, run)`: runs the call with the
  shared timeout, returns the data or `null`, and sets the response status to
  404 only when the API answered 404. Unit-tested for the three outcomes.
- `components/nav/BackLink.astro` renders the chevron link with an `href`
  prop and slotted label.
- The three pages call both.

Must not break: page titles, descriptions, canonical, the 404 status on an
unknown slug or user, and the rendered link markup. `pnpm build` and a page
screenshot are the proof.

### Build steps

- [x] **Step 1 - helper, component, three pages.** Done when `pnpm test`,
  `pnpm typecheck`, and `pnpm build` are green and the detail page still
  renders its back link.

### Testing

`headFetch` is pure logic with a test; the rest is Astro markup verified by
the build and a screenshot.

### Verify

Reload `/skills/ai-blueprint` on the dev server and check the "Skills" back
link and the page title; request an unknown slug and confirm a 404 status.

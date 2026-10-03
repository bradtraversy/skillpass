# Fix: Header overflow at phone width

**Type:** Fix
**Status:** verified
**Branch:** fix/header-overflow-at-phone-width

## The problem

The shared header in `apps/web/src/components/nav/Nav.astro` does not fit at phone width. At 375 px the row holds the logo plus Docs, CLI, the GitHub icon, the "Submit a skill" button, and the account slot, with fixed `gap-5` / `gap-[22px]` gaps and `px-6` padding. The flex row squeezes: "SkillPass" runs into "Docs", "Submit a skill" wraps to two lines, and "Sign in" is clipped at the right edge. Seen in the Browser pane on `/docs/api` and `/docs/cli` (2026-10-03); it is the same component on every page. Signed in, the account slot is wider still (avatar plus username, `AccountMenu.tsx`).

## The fix

Make the header fit below Tailwind's `sm` breakpoint (640 px) with CSS classes only; at `sm` and up it renders exactly as today.

- `Nav.astro`: header row `px-4 sm:px-6` and `gap-3 sm:gap-5`; nav `gap-[14px] sm:gap-[22px]`.
- Hide the CLI link and the GitHub icon below `sm` (`hidden` plus `sm:` display). Both stay reachable from the footer, which already links `/docs/cli` and the GitHub repo.
- Shorten the button to "Submit" below `sm` by wrapping " a skill" in `sr-only sm:not-sr-only`, so its accessible name stays "Submit a skill".
- `AccountMenu.tsx`: wrap the signed-in username in `sr-only sm:not-sr-only`, so phones show only the avatar and the menu button keeps its accessible name.

Must not break: desktop layout, the active-link highlighting (`link()`), the account dropdown position, or the `client:idle` hydration. No hamburger menu or new component.

## Build steps

- [x] 1. **Responsive header classes.** Apply the class changes above in `Nav.astro` and `AccountMenu.tsx`. **Done when** `pnpm verify` is green, and in the Browser pane at 375 px and 360 px on `/` and `/docs/api` the header row's `scrollWidth` equals its `clientWidth`, the logo's right edge is left of the nav's left edge, the Submit button is one line high, and "Sign in" is fully inside the viewport. At desktop width all five nav items show as before.

## Verify

- Browser pane at 375 px and 360 px on `/` and `/docs/api`: no overlap, no wrap, no clipping; measured with `getBoundingClientRect` as in the done-when, plus a screenshot.
- Desktop width: Docs, CLI, the GitHub icon, "Submit a skill", and the account slot all visible, unchanged.
- Signed-in state is not exercised locally (it needs a real GitHub sign-in); the username change is class-only and reviewed in the diff. Brad can confirm on a phone after deploy.
- This is a UI change, exempt from the test gate; it rides on `pnpm verify` plus the pane evidence.

## Evidence

- `pnpm verify` green on `fix/header-overflow-at-phone-width`; the built CSS carries the `sm:not-sr-only` rule.
- Browser pane on Brad's dev server, measured with `getBoundingClientRect`:
  - 375 px, `/` and `/docs/api`: header row `scrollWidth` 375 equals `clientWidth`; logo right edge 122, nav left edge 173; Submit button 38 px high (one line); "Sign in" right edge 359. Visible items: Docs, Submit, Sign in.
  - 360 px, `/` and `/docs/api`: row 360 equals 360; logo 122, nav 159; Submit 37 px; "Sign in" right edge 344.
  - Desktop (1009 px): Docs, CLI, the GitHub icon, "Submit a skill", and Sign in all visible; Submit 37 px high.
- The Submit link's text content stays "Submit a skill" at every width (the hidden part is `sr-only`, not removed).
- Not exercised: the signed-in avatar-only state (needs a real GitHub sign-in).
- Found, not changed: on `/` at 375 px the document is 436 px wide because the search bar's Keyword | AI toggle and "/" shortcut hint run past the viewport (right edges 403 and 436). Separate from the header; a `/fix` candidate.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":3738,"specSha256":"7d3c6a1b4a293d95aa20277983a0d334da029d6144dc30af41edcec212ff545e","branch":"refs/heads/fix/header-overflow-at-phone-width","head":"f78ab42aca128d866d22fc85ae19d1c70f88aa4c","baseRef":"refs/heads/main","baseCommit":"f78ab42aca128d866d22fc85ae19d1c70f88aa4c","sourceTree":"0bcd24a021a88d3bd47b10d9e4607c01b2ef731e","absentOptional":[]} -->

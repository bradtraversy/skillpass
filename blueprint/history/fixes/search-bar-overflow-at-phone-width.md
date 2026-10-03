# Fix: Search bar overflow at phone width

**Type:** Fix
**Status:** verified
**Branch:** fix/search-bar-overflow-at-phone-width

## The problem

On the homepage at 375 px the document is 436 px wide, so the page scrolls sideways. The cause is the search bar in `apps/web/src/components/home/SearchBox.tsx`: its `<input>` is a `flex-1` flex item with the default `min-width: auto`, so it never shrinks below the browser's intrinsic input width. The row then pushes the Keyword | AI toggle and the "/" shortcut hint past the viewport (measured right edges 403 and 436 in the Browser pane, 2026-10-03). Same at 360 px (document 434 px wide).

## The fix

Class-only changes in `SearchBox.tsx`:

- Add `min-w-0` to the input so it takes the space left after the icon and the toggle, and shrinks with the row.
- Hide the "/" shortcut hint below `sm` (`hidden sm:block`). It describes a keyboard shortcut that a phone does not have; at `sm` and up it shows as today.

Must not break: keyword filtering as you type, AI mode on Enter, the mode toggle, the `/` shortcut focusing the input on desktop (that listener lives outside this component and is untouched), or the desktop layout. The placeholder may truncate on phones; it is not changed.

## Build steps

- [x] 1. **Let the search input shrink.** Apply the two class changes above. **Done when** `pnpm verify` is green, and in the Browser pane on `/` at 375 px and 360 px `document.documentElement.scrollWidth` equals `clientWidth`, the search row's right edge is inside the viewport, both toggle buttons are fully visible, and typing in the input still filters the list. At desktop width the "/" hint shows and the bar looks as before.

## Verify

- Browser pane on `/` at 375 px and 360 px: no sideways scroll, toggle fully visible, measured with `getBoundingClientRect`, plus a screenshot.
- Desktop: the "/" hint is visible and pressing `/` still focuses the search input.
- A UI change, exempt from the test gate; it rides on `pnpm verify` plus the pane evidence. The homepage list needs the local API (`pnpm dev:api`) for the typing check; without it, only the layout can be checked.

## Evidence

- `pnpm verify` green on `fix/search-bar-overflow-at-phone-width`.
- Browser pane on Brad's dev server, `/`, measured with `getBoundingClientRect`:
  - 375 px: document `scrollWidth` 375 equals `clientWidth` (was 436); search row spans 24 to 351; Keyword 230 to 294 and AI 297 to 326, both inside the row; input 138 px wide; "/" hint `display: none`. Screenshot taken.
  - 360 px: document 360 equals 360 (was 434); row right edge 336; toggle right edges 280 and 311; input 124 px.
  - Desktop (1009 px): row 620 px wide as before; "/" hint `display: block`; pressing `/` focuses the search input.
- The island hydrated: clicking AI sets `aria-pressed="true"` and the AI placeholder, clicking Keyword restores both. Typing "pdf" updates the controlled input value.
- Not exercised: the filtered list after typing. The local API was not running, so the directory had no rows to filter; the input's `onChange` path is unchanged.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":3080,"specSha256":"823a419e538095ce90e7b9c3dac2923027839d85b767f75d124548a90e1fa2c4","branch":"refs/heads/fix/search-bar-overflow-at-phone-width","head":"355925c7ec274762f692ded785ee2ffbf5d6f40a","baseRef":"refs/heads/main","baseCommit":"355925c7ec274762f692ded785ee2ffbf5d6f40a","sourceTree":"fd4716f467b9fceec2bda1c22bcfd8a0bbb9090c","absentOptional":[]} -->

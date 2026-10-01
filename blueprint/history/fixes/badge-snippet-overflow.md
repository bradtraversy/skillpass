# Fix: Badge snippet overflows its card

**Type:** Fix
**Status:** verified
**Branch:** `fix/badge-snippet-overflow`

## The problem

On a skill page, the README badge markdown is long. The copy box beside the badge image cannot
shrink, so it runs past the card's right edge and hides the copy button. Measured on dev at a
1280px viewport on `/skills/skill-creator`: box right edge 1356px, card right edge 989px.

Cause: `CopyBox`'s wrapper div is a flex item without `min-w-0`, and its `truncate` span sets
`white-space: nowrap`, so the wrapper's minimum width is the full string. The install card never
showed it because `skillpass add <slug>` is short.

## The fix

Add `min-w-0` to both `CopyBox` wrappers (single-line and multiline) so the box can shrink inside
any flex row and the inner `truncate` does its job. No markup, prop, or copy changes. The install
card's command box and the Prompt tab use the same component and must look the same as before.

## Build steps

- [x] 1. **`min-w-0` on the two `CopyBox` wrappers.** Done when: on `/skills/skill-creator` at
  1280px the badge box's right edge is inside the card and the copy button is visible (browser
  measurement); the install card's command box is unchanged; `pnpm verify` is green.

## Verify

Open a skill page and scroll to README badge: the markdown box ends inside the card with the copy
button at its right edge. The install card's `skillpass add` box and the Prompt tab look as before.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":1462,"specSha256":"ed39e34287384678c98b87a8fd8aefa3a4cc98d055fd8f62819adaba833007b9","branch":"refs/heads/fix/badge-snippet-overflow","head":"0969cee55a0b7780553a6c555b23131dbc074bc5","baseRef":"refs/heads/main","baseCommit":"0969cee55a0b7780553a6c555b23131dbc074bc5","sourceTree":"bb9be0e97e4614fc5edcceb59c48694bfecf61ce","absentOptional":[]} -->

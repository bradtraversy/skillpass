# Fix: Directory pagination

**Type**: Fix (ad-hoc, chat-driven)
**Branch**: `fix/directory-pagination`
**Date**: 2026-07-28

## What changed

The homepage directory paginates its filtered results at 25 per page (the
catalog hit 194 skills with seed wave 7). Client-side over the single fetched
list, so sidebar counts and instant filtering are untouched.

- `apps/web/src/lib/paginate.ts` - `paginate` (clamped page, slice, `start`
  for rank continuation) and `pageItems` (condensed page-number model with
  gaps), with a 10-case test file.
- `Directory.tsx` - page state, reset to page 1 on any filter change, ranks
  continue across pages (`paged.start + i`), Prev/page-numbers/Next controls
  (mono, accent-tinted active page, `aria-current`), scroll back to the list
  top on page change, bottom margin under the nav.

## Evidence

- `pnpm test` 759/759 (10 new paginate tests); `pnpm build` green.
- Headless screenshot of the live dev server: 194 skills, wave-7 rows and
  sidebar counts rendering, 25-row page.

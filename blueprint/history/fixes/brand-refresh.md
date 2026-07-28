# Fix: Brand refresh - logo, favicon, blue theme, category swatches

**Type**: Fix (ad-hoc, chat-driven)
**Branch**: `fix/logo-favicon`
**Date**: 2026-07-28

## What changed

- **Logo**: replaced the stock lucide shield-check nav mark with Brad's generated
  app icon (soft S on an indigo squircle). The source JPEG had a baked backdrop;
  processing detected the tile bounds and corner radius, cropped to the box, and
  masked the corners to true transparency. Master is `public/logo.png` (512),
  nav uses `public/logo-64.png`.
- **Favicon**: replaced the default Astro rocket (`favicon.svg`, deleted) with a
  set derived from the same master: `favicon-32.png`, `favicon-16.png`,
  `favicon.ico` (PNG-in-ICO, 16+32), and `apple-touch-icon.png` (180), linked
  from `BaseLayout.astro`.
- **Theme**: `global.css` tokens shifted from purple-graphite to the logo's
  blue/white world. Accent iris `#8f7bfb` -> periwinkle `#7fa8ff` (hover, soft,
  line, ring, ink follow); neutral ramp keeps its lightness but swaps the purple
  cast for blue; text is ice-white `#e9eefa`. Verdict and risk colors untouched.
- **Category swatches**: sidebar category rows show an 8px rounded swatch in the
  category's tile hue. Tint maps moved from `Row.tsx` to `lib/categoryTints.ts`
  (`TILE_TINTS` + new `CATEGORY_SWATCHES`) so row tiles and sidebar share one
  source. "All skills" uses the accent, "Uncategorized" is neutral.

## Evidence

- `pnpm build` green (astro check + build); `pnpm test` 749/749 green.
- Headless Chrome screenshots: nav lockup at 3x, homepage with loaded directory
  and swatched sidebar, zeroize-audit passport page, favicon strips at 32/16 on
  dark and light tab chrome.

## Notes

- Logo iterations logo1 (circuit-S tile) and logo2 (bare neon glyph) were
  processed and rejected in favor of logo3; raw uploads live in `~/Downloads`,
  not the repo. Background removal scripts are session scratch, not committed.

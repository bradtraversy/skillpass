# Fix: New logo

**Type:** Fix
**Status:** verified
**Branch:** `fix/new-logo`

## The problem

The header, favicons, Apple touch icon, and the Open Graph card still use the
placeholder rounded-square "S" badge. Brad supplied the real mark, a two-part
hexagonal S in the brand blues, as `skillpass-logo.png` (1254x1254 RGBA, with a
small wordmark lockup below the mark and a soft low-alpha halo around both).

## The fix

Use only the S mark. Crop it from the source, strip the halo by thresholding the
alpha channel (below 100 becomes transparent, 100 to 220 ramps, above 220 is
solid), and regenerate every icon asset from that one clean mark:
`logo.png` (512), `logo-64.png` (header), `favicon-32.png`, `favicon-16.png`,
`favicon.ico` (16 and 32), `apple-touch-icon.png` (180, on the site background
because iOS paints transparency black), and `og.png` with the old badge replaced
in place. Bump the icon link hrefs with `?v=2` so cached favicons refresh.

Must not break: the header layout, the OG card's text, the sitemap or SEO head.

## Build steps

- [x] 1. Generate the assets from the source mark. Done when every file in
  `apps/web/public` listed above is replaced and looks right at its size.
- [x] 2. Wire the header and head links. Done when the built homepage shows the
  new mark in the nav and the favicon links carry the cache-busting query.

## Verify

Build the site and screenshot the homepage, a docs page, and the OG card.
Check the favicon in a browser tab and the touch icon at 180px.

## Verification

The dev server on port 3004 showed the new mark in the header at 28px and served
the four icon links with `?v=2`. The OG card was patched in place with the pill
border and wordmark untouched. A preview sheet at 16, 26, 32, 64, and 90px
showed a clean mark with no halo. `pnpm verify` result recorded by the archive.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":1845,"specSha256":"8af17304a6db97c8ab1d8188b8f0fe4a49da557098acb9429563907d2da85ce1","branch":"refs/heads/fix/new-logo","head":"d4c7ca739114d3d36e8792439883f6c8c6329ec2","baseRef":"refs/heads/main","baseCommit":"d4c7ca739114d3d36e8792439883f6c8c6329ec2","sourceTree":"e1cf7b7b7624cf9d7a1d674c44f4b9d5702ebfa1","absentOptional":[]} -->

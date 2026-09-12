# Fix: Website docs refresh

**Type:** Fix
**Status:** verified
**Branch:** `fix/website-docs-refresh`

## The problem

The four docs pages were written on 2026-08-02, before AI search, the
Featured tab, category and works-with filters, the AI classification steps,
the binary-file rule, the per-account submission limit, and the maintainer
dashboard shipped. They still read correctly but leave those out, and the
snapshot caps appear only under the zip fallback although they apply to
GitHub submissions too.

## The fix

Add the missing facts to the existing pages without changing their structure:

- `/docs`: a "Browsing the directory" section (keyword and AI search, the `/`
  shortcut, Featured and Latest, category and works-with filters, packs) and a
  mention of the source view in the passport paragraph.
- `/docs/validation`: the binary-file rule as a named warning, and one
  paragraph on the AI classification steps (category, works-with
  integrations, display copy) beside the AI review.
- `/docs/submitting`: the snapshot caps stated once for every source, the
  binary-file rule, the 20-per-hour submission limit, and an "After you
  publish" section on the dashboard and public profile.
- `/docs/cli`: no changes; every command and flag matches `--help`.

Must not break: the docs shell, nav, or SEO head.

## Build steps

- [x] 1. Edit the three pages. Done when `pnpm verify` passes and each page
  renders on the dev server with the new sections in place.

## Verify

Open `/docs`, `/docs/validation`, and `/docs/submitting` on the dev server and
read the new sections against the code paths they describe.

## Verification

All three pages render the new sections on the dev server (checked by fetching
each page). ESLint passes on the docs pages; `pnpm verify` result recorded by the
archive.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":1817,"specSha256":"a61871df4408587b53dea791f2915dbf01e3e3c543fc134d475b1e0ed4debf0c","branch":"refs/heads/fix/website-docs-refresh","head":"e2bb5cc16595c70ceea79857df45c8f97e0d125d","baseRef":"refs/heads/main","baseCommit":"e2bb5cc16595c70ceea79857df45c8f97e0d125d","sourceTree":"674888dc4d4f1276990bba376cb39d2b8ce45a8b","absentOptional":[]} -->

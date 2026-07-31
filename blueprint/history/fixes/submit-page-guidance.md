# Fix: Submit page guidance

**Type**: Fix (ad-hoc, chat-driven)
**Branch**: `fix/submit-page-guidance`
**Date**: 2026-07-31

## What changed

The `/submit` page assumed the user already knew everything: a heading, two
sentences, and an input, with no mention of `SKILL.md`, `skill.json`, the
pipeline, or the ownership rule. The API also detected the package shape at
submit time (`loadPackageFromFiles`) but discarded it, so the confirmation card
could not confirm what was found.

- **Guidance bands** (`SubmitGuide.astro`, new; `submit.astro`): a static,
  zero-JS section below the form - "What we expect" as two side-by-side recipe
  cards with file trees (single skill; one skill in a bigger repo via a
  `/tree/branch/path` URL), a four-step "What happens next" pipeline explainer
  (pin, snapshot, validate-advisory, publish), and "Who can submit" (ownership
  rule, zip honor-system). A right-sidebar layout was built first and reworked
  to bands below the form after review.
- **Detection feedback** (`skill-schema/submission.ts`, `routes/submissions.ts`,
  `SubmitForm.tsx`, `lib/api.ts`): new `DetectedPackage`
  (`skillMd`, `manifest: ok | inferred | missing | invalid`, `name`) and
  `CreatedSubmission` types; both create endpoints spread `detected` into their
  201 payload from the already-computed `LoadedPackage`; the confirmation card
  renders it green ("skill.json / SKILL.md found - will list as ...") or amber
  (invalid manifest, missing SKILL.md, with what to do).
- **Instructive errors** (`github/snapshot.ts`, `uploads/zip.ts`): the bad-subpath
  message now says to point the `/tree/` URL at the folder containing SKILL.md;
  the empty-zip message says to zip the folder so SKILL.md sits at the top level.

Deliberately out of scope: the pack recipe card and pack detection - they land
with the workflow-packs feature (13b).

## Verification

- `pnpm test`: 761 passed (759 -> 761; two new route tests - a snapshot with no
  SKILL.md still 201s and reports `missing`, an explicit `skill.json` detects as
  `ok` with its declared name; both locked-shape tests extended with `detected`).
- `pnpm build`: green (`astro check` 0 errors) after every step.
- Headless screenshots at 1440px and 390px: bands below the form on desktop,
  everything stacked on mobile.
- Not exercised live: the detection row in a real browser (needs a signed-in
  GitHub session); its payload is test-proven.

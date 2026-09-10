# Current Feature

> **Generated file.** Holds the one feature or fix being built right now. Run
> `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
> an ad-hoc fix. Build one thing at a time; `/complete` archives it (to
> `blueprint/history/features/` or `blueprint/history/fixes/`) and resets this file.

## Long functions: runAdd, Directory, and the two biggest route registrars

**Type:** Fix

**Branch:** `refactor/long-functions`

### The problem

After the dedupe passes, 36 functions are still over the 50-line guideline.
Most are React components and Hono route registrars whose length is JSX or
route wiring; the ones that hide real branching are `runAdd` (226 lines, two
whole install strategies inline), `Directory` (358 lines: search box, AI
search, tabs, pagination, and status copy in one body), and the submission
and skill route registrars, whose largest handlers run 60 to 100 lines each.

Audit item #9 from the 2026-09-08 code audit.

### The fix

- `runAdd`: `installPack` and `installSingle` over one `AddContext`, with
  `choosePackLocation` and `chooseSingleLocation` for the prompts and a
  module-level `promptIndex`. Messages and exit codes are unchanged; the
  38-test add suite is the gate.
- `Directory`: a `useAiSearch` hook (which also gains the in-flight and
  stale-response guard the audit flagged, plus the `/` shortcut the kbd hint
  promised), and `SearchBox`, `ListHeader`, `Pagination`, and
  `DirectoryStatus` components in `components/home/`. The stale guard is a
  pure `latestOnly` helper in `lib/` with a test.
- Routes: the submission create and publish handlers and the skill search
  and download handlers become named functions the registrars mount.

The remaining components between 70 and 180 lines are JSX and stay as they
are; that is a judgement call, not a defect.

Must not break: every suite; `pnpm build`; the homepage (search, tabs,
filters, pagination) and the detail page in the browser.

### Build steps

- [x] **Step 1 - `runAdd` split.** Done when the add suite passes unchanged.
- [x] **Step 2 - `Directory` split with the AI search guard and `/` key.**
  Done when tests, typecheck, and build pass and the homepage works in the
  browser.
- [x] **Step 3 - route handlers named.** Done when the route suites pass
  unchanged.

### Testing

`latestOnly` gets a unit test; everything else is behavior-preserving and
gated by the existing suites plus the build and a browser check.

### Verify

Homepage: type a query, press Enter in AI mode twice quickly and confirm only
the last answer renders; press `/` anywhere and the search box focuses.

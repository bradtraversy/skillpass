# Feature: 14 - Docs & CLI onboarding

**From build-plan:** feature 14
**Branch:** `feature/14-docs-cli-onboarding`
**Date:** 2026-08-02

## What and why

The site referenced docs that did not exist: skill pages showed `skillpass
add` with no guide anywhere, and the passport asked for trust it never
explained. Four static docs pages, the nav menu items deferred from feature
12, and a footer that resolves open decision #623.

## Scope decisions (as shipped)

- **Four static Astro pages, no islands**, under a shared `DocsShell.astro`
  (sidebar with active states, one scoped prose stylesheet so page content
  stays semantic HTML):
  - `/docs` - what SkillPass is, the Skill Passport, the trust chain,
    advisory-not-gatekeeping stated plainly.
  - `/docs/validation` - statuses, risk levels, AI review, immutability,
    and the permission taxonomy table **rendered from `skill-schema`'s
    `PERMISSIONS` export at build time** - docs cannot drift from the
    validator.
  - `/docs/submitting` - ownership rule, the three recipes (single repo,
    `/tree/` subpath, pack) with file trees, the pipeline, zip fallback;
    `/submit` links to it below the recipe cards.
  - `/docs/cli` - all nine commands with examples, receipts/update story,
    `SKILLPASS_API`, exit codes; parallels the npm README (manual sync when
    commands change).
- **Nav**: Docs + CLI links with active states (`/docs*` vs `/docs/cli`).
- **Footer resolves #623**, minimal: "SkillPass - never blindly trust a
  skill" left; Docs / CLI / Submit / npm right; rendered on every page via
  `BaseLayout` (body became a min-height flex column).

## Build steps

- [x] **Step 1 - docs shell, index page, nav links** (`5f1b77b`)
- [x] **Step 2 - validation & permissions page** (`c0f75d3`)
- [x] **Step 3 - submitting guide** (`9a1433e`)
- [x] **Step 4 - CLI guide** (`96befcc`)
- [x] **Step 5 - footer everywhere** (`aaaade0`)

## Verification

- `pnpm build` green with all four docs pages emitted; `pnpm test` 870;
  `pnpm typecheck` clean.
- Built-HTML checks: all 19 `PERMISSIONS` keys render on
  `/docs/validation`; every CLI command has a section on `/docs/cli`; the
  footer appears in the built home, docs, and submit pages.
- Visual pass deferred to prod by choice at completion (no dev server run);
  content was verified in the built HTML, layout judged by code review.

## Follow-ups

- `/docs/cli` and the npm README need manual sync when commands change.
- Docs search / deep linking into taxonomy rows if the pages grow.

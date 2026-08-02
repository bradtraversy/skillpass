# Feature: 15d - CLI search

**From build-plan:** feature 15d
**Branch:** `feature/15d-cli-search`
**Date:** 2026-08-02

## What and why

`skillpass search [query] [--target <tool>] [--category <slug>] [--packs]
[--json]` - discovery from the terminal over the public `GET /skills` list,
so the CLI is not slug-only. Sequenced before the npm ship (15c) so v0
launches with discovery. No API changes.

## Scope decisions (as shipped)

- **Haystack**: the site's fields (`name`, `summary`, `maintainer`,
  `targets`, `packSkills`) plus `attributedTo` - a deliberate parity
  deviation found live: "trailofbits" displayed on 75 curated rows but
  matched nothing, because curated rows show the source repo owner while
  `maintainer` is the curating admin. The site has the same blind spot
  (candidate `/fix`).
- **Filters**: `--target` (TARGETS), `--category` (CATEGORY_SLUGS, unknown
  errors with the known list), `--packs`; all compose with the query, which
  is all positionals joined by a space.
- **Contract**: `publicSkillListSchema` added to `skill-schema`; parsed via
  the CLI's `getParsed`, so malformed responses error cleanly (exit 2).
- **Layout, iterated against real terminal runs**:
  - Wide TTY: aligned single-line table.
  - Narrow TTY: two-line entries (header + dimmed truncated tagline)
    separated by blank lines - added after a real narrow pane wrapped
    unreadably.
  - Piped/no TTY: full single-line rows, grep-safe. Width only read from
    `process.stdout.columns` on a TTY.
- **Color** (`style.ts`, dependency-free ANSI, honors `NO_COLOR`, off when
  piped): bold slug, yellow author, cyan `PACK n`, dim tagline/footer.
- **Risk display**: low is silent; only medium (yellow) and high/critical
  (red) render a marker - all-195-rows-say-"low" was noise. Columns nobody
  in the result set uses collapse entirely. `--json` keeps `riskLevel`.
- Exit codes: 0 results or clean empty match, 2 usage/network/contract.

## Build steps

- [x] **Step 1 - list contract and `runSearch`** (`fab661b`)
- [x] **Step 2 - wire into the CLI** (`1562561`)
- [x] **Step 3 - width-aware layout** (`28ed648`)
- [x] **Step 4 - color and bold** (`dbe3f4a`)
- Post-step iterations from live review: narrow-mode spacing + dim taglines
  + attributedTo search (`e3e8855`), silent low risk + yellow author
  (`1944647`).

## Verification

- `pnpm test` 824 passed (806 at branch point; search, style, schema, and
  parser coverage), `pnpm typecheck` and `pnpm build` green at completion.
- Live against prod: `search pdf` (4 of 195 aligned rows), `search --packs`
  (ai-blueprint PACK 19), `search trailofbits` (75 rows after the
  attributedTo fix), unknown category error listing the 12 slugs (exit 2,
  verified unpiped), no-match friendly line (exit 0), narrow-width renders
  at 45 and 60 columns with colors.

## Out of scope / follow-ups

Server-side search, pagination, sorting, fuzzy match. Follow-ups noted:
site search misses `attributedTo` (candidate `/fix`); extend the styler to
`report`/`scan` during 15c polish.

# Feature: Skill detail and passport UI

**From build-plan:** feature 2
**Status:** complete

## Goal

Give every seeded skill a real detail page at `/skills/[slug]`, built around the
headline artifact: a static **Skill Passport** (verdict, risk, source hash,
commit, permissions requested, and expandable findings), plus an install panel,
usage, files, versions, and a maintainer block. This is the page that proves the
product's core promise - inspect exactly what a skill asks an agent to do before
you install it. `Row.astro` already links here; this feature makes the link land
on a complete page.

## Design reference

- `prototypes/skill-detail.html` - the exact layout, section order, and markup to
  reproduce (subject is `pr-review-bot`, the warning case).
- `prototypes/theme.css` - design tokens. **Already ported** into
  `apps/web/src/styles/global.css` in feature 1, so there is no re-port step; this
  is the second page on the same theme. Color stays reserved for verdict / risk /
  accent, exactly as the tokens enforce.
- The content column is narrower than the homepage: the mock centers content at
  `max-width: 760px` inside the full-width nav. Match that.

## In scope

- Static route `apps/web/src/pages/skills/[slug].astro` with `getStaticPaths` over
  the fixtures (SSG, no SSR), one page per seeded skill.
- Detail fixtures (`SkillDetail`) extending the existing `Skill` contract with the
  per-skill data the passport needs, authored for **all 8** seeded slugs.
- Header block: monogram tile, name, summary, target tags, source repo link, and
  the large verdict stamp.
- Install panel: the `aiskills add <slug>` command with a working copy button, and
  a static "Download & pre-flight" button (behavior deferred to feature 8).
- The Skill Passport document: strip (title, version, immutable), fields grid
  (verdict, risk, targets, source hash, commit, validated), permissions-requested
  list, and expandable findings (native `<details>`).
- Supporting sections: Usage, Files, Versions (per-version verdict stamps),
  Maintainer, and footer.
- One derived helper `repoHandle(url)` (owner/repo from a GitHub URL) with tests,
  and a fixtures-integrity test.

## Out of scope

- `/skills/[slug]/[version]` version-pinned permalink - **feature 7** (immutable
  per-version passport). Versions here are static rows, not links.
- Real "Download & pre-flight" behavior and blocking of failed versions -
  **feature 8**. The button is a static styled anchor to `#`.
- Real validator-generated passports - **features 3/4/7**. All passport data is
  fixture data with the same *display shape* the real `SkillPassport` will feed.
- Maintainer profile page `/u/[username]` - **features 5/10**. The maintainer block
  is static and not linked to a profile.
- `lucide-react` / React islands - permission and section icons are inline SVG in
  Astro, consistent with `Nav.astro` and `Row.astro`. The only client JS is the
  copy button (a small bundled `<script>`, not a React island).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Detail fixtures + helper (logic).** Add `lib/skill-details.ts`:
  the `SkillDetail` type (and sub-types `PermissionEntry`, `Finding`,
  `SkillVersionRow`, `SkillFile`, `MaintainerInfo`), a `skillDetails` record
  keyed by slug covering **all 8** seeded skills, and `getSkillDetail(slug)`. Add
  `repoHandle(url)` to `lib/format.ts`. Payloads are proportional to verdict:
  passed/low skills get 1-2 permissions and zero findings; `pr-review-bot`
  (warning) and `auto-deploy-runner` (failed) carry findings. *Done when:*
  `pnpm test` is green including new `repoHandle` cases and a fixtures-integrity
  test (every `skills` slug has exactly one `skillDetails` entry and vice versa);
  `pnpm typecheck` passes. No UI yet.

- [x] **Step 2 - Route + header + install bar.** Create
  `pages/skills/[slug].astro` (`getStaticPaths` over `skills`, passing the base
  `Skill` and its `SkillDetail`), plus `DetailHeader.astro` (monogram tile via
  `monogram()`, name, summary, target tags, repo link via `repoHandle()`, large
  verdict stamp) and `InstallBar.astro` (copy command + working copy button,
  static Download button to `#`). Factor the verdict->tint map so `Stamp.astro`
  and the large header stamp share it (no duplicated color map). *Done when:*
  every homepage row navigates to a working page showing header + install bar; the
  large stamp text and tint match verdict (passed VERIFIED, warning WARNING /
  REVIEW REQ'D, failed FAILED / BLOCKED); clicking copy puts the command on the
  clipboard; `pnpm build` generates a page per skill.

- [x] **Step 3 - Passport document.** `Passport.astro` composing the strip
  (title, passport version, immutable), the 6-field grid (verdict, risk level,
  targets, source hash, commit, validated), the permissions-requested list
  (`PermissionRow.astro` - icon by key with a fallback, key, description, LOW/MED/
  HIGH level badge), and findings (`Finding.astro` using `<details>`/`<summary>`,
  severity-tinted icon, optional code reference block). *Done when:* the passport
  renders with the correct verdict tint on strip + fields; permission rows show
  level badges; findings expand and collapse with zero JS; a passed skill (e.g.
  `commit-message-writer`) shows the permissions list and **no findings section**;
  `pr-review-bot` matches the mock; `pnpm build` passes.

- [x] **Step 4 - Supporting sections + footer.** Add the Usage, Files, Versions
  (rows reuse `Stamp.astro` for per-version PASS/WARN/FAIL), and Maintainer blocks
  (username, reputation, skill count, joined), plus the back-to-directory link and
  footer pinned to the source hash. *Done when:* all four sections render from
  fixtures for every skill; the failed skill (`auto-deploy-runner`) shows a FAIL
  version stamp and a failure finding; a full-page screenshot matches the mock's
  section order; `pnpm build` passes.

## Files / areas

- **New** `apps/web/src/pages/skills/[slug].astro` - the SSG detail route.
- **New** `apps/web/src/lib/skill-details.ts` - `SkillDetail` + sub-types,
  `skillDetails` fixtures (all 8 slugs), `getSkillDetail(slug)`.
- **New** `apps/web/src/lib/skill-details.test.ts` - fixtures-integrity test.
- **New** components under `apps/web/src/components/skill/`: `DetailHeader.astro`,
  `InstallBar.astro`, `Passport.astro`, `PermissionRow.astro`, `Finding.astro`.
  (Usage / Files / Versions / Maintainer are inline sections in the page - simple,
  no reuse pressure - and Versions rows reuse `Stamp.astro`.)
- **Changed** `apps/web/src/lib/format.ts` (+`repoHandle`) and
  `apps/web/src/lib/format.test.ts` (+`repoHandle` cases).
- **Unchanged** `Row.astro` already links to `/skills/${slug}`; `Nav.astro` is
  reused as-is (do not rebuild the mock's slightly different nav).

## Data / contracts

`SkillDetail` is **fixture-level and provisional**, the same status as `Skill`:
aligned with, and superseded by, `packages/skill-schema` at feature 3. To cut
feature-3 churn, name fields to echo the overview's `SkillPassport` /
`ValidationReport` shapes:

```ts
export interface PermissionEntry { key: string; description: string; level: RiskLevel; }
export interface Finding {
  title: string;
  body: string;
  severity: 'warning' | 'failure';
  code?: { location: string; snippet: string; highlight?: string };
}
export interface SkillVersionRow { version: string; verdict: Verdict; date: string; current?: boolean; }
export interface SkillFile { name: string; size: string; }        // size as display string
export interface MaintainerInfo { username: string; reputation: number; skillCount: number; joined: string; }
export interface SkillDetail {
  slug: string;                 // FK to Skill.slug
  version: string;              // current passport version, e.g. 'v2.1.0'
  githubRepoUrl: string;
  sourceHash: string;           // short display hash (-> SkillPassport.sourceHash)
  resolvedCommitSha: string;    // short display sha (-> SkillVersion.resolvedCommitSha)
  validated: string;            // display, e.g. '3 days ago'
  usage: string;
  permissions: PermissionEntry[];   // -> SkillPassport.permissionsSummary
  findings: Finding[];              // -> SkillPassport.warningsSummary + failures
  files: SkillFile[];
  versions: SkillVersionRow[];
  maintainerInfo: MaintainerInfo;
}
```

- Reuse the existing `Verdict` and `RiskLevel` unions from `lib/skills.ts` - do not
  redefine them.
- The base `Skill` contract is unchanged; the page composes `Skill` + `SkillDetail`.
- Dates and file sizes are baked display strings (matching the `lastValidated:
  '2d ago'` convention already in `skills.ts`); no date/byte formatters this
  feature.

## Testing

`AGENTS.md` declares a `test` command, so the gate is on. This feature is mostly
UI (Astro components, one route), which rides on **screenshot + `pnpm build`** per
the Testing gate in `coding-standards.md`. The logic-bearing bits get real tests:

- `repoHandle(url)` in `format.test.ts` - owner/repo extraction with edge cases:
  trailing slash, `.git` suffix, plain `https://github.com/owner/repo`, and a
  non-GitHub or malformed URL (defined fallback, decided in Step 1 and asserted).
- `skill-details.test.ts` - fixtures integrity: every slug in `skills` has exactly
  one `skillDetails` entry and there are no orphan detail entries. This guards
  `getStaticPaths` against a skill with no detail page.
- UI steps (2-4) are verified by driving the page in the browser and a full-page
  screenshot against `prototypes/skill-detail.html`, plus a green build. No unit
  tests for the `.astro` components.

## Notes for the AI

- **Astro-first, zero JS** except the InstallBar copy button, which is one small
  bundled `<script>` (querySelector + `navigator.clipboard.writeText`), not a
  React island - a copy button does not justify hydrating React on an otherwise
  static page. Flag it if you disagree before building.
- **SSG only:** `getStaticPaths` returns all slugs; no SSR, no runtime data
  fetching (front end is static, per `coding-standards.md`).
- **Reuse, don't duplicate:** `Stamp.astro` (version rows, and its tint logic for
  the large header stamp - extract the shared verdict->tint map rather than copy
  it), `monogram()` and `formatInstalls()` from `format.ts`, and the theme tokens
  (color only for verdict/risk/accent).
- **Large header stamp labels** by verdict: passed -> `VERIFIED` / `PASSED`,
  warning -> `WARNING` / `REVIEW REQ'D`, failed -> `FAILED` / `BLOCKED`. Hidden
  below ~620px, as in the mock.
- **Permission icons:** inline SVG chosen by key prefix (`filesystem`, `network`,
  `env`, `shell`) with a fallback icon for unknown keys. Do not add lucide-react.
- **Monogram consistency:** reuse `monogram()` so the detail header matches the
  homepage rows. The mock's hand-picked initials (`PR`, `MC`) are cosmetic; the
  derivation is the accepted behavior unless we later add an override map (open
  question, deferred).
- **Every slug needs a detail entry** - the integrity test enforces it so
  `getStaticPaths` never emits a broken page.

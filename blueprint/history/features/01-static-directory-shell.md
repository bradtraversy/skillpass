# Feature: Static directory shell

**From build-plan:** feature 1
**Status:** not started

## Goal

Stand up the public homepage as the directory itself: top nav, a centered hero
with search, and a dense, filterable "inspection log" of skills rendered from
fixture data. It's the first screen of the product and the foundation every later
visual feature builds on. No backend, no DB - fixtures only.

## Design reference

The look is locked in the prototypes (built with `/prototype`, verified against
cursor.directory and deliberately distinct from stackmaven.io):

- `prototypes/homepage.html` - the exact target for this feature.
- `prototypes/theme.css` - the design tokens (warm-graphite base, iris accent,
  verdict semantics). **Source of truth for color, type, and spacing.** Step 1
  ports these into the app's global `@theme`.

`prototypes/skill-detail.html` and `prototypes/upload.html` are references for
features 2 and 5/6, **not** this one. Prototypes get discarded at this feature's
`/complete`.

## In scope

- Tailwind v4 (CSS-first `@theme`) installed and the `theme.css` tokens ported in.
- A base layout and the top nav (wordmark + Browse / Validator / Docs / CLI /
  Submit).
- A typed fixture dataset of ~8 skills with mixed verdicts and risk levels.
- Centered hero: eyebrow pledge, headline, lede, search input, stats runline.
- The inspection-log list: ranked rows with monogram, name + tool tags, summary,
  verdict stamp (PASS / WARN / FAIL), risk, and install/validated meta - matching
  `homepage.html`.
- Trending / New / Verified / Workflow-packs tabs and a Filter / Tool / Verdict
  control row (static presentation).
- Client-side **search and filtering** over the fixtures (one React island),
  including the empty state.

## Out of scope

- Skill detail pages and the Skill Passport (feature 2).
- Any real data, DB, API, auth, or submission flow (fixtures only).
- Versions, pagination, sorting beyond the fixture order, and a real search
  backend.
- Deep accessibility and pixel-perfect mobile - desktop-first per the mockup;
  keep the prototype's basic responsive behavior, don't gold-plate it.
- shadcn/ui setup (not needed until form-heavy islands later).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Tailwind v4 + theme port** - Install Tailwind v4 (CSS-first, no
  `tailwind.config.js`) and port `prototypes/theme.css` tokens into a global
  stylesheet `@theme` block (colors, verdict semantics, fonts, radii; keep
  rgba/shadow values as CSS vars where cleaner). Import the global stylesheet in
  `index.astro` for now (Step 2's `BaseLayout` takes over the import). Load the
  Geist/Inter and mono fonts (e.g. `@fontsource-variable/geist`) or accept the
  system fallback - match the prototype. *Done when:* `pnpm dev` renders a probe
  element styled by a theme token (page background `--bg`, iris accent) at the
  right colors, and `pnpm build` passes.
- [x] **Step 2 - Base layout + top nav** - `BaseLayout.astro` (html shell, font
  stacks, global CSS, `<slot/>`) and `Nav.astro` (wordmark with the rotated stamp
  glyph, Browse / Validator / Docs / CLI links, Submit a skill). *Done when:* `/`
  shows the nav matching `homepage.html`, ships zero client JS, build passes.
- [x] **Step 3 - Fixture data + Skill type** - `src/lib/skills.ts` exporting a
  typed `Skill[]` (~8 entries: mixed `passed`/`warning`/`failed`, low->critical
  risk, varied tools/categories) and the `Skill` type. *Done when:* a temporary
  render of `skills.length` shows the count on the page and `pnpm build` passes
  (types compile).
- [x] **Step 4 - Hero (static)** - `Hero.astro`: eyebrow pledge ("never trust a
  skill blindly"), headline, lede, the search input shell, and the stats runline.
  *Done when:* the hero renders matching `homepage.html` (static, no JS yet).
- [x] **Step 5 - Inspection-log list + presentational components (static)** -
  `Stamp.astro` (verdict), `Row.astro` (rank, monogram, name+tags, summary,
  verdict, risk, meta), and a static list rendering all fixtures under the
  Trending/New/Verified tabs and Filter/Tool/Verdict bar. *Done when:* all fixture
  skills render as rows with the correct verdict stamps and risk colors matching
  `homepage.html`; build passes.
- [x] **Step 6 - Search + filter island** - Move the search input, tabs, filter
  controls, and the results list into one React island (`Directory.tsx`) that
  filters the fixtures client-side by query and by verdict/tool, with the
  "No skills match these filters." empty state. Hydrate `client:visible`; keep the
  hero heading and nav static. Extract the filter predicate as a pure function in
  `src/lib` so it's unit-testable later. *Done when:* typing in search narrows the
  rows live, verdict/tool filters work, the empty state shows when nothing matches,
  the island hydrates, and the rest of the page stays zero-JS.

## Files / areas

- `apps/web/package.json`, Tailwind v4 setup, `apps/web/src/styles/global.css`
  (or equivalent) with the `@theme` block.
- `apps/web/src/layouts/BaseLayout.astro`
- `apps/web/src/components/nav/Nav.astro`
- `apps/web/src/components/home/Hero.astro`
- `apps/web/src/components/skill/Stamp.astro`, `Row.astro`
- `apps/web/src/components/home/Directory.tsx` (the one React island) + a pure
  `filterSkills` helper in `src/lib/`
- `apps/web/src/lib/skills.ts` (fixtures) and the `Skill` type
- `apps/web/src/pages/index.astro` (composes layout + hero + directory)

## Data / contracts

**Load-bearing** - feature 2 (detail + passport) reuses this shape, so define it
deliberately. Local to `apps/web/src/lib` for now; it aligns with, and gets
superseded by, the canonical schema in `packages/skill-schema` at feature 3.

```ts
type Verdict = 'passed' | 'warning' | 'failed';        // matches overview status
type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
type Target = 'codex' | 'claude-code' | 'cursor' | 'cowork' | 'aider';

interface Skill {
  slug: string;
  name: string;
  summary: string;
  targets: Target[];
  verdict: Verdict;          // Stamp renders PASS / WARN / FAIL
  riskLevel: RiskLevel;
  category: string;
  tags: string[];
  maintainer: string;        // username
  installs: number;
  lastValidated: string;     // display string for fixtures (e.g. "2d ago")
}
```

## Testing

No `test` command is declared in `AGENTS.md`, so **tests are not a gate** for this
feature. It's UI plus one interactive island, which `coding-standards.md` says to
verify with screenshot + build, not unit tests.

- Per step: the observable *Done when* above, confirmed in the browser (drive it
  with `/check`) and a green `pnpm build`.
- The only real logic is the client-side filter. Extract it as a pure
  `filterSkills(skills, query, filters)` in `src/lib` so that **if** a runner is
  added later (e.g. `/fix "add unit testing"`), it's the natural first unit test
  (empty query, no-match, verdict/tool combinations). For now, verify it live.

## Notes for the AI

- **Astro static by default; exactly one React island** (`Directory.tsx`,
  `client:visible`). Nav and hero heading stay zero-JS Astro. Don't hydrate the
  whole page.
- **Tailwind v4 CSS-first**: tokens live in the global `@theme`, no
  `tailwind.config.js`. Pull colors/spacing from the ported tokens, never
  hard-coded hexes - that's what keeps parity with `theme.css`.
- **Build to `homepage.html`.** It's the exact target: warm-graphite base, iris
  accent, verdict stamps as the anchor, monospace for inspection data (tags,
  hashes, meta). Verdict semantic colors come from the theme tokens.
- Icons: inline SVG in Astro components (as the prototype does); `lucide-react` is
  fine inside the island. No shadcn for this feature.
- Keep the `Skill` fixture type clean - feature 2 imports it, so treat it as a
  contract, not throwaway.
- Desktop-first; keep the prototype's basic responsive behavior, don't over-invest.
- `apps/web` already has `@astrojs/react` wired, so no integration setup is needed
  for the island.

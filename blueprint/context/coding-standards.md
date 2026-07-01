# Coding Standards

> Conventions for this project: a pnpm monorepo with an Astro + React-islands web
> app (`apps/web`) and shared workspace packages (`packages/*`). Some stack
> choices are still open and marked `> TODO`; tighten them as they land.

## TypeScript

- Strict mode is on (`apps/web` extends `astro/tsconfigs/strict`)
- No `any` types - use proper typing or `unknown`
- Define interfaces/types for component props, API responses, and data models
- Use type inference where obvious, explicit types where helpful
- Shared types that cross package boundaries belong in a workspace package (e.g.
  `packages/skill-schema`), not duplicated per app

## Astro and React islands

- Astro components (`.astro`) are the default and render to static HTML with zero
  client JS. Reach for them first.
- Use React only for genuine interactivity (search filters, upload form,
  validation progress, account menu, dashboard widgets, download pre-flight).
- Ship islands intentionally: add a `client:*` directive only when a component
  needs to hydrate. Prefer `client:idle` or `client:visible` over `client:load`
  unless the island must be interactive immediately.
- React components: functional only, hooks for state and effects, one job per
  component, reusable logic in custom hooks.
- The front end is static: Astro fetches at build time, and all live data and
  secrets (DB, R2, tokens) live in the `apps/api` backend, never in `apps/web`.
  Pass islands the minimal props they need.

## Project Structure

- Monorepo managed by pnpm workspaces (`apps/*`, `packages/*`)
- Web app (static front end): `apps/web`
  - Pages/routes: `apps/web/src/pages/[route].astro`
  - Layouts: `apps/web/src/layouts/`
  - Astro components: `apps/web/src/components/[feature]/Name.astro`
  - React islands: `apps/web/src/components/[feature]/Name.tsx`
  - Content collections (if used for docs/seed data): `apps/web/src/content/`
  - Lib/utils: `apps/web/src/lib/`
- API/backend (Node, Hono): `apps/api` - GitHub OAuth, submissions, validation
  job orchestration, and the worker. All DB (Drizzle/Neon), R2, and queue access
  lives here, never in `apps/web`.
- Shared packages (per the plan): `packages/validator`, `packages/skill-schema`,
  `packages/cli`, and later `packages/queue`. Keep cross-cutting logic (schemas,
  the validator, CLI) in packages so the web app and CLI share one source of truth.
- Dynamic routes for skill/version/maintainer pages.

## Naming

- Components: PascalCase (`SkillCard.astro`, `SearchFilters.tsx`)
- Files: match the component name, otherwise kebab-case
- Functions: camelCase
- Constants: SCREAMING_SNAKE_CASE
- Types/Interfaces: PascalCase (no prefix)
- Package names: kebab-case matching the directory (`skill-schema`)

## Styling

- Tailwind CSS for styling. **> TODO: not installed yet** - add it as a build
  step (`pnpm astro add tailwind`) before styling work; use Tailwind v4 CSS-first
  config (`@theme` in the global stylesheet), no `tailwind.config.js`.
- shadcn/ui components where they fit React islands.
- lucide-react for icons.
- No inline styles.
- The homepage is the directory itself (cards for featured/trending, compact rows
  for dense search results), not a marketing page. Fast, sharp, security-aware.

## Database

- Neon Postgres.
- ORM: Drizzle. Use it for all DB access from `apps/api`, keep schema changes in
  versioned migrations, and verify migration status before committing.
- Auth is GitHub OAuth. Scope every user-owned query by the authenticated
  GitHub user id from the session; never trust a client-supplied user id.
- Keep credentials out of the repo. Uploaded zips and normalized source
  snapshots live in object storage (Cloudflare R2), not the database.

## Data Fetching and Validation

- Astro is static: pages fetch at build time (from the API or DB) and render to
  HTML. Runtime dynamic data comes from the API, not Astro.
- React islands call the `apps/api` backend over HTTP; they never import
  server-only code (DB client, R2, secrets).
- Validate all external input (submissions, API bodies, CLI args) with Zod, using
  schemas shared from `packages/skill-schema` where they cross boundaries.

## Error Handling

- Use try/catch in API endpoints and any server action helpers.
- Return a consistent `{ success, data, error }` shape from those helpers.
- Surface user-friendly messages in the UI (toast or inline panel); log the real
  error server-side.

## Testing

The blueprint installs no test runner; testing is opt-in at the project level,
because the overlay can't know your stack. Adding unit testing is an explicit
setup task the AI can do through the normal workflow, either as a build-plan item
or with `/fix "add unit testing"`. The setup should choose the stack-native
runner, wire the scripts or commands, add a small example test, and update the
Commands section of `AGENTS.md`.

**The opt-in switch is one signal: a `test` command in the Commands section of
`AGENTS.md`.** Declare one and **tests become a gate for logic-bearing steps**,
not an optional extra; leave it out and the loop verifies logic with the evidence
it already uses (run it, a screenshot, the build). Adding the runner is itself a
deliberate step, never a silent mid-step install. This is the single definition
of the switch; the skills and `ai-interaction.md` only point back here.

- **What to test (the scope rule):** pure logic where a wrong answer is possible -
  the validator, manifest/report parsers, permission taxonomy, id/slug builders,
  source-hash logic, API handlers. These have assertable inputs and outputs and
  real edge cases (empty, missing, malformed).
- **What not to test:** UI components and integration-level surfaces (Astro pages,
  React islands, anything driving a real browser or external service). Verify
  those with a screenshot and the build, not brittle unit tests.
- **The gate (when a runner is configured):** a build step that adds in-scope logic
  must ship a passing test in the same reviewable diff. The project's test command
  must be green before the step is approved, before any checkpoint commit, and
  before `/complete` merges. UI and integration-only steps are exempt and ride on
  screenshot plus build evidence.
- **When it's named:** the `/feature` spec's Testing section predicts the coverage,
  `/implement` writes the test with the step, and if a step surfaces logic the spec
  didn't foresee, add a focused test then.
- An empty suite should fail, not pass, so "no tests ran" never looks like "passed".
- Test files live next to source files (for example `validator.test.ts`).
- Run them via the project's test command (see Commands in `AGENTS.md`), not a
  hardcoded tool name.

Stack binding: this is a TypeScript monorepo, so the natural runner is Vitest
(one config covering `apps/*` and `packages/*`), with `vi.mock()` for external
dependencies (the DB client, R2, GitHub, the queue) and `vi.useFakeTimers()` for
time-dependent logic. The validator and schema packages are the highest-value
test targets.

## Code Quality

- No commented-out code unless specified
- No unused imports or variables
- Keep functions under 50 lines when possible

## Comments

Write code that explains itself; comment only what the code cannot say.
Over-commenting is a common AI tell, so resist it.

- Comment the **why**, not the **what**. Delete any comment that restates the code.
- No banner/header blocks, section dividers, or step-by-step narration of obvious
  code. A file does not need a comment announcing each region.
- A comment earns its place only when it captures something the code can't: a
  non-obvious decision, a gotcha or workaround, why a value is what it is, or a
  link to a spec or issue.
- Prefer self-documenting names and small functions over explanatory comments.
- Keep doc comments minimal: a one-line purpose on an exported type or function is
  plenty; don't write JSDoc that just repeats the signature.
- When in doubt, leave the comment out.

## Writing

- No em dashes (U+2014) in generated content: docs, comments, commit messages,
  READMEs, specs. They read as AI-generated.
- Use a hyphen for `term - description` separators; rephrase prose with commas,
  parentheses, or a colon. Avoid en dashes and the ellipsis character too.

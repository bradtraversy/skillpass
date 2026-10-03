# Feature: Public API docs

**From build-plan:** feature 28
**Build attempt:** 1

**Status:** verified
**Branch:** feature/public-api-docs

## Goal

A `/docs/api` page that documents the existing public read endpoints so anyone can build on the directory: the Skill Passport JSON first, then list, detail, version, pre-flight, and search, with response fields taken from `skill-schema` and the real error and rate-limit behavior. No auth, no new endpoints, no API change.

## In scope

- A static docs page at `/docs/api` in the existing `DocsShell`, titled "Public API".
- Intro: base URL `https://api.skillpass.dev`, read-only JSON, no auth, the response envelope (`{ "success": true, "data": ... }` and `{ "success": false, "error": "<message>" }`), and the browser rule from `apps/api/src/app.ts`: CORS allows only the SkillPass web origin, so other sites call the API from a server, a script, or the CLI, not from browser JavaScript.
- The Skill Passport as the headline section: what it is, a field table for `skillPassportSchema`, a trimmed example, and where it appears (`data.passport` on the detail and version responses).
- One section per endpoint, each with method and path, a `curl` example, what it returns, and its status codes:
  - `GET /skills` - every published skill in one array, no pagination; featured listings first by rank, then newest first. Field table for `publicSkillSummarySchema`.
  - `GET /skills/:slug` - the summary fields plus the detail-only fields of `publicSkillDetailSchema` (pack members, repo URL, passport, maintainer info, versions, AI review). 404 for an unpublished or unknown slug.
  - `GET /skills/:slug/:version` - the same shape pinned to one version; 404 for an unknown version.
  - `GET /skills/:slug/:version/preflight` - field table for `publicPreflightSchema`; `blocked` is true when validation failed, `diff` is null for the first published version, `sourceVerified` compares the stored snapshot to the pinned hash; 404, and 502 when the snapshot store is unreachable.
  - `GET /skills/search?q=` - semantic search, `q` 1 to 500 characters, up to 20 summaries ordered by similarity with no relevance cutoff; 400, 429, 502, 503.
- Errors and rate limits: a status table (400, 404, 429, 500, 502, 503) with the real messages. Only search is rate limited, at 20 requests per minute per client IP (`createRateLimiter(20, 60_000)`).
- Compatibility note from the `skill-schema` read contracts: new fields can appear, so ignore unknown keys; the optional summary fields (`noteCount`, `category`, `displayName`, `tagline`, `integrations`, `packSkills`, and `packMembers` on detail) can be missing.
- Links: a "Public API" entry in the `DocsShell` sidebar after "The skillpass CLI", `/docs/api` in `STATIC_ROUTES` for the sitemap, and a line in the docs index "Where to go next" list.

## Out of scope

- Any API change: new endpoints, CORS changes, auth, API keys, pagination, caching headers.
- `GET /skills/:slug/:version/source`, `/download`, `/skills/:slug/badge.svg`, `GET /users/:username`, and every authenticated or write route. The plan names five endpoints; the badge is already documented on the submitting page.
- An OpenAPI file, a generated JSON Schema download, or an interactive try-it console.
- Footer and top-nav links.

## Build loop

`blueprint/config.json` is absent, so defaults apply: `workflow.stepReview: "feature"` (one review packet after both steps) and checkpoint commits disabled. `/complete` creates the single feature commit. `pnpm verify` must be green before the review packet.

## Build steps

- [x] 1. **Field docs module with a drift test.** Add `apps/web/src/lib/api-docs.ts` holding, for each documented object (passport, summary, detail-only fields, version entry, pre-flight), an ordered list of `{ name, type, description }` rows, plus one typed example payload per endpoint (`satisfies` the `skill-schema` type). Enum type labels come from `VALIDATION_STATUSES`, `RISK_LEVELS`, and `TARGETS`, not retyped strings. Add `apps/web/src/lib/api-docs.test.ts`: each row list's names equal `Object.keys(<schema>.shape)` (detail-only rows equal the detail keys minus the summary keys), and every example parses with its schema (`skillPassportSchema`, `publicSkillListSchema`, `publicSkillDetailSchema`, `publicPreflightSchema`). **Done when** `pnpm test` passes with the new tests, and adding a field to one of those schemas would fail the key test.
- [x] 2. **The `/docs/api` page and its links.** Add `apps/web/src/pages/docs/api.astro` rendering the sections above from `api-docs.ts` (field tables, examples as `JSON.stringify(example, null, 2)` in `<pre><code>`), add the sidebar entry in `DocsShell.astro`, `/docs/api` in `STATIC_ROUTES`, and the docs index link. **Done when** `pnpm verify` is green, the built `/docs/api` HTML contains all five endpoint paths and every passport field name, the sidebar highlights "Public API" on the page, and a browser-pane check at desktop and 375 px width shows no horizontal page scroll (tables and code blocks scroll inside their own box).

## Files / areas

- `apps/web/src/lib/api-docs.ts`, `apps/web/src/lib/api-docs.test.ts` (new)
- `apps/web/src/pages/docs/api.astro` (new)
- `apps/web/src/components/docs/DocsShell.astro` (sidebar entry)
- `apps/web/src/lib/sitemap.ts` (`STATIC_ROUTES`)
- `apps/web/src/pages/docs/index.astro` ("Where to go next")
- Read only: `packages/skill-schema/src/{passport,public,preflight,enums}.ts`, `apps/api/src/routes/skills.ts`, `apps/api/src/routes/rate-limit.ts`, `apps/api/src/app.ts`

## Data / contracts

- Response shapes are the `skill-schema` read schemas as they are today; this feature documents them and changes none.
- Envelope: success `{ success: true, data }`; failure `{ success: false, error }` with messages from `skills.ts` and `app.ts`: `not found` (404), `q must be 1-500 characters` (400), `Too many requests, slow down.` (429), `AI search is temporarily unavailable` (502), `AI search is not configured` (503), `internal error` (500). The pre-flight 502 message comes from `snapshotOr502`; read it there rather than guessing.
- Enum values: validation status `passed | warning | failed`; risk level `low | medium | high | critical`; targets from `TARGETS`. Permission keys link to the taxonomy table on `/docs/validation` instead of being repeated.
- Example payloads are illustrative, labelled as examples, and must parse with the real schemas.

## Testing

- Step 1 is logic-bearing: `api-docs.test.ts` covers key parity with the schemas and example validity.
- Step 2 is a UI page: it rides on `pnpm verify` (astro check plus build), the existing sitemap test (it iterates `STATIC_ROUTES`, so the new route is covered), a grep of the built HTML, and a pane screenshot. No browser test command exists, so no browser test is added.

## Notes for the AI

- Follow the existing docs page voice and markup (`docs/cli.astro`, `docs/validation.astro`): plain `<h2>`, `<p>`, `<table>`, `<pre><code>`; the validation page already renders a table from `skill-schema` and is the pattern to copy.
- `api-docs.ts` imports only constants and types at runtime; the schemas are imported in the test, so the page ships no zod.
- Field descriptions are plain sentences from the schema comments and route code; do not promise stability, versioning, or limits the code does not enforce.
- Do not start a dev server; ask Brad when the pane check needs one.

## Verification

- `pnpm verify` green on `feature/public-api-docs`: lint, format check, typecheck, all tests, build.
- `apps/web/src/lib/api-docs.test.ts`: field names match the `skill-schema` shapes for the passport, summary, detail-only, version, and pre-flight tables; all five examples parse with the real schemas.
- Built `apps/web/dist/client/docs/api/index.html`: all five endpoint paths and all 14 passport field names present; the "Public API" sidebar entry is active on the page.
- Browser pane on Brad's dev server (`localhost:4321/docs/api`) at 375 px: document scroll width equals client width (375); tables and code blocks scroll inside their own boxes. Brad reviewed the page at desktop width.
- Examples are trimmed from the live `pdf` listing (`GET /skills/pdf` and `GET /skills/pdf/1.0.0/preflight`, 2026-10-03).
- Found, not changed: the shared site header overlaps at 375 px on every page ("SkillPass" runs into "Docs", "Sign in" is clipped). A `/fix` candidate.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":8415,"specSha256":"cd7caddbeeea57c450ac18053f7fd18a60b9bba5aa409fa22dbd5df1ab08d4fa","branch":"refs/heads/feature/public-api-docs","head":"75079b36d3ae921efcc581759b7488135a7892e7","baseRef":"refs/heads/main","baseCommit":"75079b36d3ae921efcc581759b7488135a7892e7","sourceTree":"d6bbbdaacad8489c80d342ef2ba4d023e21c440c","absentOptional":[]} -->

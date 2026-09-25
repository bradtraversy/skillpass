# SkillPass - Project Overview

<!-- blueprint:source-hash 9ff9bc35aacbeb2bd8877671eedb12fd9efc4503c48299e5a61545befc3d671c -->

> A public, validation-first directory of AI agent skills: discover a skill, see
> which tools it targets, and inspect exactly what it asks an agent to do before
> you install it. Core rule: never blindly trust a skill.

## Problem

AI agent skills are becoming reusable software artifacts, but they're scattered
across GitHub repos, dotfiles, docs, gists, and tool-specific ecosystems. There's
no trusted place to discover them, see which agent tools they work with, or
inspect what they instruct an agent to do before installing. This directory fixes
that by pairing discovery with built-in validation, so every listed skill ships a
reviewable safety summary (a Skill Passport) rather than asking for blind trust.

## Users

- **Developers using AI coding tools** (Codex, Claude Code, Cursor, Cowork, Aider,
  and similar) - the primary audience; browse, search, inspect passports, and
  install. Anonymous by default.
- **Skill authors / maintainers** - sign in with GitHub to submit skills, manage
  listings, and build reputation. May only submit repositories they own or org
  repositories where their GitHub org membership is public.
- **Tool maintainers and teams** - want a reviewable way to adopt shared AI
  workflows.
- **Admins** - triage failed or flagged submissions in a holding queue; may
  submit any repository as a curated listing (attributed to the source repo
  owner via `skills.attributedTo`).

Access tiers: anonymous (browse, search, inspect, download pre-flight), signed-in
maintainer (submit, manage, profile), admin (review queue, manual states).

## Features

MVP feature set in build-plan order, one line of purpose each. **Validation (the
Skill Passport) is the headline feature** - it's what makes this more than a link
list. Items 1-19 and 20a-20b are shipped; 20c and 21-29 are next.

1. **Static directory shell** - Astro homepage, layout, nav, seeded skills, and search/filter/featured UI on fixture data.
2. **Skill detail and passport UI** - detail pages with the Skill Passport, permissions summary, install panel, versions, maintainer block, and expandable findings.
3. **Manifest and report schemas** - `skill.json`, the validation report schema, permission taxonomy, statuses, risk levels, targets, variants, and packs in `packages/skill-schema`.
4. **Validator V0 with fixtures** - `packages/validator` reads `SKILL.md` and manifests, detects basic risks, and emits pass/warning/failed reports.
5. **Submission draft flow** - GitHub OAuth, GitHub-URL submission (primary) and zip upload (fallback), Neon draft records, R2 snapshots.
6. **Queue-backed validation** - Redis + BullMQ worker, job records, a job-status API, and the inline validation progress panel.
7. **Publishable skill flow** - passed submissions publish; every version gets a public immutable Skill Passport and a source view pinned to the source hash.
8. **Download pre-flight** - endpoint + UI showing current validation, source hash, permissions, permission diffs; failed versions are blocked.
9. **CLI scan and report** - `skillpass scan` and `skillpass report` sharing the validator, readable and JSON output.
10. **Reputation and admin** - maintainer reputation, public profiles, abuse reports, the admin holding queue, and manual review states.
11. **Launch seed** - `db:seed` publishes a curated set through the real submit, validate, publish pipeline.
12. **Navigation and shell wiring** - placeholder nav removed; the shell is logo, Submit, and account.
13. **Homepage ranking and curation** - admin-set Featured and Verified flags, New by recency, and workflow packs published as one listing with member skills.
14. **Docs and CLI onboarding** - docs on the passport, validation, the permission taxonomy, submitting, and the CLI guide.
15. **CLI install lifecycle** - `add` (pack-aware), `remove`, `list`, `search`, `outdated`, and `update` behind the pre-flight gate with per-area receipts; shipped to npm as `skillpass`.
16. **Maintainer dashboard** - authed `/dashboard` for your listings, submissions, and reports.
17. **Category browse** - a 12-slug taxonomy, Haiku classifier with backfill, and the filter sidebar.
18. **AI skill review** - Haiku reads each version and adds a plain-English summary and safety verdict to the passport, once per source hash, injection-hardened.
19. **Works-with integrations facet** - a fixed vocabulary of external tools a skill touches, Haiku-classified, filterable from the sidebar.
20. **AI semantic search** - pgvector embeddings per published version and a rate-limited `GET /skills/search?q=` behind a Keyword | AI toggle; the CLI `search --ai` flag (20c) is still open.
21. **Multi-agent install targets** - a CLI-local install registry (claude-code, codex, cursor, windsurf, github-copilot, gemini-cli, cline, opencode) with project and user-level folders from each tool's docs, repeatable `--target` on `add`, shared folders reported once, and layout-family mapping for declared-target warnings and pack variants. `skill-schema` `TARGETS` is unchanged.
22. **Install from any repo with local pre-flight** - `skillpass add github:<owner>/<repo>[/<path>]` runs the validator locally, shows the same pre-flight, then installs with a receipt marked unlisted. Never lists or submits.
23. **Passport badge for READMEs** - an SVG badge endpoint with the latest version's validation status and risk level, plus the markdown snippet on the detail page and docs.
24. **Prompt install tab** - a pasteable agent instruction beside the `skillpass add` command on the detail page, same slug and version pin.
25. **Per-agent landing pages** - one page per install tool: what it reads, the install command, and the directory filtered to compatible skills.
26. **Official page** - first-party maker listings from the existing `verified` flag and `attributedTo`, grouped by source org.
27. **Source-owner pages** - a page per GitHub org or user listing every published skill attributed to or maintained by them.
28. **Public API docs** - `/docs/api` documenting the existing read endpoints with the passport JSON as the headline. No auth, no new endpoints.
29. **`skillpass init`** - scaffold a skill package that passes `skillpass scan` out of the box.

## Data model

Concrete shapes derived from project-plan section 4 and the features above.
ORM is Drizzle; shapes are written plainly and map directly to Drizzle tables.
Ids are the DB's native id type. These live in the API/backend (`apps/api`), not
the static front end.

### User

- `id` - primary key
- `githubId` (string, unique) - from GitHub OAuth
- `username` (string, unique) - GitHub handle / slug
- `displayName` (string)
- `avatarUrl` (string)
- `role` (enum: `user` | `maintainer` | `admin`)
- `reputation` (int) - rolled up from ReputationInput
- `createdAt` (datetime)
- Relationships: maintains many **Skill**, files many **Submission** and
  **AbuseReport**. Maintainer profile fields live here (v1); split into a 1:1
  `MaintainerProfile` only if it grows.

### Skill (the logical listing)

- `id`
- `slug` (string, unique) - from the id/slug builder
- `name` (string), `summary` (string)
- `maintainerId` -> User
- `attributedTo` (string, nullable) - GitHub login of the source repo owner when
  an admin curates someone else's repo
- `categoryId` -> Category
- `latestVersionId` -> SkillVersion
- `status` (enum: `published` | `draft` | `private` | `flagged`)
- `createdAt`, `updatedAt`
- Relationships: has many **SkillVersion**, many-to-many **Tag**, belongs to
  **Category** and **User** (maintainer).

### SkillVersion (immutable once published) - locked shape, features 2/7/8 depend on it

- `id`
- `skillId` -> Skill
- `version` (semver string)
- `sourceType` (enum: `github` | `zip`)
- `githubRepoUrl` (string, nullable)
- `resolvedCommitSha` (string, nullable) - pinned GitHub commit
- `sourceHash` (string) - hash of the normalized source snapshot
- `snapshotKey` (string) - R2 object key for the normalized source (copies the
  submission's; source view and downloads read the object the validator saw)
- `submissionId` -> Submission (unique - one version per submission, ever; the
  publish idempotency anchor)
- `publishedAt` (datetime, nullable)
- Validation status and risk live on the version's **ValidationReport** and
  **SkillPassport**, not as a column here; only passed submissions publish.
- Relationships: has one **Manifest**, one **ValidationReport**, one
  **SkillPassport**; belongs to **Skill** and **Submission**.

### Manifest (parsed `skill.json`) - locked shape, feature 3 defines it

- `id`, `skillVersionId` -> SkillVersion
- `name`, `description`
- `targets` (string[] enum: `codex` | `claude-code` | `cursor` | `cowork` |
  `aider` | ...) - which agent tools the skill supports
- `variants` (json) - per-target or per-mode variations; supports multi-skill packs
- `requestedPermissions` (Permission[] via join) - what the skill asks for
- `raw` (json) - the original manifest
- Relationships: belongs to **SkillVersion**; references **Permission**.

### ValidationReport - locked shape, features 4/7/8 depend on it

- `id`, `skillVersionId` -> SkillVersion (or Submission pre-publish)
- `status` (enum: `passed` | `warning` | `failed`)
- `riskLevel` (enum: `low` | `medium` | `high` | `critical`)
- `sourceHash` (string)
- `createdAt` (datetime)
- Relationships: has many **Permission** (detected), many **Warning**, many
  **Failure**.

### SkillPassport (public, immutable per version) - the headline artifact

- `id`, `skillVersionId` -> SkillVersion (1:1)
- `validationStatus` (enum: `passed` | `warning` | `failed`)
- `riskLevel` (enum)
- `permissionsSummary` (json) - resolved permission set for display + diffing
- `warningsSummary` (json)
- `sourceHash`, `resolvedCommitSha`
- `generatedAt` (datetime)
- Immutable once generated; download pre-flight (feature 8) diffs permissions
  between passports.

### Supporting models

- **Category** - `id`, `slug`, `name` (curation grouping); has many Skill.
- **Tag** - `id`, `slug`, `name`; many-to-many with Skill.
- **Permission** (taxonomy) - `id`, `key` (e.g. `filesystem.write`, `network`,
  `shell.exec`, `env.read`), `label`, `description`, `riskWeight`.
- **Warning** / **Failure** - `id`, `reportId`, `code`, `message`, `severity`.
- **Submission** - `id`, `userId`, `sourceType` (`github_url` | `zip`),
  `githubUrl` (nullable), `uploadedZipKey` (R2, nullable), `status`
  (`draft` | `validating` | `passed` | `warning` | `failed` | `published`),
  `createdAt`. The publish link lives on `skill_versions.submissionId`
  (immutable side), not here.
- **ValidationJob** - `id`, `submissionId`, `state`
  (`queued` | `running` | `done` | `error`), `progress` (json: step rows for the
  inline panel), `bullJobId`, `reportId` (nullable), `startedAt`, `finishedAt`.
- **Download / InstallEvent** - `id`, `skillVersionId`, `userId` (nullable for
  anon), `source` (`web` | `cli`), `createdAt`.
- **AbuseReport** - `id`, `skillId` (or `skillVersionId`), `reporterId` -> User,
  `reason`, `status` (`open` | `reviewed` | `actioned`), `createdAt`.
- **ReputationInput** - `id`, `userId`, `type`, `weight`, `createdAt`; rolls up
  into `User.reputation`.

## Tech stack

- **Architecture** - a fully static Astro front end (`apps/web`) plus a separate
  Node API/backend (`apps/api`). Astro does no SSR; all dynamic behavior (auth,
  submissions, validation jobs, job status, pre-flight) is served by the API,
  which the static pages and React islands call.
- **Astro (static / SSG)** - the public web front end (`apps/web`).
- **React islands** - interactive pieces only: search filters, upload form,
  validation progress, account menu, dashboard widgets, download pre-flight; they
  call the Node API for dynamic data.
- **Node API/backend (`apps/api`)** - Hono; GitHub OAuth, submissions, validation
  job orchestration, and the validation worker.
- **TypeScript** - everywhere, strict.
- **Tailwind CSS** + **shadcn/ui** (React islands) + **lucide-react** - styling
  and icons.
- **Neon Postgres** - primary database.
- **Drizzle** - ORM.
- **GitHub OAuth** - maintainer sign-in, handled by the API.
- **Cloudflare R2** - object storage for uploaded zips and normalized source
  snapshots.
- **BullMQ + Redis** - the validation job queue, processed by the API's worker.
- **Monorepo** - `apps/web` (static Astro), `apps/api` (Node backend + worker);
  packages `packages/validator`, `packages/skill-schema`, `packages/cli`, and
  later `packages/queue`, shared so the web app, API, and CLI use one source of
  truth.

## Monetization

Not in v1. It launches free and public with no paid marketplace. Possible later:
private team registries, advanced validation reports, maintainer verification,
clearly labeled sponsorships, or pro tooling. Explicitly avoid pay-to-rank and
engagement-bait stats.

## UI/UX

Feels like a trusted developer utility: fast, sharp, searchable, security-aware,
more polished than a plain index. Structurally similar to Cursor Directory but not
a visual clone. The homepage is the directory itself. Search and validation are
both first-screen signals: polished cards for featured/trending, compact rows for
dense search results. The validation animation is an inline panel with step rows
ending in a check, warning, or x icon.

Static Astro pages (`apps/web`, names indicative):

- `/` - directory homepage: search, filters, featured/trending cards, result rows
- `/skills/[slug]` - skill detail: Skill Passport, permissions summary, install
  panel, versions, maintainer block, expandable findings, and a source view
  (SKILL.md rendered, other package files viewable) from the validated snapshot
- `/skills/[slug]/[version]` - version-pinned passport permalink
- `/submit` - submission flow (GitHub URL primary, zip fallback) with the inline
  validation progress panel
- `/u/[username]` - maintainer profile: listed skills and reputation
- `/dashboard` - maintainer dashboard widgets
- `/admin` - holding queue for failed/flagged submissions, manual review states

All dynamic content is client-fetched (decided at 7b): the directory, detail,
and passport pages are static shells whose React islands call the public read
API at runtime, so new publishes appear without a rebuild. Revisit
pre-rendering (rebuild-on-publish or hybrid) at deploy time if SEO wants it.

Node API endpoints (`apps/api`, names indicative):

- `GET /auth/github` + callback - GitHub OAuth
- `GET /skills` + `GET /skills/:slug` - public, anonymous directory list/detail
- `/submissions` - create and read submissions
- `/validation/:jobId` - job status feeding the inline progress panel
- `/download/preflight` - current validation, source hash, permissions, diffs

CLI (not a route): `skillpass search`, `scan`, `report`, `add`, `remove`, `list`, `outdated`, `update`.

## Open questions

> Resolve in the plans, then re-run /overview. Delete this section when empty.

- **Maintainer profile modeling** - project-plan lists "users and maintainer
  profiles" separately; modeled here as fields on User. Split into a 1:1
  `MaintainerProfile` only if it grows.
- **Redis for the validation queue** - dev is a local `redis-server`; the
  production provider is decided at deploy time alongside the API's host.
  Candidates: Upstash (proven with BullMQ on Vidpipe; watch idle-polling
  command costs) vs Redis colocated with the API host. Only `REDIS_URL`
  changes either way.

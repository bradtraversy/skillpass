# AI Skills Directory - Project Overview

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
  submit any repository as a curated listing (attribution to the source repo
  owner lands with feature 7).

Access tiers: anonymous (browse, search, inspect, download pre-flight), signed-in
maintainer (submit, manage, profile), admin (review queue, manual states).

## Features

MVP feature set in build-plan order, one line of purpose each. **Validation (the
Skill Passport) is the headline feature** - it's what makes this more than a link
list.

1. **Static directory shell** - Astro homepage, layout, nav, seeded skills, and
   search/filter/featured UI on fixture data. The directory shows immediately, not
   a marketing page.
2. **Skill detail and passport UI** - detail pages with a static Skill Passport,
   permissions summary, install panel, versions, maintainer block, and expandable
   findings.
3. **Manifest and report schemas** - define `skill.json`, the validation report
   schema, permission taxonomy, status values, risk levels, package targets,
   variants, and multi-skill packs (in `packages/skill-schema`).
4. **Validator V0 with fixtures** - `packages/validator` parses local fixture
   packages, reads `SKILL.md` and manifests, detects basic risks, and emits
   pass/warning/failed reports.
5. **Submission draft flow** - GitHub OAuth, maintainer profile, GitHub-URL
   submission (primary) and zip upload (fallback), Neon draft records, R2 snapshot
   storage.
6. **Queue-backed upload validation** - Redis + BullMQ + a worker service, job
   progress records, a job-status API, and the inline validation progress panel
   wired to real jobs.
7. **Publishable skill flow** - passed submissions publish, failed stay private,
   warnings route to draft/review, and each published version gets a public
   immutable Skill Passport plus a readable source view (SKILL.md and package
   files rendered from the validated snapshot, pinned to the source hash).
8. **Download pre-flight** - endpoint + UI showing current validation, source
   hash, permissions, permission diffs, and blocking of failed versions.
9. **CLI scan and report** - `packages/cli` with `aiskills scan` and
   `aiskills report`, sharing the validator, readable + JSON output.
10. **Reputation and admin** - maintainer reputation, user profiles, abuse
    reports, admin holding queue, validation history, manual review states.
11. **Launch seed and docs** - seed first-party listings, feature AI Blueprint and
    Memcrate, author docs, and the bradtraversy.dev project page.

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
- `snapshotKey` (string) - R2 object key for the normalized source
- `status` (enum: `passed` | `warning` | `failed`)
- `publishedAt` (datetime, nullable)
- Relationships: has one **Manifest**, one **ValidationReport**, one
  **SkillPassport**; belongs to **Skill**.

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
  `skillVersionId` (nullable, set on publish), `createdAt`.
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
  and icons. (Tailwind not installed yet.)
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

Dynamic pages (`/submit`, `/dashboard`, `/admin`, live search) are static shells
whose React islands call the API; content pages (directory, detail, passports)
are built from data at deploy time (see Open questions on freshness).

Node API endpoints (`apps/api`, names indicative):

- `GET /auth/github` + callback - GitHub OAuth
- `/submissions` - create and read submissions
- `/validation/:jobId` - job status feeding the inline progress panel
- `/download/preflight` - current validation, source hash, permissions, diffs

CLI (not a route): `aiskills scan`, `aiskills report`.

## Open questions

> Resolve in the plans, then re-run /overview. Delete this section when empty.

- **Static data freshness** - a fully static directory won't show newly published
  skills until a rebuild. Decide the strategy before feature 7: rebuild-on-publish
  (webhook/CI), client-fetch the listing from the API, or a hybrid.
- **Maintainer profile modeling** - project-plan lists "users and maintainer
  profiles" separately; modeled here as fields on User. Split into a 1:1
  `MaintainerProfile` only if it grows.
- **Redis for the validation queue** - dev is a local `redis-server`; the
  production provider is decided at deploy time alongside the API's host.
  Candidates: Upstash (proven with BullMQ on Vidpipe; watch idle-polling
  command costs) vs Redis colocated with the API host. Only `REDIS_URL`
  changes either way.

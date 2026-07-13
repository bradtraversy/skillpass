# Project Plan

> One of the two planning docs you provide. This is the owner-written input for the AI Blueprint workflow. Run `/overview` after this and `build-plan.md` are filled in.

## 1. Problem - What problem are we solving?

AI agent skills are becoming reusable software artifacts, but they are scattered across GitHub repos, personal dotfiles, docs, gists, and tool-specific ecosystems. Developers need a place to discover them, understand which tools they work with, and inspect what they ask an AI agent to do before installing them.

The main purpose is to build a public directory of AI agent skills with validation built in. The core rule is: never blindly trust a skill.

## 2. Users - Who is this for?

Primary users are developers who use AI coding tools such as Codex, Claude Code, Cursor, Cowork, Aider, and similar agent harnesses.

Secondary users are skill authors, workflow builders, tool maintainers, and teams that want a reviewable way to adopt shared AI workflows.

## 3. Features - What does the MVP need?

- Public directory homepage with search, filters, and curated sections.
- Skill detail pages with examples, install instructions, compatibility badges, and Skill Passport.
- Skill Passport for every listed version, including validation status, risk, permissions, source hash, and warnings.
- GitHub URL submission as the primary upload path.
- Zip upload as the fallback upload path.
- Inline validation progress panel that ends in passed, warning, or failed state.
- Local CLI named `skillpass` that can scan a skill and emit a report.
- GitHub login for maintainers.
- Maintainer profiles with listed skills and reputation.
- Admin holding area for failed or flagged submissions.
- Seed catalog with AI Blueprint, Memcrate, and representative Codex, Claude Code, Cursor, and integration skills.

## 4. Data - What are we storing?

- Users and maintainer profiles.
- Skills and skill versions.
- Skill packages, manifests, targets, variants, categories, and tags.
- Submissions and submission drafts.
- Validation jobs and progress state.
- Validation reports and Skill Passports.
- Permissions, warnings, failures, source hashes, and resolved GitHub commit SHAs.
- Uploaded zips and normalized source snapshots in object storage.
- Downloads, CLI install events, abuse reports, and reputation inputs.

## 5. Tech - What stack are we using?

- **Architecture: static front end plus a separate backend API.** Astro is fully static (SSG), no SSR. A separate Node API/backend service (`apps/api`) handles GitHub OAuth, submissions, validation jobs, and the validation worker. The static site and its React islands call this API for all dynamic data.
- Astro (static / SSG) for the public web front end (`apps/web`).
- React islands for search filters, upload form, validation progress, account menu, dashboard widgets, and download pre-flight; islands call the Node API for dynamic data.
- Hono for the Node API/backend (`apps/api`).
- TypeScript.
- Tailwind
- ShadCN UI components.
- lucide-react icons.
- Neon Postgres.
- Drizzle
- GitHub OAuth.
- Cloudflare R2 for uploaded zips and source snapshots.
- BullMQ plus Redis for real validation jobs, processed by the API's worker.
- Monorepo layout: `apps/web` (static Astro) and `apps/api` (Node backend plus worker); packages `packages/validator`, `packages/skill-schema`, `packages/cli`, and later `packages/queue`.

## 6. Monetize - How will this make money?

V1 is free and public. No paid marketplace at launch.

Possible later monetization: private registries for teams, advanced validation reports, maintainer verification, clearly labeled sponsorships, or pro tooling. Avoid pay-to-rank and engagement-bait stats.

## 7. UI/UX - How should this look and feel?

Similar structure to Cursor Directory, but not a visual clone. It should feel like a trusted developer utility: fast, sharp, searchable, security-aware, and more polished than a plain index.

The homepage should show the actual directory immediately, not a marketing page. Search and validation are both first-screen signals. Use polished cards for featured/trending areas and compact rows for dense search results. The validation animation is an inline panel with step rows and a final check, warning, or x icon.

# Fix: Rebrand to SkillPass

**Type:** Fix
**Status:** complete (2026-07-13)

## The problem

The product was renamed from "AI Skills Directory" (a description, not a brand)
to **SkillPass** - site at `skillpass.dev`, CLI command `skillpass`, npm package
`skillpass` (name confirmed free on npm; domain confirmed available at $9.99/yr).
The old name and the `aiskills` command appeared across the web UI, CLI, API
session cookie, deploy config, and docs. The rename happened now, before anything
was published or deployed, while it was free.

## The fix

Swept every live surface: display name "AI Skills Directory" -> "SkillPass",
command/identifier `aiskills` -> `skillpass`, env var `AISKILLS_API` ->
`SKILLPASS_API`, session cookie `aiskills_session` -> `skillpass_session`.
Nothing published or in prod, so no back-compat shims - a clean rename.

**Deliberately not touched:**

- GitHub repo + local folder name (`ai-skills-directory`) - disruptive to
  tooling; decide separately. GitHub redirects if renamed later.
- `prototypes/` - throwaway mockups, not a live surface.
- `blueprint/history/` - archived records keep their historical names.
- Buying `skillpass.dev` and publishing to npm - external actions, Brad's.
- Making the CLI package publishable (build step, `private: false`, npm
  publish) - that stays feature 15; this fix only renamed it.

## Build steps (all done)

- [x] **Step 1 - web UI brand swap** - Nav logo, BaseLayout default title,
  submit page title, Directory tagline, InstallBar CTA -> `skillpass add`,
  markdown test strings. Verified: grep clean under `apps/web/src`, screenshots
  of homepage + detail page.
- [x] **Step 2 - CLI rename** - package `cli` -> `skillpass` (still private),
  bin `aiskills.mjs` -> `skillpass.mjs`, usage strings, `SKILLPASS_API`, root
  `cli` script path, test tmpdir prefixes. Verified: live `--help` + fixture
  scan PASSED.
- [x] **Step 3 - API cookie + deploy config** - `SESSION_COOKIE` ->
  `skillpass_session` + test assertions; render.yaml services ->
  `skillpass-web`/`skillpass-api` (none created on Render yet).
- [x] **Step 4 - docs sweep** - README, CLAUDE.md title, AGENTS.md commands
  (bin path, env var), project-plan, build-plan items 9/14/15, project-overview
  title + command refs.

## Verification

- `vitest run`: 49 files, 593 tests green after every step.
- `astro check`: 0 errors, 0 warnings.
- Repo-wide grep for `aiskills` / "AI Skills Directory" hits only
  `blueprint/history/`, `prototypes/`, and the spec itself.
- Screenshots: SkillPass nav + "skillpass CLI" tagline on `/`,
  `skillpass add theme-factory` on the detail page.

## Follow-ups (owned elsewhere)

- Buy `skillpass.dev` (Brad, external).
- Publish `skillpass` to npm + `private: false` + real build (feature 15).
- Repo/folder rename decision (separate, Brad's call).

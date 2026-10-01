# Feature: Per-agent install guides

**From build-plan:** feature 25
**Build attempt:** 1
**Status:** verified

**Branch:** `feature/per-agent-install-guides`

## Goal

One static page per install tool the CLI knows (Claude Code, Codex, Cursor, Windsurf, GitHub
Copilot, Gemini CLI, Cline, OpenCode) at `/install/<tool>`, plus an index at `/install`. Each
page says where that tool reads skills (project and user-level folders, and which other tools
share the folder), gives the exact `skillpass add ... --target <tool>` command with `--global`,
offers a pasteable agent prompt already aimed at that tool, and sends the reader to the directory
because every listed skill works with every tool. Linked from the footer and the install card.
These are the search landing pages for "install skills in <tool>".

Re-scoped 2026-09-29 from the build-plan line: no per-tool directory filter. Every listed skill
declares `claude-code` and `codex`, and every other tool reads the `.agents/skills` layout, so a
compatibility filter returns the whole directory on all eight pages. Compatibility is a layout
fact the CLI already encodes, not a declaration.

## In scope

- `apps/web/src/lib/install-tools.ts`: the web-side mirror of the CLI install registry
  (`packages/cli/src/targets.ts`), extending the `PROMPT_TOOLS` precedent from feature 24.
  `INSTALL_TOOLS` is an ordered array of `{ slug, name, project, user, layout }` for the eight
  tools (order: claude-code, codex, cursor, windsurf, github-copilot, gemini-cli, cline,
  opencode). Folders from the registry: Claude Code `.claude/skills` and `~/.claude/skills`
  (layout `claude-code`); Cline `.cline/skills` and `~/.cline/skills`; every other tool
  `.agents/skills` and `~/.agents/skills` (layout `agents`). `findInstallTool(slug)` returns the
  row or `undefined` (an array lookup, so `constructor` is unknown). `sharedWith(tool)` lists the
  other tools reading the same project folder.
- `apps/web/src/lib/install-prompt.ts`: `PROMPT_TOOLS` derives from `INSTALL_TOOLS`; the prompt
  text is unchanged. `toolPrompt(tool)` lives here beside `installPrompt` (not in
  `install-tools.ts`, which would make the two modules import each other): the feature 24 prompt
  with `--target <tool.slug>` fixed, `<slug>` as the placeholder ref, no "where <tool> is" line,
  and `Passport: ${SITE_URL}/skills/<slug>` at the end. The step 2 and step 3 sentences are
  shared constants so the two prompts cannot drift.
- `apps/web/src/lib/sitemap.ts`: `STATIC_ROUTES` gains `/install` and `/install/<slug>` for each
  tool, built from `INSTALL_TOOLS`.
- `apps/web/src/pages/install/[tool].astro`: prerendered through `getStaticPaths` over
  `INSTALL_TOOLS` (unknown tools are a normal 404). Rendered inside `DocsShell`. Title and h1
  `Install skills in <Name>`; description names the tool. Sections: an intro (every SkillPass
  skill installs into <Name>, the CLI writes the files where <Name> reads them, pre-flight first);
  "Where <Name> reads skills" with the project and user-level folders and the shared-folder note
  (the other tools that read it, or "its own layout" for Claude Code and "its own folders" for
  Cline); "Install a skill" with `npm install -g skillpass`, `skillpass add <slug> --target
  <tool>`, the `--global` form, the one-off `npx skillpass@latest add <slug> --target <tool>`,
  and what the pre-flight does (report first, medium+ risk asks, hash-verified, atomic); "Or paste
  a prompt into <Name>" with `toolPrompt` in a docs `pre` block (the docs shell styles every
  `pre`, so a `CopyBox` island would render a box inside a box; the skill page keeps the copy
  button) and a line that every skill page has a Prompt tab; one sentence on packs (every member installs, using
  the tool's layout variant); "Browse" with a link to `/` and to `/docs/cli`.
- `apps/web/src/pages/install/index.astro`: `Install by agent` in `DocsShell`: one line of intro,
  a list linking each tool page with its project folder, a line for any other tool that reads
  `.agents/skills` (`--target agents`) or anything else (`--dir`), and a link to `/docs/cli`.
- `DocsShell.astro`: sidebar entry `Install by agent` (`/install`), active on `/install` and
  `/install/*`. `Nav.astro`: the Docs link also highlights under `/install`.
- Links: `Footer.astro` gains `Install` (`/install`) after `CLI`; `InstallBar.tsx` CLI-tab
  footnote gains an `Install guide for your agent` link to `/install`; `/docs` "Where to go next"
  gains a line; `/docs/cli` "Install: add" gains a sentence linking the per-agent guides.

## Out of scope

- A directory filter by tool, a `?target=` query on the homepage, or any change to `TARGETS`,
  declared targets, the manifest, or the API. The pages fetch nothing.
- Tools outside the CLI registry (Amp, Kiro, Roo Code, Zed, and others): a registry row first.
- Per-tool rules-file snippets (`.cursor/rules`, `CLAUDE.md`, and similar); the registry holds no
  such facts and the pages must not invent them.
- Rewording the build-plan line (user-owned plan; the "filtered" wording is flagged at
  `/complete`).
- Detecting which agent is reading a skill page.

## Build loop

Build one small step at a time. `blueprint/config.json` is absent, so defaults apply:
`workflow.stepReview: feature` (one review packet after all steps) and checkpoint commits
disabled. Independent review runs only if the `when-sensitive` gate selects it; this feature is
static pages, copy, and client-side string building with no auth, data, or trust-boundary change,
so it is not selected. `/complete` makes the final feature commit.

## Build steps

- [x] 1. **Tool table, tool prompt, sitemap routes** - add `lib/install-tools.ts` with
  `INSTALL_TOOLS`, `findInstallTool`, `sharedWith`, `toolPrompt`; derive `PROMPT_TOOLS` from it;
  extend `STATIC_ROUTES`. Done when: `install-tools.test.ts` proves the eight rows in order with
  the registry folders and layouts, `findInstallTool` rejects unknown names and `constructor`,
  `sharedWith` lists the six `.agents` readers for each other and nothing for Claude Code and
  Cline; `install-prompt.test.ts` still pins the eight names and proves `toolPrompt` for Cursor
  contains `npx skillpass@latest add <slug> --target cursor`, `--global`, the same step 2 and 3
  lines as the skill-page prompt, never `<tool>`, and ends with the `<slug>` passport link;
  `sitemap.test.ts` proves `/install` and `/install/cursor`; `pnpm test` is green.
- [x] 2. **The pages** - `pages/install/[tool].astro`, `pages/install/index.astro`, the
  `DocsShell` sidebar entry and active rule, the `Nav` highlight. Done when: `pnpm build` is
  green, `dist/client/install/index.html` links all eight tools, and
  `dist/client/install/cursor/index.html` carries the title, both folders, the shared-folder note,
  the `--target cursor` command, and the prompt with `--target cursor` (text evidence from the
  build; a browser look when a server is running).
- [x] 3. **Links** - footer, install-card footnote, `/docs` next-steps line, `/docs/cli`
  sentence. Done when: `pnpm build` is green and the built footer and `/docs/cli` link
  `/install`; `pnpm verify` is green.

## Files / areas

- `apps/web/src/lib/install-tools.ts`, `apps/web/src/lib/install-tools.test.ts` - new.
- `apps/web/src/lib/install-prompt.ts`, `apps/web/src/lib/install-prompt.test.ts` - derive
  `PROMPT_TOOLS`, share the step sentences, add `toolPrompt`.
- `apps/web/src/lib/sitemap.ts`, `apps/web/src/lib/sitemap.test.ts` - routes.
- `apps/web/src/pages/install/[tool].astro`, `apps/web/src/pages/install/index.astro` - new.
- `apps/web/src/components/docs/DocsShell.astro`, `apps/web/src/components/nav/Nav.astro`,
  `apps/web/src/components/nav/Footer.astro` - navigation.
- `apps/web/src/components/skill/InstallBar.tsx` - footnote link.
- `apps/web/src/pages/docs/index.astro`, `apps/web/src/pages/docs/cli.astro` - links.

## Data / contracts

- No API, schema, CLI, or manifest change. Folder paths and tool names are the CLI's install
  registry as of feature 21; the table comment says to keep it in step with
  `packages/cli/src/targets.ts`.
- `InstallTool`: `{ slug, name, project, user, layout }` with `layout` `'claude-code' |
  'agents'`; `user` is the display path starting with `~/`.
- Routes: `/install` and `/install/<slug>`, static, canonical from `BaseLayout`.
- `toolPrompt` uses only the documented `add <slug> [--target <tool>] [--global] [--yes]`
  grammar and the same step wording as the skill-page prompt.

## Testing

- `install-tools.test.ts` - table contents, lookup, shared-folder rule.
- `install-prompt.test.ts` - the eight-name pin stays as the drift check; `toolPrompt`.
- `sitemap.test.ts` - the new static routes.
- Pages and links ride on `pnpm build` plus the built-HTML checks in the packet.

## Notes for the AI

- Write `@` inside `.astro` text as `&#64;` (the `/docs/cli` precedent) and use `{' '}` for
  intentional spaces between inline elements.
- The pages are static: `prerender` stays at the default, and nothing imports `lib/api`.
- The pages ship no islands: plain Astro, zero client JS.
- No em dashes anywhere, `pnpm format` before presenting the diff.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":9159,"specSha256":"49641ec0b6000db7e87c29b05428a36f18ac8976c5e3026bc349891aa47ffb1d","branch":"refs/heads/feature/per-agent-install-guides","head":"9c6adef64249207cb1edf0ec1e48d7dc357b857e","baseRef":"refs/heads/main","baseCommit":"9c6adef64249207cb1edf0ec1e48d7dc357b857e","sourceTree":"43198577d02e7102715dc3cfc923ef7a6167e996","absentOptional":[]} -->

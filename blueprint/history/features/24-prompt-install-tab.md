# Feature: Prompt install tab

**From build-plan:** feature 24
**Build attempt:** 1
**Status:** verified

**Branch:** `feature/prompt-install-tab`

## Goal

Beside the `skillpass add` command on a skill page, a "Prompt" tab holds a pasteable
instruction for an AI agent: install this skill through the skillpass CLI with the same slug
and version pin the CLI tab shows, read the pre-flight, and stop for the user on medium or
higher risk. A person who never installs CLIs by hand can still put the passport gate in
front of the install.

## In scope

- `apps/web/src/lib/install-prompt.ts`: `installRef(slug, version, pinned)` returns `slug`
  on the latest page and `slug@version` on a version permalink; `installPrompt({ slug,
  version, pinned })` returns the multi-line prompt. The prompt names the skill and version,
  gives the exact command `npx skillpass@latest add <ref> --target <tool>` with the accepted
  tool names (claude-code, codex, cursor, windsurf, github-copilot, gemini-cli, cline,
  opencode) and the `--global` option, explains that the CLI prints the pre-flight first and
  exits when the risk is medium or higher, tells the agent to show the report and wait for
  approval before rerunning with `--yes`, asks for the installed path and a two-sentence
  summary of the skill, and ends with the passport link (`/skills/<slug>` or
  `/skills/<slug>/<version>` when pinned).
- `apps/web/src/lib/site.ts`: `SITE_URL` moves here from `badge.ts` so the badge snippet and
  the prompt share one public-site origin; `badge.ts` imports it.
- `InstallBar.tsx` (distribution `skill` only): a `CLI | Prompt` segmented toggle in the
  install card. CLI shows `skillpass add <ref>` as today; Prompt shows the prompt in a
  multi-line copy box. Both use the same `<ref>`, so a version permalink now shows
  `skillpass add <slug>@<version>` instead of the unpinned command. `SkillDetail.tsx` passes
  `pinned` (true when the page is `/skills/:slug/:version`).
- `CopyBox` gains a `multiline` flag: wrapped `pre` text with the copy button at the top
  right instead of a single truncated line.
- One sentence on `/docs/cli` under "Install: add" saying every skill page has a Prompt tab
  for agents.

## Out of scope

- CLI, API, or schema changes; the prompt only uses the published `add` grammar.
- Per-tool prompt variants or detecting which agent is reading the page.
- A Prompt tab for `cli` or `system` distributions, which have no `skillpass add` command.
- Remembering the chosen tab across pages.

## Build loop

Build one small step at a time. `blueprint/config.json` is absent, so defaults apply:
`workflow.stepReview: feature` (one review packet after all steps) and checkpoint commits
disabled. Independent review runs only if the `when-sensitive` gate selects it; this
feature is client-side copy and string building with no auth, data, or trust-boundary
change, so it is not selected. `/complete` makes the final feature commit.

## Build steps

- [x] 1. **Prompt builder and shared site origin** - add `lib/site.ts` (`SITE_URL`), point
  `badge.ts` at it, add `lib/install-prompt.ts` with `installRef` and `installPrompt`. Done
  when: `install-prompt.test.ts` proves `installRef` is `slug` unpinned and `slug@version`
  pinned, the prompt contains the exact `npx skillpass@latest add <ref> --target <tool>`
  command, every accepted tool name, the `--global` note, the medium-or-higher stop and
  `--yes` only after approval, and the passport URL for both cases; `site.test.ts` (moved
  from `badge.test.ts`) proves the fallback origin; `pnpm test` is green.
- [x] 2. **Tabs on the install card** - `CopyBox` `multiline`, `InstallBar` `pinned` prop and
  `CLI | Prompt` toggle, `SkillDetail` passes `pinned={Boolean(version)}`. Done when:
  `pnpm build` is green; on a skill page the card shows the toggle, CLI is the default with
  `skillpass add <slug>`, Prompt shows the wrapped prompt with a working copy button, and a
  version permalink shows `<slug>@<version>` in both (manual check against a running API
  and web).
- [x] 3. **Docs line** - the sentence on `/docs/cli`. Done when: `pnpm build` is green.

## Files / areas

- `apps/web/src/lib/site.ts`, `apps/web/src/lib/site.test.ts` - new.
- `apps/web/src/lib/install-prompt.ts`, `apps/web/src/lib/install-prompt.test.ts` - new.
- `apps/web/src/lib/badge.ts`, `apps/web/src/lib/badge.test.ts` - import `SITE_URL`.
- `apps/web/src/components/ui/CopyBox.tsx` - `multiline`.
- `apps/web/src/components/skill/InstallBar.tsx` - tabs and `pinned`.
- `apps/web/src/components/skill/SkillDetail.tsx` - passes `pinned`.
- `apps/web/src/pages/docs/cli.astro` - one sentence.

## Data / contracts

- No API or schema change. The prompt uses only the documented `add <slug>[@version]
  [--target <tool>... [--global]] [--yes]` grammar and the tool names from the CLI's install
  registry.
- `installRef`: `slug` when `pinned` is false, `${slug}@${version}` when true. The CLI tab
  and the Prompt tab always agree.
- Passport link: `${SITE_URL}/skills/${encodeURIComponent(slug)}` plus
  `/${encodeURIComponent(version)}` when pinned.

## Testing

- `install-prompt.test.ts` - ref and prompt content for pinned and unpinned pages.
- `site.test.ts` - the `SITE_URL` fallback and trailing-slash strip.
- UI rides on `pnpm build` plus the manual check in the review packet.

## Notes for the AI

- Without a TTY and without `--target`, the CLI drops the raw skill into `./<slug>` and only
  prints a tip; that is why the prompt makes `--target <tool>` mandatory.
- Without a TTY, medium or higher risk exits 2 with "rerun with --yes"; the prompt turns
  that into a stop-and-ask, never an automatic `--yes`.
- Keep the prompt plain text with numbered steps; agents follow it better than prose.
- No em dashes anywhere, `pnpm format` before presenting the diff.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":5829,"specSha256":"166a3c1fa8d00b67a9b94b82029adf5cc50efd5f17446a5102c9714fb4f173df","branch":"refs/heads/feature/prompt-install-tab","head":"524bef12318a9d3d6f00191ddcf3ce89ad818df7","baseRef":"refs/heads/main","baseCommit":"524bef12318a9d3d6f00191ddcf3ce89ad818df7","sourceTree":"a0acb07bf6894bbad95fd0917472bd4e928ddc96","absentOptional":[]} -->

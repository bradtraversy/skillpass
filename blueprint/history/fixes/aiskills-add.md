# Fix: aiskills add - install skills through the pre-flight gate

**Type:** Fix
**Status:** complete

## Problem

Every skill page's install bar tells users to run `aiskills add <slug>`, but
that command doesn't exist - the CLI shipped verify-only (scan, report).
Anyone copying the site's primary CTA gets `unknown command "add"`. The pieces
to make it real already exist: `report` fetches and gates on the pre-flight,
the download endpoint serves the verified snapshot zip, and the
`download_events` enum has an unused `cli` value waiting.

## Fix

`aiskills add <slug>[@version]` - install a published skill through the same
pre-flight gate the web UI uses:

1. Fetch the detail + pre-flight (same locked contracts as `report`).
2. Refuse blocked versions (exit 1).
3. Print the pre-flight, then require confirmation when `riskLevel` is not
   `low` (MVP rule: "require confirmation for medium or high-risk skills") -
   `--yes` skips the prompt; a non-TTY run that needs confirmation without
   `--yes` exits 2 with a clear message.
4. Download the zip with `?source=cli`, unzip **in memory**, reject unsafe
   entry paths (absolute or `..`), recompute the source hash from the
   extracted files with the validator's own `loadPackageFromFiles`, and
   refuse on mismatch (exit 2) - nothing touches disk until the bytes verify
   against the pinned hash.
5. Write files to `--dir <path>` (default `./<slug>`); refuse a non-empty
   existing target (exit 2). Print a summary and exit 0.

API side: the download route accepts `?source=web|cli` (default `web`,
anything else 400s) so CLI installs are counted separately, per the metrics
model.

## Out of scope

- `aiskills publish` / `pack`, npm distribution.
- Changing the InstallBar UI - its copy becomes correct as-is.
- Install mappings for tools without a real skills-folder convention
  (cursor, cowork, aider) - they stay on `--dir` until a convention exists;
  inventing paths would be worse than none.

## Build steps

- [x] **Step 1 - API source param** - download route reads `?source=`,
  validates `web | cli` (400 otherwise), records it on the event. *Done
  when:* route tests cover cli source recorded, default web, and 400 on
  junk; suite green.
- [x] **Step 2 - runAdd core** - extract the shared fetch/parse helpers from
  `report.ts` into `src/api.ts`, add `src/add.ts` with `runAdd(ref, opts)`
  (injectable fetch, confirm, and target dir), fflate dep for unzip. *Done
  when:* tests cover a successful install (files written, hash verified
  against a zip built from the same files), hash-mismatch refusal writing
  nothing, blocked refusal, non-empty target refusal, zip-slip entry
  rejection, confirm required for medium+ risk and skipped with `--yes`;
  suite green.
- [x] **Step 3 - wiring + evidence** - `add` dispatch + usage text,
  `AGENTS.md` CLI line mentions add. *Done when:* build green; terminal
  evidence shows `aiskills add smoke-clean` installing from the live dev API
  into a temp dir with a verified hash, and the DB shows a `source: 'cli'`
  download event.
- [x] **Step 4 - tool install targets** - `--target <tool>` selects a
  premade install area, `--global` picks the user-level one where a real
  convention exists: `claude-code` -> `.claude/skills/<slug>` (project) or
  `~/.claude/skills/<slug>` (global); `codex` -> `.agents/skills/<slug>`
  (project only). `--target` and `--dir` together error; a `--target` the
  skill's manifest doesn't declare warns but proceeds; unmapped tools exit 2
  naming `--dir` as the path. Default without either flag stays `./<slug>`
  plus a one-line tip when the skill declares a mappable target. *Done when:*
  tests cover both mappings, the global variant, the conflict error, the
  undeclared-target warning, and the unmapped-tool message; live evidence
  installs smoke-clean into a scratch project's `.claude/skills/smoke-clean`
  via `--target claude-code`.
- [x] **Step 5 - interactive location picker** - with no `--target`/`--dir`
  on a TTY, `add` prints a numbered menu (declared tool folders, the
  user-level folder where one exists, current directory) and installs to the
  chosen one (empty/invalid answer -> option 1). Output now streams so the
  pre-flight report prints BEFORE any prompt (the risk confirmation used to
  fire first - fixed). Non-TTY keeps the tip + `./<slug>` default. *Done
  when:* tests cover the menu choices, choice honoring, empty-answer
  default, current-directory pick, and emit/streamed parity; pty evidence
  shows the menu installing into `.claude/skills/` on answer 1.

## Files / areas

- `apps/api/src/routes/skills.ts` (+tests).
- `packages/cli/src/api.ts` (new, extracted), `src/add.ts` (+test, new),
  `src/report.ts` (refactor to shared helpers), `src/index.ts`, package.json
  (fflate), `pnpm-lock.yaml`.
- `AGENTS.md` Commands line.

## Testing

- All logic-bearing: route tests + runAdd tests with stubbed fetch/confirm
  and a temp dir; the in-memory zip fixtures are built with fflate's
  `zipSync` so hash parity is real, not mocked.

## Notes for the AI

- Verify before write: unzip and hash-check in memory, only then create the
  target directory. A partial install on failure is a bug.
- Keep `process.exit`/prompts out of the cores: `confirmImpl` defaults to a
  readline y/N only in the entry path.
- The download response is bytes, not the JSON envelope - handle non-200s by
  parsing the envelope error when present.

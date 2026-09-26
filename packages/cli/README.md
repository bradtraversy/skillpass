# skillpass

Validation-first installer for AI agent skills. Search the
[SkillPass directory](https://skillpass.dev), inspect exactly what a skill asks
an agent to do, and install it - hash-verified against the validated snapshot -
into Claude Code, Codex, or any folder you choose.

Core rule: never blindly trust a skill. Every listed skill ships a Skill
Passport - a validation report covering detected permissions, risky patterns,
and an AI review. This CLI puts that gate in front of every install.

## Install

```
npm install -g skillpass
```

Requires Node 20 or newer. No runtime dependencies.

## Commands

```
skillpass search [query] [--ai] [--target <tool>] [--category <slug>] [--packs] [--json]
skillpass scan <path> [--json]
skillpass report <slug>[@version] [--json]
skillpass add <slug>[@version] [--target <tool>... [--global] | --dir <path>] [--yes]
skillpass add github:<owner>/<repo>[/<path>][@<ref>] [same flags]
skillpass remove <slug> [--target <tool> [--global] | --dir <path>]
skillpass update <slug>[@version] [--target <tool> [--global]] [--yes]
skillpass outdated
skillpass list
skillpass --version | --help
```

### Find

`skillpass search pdf` searches the directory the same way the website does
(names, summaries, authors, tools, pack members). Filter with
`--target claude-code`, `--category security-review`, or `--packs` for
multi-skill workflow packs.

`skillpass search --ai "turn a video into an article"` searches by meaning
instead of by keyword, through the directory's free AI search. Results come
back in relevance order and the same filters apply.

### Inspect

`skillpass report <slug>` prints the version's Skill Passport before you
install anything: validation status, risk level, declared vs detected
permissions, the permission diff against the previous version, and the pinned
source hash. Failed versions are blocked from download.

### Install

`skillpass add <slug>` shows the passport, asks for confirmation on medium+
risk, then downloads the validated snapshot and re-verifies every byte against
the pinned source hash before anything touches disk. Installs are atomic - a
failed write leaves nothing behind.

- `--target <tool>` installs into the tool's skills folder, or its user-level
  folder with `--global`:
  - `claude-code`: `.claude/skills/` and `~/.claude/skills/`
  - `agents`: the shared `.agents/skills/` and `~/.agents/skills/` that
    `codex`, `cursor`, `windsurf`, `github-copilot`, `gemini-cli`, and
    `opencode` all read; any of those names resolves to the same folders
  - `cline`: `.cline/skills/` and `~/.cline/skills/`
- Repeat `--target` to install into several tools in one pass with one
  pre-flight; targets that share a folder install once
- `--dir <path>` installs anywhere
- No flags in a terminal: an interactive picker

**Packs**: a multi-skill pack installs every member skill into the chosen
tool's skills area using that tool's variant files -
`skillpass add ai-blueprint --target claude-code` installs 19 individual
skills in one verified step.

### Install from any repo

A skill does not have to be on the directory to go through the gate:

```
skillpass add github:owner/repo --target claude-code          # the repo root is the skill (or a pack)
skillpass add github:owner/repo/skills/pdf --target cursor    # one folder of a monorepo
skillpass add github:owner/repo@v1.2.0 --target claude-code   # pin a branch, tag, or commit
skillpass add https://github.com/owner/repo/tree/main/skills/pdf --target agents
```

The CLI pins the reference to a commit, downloads that commit's archive from
GitHub, runs the same validator on it locally, and shows the same pre-flight
(status, risk, permissions, findings, source hash) plus the repo and commit
it came from. A failed report blocks the install; medium+ risk asks for
confirmation. Then the same atomic install path runs, so `--target`,
`--global`, `--dir`, packs, and the location picker all work.

These installs are **unlisted**: validated on your machine, never submitted
or listed, with no maintainer ownership check and no AI review behind them.
The receipt records the repo and commit and marks the install `unlisted`;
`list` shows the origin, `outdated` leaves it out of the update count, and
`update` refuses it so a same-named directory skill can never replace it.
To refresh an unlisted install, `remove` it and `add` it again. Public
repositories only; `add github:...` never contacts the directory.

### Manage

Installs into the known skills areas are recorded in a per-area
`.skillpass.json` receipt, so the CLI knows what it installed and at which
version - your own hand-made skills in the same folders are left alone.

- `skillpass list` shows installed skills with their versions
- `skillpass outdated` compares them to the directory (exits 1 when updates
  exist, handy in scripts)
- `skillpass update <slug>` re-runs the whole trust gate - including a
  permission diff against the version you currently have - then swaps the
  install atomically; updating a pack swaps, adds, and removes members as
  the pack changed (unlisted installs are refused: remove and add again)
- `skillpass remove <slug>` deletes an installed skill (a pack removes its
  whole family); it refuses anything that does not look like an installed
  skill, so a stray `--dir` can never wipe a real folder
- `skillpass scan <path>` runs the same validator the directory uses on any
  local skill folder before you submit it

## Configuration

- `SKILLPASS_API` - override the API base URL (defaults to
  `https://api.skillpass.dev`)
- `NO_COLOR` - disable colored output; piped output is always plain

## Exit codes

`0` success (including a clean empty search), `1` failed validation or a
blocked version, `2` usage, network, or refused operations.

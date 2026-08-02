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
skillpass search [query] [--target <tool>] [--category <slug>] [--packs] [--json]
skillpass scan <path> [--json]
skillpass report <slug>[@version] [--json]
skillpass add <slug>[@version] [--target <tool> [--global] | --dir <path>] [--yes]
skillpass remove <slug> [--target <tool> [--global] | --dir <path>]
skillpass list
skillpass --version | --help
```

### Find

`skillpass search pdf` searches the directory the same way the website does
(names, summaries, authors, tools, pack members). Filter with
`--target claude-code`, `--category security-review`, or `--packs` for
multi-skill workflow packs.

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

- `--target claude-code` installs to `.claude/skills/<slug>` (project) or
  `~/.claude/skills/<slug>` with `--global`
- `--target codex` installs to `.agents/skills/<slug>`
- `--dir <path>` installs anywhere
- No flags in a terminal: an interactive picker

**Packs**: a multi-skill pack installs every member skill into the chosen
tool's skills area using that tool's variant files -
`skillpass add ai-blueprint --target claude-code` installs 19 individual
skills in one verified step.

### Manage

`skillpass list` shows what is installed in the known skills areas.
`skillpass remove <slug>` deletes an installed skill; it refuses anything that
does not look like an installed skill, so a stray `--dir` can never wipe a
real folder. `skillpass scan <path>` runs the same validator the directory
uses on any local skill folder before you submit it.

## Configuration

- `SKILLPASS_API` - override the API base URL (defaults to
  `https://api.skillpass.dev`)
- `NO_COLOR` - disable colored output; piped output is always plain

## Exit codes

`0` success (including a clean empty search), `1` failed validation or a
blocked version, `2` usage, network, or refused operations.

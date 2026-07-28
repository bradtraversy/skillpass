# Fix: CLI coming-soon note in the install panel

**Type**: Fix (ad-hoc, chat-driven)
**Branch**: `fix/cli-coming-soon`
**Date**: 2026-07-28

## What changed

The skill detail install panel shows `skillpass add <slug>` with a copy
button, but the CLI isn't on npm yet (feature 15). Until it ships, the panel
now carries an accent-tinted "Coming soon" chip and a one-liner pointing
people at Download & pre-flight instead, so the copy CTA stops implying a
command that doesn't resolve.

- `InstallBar.tsx` - the `distribution === 'skill'` branch wraps the command
  row and adds the note line inside the panel. Remove it when feature 15
  publishes the CLI.

## Evidence

- `pnpm test` 759/759, `pnpm build` green (UI-only change).

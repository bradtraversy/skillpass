# Fix: Hero install guides link

**Type:** Fix
**Status:** verified
**Branch:** fix/hero-install-guides-link

## The problem

The per-agent install guides (`/install`, feature 25) are linked from the footer, the skill page install card, the docs sidebar, and the CLI docs, but not from the homepage, where a new visitor decides whether SkillPass works with their tool. The open decision from 2026-10-01 was where to add the link. Brad chose a hero line on 2026-10-03: the top nav stays as it is, because the phone-width header fix (PR #28) already had to hide CLI and GitHub to fit.

## The fix

In `apps/web/src/components/home/Hero.astro`, add a second link line under the existing "Browse the official skills..." line, in the same style: "Install guides for Claude Code, Codex, Cursor and more", linking to `/install`. No count in the copy, so it cannot drift from `INSTALL_TOOLS`. No other page changes; the top nav is unchanged.

## Build steps

- [x] 1. **Hero install line.** Add the line. **Done when** `pnpm verify` is green, the built homepage HTML has an `/install` link with that text directly after the `/official` link, and after deploy the Browser pane on skillpass.dev at 375 px shows both hero links fully on screen with no sideways scroll.

## Verify

- Built `dist` homepage contains the new link in the hero.
- After merge and deploy: skillpass.dev in the Browser pane at 375 px and desktop; the link opens `/install`.
- A UI copy change, exempt from the test gate.

## Evidence

- `pnpm verify` green on `fix/hero-install-guides-link`.
- Built `apps/web/dist/client/index.html`: `<a href="/install">` with "Install guides for Claude Code, Codex, Cursor and more" sits directly after the "Browse the official skills" link in the hero.
- The skillpass.dev check at 375 px and desktop runs after merge and deploy, as the done-when states; no local dev server was running.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":1890,"specSha256":"0535640ebd0151679868d62b7d4b23ba2ca62da9c93aa928e9190dc7b3bce738","branch":"refs/heads/fix/hero-install-guides-link","head":"c8b38b7b1662dafcf7b9a1fc7b49b2d3879fad91","baseRef":"refs/heads/main","baseCommit":"c8b38b7b1662dafcf7b9a1fc7b49b2d3879fad91","sourceTree":"42facd2797d547bdda57e1086adb02c5f8ce0d77","absentOptional":[]} -->

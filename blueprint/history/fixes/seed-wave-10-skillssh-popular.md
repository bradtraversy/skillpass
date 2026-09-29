# Fix: Seed wave 10 - skills.sh popular skills

**Type:** Fix
**Status:** verified
**Branch:** `fix/seed-wave-10-skillssh-popular`

## The problem

The directory holds 245 published skills, 243 of them curated, and September
added two. skills.sh ranks 9,832 skills by install telemetry. Per-agent,
Official, and source-owner pages (build-plan 25 to 27) all render lists over the
catalog and stay thin at this size. Brad's call (2026-09-29): add the popular
skills first, then build those pages over the bigger catalog.

## The fix

Extend `SEED_LISTINGS` (`apps/api/src/seed/listings.ts`) with wave 10: every
skill on the skills.sh homepage leaderboard (All Time, Trending, Hot; 600
unique skills, all above 50k installs) whose folder still exists upstream.
Discovery ran 2026-09-29 against the GitHub trees API.

| Bucket | Count | Handling |
|---|---|---|
| Added | 347 | singles, one per skill folder, attributed to the repo owner |
| Dropped after the dev seed run | 33 | see step 2 |
| Already listed | 84 | no entry, the manifest is idempotent |
| Gone upstream | 71 | renamed or removed since telemetry; cannot be listed |
| Zero-star copies of obra/superpowers | 31 | dropped |
| Hosted off GitHub (feishu, uizze, agent.qq, sentry/dev) | 32 | dropped, the pipeline takes GitHub or zip |
| Proprietary (degausai/wonda) | 1 | dropped |

Decisions:

- Singles everywhere, including the big vendor sets (marketingskills 33,
  mattpocock 31, runcomfy 30, azure 28, larksuite 27, hyperframes 27,
  caveman 20). Popularity is per skill and so is `skillpass add <slug>`.
- Repos with no license file (remotion-dev, firecrawl/cli, momentic-ai,
  genkit-ai, better-auth, Wind-Alice) go in on Brad's call; the README-only
  MIT claims (vercel-labs/agent-skills, 2dmurali, SpillwaveSolutions,
  nozomio-labs) too.
- Five runcomfy names collide with genmedia-labs names inside the wave; the
  lower-installed side gets a `runcomfy-` prefixed `name`.
- Owner casing follows the GitHub API (`Leonxlnx`, `JuliusBrussee`,
  `shadcn-ui`), which the manifest test enforces against the URL.
- The seed engine, pipeline, and runner do not change.

## Build steps

- [x] **Step 1 - Extend the manifest.** `WAVE_10` table plus `WAVE_10_NAMES`
  and a `wave10()` builder in `listings.ts`; test count 624, per-owner counts,
  no duplicate URLs. *Done when:* `pnpm test` green.
- [x] **Step 2 - Dev seed run and triage.** First run (624 entries, 64
  minutes): 345 published, 236 skipped, 43 failed. Every failure triaged:
  - 30 "archive exceeds the 100 MB download budget": all 27 heygen-com/hyperframes
    and 3 stablyai/orca entries. The fetcher pulls the whole repo archive;
    a subtree fetch would admit them. Dropped from the wave, noted in the
    manifest comment as a follow-up.
  - 10 "no files under ... at the pinned commit": 7 trailofbits plugins from
    waves 2 to 5 that moved upstream since July (published in prod at their
    pinned commit, so a prod rerun skips them; manifest hygiene follow-up),
    plus 3 mattpocock entries: implement-spec and retro moved from
    `skills/in-progress/` to `skills/engineering/` between discovery and
    the run (paths fixed), resolving-merge-conflicts removed upstream (dropped).
  - 2 "exceeds 1 MB": ai-blueprint (owner pick, already published in prod via
    submit, a no-op there) and pbakaus/impeccable (dropped).
  - 1 "package exceeds 10 MB total": tt-a1i/archify (dropped).
  - No slug collisions: every skip was an already-present listing.
  Manifest after triage: 591 entries (347 wave 10). Rerun: 2 published (implement-spec, retro), 581 skipped, 8 failed, all
  eight the pre-existing dev-only entries above. Zero wave 10 failures. Dev
  now holds 347 wave 10 listings.

## Verify

- `pnpm test` and `pnpm typecheck` green.
- Dev seed counts recorded; failures explained.
- Prod seed is a separate step after the PR, with Brad's explicit yes
  (`DATABASE_URL` pointed at `PROD_DATABASE_URL`).


<!-- blueprint:completion {"schemaVersion":1,"specBytes":3949,"specSha256":"cab47115bd224d4bcf657d6cddf970ac2ab8257ff3b2525f5979a76960b0cab5","branch":"refs/heads/fix/seed-wave-10-skillssh-popular","head":"798877f83fb6fb6e4e1e6cd6ce11699c49d67a5e","baseRef":"refs/heads/main","baseCommit":"fb5ad6c9f0e9f37692e36705f9bea80d98bd10d6","sourceTree":"192fb5c4aaa578b8111cd97574c91414d8c7dddd","absentOptional":[]} -->

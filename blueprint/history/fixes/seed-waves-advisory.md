# Current Feature

> **Generated file.** Holds the one feature or fix being built right now. Run
> `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
> an ad-hoc fix. Build one thing at a time; `/complete` archives it (to
> `blueprint/history/features/` or `blueprint/history/fixes/`) and resets this file.

## Seed waves 2-5 + advisory findings model

**Type:** Fix

## The problem

The directory holds only the 17 wave-1 `anthropics/skills` listings. The launch
backlog calls for seeding the bigger verified source waves recorded in the
launch-seed archive: `addyosmani/agent-skills`, `obra/superpowers`,
`kepano/obsidian-skills`, and `trailofbits/skills`.

Discovery (GitHub trees API, 2026-07-25) found 118 skill folders:

| Source | Skills | Layout | attributedTo |
|---|---|---|---|
| `addyosmani/agent-skills` | 24 | `skills/<name>` | `addyosmani` |
| `obra/superpowers` | 14 | `skills/<name>` | `obra` |
| `kepano/obsidian-skills` | 5 | `skills/<name>` | `kepano` |
| `trailofbits/skills` | 75 | `plugins/<plugin>/skills/<name>` | `trailofbits` |

The dev seed then exposed a second, deeper problem: **18 legitimate security and
DevOps skills hard-failed** on the content rules. Triage showed they are almost
all false positives - a regex can't tell "here's how attackers steal tokens"
(documentation) from "steal the tokens" (instruction), and `curl | sh` / `rm -rf`
are normal in install and container tooling. Hard-failing them is wrong for a
directory whose whole pitch is *inspect, don't blindly trust*.

## The fix

**Part 1 - seed the waves.** Extend `SEED_LISTINGS`
(`apps/api/src/seed/listings.ts`) with the 118 discovered subpath URLs. The seed
engine, pipeline, and `pnpm db:seed` runner don't change (wave-1 design: "later
waves extend this array"). One listing per skill folder; no new `featured` flags.

**Part 2 - advisory findings, not blocks.** The scanner should surface ambiguous
safety signals for human review instead of blocking. **Only concrete leaked
secret *values* still hard-fail** (a real committed key; republishing it would
literally leak the secret). Everything else content-based - prompt injection, the
malware/credential/destruction intent buckets, `curl | sh`, `rm -rf` - becomes a
`warning`: it publishes and shows on the passport as "what to look out for," with
copy that reassures the reader it may be perfectly legitimate. Feature 18 (LLM
review) is what later promotes an advisory to a real block with actual judgment.

**Decisions:**

- Hard-fail floor = leaked secret values only (Brad's call). Structural/manifest
  errors still fail. All other content findings are advisory.
- Slug collisions publish first-come, skip later duplicates (idempotency skip).
- Fix one nonsensical false positive in the new destruction rule: `format
  (machine-parseable ...)` matched `format` + `machine`; require `machine` not be
  followed by a hyphen so `machine-parseable`/`machine-readable` don't trip it.
- Engine bumps `0.2.0 -> 0.3.0` (rule-set semantics changed); re-seeded skills get
  0.3.0 passports, distinct from the 0.2.0 hard-fail era.
- Prod run stays a manual post-build step with explicit approval, via
  `PROD_DATABASE_URL`, after Part 2 lands.
- **Out of scope / follow-up:** many seeded skills show an empty summary (`>` /
  `>-`) because the manifest description isn't parsed from their SKILL.md; tracked
  separately. The submit-flow warning routing (feature 7) is unchanged here.

## Build steps

- [x] **Step 1 - Extend the source manifest.** Add the four wave arrays to
  `listings.ts` (three `skills/<name>` repos mapped like `ANTHROPIC_SKILLS`;
  trailofbits as full plugin subpaths). Update `listings.test.ts`: total count
  135, per-source attribution/URL-shape checks, and a no-duplicate-URL test.
  *Done when:* `pnpm test` green; `SEED_LISTINGS` has 135 entries.

- [x] **Step 2 - Dev seed run and triage.** Run `pnpm db:seed` against the dev
  `DATABASE_URL`, record published/skipped/failed counts, and triage every
  failure by reason. *Done:* 99 published, 1 collision-skipped, 18 flagged - all
  18 triaged as false positives (security-doc prose, installers, container
  cleanup), which motivated Part 2.

- [ ] **Step 3 - Advisory severities in `contentRule`.** Keep the format-specific
  `SECRET_PATTERNS` as `failure`; mark injection, dangerous-command, malware, and
  credential rows `warning` at assembly (an `advisory()` helper). Fix the
  `machine-parseable` false positive. Update `content.test.ts` to assert the new
  severities (secrets fail, the rest warn) and that `format (machine-parseable ...)`
  no longer trips. Update the `validate.test.ts` fixture matrix: `prompt-injection`
  is now `warning`/`medium`, not `failed`/`high`. Bump `ENGINE_VERSION` to `0.3.0`
  (and its assertions + `validator/package.json`). *Done when:* `pnpm test` green;
  a skill with only ambiguous signals validates `warning` and publishes.

- [ ] **Step 4 - Passport "what to look out for".** Reframe the passport findings
  block (`Passport.tsx`) from "Findings" to "What to look out for" with a short
  reassurance intro. *Done when:* `pnpm build` green; the section reads as advisory,
  not accusatory.

- [ ] **Step 5 - Re-seed dev.** Re-run `pnpm db:seed`; the 18 flagged skills now
  publish as `warning` (or clean `passed` for the two whose only hit was the
  machine-parseable bug). *Done when:* seed reports ~0 validation failures; spot
  check shows a security skill live with its advisory notes.

## Verify

- **Unit (the gate):** `pnpm test` green - listing tests, new severity assertions,
  updated fixture matrix.
- **Build:** `pnpm build` green (passport copy change type-clean).
- **Dev run:** re-seed publishes the previously-failed security skills as
  advisories; leaked-secret fixtures still fail.
- **Prod (post-build, explicit approval only):** rerun with `PROD_DATABASE_URL`,
  then spot-check skillpass.dev listings and per-skill passports.

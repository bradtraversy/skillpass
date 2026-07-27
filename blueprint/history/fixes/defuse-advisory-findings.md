# Current Feature

> **Generated file.** Holds the one feature or fix being built right now. Run
> `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
> an ad-hoc fix. Build one thing at a time; `/complete` archives it (to
> `blueprint/history/features/` or `blueprint/history/fixes/`) and resets this file.

## Fix - Defuse false-positive advisory findings

**Type:** Fix

## The problem

Security-education skills trip the credential heuristics on their own teaching
material. Live example: zeroize-audit bundles
`references/rust-zeroization-patterns.md`, and pattern 3 in
`packages/validator/src/rules/content.ts` flags both `## B3 - Box::leak(secret)`
(a heading naming a Rust anti-pattern) and the remediation line "**Fix**: Avoid
`Box::leak` for secrets..." - the advice against leaking is itself labeled
"exfiltrates or steals credentials". The passport then shows that verdict-like
message with no hint that the match sits in bundled reference docs rather than
the skill's instructions. Visitors read it as "this skill steals credentials."

## The fix

Three thin layers, none of which touches the immutable stored passports:

- **UI copy map** - display copy for advisory finding codes lives in
  `packages/skill-schema` (shared with the CLI later): per code, a human label
  and a neutral description that frames the finding as a pattern match plus a
  "read the flagged line" nudge. `Finding.tsx` renders the mapped copy and
  keeps the stored `message` only as fallback for unmapped codes. This is what
  fixes the 134 live passports, since their stored messages are immutable.
- **Bundled-docs hint** - when `location.path` is under `references/` or
  `docs/`, the finding shows an "in bundled reference docs" hint so a match in
  educational material reads differently from one in `SKILL.md` instructions.
- **Validator precision tuning** (future publishes + CLI scans):
  - extend pattern 3's negative lookbehind beyond `never|not|don't` with
    `avoid(s)?|prevent(s)?|stop(s)?` so remediation advice stops matching;
  - guard the leak-verb group against code identifiers with lookbehinds for
    `::` and `.` so `Box::leak(secret)` / `.leak(` stop matching;
  - reword the four `CREDENTIAL_PATTERNS` messages from behavior assertions
    ("exfiltrates or steals credentials") to match descriptions ("matches a
    credential-exfiltration phrase").

Must not break: existing positive detections (the pattern tests' true
positives stay red), passport immutability (no regeneration, no migration),
CLI `scan` output (it prints the new messages, fine), and unmapped finding
codes still render via the stored message.

## Build steps

- [x] **Step 1 - validator tuning + message rewording.** Update
  `CREDENTIAL_PATTERNS` in `packages/validator/src/rules/content.ts` per the
  fix; tests add the two zeroize-audit lines as negative cases ("Avoid
  `Box::leak` for secrets", "`Box::leak(secret)`" heading) and keep the
  existing positives ("steals passwords from the machine" and friends) green.
  *Done when:* `pnpm test` green with the new negative cases.

- [x] **Step 2 - finding copy map in `skill-schema`.** New `findings.ts`:
  `FINDING_COPY: Record<string, { label, description }>` covering the advisory
  codes the validator emits (`credential-harvesting`, `prompt-injection`,
  `dangerous-command`, `malware`, `destruction`, and any others in the rules),
  each framed as "matched a pattern" with a read-before-install nudge; export
  a `findingCopy(code)` helper with a null/fallback path. *Done when:*
  `pnpm test` green; tests cover a mapped code and an unmapped fallback.

- [x] **Step 3 - Finding UI.** *(Iterated at review: the bare evidence box read
  as SkillPass talking to the visitor - a quoted "**Fix**:" line looked like an
  instruction. The box now carries a caption, "the flagged line, quoted from
  <path:line>", with the quote on its own line.)* `Finding.tsx`: summary row shows the mapped
  label (fallback: the code); body shows the mapped description (fallback:
  stored message); an "in bundled reference docs" hint when `location.path`
  starts with `references/` or `docs/`. *Done when:* `pnpm build` green;
  dev screenshot of the zeroize-audit passport showing the neutral copy and
  the docs hint on both findings, unchanged stored data.

## Verify

- `pnpm test` and `pnpm build` green at every step.
- Dev: zeroize-audit passport shows "Credential access pattern"-style label,
  neutral description, docs hint; a finding with an unmapped code (fixture)
  still renders.
- Validator: `pnpm cli scan` on a fixture containing the two zeroize lines
  reports no credential finding; a genuine "steals passwords" fixture still
  flags.
- Prod (at `/complete`): push only - UI reinterprets stored passports, no
  backfill, no migration.

## Files / areas

- `packages/validator/src/rules/content.ts` (+ its test file)
- `packages/skill-schema/src/findings.ts` (new, +test), `src/index.ts`
- `apps/web/src/components/skill/Finding.tsx`

## Notes for the AI

- The stored passports are immutable - do not touch `warningsSummary`
  generation, the passport schema, or anything requiring regeneration.
- Keep the copy honest: these are flags worth reading, not exonerations. The
  neutral description should say what matched and invite review, not say
  "false positive".
- AI adjudication of findings (feeding heuristic flags into the Haiku review)
  is deliberately out of scope - it requires the review engine version bump
  and cached-review regeneration; queue it separately.
- JS regex lookbehind is variable-length; extending the alternation is safe.

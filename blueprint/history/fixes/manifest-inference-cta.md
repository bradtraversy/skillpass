# Fix: Manifest inference + distribution-aware CTA

**Type:** Fix

## The problem

Two gaps, both centered on the manifest, settled together:

1. **No manifest required, but a bare `SKILL.md` doesn't pass cleanly.** A missing
   `skill.json` today yields a `missing-manifest` warning, so a clean skill lands at
   status `warning` and routes to draft instead of publishing. Most real skills are
   a bare SKILL.md, so the common case hits friction.
2. **Every listing shows a "Download" button, even when that's wrong.** A CLI tool
   (Memcrate: `cargo install`) or a framework (the AI Blueprint: overlay-from-repo)
   shouldn't offer a zip download - the honest CTA is an install command or a repo
   link. The manifest has no way to say what kind of thing a listing is.

## The fix

**Infer a manifest when none is provided**, and **let a manifest declare its
distribution type** so the detail page shows the right primary action.

Settled decisions:

- **Inference:** synthesize `name`/`description` from SKILL.md frontmatter (else the
  dir/slug), `targets` from folder location (`.claude/skills` -> claude-code,
  `.agents/skills` -> codex) defaulting to **both `claude-code` + `codex`** for a
  bare root file, `permissions` = the detected **non-critical** set, and
  `distribution: 'skill'`. Marked `inferred`.
- **Safety (must not break):** inference declares only non-critical detected
  permissions. **Critical** capabilities (weight >= `CRITICAL_WEIGHT`, e.g.
  `destructive.delete`) stay undeclared, so `permissionsRule` still fails them. A
  dangerous bare SKILL.md still fails and stays unlisted.
- **Distribution (three types = the three ways to "get" something):**
  `skill` (download the validated snapshot, default), `cli` (show an install
  command + repo), `system` (link to the repo/docs). Inferred manifests are always
  `skill`.
- **Honesty:** the passport labels an inferred manifest ("permissions inferred from
  content, not author-declared").

**No migration:** distribution fields and the inferred flag live in the passport
`jsonb` (which already flows to the public detail) and the manifest `jsonb`.

## Build steps

- [x] **Step 1 - Manifest schema: distribution fields.** In
  `packages/skill-schema/src/manifest.ts` add `distribution: z.enum(['skill','cli','system']).default('skill')`,
  `homepage: z.url().optional()`, `install: z.string().min(1).optional()` to the
  manifest schema. *Done when:* `pnpm test` green; a manifest parses with a
  `distribution`, defaults to `skill` when omitted, and rejects an unknown type.

- [x] **Step 2 - Passport schema: carry distribution + inferred.** In
  `passport.ts` add `distribution`, optional `homepage`/`install`, and
  `manifestInferred: z.boolean()` to `skillPassportSchema`. *Done when:* `pnpm test`
  green; a passport parses with the new fields and `parsePassport` round-trips them.

- [x] **Step 3 - Infer a manifest in the loader.** In `packages/validator/src/load.ts`
  add a frontmatter reader (name/description only, no YAML dep) and synthesize a
  manifest when `skill.json` is absent: `{ state: 'ok', inferred: true, data, raw }`
  with the fields above (targets default `['claude-code','codex']`, permissions =
  detected non-critical, `distribution: 'skill'`). Add `inferred?: boolean` to the
  `ok` `ManifestState`. Update fixtures/tests that asserted `state: 'missing'` /
  `missing-manifest`. *Done when:* `pnpm test` green; a bare-SKILL.md fixture loads
  an inferred manifest and validates **passed** when clean, still **failed** on a
  critical capability (unit tests for both).

- [x] **Step 4 - Publish threads distribution + inferred into the passport.** The
  publish route reads `pkg.manifest.data.{distribution,homepage,install}` and
  `pkg.manifest.inferred`, passes them through `publishSubmission` to
  `buildPassport`, which sets them on the passport. *Done when:* `pnpm test` green;
  a published skill's passport carries its `distribution` (and `install`/`homepage`
  when present) and the correct `manifestInferred`; a manifest-authored skill is
  `false`, an inferred one `true`.

- [x] **Step 5 - UI: CTA per distribution + inferred label.** In
  `components/skill/InstallBar.tsx` (wired from `SkillDetail.tsx`, which has the
  passport + `githubRepoUrl`), render by `distribution`: `skill` keeps the current
  `aiskills add` + Download & pre-flight; `cli` shows the `install` command in the
  copy box + a "View repo" link (no download); `system` shows "View on GitHub"
  (+ docs link if `homepage`). In `Passport.tsx`, show the "permissions inferred"
  note when `manifestInferred`. *Done when:* build passes; screenshots show all
  three CTA variants (a skill, a cli with its command, a system with a repo link)
  and the inferred note.

## Verify

- **Unit (the gate):** manifest + passport schema tests (distribution defaults,
  rejects unknown types); validator tests (inferred clean -> passed, inferred
  critical -> failed, `manifestInferred` set); publish tests (passport carries
  distribution + inferred). `pnpm test` green.
- **End to end, local:** submit a public repo with a bare `SKILL.md` and no
  `skill.json` -> validates **passed**, publishes, lists, passport shows the
  inferred note and a Download CTA. Then a repo whose `skill.json` sets
  `distribution: cli` + `install` -> detail page shows the install command instead
  of Download. (Restart the API - it doesn't hot-reload, see
  [[api-dev-server-no-hot-reload]].)
- **UI:** the three CTA variants render; the inferred note appears only on inferred
  passports.

## Notes

- Single choke point for inference is `loadPackageFromFiles`, so the validator,
  publish flow, and CLI scan all see the inferred manifest; the source hash is
  computed from files, so inference doesn't change it.
- Distribution/homepage/install reach the UI via the passport `jsonb` embedded in
  the public detail - no public-schema or DB migration.
- The `cli`/`system` link defaults to the submitted `githubRepoUrl`; `homepage`
  overrides/augments it. No extra submission input needed for a `system` listing
  beyond `distribution: system` in its `skill.json`.
- Larger than a typical fix (5 steps across schema/validator/api/web) but one
  coherent manifest surface; if step 3's diff runs large, split the frontmatter
  reader from the synthesis wiring.
- Supersedes the parked infer-manifest spec (its design is folded in here).

# Feature: Workflow packs

**From build-plan:** feature 13b
**Status:** not started

## Goal

A multi-skill repo submits by URL alone and publishes as **one listing** with
its member skills visible, never N singles. The proving listing is the AI
Blueprint: 19 skills across `.claude/skills/` and `.agents/skills/`, zero repo
changes required. This also finalizes the API surface the CLI (feature 15)
installs packs from, so the CLI ships pack-aware from v0.

## In scope

- Pack inference in the validator (no `skill.json` required, ever)
- Member count in the submit endpoints' `detected` payload
- Persisting members at publish; exposing them in the public summary and detail
- Directory: pack badge, member names searchable, a Type filter (packs)
- Detail page: "Skills in this pack" section
- Submit page: the deferred pack recipe card
- Proving run: ai-blueprint submitted end to end on dev

## Out of scope

- CLI pack install (`skillpass add <pack>`) - feature 15, built against the
  contracts locked here
- A literal homepage tab row - 13a deliberately shipped tabs dormant; the
  Workflow-packs intent lands as a sidebar Type filter in the shipped UI idiom
- Backfills - no existing listing is a pack; nothing to migrate
- Publishing ai-blueprint to prod (a curation decision for later, one click)

## Build loop

Build one step at a time, never the whole feature at once. Diff + plain-English
explanation per step; approve before the next; optional checkpoint commits;
`/complete` makes the feature commit.

## Build steps

- [x] **Step 1 - pack inference in the validator.** In
  `packages/validator/src/load.ts`: when a package has no root `SKILL.md` and no
  `skill.json`, look for the known layouts - `.claude/skills/*/SKILL.md` +
  `.agents/skills/*/SKILL.md` (same-named folders pair into one entry with a
  per-target variant; unpaired folders become single-target entries) and, when
  no adapter dirs match, `skills/*/SKILL.md`. Two or more members infer a pack
  manifest (`skills[]` populated, member name/description from each file's
  frontmatter via `readSkillMeta`, folder-name fallback); exactly one member
  infers today's single-skill manifest anchored on that file. A root `SKILL.md`
  always wins as a single skill. Pack description falls back to README's first
  prose line, else "A pack of N skills".
  *Done when: validator tests cover both layouts, adapter pairing (incl. a
  folder present in only one adapter), the single-nested-skill case, the
  root-SKILL.md-wins rule, and zip parity (same loader); an inferred pack
  passes validation with `entries` resolved for every member and variant;
  `pnpm test` green.*

- [x] **Step 2 - member count in `detected`.** Add optional
  `skillCount: number | null` to `DetectedPackage` (null/absent = not a pack);
  populate from the inferred manifest's `skills[]` in both create endpoints;
  `SubmitForm` renders "pack - N skills" in the detection line.
  *Done when: route tests assert `skillCount` for a pack snapshot and null for
  a single skill; locked-shape tests updated; `pnpm test` green.*

- [x] **Step 3 - persist members at publish.** Migration 0014:
  `skill_versions.pack_skills` jsonb (array of the manifest `skills[]` entries:
  `{name, description?, entry, targets?, variants?}`), null for non-packs.
  `publishSubmission` writes it from the manifest. Update the `$inferSelect`
  version-row test fixtures (the known fixture tax).
  *Done when: publish tests assert the column round-trips a pack's members and
  stays null for singles; `pnpm test` green.*

- [x] **Step 4 - expose members in the public payloads.** Summary gains
  `packSkills: string[] | null` (member names; optional in the schema for
  deploy skew, like category); detail gains
  `packMembers: {name, description, entry, targets, variants}[] | null`.
  Built from `pack_skills` in the payload builders in `apps/api/src/db/skills.ts`.
  *Done when: route tests assert both fields for a pack and null for singles;
  `pnpm test` green.*

- [x] **Step 5 - directory: badge, search, Type filter.** `Row.tsx` shows a
  "Pack · N skills" chip when `packSkills` is non-empty. `filterSkills` adds
  member names to the search haystack and a `type: 'all' | 'skill' | 'pack'`
  filter; `FilterSidebar` gets a small Type group (All / Single skills /
  Packs) with counts, following the works-with group's pattern.
  *Done when: filterSkills tests cover the type filter and member-name search;
  build green; screenshot of a pack row with the badge.*

- [x] **Step 6 - detail: "Skills in this pack".** `SkillDetail.tsx` renders a
  members section (name, description, per-member target chips when they differ
  from the pack's) between the passport and Source sections, with a note that
  the passport covers the whole pack. Non-packs render nothing new.
  *Done when: build green; screenshot of the section on a dev pack listing.*

- [x] **Step 7 - submit page pack card.** Third recipe card in
  `SubmitGuide.astro`: "Multiple skills? Submit the repo root" with the
  recognized layouts file-tree; removes the single-skill-only gap flagged in
  the submit-page-guidance fix.
  *Done when: build green; screenshot of the three-card row (and stacked
  mobile).*

- [x] **Step 8 - proving run: ai-blueprint on dev.** Submit
  `https://github.com/bradtraversy/ai-blueprint` through the dev pipeline,
  watch `detected` report the pack, validation pass, and publish produce one
  listing with 19 members, both adapters mapped. The browser submit needs
  Brad's signed-in session; fall back to the curate path plus API checks if
  he's not at the keyboard.
  *Done when: dev API detail payload shows 19 `packMembers` with codex
  variants; the publish-time classifiers (category, display copy,
  integrations, AI review) complete or degrade to null without erroring on a
  listing with no root SKILL.md; directory shows the badge; screenshots of the
  listing and its members section.*

## Files / areas

- `packages/validator/src/load.ts` (+ tests) - inference
- `packages/skill-schema/src/submission.ts`, `public.ts` (+ tests) - contracts
- `apps/api/src/db/schema.ts`, `drizzle/0014_*`, `publish/publish.ts`,
  `db/skills.ts`, `routes/submissions.ts` (+ tests) - persist + expose
- `apps/web/src/lib/filterSkills.ts` (+ tests), `components/skill/Row.tsx`,
  `components/home/FilterSidebar.tsx`, `components/skill/SkillDetail.tsx`,
  `components/submit/SubmitForm.tsx`, `components/submit/SubmitGuide.astro`

## Data / contracts (load-bearing)

- `skill_versions.pack_skills` jsonb - the manifest `skills[]` entries verbatim
  (`{name, description?, entry, targets?, variants?}`); null = not a pack.
- Summary `packSkills: string[] | null` - names only, for badge count + search.
- Detail `packMembers` - full entries **including `variants`**; feature 15's
  CLI resolves per-target install paths from exactly this field plus the
  existing source endpoint. Locked here.
- `DetectedPackage.skillCount: number | null` - additive, optional.

## Testing

Logic gates (Vitest, same-diff): inference layouts and pairing rules (step 1),
`detected.skillCount` routes (step 2), publish round-trip (step 3), payload
builders (step 4), filterSkills type + search (step 5). UI steps 6-7 ride on
build + screenshots; step 8 is the end-to-end proof against the running dev
stack.

## Notes for the AI

- Inference must never fire when `skill.json` exists (explicit always wins) or
  a root `SKILL.md` exists (single skill wins; nested layouts ignored).
- Member entry names come from frontmatter `name` slugified, folder name as
  fallback; folder names are unique per layout so entry-name collisions can't
  occur within a layout - don't add dedupe machinery.
- `manifest.skills[].targets` must stay a subset of package targets or the
  schema rejects it - derive package targets from the union of member targets.
- The zip path shares `loadPackageFromFiles`, so pack zips work for free -
  cover with one test, don't build a separate path.
- Watch the tsx/node --watch staleness gotcha on the API dev server during
  step 8 (`touch src/index.ts` if the payload lacks the new key).
- The publish-time classifiers and AI review read skill content - check what
  they're fed when there is no root SKILL.md before step 8, and feed them the
  member SKILL.md set (or accept graceful null) rather than letting them error
  a pack publish.

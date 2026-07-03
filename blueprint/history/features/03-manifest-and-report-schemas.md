# Feature: Manifest and report schemas

**From build-plan:** feature 3
**Status:** complete

## Goal

Stand up `packages/skill-schema` as the shared contract layer: Zod schemas and
derived TypeScript types for the `skill.json` manifest, the validation report,
and the Skill Passport, plus the permission taxonomy and the core enums (status,
risk, targets, source types). Everything downstream speaks this language - the
validator (feature 4) consumes and emits these shapes, the API (features 5-8)
stores them, and the CLI (feature 9) prints them. This feature also settles the
targets-vs-variants boundary and how multi-skill packs map onto a listing.

## In scope

- New workspace package `packages/skill-schema` (name `skill-schema`, private,
  source-only exports, Zod as its one dependency). First Zod install in the repo.
- Core enums as const arrays + Zod schemas + derived types: validation status
  (`passed | warning | failed`), risk level (`low | medium | high | critical`),
  targets (`codex | claude-code | cursor | cowork | aider`), source types
  (`github | zip`).
- The permission taxonomy: a `PERMISSIONS` const of `{ key, label, description,
  riskWeight }` entries covering the filesystem/env/shell/network/connector/
  external/destructive groups from the validation model, a `permissionKeySchema`
  that rejects unknown keys, and a `permissionGroup(key)` helper.
- `manifestSchema` for `skill.json`: package metadata, declared permissions,
  targets, and a `skills` entry list that makes a multi-skill pack the general
  case (a single skill is a pack of one). Strict (unknown keys rejected), with
  subset and path-safety refinements.
- `validationReportSchema` + `reportFindingSchema`, including the
  status-findings consistency invariant (failed iff failures exist, warning iff
  warnings only, passed iff clean).
- `skillPassportSchema`: the public immutable artifact shape, with
  `permissionsSummary` as `{ declared, detected }` so feature 8 can diff it.
- Parse helpers `parseManifest` / `parseReport` / `parsePassport` returning the
  project's `{ success, data, error }` shape.
- Colocated Vitest tests for all of the above (this package is pure logic; the
  test gate applies to every step except the final wiring step).
- Re-point the `apps/web` fixture enums (`Verdict`, `RiskLevel`, `Target`) at the
  package so the UI and schema can't drift.

## Out of scope

- **Risk scoring** (deriving `riskLevel` from permission `riskWeight`s) and all
  detection/scanning logic - feature 4, the validator. This package carries the
  weights; it doesn't compute with them.
- **Fixture skill packages on disk** - feature 4 creates those for the validator.
  Feature 3 tests use inline JSON objects.
- **DB tables / Drizzle** - feature 5 stands up `apps/api`; the overview's
  Manifest/ValidationReport/SkillPassport rows will store these parsed shapes.
- **Passport signing** - the schema carries an optional `signature` field, but
  generating/verifying signatures is deferred (feature 7 at the earliest).
- **`unverified`** - the vault validation model lists it as a fourth status; it
  is a display state for "no report exists", not something the validator emits,
  so it stays out of the report schema.
- **Reshaping `SkillDetail`** - the web detail fixtures keep their display shape
  (formatted dates, display hashes) until real passports feed them (features
  7-8). Only the three shared enums move to the package now.

## Design rulings (the decisions this feature exists to make)

- **Targets vs variants.** `targets` is the compatibility claim: which agent
  tools a skill supports. `variants` is the packaging detail: an optional
  per-target map from target to entry path (e.g. `claude-code ->
  .claude/skills/x/SKILL.md`, `codex -> .agents/skills/x/SKILL.md`) for packages
  that ship per-tool adapters. A skill with one canonical `SKILL.md` that every
  target reads needs no `variants` at all. Variant keys must be a subset of the
  skill's effective targets.
- **Multi-skill packs.** The **package** is the unit of submission, validation,
  versioning, and listing - it maps 1:1 onto Skill + SkillVersion. A package
  contains one or more **skill entries** in the manifest's `skills` array; the
  entries live inside the stored manifest JSON (the overview Manifest row's
  `variants`/`raw` json), not as separate SkillVersion rows. Per-entry
  sub-listings in the UI are a later concern.
- **Pack-level declarations are the superset.** Package `targets` and
  `permissions` cover the whole pack; a skill entry may narrow them (its targets
  and permissions must be subsets of the package's). The package-level set is
  what the passport summarizes and feature 8 diffs.
- **Risk enum is `low | medium | high | critical`.** This matches the vault
  validation model and the shipped UI badges (features 1-2). The overview's
  `none | low | medium | high` loses: a no-permission docs skill is `low`, and
  `critical` is needed as the instant-fail tier. Flag the overview for a fix at
  the next `/overview` run.
- **Status stays three-valued** (`passed | warning | failed`), matching the
  overview's locked shapes and the UI's `Verdict`.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Package scaffold + core enums (logic).** Create
  `packages/skill-schema/` with `package.json` (name `skill-schema`, private,
  `"type": "module"`, `exports` pointing at `./src/index.ts`, dep `zod`),
  a strict `tsconfig.json`, `src/enums.ts` with the four const arrays
  (`VALIDATION_STATUSES`, `RISK_LEVELS`, `TARGETS`, `SOURCE_TYPES`), their Zod
  schemas, and derived types (`ValidationStatus`, `RiskLevel`, `Target`,
  `SourceType`), re-exported from `src/index.ts`. Colocated `enums.test.ts`:
  each schema accepts its members and rejects an unknown string. *Done when:*
  `pnpm install` succeeds, `pnpm test` is green including the new tests, and
  root vitest picks the package up via the existing `packages/**` glob.
- [x] **Step 2 - Permission taxonomy (logic).** `src/permissions.ts`:
  `PERMISSIONS` const (key, label, description, riskWeight) covering
  `filesystem.read.project`, `filesystem.read.home`, `filesystem.write.project`,
  `filesystem.write.home`, `env.read`, `shell.suggest`, `shell.execute`,
  `network.fetch`, `network.post`, `connector.github.read`,
  `connector.github.write`, `connector.gmail.read`, `connector.gmail.send`,
  `connector.calendar.read`, `connector.calendar.write`, `external.publish`,
  `external.deploy`, `external.payment`, `destructive.delete`;
  `permissionKeySchema` (enum of the keys); `PermissionKey` type;
  `permissionGroup(key)` returning the prefix group; `riskWeightOf(key)` lookup.
  Tests: keys are unique, every key parses, unknown key rejected, group
  derivation cases, weights are positive and `destructive.delete` /
  `external.payment` / `shell.execute` outrank the read-only keys. *Done when:*
  `pnpm test` green with the new cases.
- [x] **Step 3 - Manifest schema (logic).** `src/manifest.ts`:
  `skillEntrySchema` (`name` slug, optional `description`, `entry` path,
  optional `targets`, `permissions`, `variants`) and `manifestSchema`
  (`schemaVersion: '0.1'`, `name` slug, `description`, optional semver
  `version`, `targets` nonempty, `permissions` (may be empty), optional
  `skills` nonempty when present), `.strict()` at both levels, with
  refinements: entry targets/permissions are subsets of the package's, variant
  keys are a subset of the entry's effective targets, entry names are unique
  within the pack, and `entry`/variant paths are relative with no `..` segments
  or leading `/`. `parseManifest(input: unknown)` returns
  `{ success, data, error }`. Tests: valid single-skill manifest, valid
  two-skill pack with variants, and rejections for missing name, bad slug,
  unknown target, unknown permission key, empty `skills` array, duplicate entry
  names, entry targets not a subset, variant key outside targets, path
  traversal in `entry`, and an unknown top-level key. *Done when:* `pnpm test` green with
  those cases.
- [x] **Step 4 - Report + passport schemas (logic).** `src/report.ts`:
  `reportFindingSchema` (`code`, `message`, optional `location` of
  `{ path, line?, snippet? }`) and `validationReportSchema` (`schemaVersion`,
  `status`, `riskLevel`, `sourceHash`, `engineVersion`, `permissionsDeclared`,
  `permissionsDetected`, `warnings`, `failures`, `createdAt` ISO string) with a
  `superRefine` enforcing status-findings consistency. `src/passport.ts`:
  `skillPassportSchema` (`schemaVersion`, `validationStatus`, `riskLevel`,
  `permissionsSummary: { declared, detected }`, `warningsSummary` findings
  array, `sourceHash`, optional `resolvedCommitSha`, `engineVersion`,
  `generatedAt`, optional `signature`). `parseReport` / `parsePassport`
  helpers. Tests: consistent reports parse for all three statuses;
  `failed`-with-no-failures, `passed`-with-warnings, and
  `warning`-with-failures all reject; valid passport parses; passport with an
  unknown permission key in the summary rejects. *Done when:* `pnpm test`
  green with those cases.
- [x] **Step 5 - Point apps/web at the package (wiring).** Add `skill-schema`
  as a workspace dependency of `apps/web`; in `lib/skills.ts` replace the
  local `Verdict` / `RiskLevel` / `Target` literals with imports (keep
  `Verdict` as an alias of `ValidationStatus` so component code is untouched);
  drop the now-stale "superseded by packages/skill-schema" comment. No new
  logic, no new test. *Done when:* `pnpm typecheck`, `pnpm build`, and
  `pnpm test` are all green and the built site renders unchanged.

## Files / areas

- `packages/skill-schema/package.json`, `tsconfig.json` - new package plumbing.
- `packages/skill-schema/src/{index,enums,permissions,manifest,report,passport}.ts`
  plus colocated `*.test.ts` files.
- `apps/web/package.json` (workspace dep) and `apps/web/src/lib/skills.ts`
  (enum imports) in step 5 only.
- No changes to `apps/web` components, pages, or styles.

## Data / contracts

All load-bearing; features 4-9 build on these exact shapes.

```ts
type ValidationStatus = 'passed' | 'warning' | 'failed';
type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
type Target = 'codex' | 'claude-code' | 'cursor' | 'cowork' | 'aider';
type SourceType = 'github' | 'zip';
type PermissionKey = /* the 19 taxonomy keys */;

interface SkillEntry {
  name: string;              // kebab-case slug
  description?: string;
  entry: string;             // relative path to the SKILL.md
  targets?: Target[];        // subset of package targets
  permissions?: PermissionKey[]; // subset of package permissions
  variants?: Partial<Record<Target, string>>; // per-target entry path
}

interface Manifest {         // skill.json
  schemaVersion: '0.1';
  name: string;              // kebab-case slug
  description: string;
  version?: string;          // semver
  targets: Target[];         // nonempty
  permissions: PermissionKey[];
  skills?: SkillEntry[];     // nonempty when present; absent = single skill
}

interface ReportFinding {
  code: string;              // e.g. 'secret-pattern', 'undeclared-permission'
  message: string;
  location?: { path: string; line?: number; snippet?: string };
}

interface ValidationReport {
  schemaVersion: '0.1';
  status: ValidationStatus;  // consistent with warnings/failures arrays
  riskLevel: RiskLevel;
  sourceHash: string;
  engineVersion: string;
  permissionsDeclared: PermissionKey[];
  permissionsDetected: PermissionKey[];
  warnings: ReportFinding[];
  failures: ReportFinding[];
  createdAt: string;         // ISO datetime
}

interface SkillPassport {
  schemaVersion: '0.1';
  validationStatus: ValidationStatus;
  riskLevel: RiskLevel;
  permissionsSummary: { declared: PermissionKey[]; detected: PermissionKey[] };
  warningsSummary: ReportFinding[];
  sourceHash: string;
  resolvedCommitSha?: string;
  engineVersion: string;
  generatedAt: string;       // ISO datetime
  signature?: string;        // signing deferred
}
```

Parse helpers return `{ success: true, data } | { success: false, error }` per
`coding-standards.md`.

## Testing

- Pure-logic package: every schema/taxonomy step (1-4) ships colocated Vitest
  tests in the same diff; the named rejection cases above are the minimum bar.
- Step 5 is wiring with no new logic: it rides on `pnpm typecheck` +
  `pnpm build` + the existing suite staying green.
- Verify overall with `pnpm test` (root config already globs `packages/**`) and
  `pnpm typecheck`.

## Notes for the AI

- Zod v4, imported as `zod`. Use `z.enum` over const arrays, `.strict()` on
  object schemas, `superRefine` for the cross-field invariants.
- Source-only package: `exports` points at `./src/index.ts`, no build step.
  Vite/Vitest consume TS directly; `astro check` type-checks it once `apps/web`
  imports it (step 5). Keep the package free of Node-specific APIs.
- Strict TS, no `any`; use `unknown` for parse inputs.
- pnpm in this shell may need `--store-dir /home/brad/.local/share/pnpm/store/v11`
  if install errors with `ERR_PNPM_UNEXPECTED_STORE`.
- Keep comments minimal per `coding-standards.md`; the schemas should read as
  the documentation.
- The risk-enum ruling diverges from `project-overview.md` (`none|low|medium|high`
  there). Do not edit the overview mid-feature; note it for the next `/overview`
  run (or fix at `/complete`).
- Slug regex for `name` fields: `/^[a-z0-9]+(-[a-z0-9]+)*$/`.
- `Verdict` stays the display alias in `apps/web`; don't rename component props.

# Feature: Validator V0 with fixtures

**From build-plan:** feature 4
**Status:** complete

## Goal

Build the scan engine: `packages/validator` takes a local skill package
directory, loads its `skill.json` and `SKILL.md` files, runs V0 static-analysis
rules, and emits a schema-valid `ValidationReport` (feature 3's locked shape).
V0 is pure pattern matching against fixture packages on disk - no network, no
queue, no sandbox, no execution. This is the engine features 6 (queue worker),
7 (passport generation), 8 (pre-flight), and 9 (CLI) all wrap; the CLI-equals-
website trust promise depends on this one package being the single scanner.

## In scope

- New workspace package `packages/validator` (dir and name `validator`, private,
  source-only exports like `skill-schema`), depending on `skill-schema` and
  Node built-ins (`node:fs`, `node:path`, `node:crypto`) only.
- **Loader**: `loadPackage(dir)` walks the package directory, reads files as
  UTF-8, parses `skill.json` when present (via `parseManifest`), resolves the
  skill entry files (manifest `skills[].entry`/`variants`, or root `SKILL.md`
  when there is no manifest), and computes the **source hash** - sha256 over
  the sorted relative paths + contents, formatted `sha256:<hex>`. Returns
  structured facts, not findings.
- **Structural rules**: missing `skill.json` -> warning (`missing-manifest`);
  unparseable or schema-invalid manifest -> failure (`invalid-manifest`);
  referenced entry file missing or empty -> failure (`missing-skill-file`);
  package unreadable / no skill content at all -> failure.
- **Content rules, failure tier** (data-driven pattern tables): secret patterns
  (GitHub `ghp_`/`gho_` tokens, AWS `AKIA` keys, `sk-` API keys, PEM private key
  blocks, generic `api_key = "<value>"` assignments) -> `secret-pattern`;
  prompt-injection phrases ("ignore previous/all instructions", "disregard your
  system prompt", "bypass approval/permission") -> `prompt-injection`; dangerous
  commands (`curl ... | bash`/`sh`, `rm -rf` outside temp, base64-decode piped
  to a shell) -> `dangerous-command`.
- **Permission detection + mismatch**: a V0 mapping table from text patterns to
  `PermissionKey` (see Data / contracts). Detected keys beyond the declared set
  -> warning (`undeclared-permission`); detected keys with `riskWeight >= 7`
  beyond declared -> failure (`undeclared-critical-permission`), per the
  validation model's "critical behavior beyond declared permissions" rule.
- **Risk scoring**: `riskLevel` = max `riskWeight` across the union of declared
  + detected permissions: 0-3 `low`, 4-6 `medium`, 7-8 `high`, 9+ `critical`.
  Risk and status stay independent axes - a passed skill that declares
  `shell.execute` is still `high`.
- **Assembly**: `validatePackage(dir, opts?)` glues loader + rules into a
  `ValidationReport`. Status is *derived* from findings (failures -> `failed`,
  else warnings -> `warning`, else `passed`), never hand-set, and the assembled
  report is self-checked with `validationReportSchema.parse` before returning.
  `createdAt` comes from an injectable clock (`opts.now`); `engineVersion` is
  the package version.
- **Fixture packages** under `packages/validator/fixtures/`: `clean-skill`
  (passed), `undeclared-network` (warning), `missing-manifest` (warning),
  `broken-manifest` (failed), `leaked-secret` (failed), `prompt-injection`
  (failed), plus a multi-skill pack fixture to prove entry resolution. An
  end-to-end matrix test asserts the expected status per fixture.

## Out of scope

- **Acquisition** - fetching a GitHub URL, extracting a zip, R2 snapshots. The
  validator takes a local directory; features 5-6 (API) and 9 (CLI) feed it.
- **Sandbox dry run and report signing** - deferred per the validation model;
  the report's optional `signature` stays unset.
- **Passport generation** - feature 7 turns reports into passports.
- **Queue/progress integration** - feature 6; V0 is a synchronous function call.
- **Compatibility/version checks per target tool** - the manifest's `targets`
  are trusted as declared in V0.
- **Binary handling and size limits** - V0 reads everything as UTF-8 text;
  hardening comes with real submissions (feature 6).
- **Tuning for false positives beyond the fixture set** - patterns are data
  tables precisely so later features can extend them without re-architecting.

## Design rulings (the calls this feature exists to make)

- **Detection-to-permission mapping is a data table**, not scattered code:
  `{ pattern: RegExp, permission: PermissionKey, description }[]`. V0 rows:
  fetch/curl/wget/HTTP-read -> `network.fetch`; POST/upload/webhook/"send data"
  -> `network.post`; "run/execute" a shell command -> `shell.execute`; reads of
  `~`/`$HOME`/dotfiles -> `filesystem.read.home`; `.env`/`process.env`/env-var
  reads -> `env.read`; `git push`/PR creation -> `connector.github.write`;
  npm/site publish -> `external.publish`; deploy commands -> `external.deploy`;
  send email -> `connector.gmail.send`; `rm -rf`/irreversible deletes ->
  `destructive.delete`. Writing project files is assumed baseline for a skill
  and not detected in V0.
- **Missing manifest is a warning, invalid manifest is a failure.** Wild skills
  often ship only a `SKILL.md`; the directory should scan them and nudge, not
  reject. But a manifest that exists and lies (malformed JSON, schema-invalid)
  is a trust violation -> failed.
- **Risk = permissions, status = findings.** The risk formula never reads
  findings and the status derivation never reads permissions (mismatch findings
  are produced by a rule like any other). Keeps both axes explainable.
- **Rules are pure** - they take loaded facts (`LoadedPackage`) and return
  findings. Only the loader touches the filesystem, so most tests need no disk.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Package scaffold + loader + source hash (logic).** Create
  `packages/validator` (package.json with `skill-schema: workspace:*` dep,
  strict tsconfig with node types, `@types/node` devDep, src/index.ts).
  `src/load.ts`: `LoadedPackage` type and `loadPackage(dir)` - recursive file
  walk (sorted, relative paths), UTF-8 contents, manifest presence +
  `parseManifest` result, resolved entry files, `sourceHash` via `node:crypto`.
  First fixtures: `clean-skill` and the multi-skill pack. Tests: loads both
  fixtures with correct file lists and entries, hash is stable across runs and
  changes when a file changes, nonexistent dir throws a typed error. *Done
  when:* `pnpm test` green with the new cases.
- [x] **Step 2 - Structural rules (logic).** `src/rules/structure.ts`: findings
  for `missing-manifest` (warning), `invalid-manifest` (failure),
  `missing-skill-file` / empty entry (failure), `empty-package` (failure).
  Fixtures added: `missing-manifest`, `broken-manifest`. Tests per rule using
  loader output (pure - hand-built `LoadedPackage` objects where possible).
  *Done when:* `pnpm test` green with the new cases.
- [x] **Step 3 - Failure-tier content rules (logic).** `src/rules/content.ts`
  with two pattern tables: `SECRET_PATTERNS` and `INJECTION_PATTERNS` (+
  dangerous commands), each row `{ code, pattern, message }`, scanning all
  loaded files and attaching `location` (path, line, snippet). Fixtures added:
  `leaked-secret`, `prompt-injection`. Tests: each table row has at least one
  matching and one near-miss non-matching case; findings carry correct
  locations. *Done when:* `pnpm test` green with the new cases.
- [x] **Step 4 - Permission detection + mismatch (logic).**
  `src/rules/permissions.ts`: the `PERMISSION_SIGNALS` mapping table, detection
  over loaded files, then the mismatch rule - `undeclared-permission` warning,
  `undeclared-critical-permission` failure for `riskWeight >= 7`. Fixture
  added: `undeclared-network`. Tests: each mapping row matches its phrase,
  declared permissions produce no finding, undeclared low-weight -> warning,
  undeclared `shell.execute` -> failure, detected set is deduplicated. *Done
  when:* `pnpm test` green with the new cases.
- [x] **Step 5 - Risk scoring + assembly + fixture matrix (logic).**
  `src/score.ts`: `riskLevelFor(keys)` with the 0-3/4-6/7-8/9+ thresholds.
  `src/validate.ts`: `validatePackage(dir, opts?)` - load, run all rules,
  derive status from findings, sort findings by (path, code) for determinism,
  stamp `createdAt` from `opts.now ?? new Date()` and `engineVersion`,
  self-check with `validationReportSchema.parse`. End-to-end matrix test: every
  fixture -> expected status and key findings; clock injected for a stable
  `createdAt`; the report round-trips through `parseReport`. *Done when:*
  `pnpm test` green including the matrix, and `pnpm build` + `pnpm typecheck`
  stay green (web untouched).

## Files / areas

- `packages/validator/package.json`, `tsconfig.json` - package plumbing.
- `packages/validator/src/{index,load,score,validate}.ts` and
  `src/rules/{structure,content,permissions}.ts`, each with a colocated test.
- `packages/validator/fixtures/<name>/...` - the seven fixture packages
  (small: a `skill.json` and one or two markdown files each).
- **No changes to `apps/web`** - the web app must never import this package
  (it uses `node:fs`; the front end is static and Node-free).

## Data / contracts

`ValidationReport`, `ReportFinding`, `PermissionKey`, and the enums are already
locked in `skill-schema` - the validator emits them unchanged. New contracts
this feature locks:

```ts
interface LoadedPackage {
  dir: string;
  files: { path: string; content: string }[]; // sorted relative paths
  manifest:
    | { state: 'ok'; data: Manifest; raw: string }
    | { state: 'missing' }
    | { state: 'invalid'; error: string };
  entries: { skillName: string; path: string; exists: boolean }[];
  sourceHash: string; // "sha256:<hex>" over sorted paths + contents
}

interface PermissionSignal {
  pattern: RegExp;
  permission: PermissionKey;
  description: string;
}

type Rule = (pkg: LoadedPackage) => RuleFinding[]; // pure
interface RuleFinding extends ReportFinding { severity: 'warning' | 'failure' }

function validatePackage(
  dir: string,
  opts?: { now?: Date },
): Promise<ValidationReport>;

const ENGINE_VERSION: string; // mirrors package.json version, starts 0.1.0
```

Risk thresholds (load-bearing for features 7-8 display): max weight 0-3 ->
`low`, 4-6 -> `medium`, 7-8 -> `high`, 9+ -> `critical`.

## Testing

- Everything here is in-scope logic: every step ships colocated Vitest tests in
  the same diff. Rules are pure functions, so most tests build `LoadedPackage`
  objects inline; only loader and matrix tests touch the fixture folders.
- Pattern tables get paired positive/near-miss cases per row so false-positive
  regressions are caught when rows are tuned later.
- The step 5 matrix test is the feature's acceptance proof: seven fixtures,
  each asserting status, key finding codes, and riskLevel.
- Clock is injected (`opts.now`) - no fake timers needed for the report tests.
- Verify with `pnpm test` and `pnpm typecheck`; `pnpm build` should be
  untouched but run once at the end to prove the web app is unaffected.

## Notes for the AI

- Rules must be pure and data-driven; only `load.ts` may import `node:fs`.
- Findings must be deterministic: stable sort by (path, code); file walk sorted.
- Derive status, never assign it - the schema's consistency refinement will
  reject a hand-set status that disagrees with the findings arrays.
- Line numbers in `location` are 1-based; keep snippets to the matching line.
- The npm registry has an unrelated popular package named `validator`; ours is
  private and consumed via `workspace:*`, so no conflict, but never `pnpm add
  validator` from another package - declare `"validator": "workspace:*"`.
- pnpm may need `--store-dir /home/brad/.local/share/pnpm/store/v11` in this
  shell.
- Keep comments minimal; the pattern tables' `description` fields are the
  documentation.
- Fixture `SKILL.md` files contain injection phrases and fake secrets by
  design; keep fake credentials obviously fake (e.g. `ghp_` + `x`-padding) so
  secret scanners flagging this repo see placeholders.

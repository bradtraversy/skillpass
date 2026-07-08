# Feature: CLI scan and report

**From build-plan:** feature 9
**Status:** complete

## Goal

The validator leaves the website: `packages/cli` ships an `aiskills` command
where `scan` runs the exact same validation engine against a local skill folder
(readable terminal output or `--json`, non-zero exit on a failed scan) and
`report` fetches the hosted passport pre-flight for a published skill from the
public API. This closes the Validation Model's local lane: users can verify a
skill themselves instead of trusting the website alone.

## Command semantics (decision)

- `aiskills scan <path>` - load the local package with the validator's own
  loader, run the full rule set, print a readable report (status, risk, source
  hash, permissions with plain-English labels, findings with path:line).
  `--json` prints the raw `ValidationReport` JSON instead. Exit codes: 0
  passed/warning, 1 failed, 2 usage or load errors (bad path, unreadable
  package).
- `aiskills report <slug>[@version]` - fetch `GET /skills/:slug` (and the
  pinned version when given) plus `GET /skills/:slug/:version/preflight` from
  the public API and render the passport pre-flight: name, version, validation
  status, risk, source hash + verified flag, permissions, permission diff vs
  previous version, maintainer. `--json` prints the `PublicPreflight` object
  verbatim. Exit codes: 0 ok, 1 blocked version, 2 not found / network / API
  errors.
- The API base URL comes from `AISKILLS_API` (default
  `http://localhost:8787`); the default swaps to the deployed API at
  deploy/launch time.
- Note: the vault MVP sketch (June) showed `report ./path --json`; the newer
  in-repo contracts (7b/7c/8) explicitly name the CLI as the consumer of
  `PublicSkillDetail`/`PublicPreflight`, so `report` is the hosted lookup and
  `scan --json` covers the local-JSON use case. Flagged as a deliberate call.

## In scope

- **`packages/cli`** workspace package (name `cli`, private, type module,
  same source-exports pattern as `validator`/`skill-schema`):
  - deps: `validator`, `skill-schema` (workspace), `tsx` (runtime for the bin
    launcher, same version the API uses).
  - `bin/aiskills.mjs` - shebang launcher that registers tsx and imports
    `src/index.ts`, so `node packages/cli/bin/aiskills.mjs ...` (and a root
    `pnpm cli` script) work without a build step.
- **`src/scan.ts`** - `runScan(path, { json })` returning
  `{ lines: string[], exitCode: number }`; wraps `validatePackage`, catches
  the loader's read errors as exit 2 with a readable message.
- **`src/report.ts`** - `runReport(ref, { json, apiUrl, fetchImpl })` with the
  same `{ lines, exitCode }` shape; parses `slug[@version]`, calls the two
  public endpoints, validates responses with the locked schemas, maps 404 to
  a friendly "not published" message (exit 2) and `blocked: true` to exit 1.
  `fetchImpl` is injectable for tests; default `globalThis.fetch`.
- **`src/render.ts`** - shared pure renderers: status/risk lines, permission
  rows with taxonomy labels, findings with `path:line`, diff lines. Plain
  ANSI-free text (no color dependency).
- **`src/index.ts`** - hand-rolled arg parsing (no new arg library):
  `scan|report`, `--json`, `--help`/no-args usage text, unknown command ->
  usage + exit 2. Prints lines, exits with the returned code.
- **Root wiring**: `pnpm cli` script in the root `package.json`; a CLI line in
  the Commands section of `AGENTS.md`.

## Out of scope

- `aiskills scan <github-url>` - needs the GitHub fetch logic extracted from
  `apps/api`; deferred until a feature needs it in two places.
- `aiskills add` / `install` / `publish` / `pack` (MVP's "possible later").
- npm publishing, versioned dist builds, colorized output (launch scope).
- Recording `source: 'cli'` download events (no CLI download exists yet).

## Build steps

- [x] **Step 1 - package + scan** - scaffold `packages/cli` (package.json,
  tsconfig if needed, bin launcher), `src/scan.ts` + `src/render.ts` +
  `src/index.ts` with the `scan` path wired end to end; workspace install via
  the store-dir workaround. *Done when:* unit tests cover `runScan` against
  the validator's own fixtures (clean-skill passes with exit 0,
  leaked-secret fails with exit 1 and findings rendered with path:line,
  bad path exits 2, `--json` output parses with `validationReportSchema`);
  suite green.
- [x] **Step 2 - report** - `src/report.ts` + `report` dispatch in
  `src/index.ts`. *Done when:* tests with an injected fetch stub cover a
  rendered report (status, hash verified, permissions, diff line), `--json`
  emitting schema-valid `PublicPreflight`, `slug@version` pinning, 404 ->
  exit 2 message, blocked -> exit 1, network failure -> exit 2; suite green.
- [x] **Step 3 - wiring + evidence** - root `pnpm cli` script, `AGENTS.md`
  Commands line, usage/help text test. *Done when:* build green; captured
  terminal output shows `aiskills scan` on a passing and a failing fixture
  (with exit codes echoed), `aiskills scan --json`, and `aiskills report
  smoke-clean` against the live dev API; `aiskills` with no args prints
  usage and exits 2.

## Files / areas

- `packages/cli/package.json`, `bin/aiskills.mjs`, `src/index.ts`,
  `src/scan.ts` (+test), `src/report.ts` (+test), `src/render.ts` (+test),
  `src/args.ts` if parsing grows (+test).
- Root `package.json` (cli script), `AGENTS.md` (Commands).
- `pnpm-lock.yaml` (workspace install).

## Data / contracts

- **The CLI consumes only locked contracts**: `ValidationReport` (scan),
  `PublicSkillDetail` + `PublicPreflight` (report). It validates API
  responses with the schemas instead of trusting the wire.
- **Same engine, same verdicts**: scan calls `validatePackage` directly - no
  reimplementation, so local and hosted results can only differ by engine
  version.
- Exit codes are part of the contract (CI usage): 0 ok/warning, 1
  failed/blocked, 2 usage/load/network.

## Testing

- All three steps are logic-bearing: scan/report/render/arg tests ride in the
  same diffs, fixtures come from `packages/validator/fixtures` (real engine,
  no mocks), report tests inject a fetch stub.
- Step 3's terminal evidence doubles as the integration check; no browser
  involved.

## Notes for the AI

- pnpm installs in this shell need
  `pnpm --store-dir ~/.local/share/pnpm/store/v11 install` (project memory);
  run gates via direct binaries.
- Return `{ lines, exitCode }` from the command cores and keep
  `process.exit`/`console.log` only in `src/index.ts` - that is what makes
  the cores testable.
- Reuse `PERMISSIONS` from skill-schema for plain-English permission labels;
  do not import from `apps/*`.
- The validator throws `PackageReadError` for unreadable dirs - map it to
  exit 2, don't let it stack-trace.
- Node's `util.parseArgs` is fine for flag parsing if it stays simple;
  hand-rolled otherwise. No commander/yargs.

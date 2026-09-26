# Feature: Install from any repo with local pre-flight

**From build-plan:** feature 22
**Build attempt:** 1
**Status:** verified

**Branch:** `feature/install-from-any-repo-with-local-pre-flight`

## Goal

`skillpass add` accepts a GitHub repository reference for skills that are not in the
directory: it fetches the pinned repo snapshot, runs the same validator locally, shows the
same pre-flight report and risk confirmation, then installs through the same atomic install
path with a receipt marked unlisted. The passport stands in front of every install, listed
or not. The unlisted path never lists, submits, publishes, or calls the SkillPass API.

## In scope

- Two reference forms on `add`, alongside the existing `<slug>[@version]`:
  - `github:<owner>/<repo>[/<path>][@<ref>]` - the short form from the build plan, with an
    optional `@<ref>` pin (branch, tag, or commit) mirroring the `slug@version` grammar.
  - `https://github.com/<owner>/<repo>` and
    `https://github.com/<owner>/<repo>/tree/<ref>[/<path>]` - a plain GitHub URL, with the
    same grammar the API accepts on submission (`.git` suffix tolerated).
- Pin the reference to a full commit sha through the public GitHub API, download that
  commit's zip archive from codeload, re-root the tree at `<path>` when given, and enforce
  the CLI's existing snapshot caps and unsafe-path refusal before anything is decoded.
- Load the files with `loadPackageFromFiles` (manifest inference, pack inference, and the
  source hash exactly as the directory computes them) and run `validateLoadedPackage`.
- Render a local pre-flight report in the same shape as the hosted one (skill, version,
  status, risk, source hash, engine, permissions, findings) plus the repo, subpath, and
  pinned commit, and a clear unlisted marker.
- Block a `failed` report exactly as a blocked hosted version is blocked: exit 1, nothing
  written.
- Reuse `confirmRisk` with the same rule as directory installs: medium+ risk needs a yes or
  `--yes`; without a TTY the command exits 2 with the rerun hint.
- Install single skills and inferred packs through the existing `installSingle` and
  `installPack` code, so `--target` (repeatable), `--global`, `--dir`, the interactive
  location picker, shared-folder deduplication, the declared-target warning, destination
  occupancy checks, atomic writes, and the pack member fan-out all behave as they do today.
- Receipts for unlisted installs carry an `unlisted` marker (repo, optional subpath, full
  commit sha) so later commands can tell them from directory installs.
- `list` shows the unlisted origin; `outdated` reports unlisted installs as not tracked by
  the directory and never compares them to a same-named directory slug; `update` refuses an
  unlisted install with a reinstall hint instead of replacing it with the directory's skill
  of the same name.
- Help text, the CLI README, and the docs CLI page document the new forms and what unlisted
  means.

## Out of scope

- Private repositories and GitHub tokens. This feature uses unauthenticated GitHub only
  (60 requests per hour per IP; an install costs two). A token is a later fix if needed.
- Refreshing an unlisted install through `update` or `outdated` (re-fetching the repo).
  An unlisted install is refreshed with `remove` then `add` again.
- `report github:...` or scanning a remote repo without installing; `scan` on a clone
  already covers that.
- Any request to the SkillPass API from the unlisted path, including a lookup of whether the
  repo is already listed. No submission, listing, publish, or download event.
- Hosts other than github.com, local paths, tarball URLs, and git protocols.
- Branch names containing `/` in the URL form, the same v1 limitation the API has.
- The web UI, a CLI version bump, and the npm publish (a separate release chore).

## Build loop

Build one small step at a time. `blueprint/config.json` is absent, so defaults
apply: `workflow.stepReview: feature` (one review packet after all steps) and
checkpoint commits disabled. Independent review runs only if the
`when-sensitive` gate selects it. `/complete` makes the final feature commit.

## Build steps

- [x] 1. **Repo reference parsing and package naming** - add `packages/cli/src/repo.ts`
  with `isRepoRef`, `parseRepoRef`, and `packageNameFor` (last subpath segment, else the
  repo name), mirroring the API's owner and repo rules from `apps/api/src/github/url.ts`.
  Done when: `repo.test.ts` proves `github:o/r`, `github:o/r/a/b`, `github:o/r@v1`,
  `github:o/r/a/b@main`, `https://github.com/o/r`, `https://github.com/o/r.git`, and
  `https://github.com/o/r/tree/main/a/b` parse to the expected target; `github:o`, `.`
  or `..` path segments, `http://`, non-GitHub hosts, and a URL with a marker other than
  `tree` are refused with a usage message; plain slugs and `slug@1.0.0` are not repo refs;
  `pnpm test` is green.
- [x] 2. **GitHub commit resolve and zip snapshot** - add `packages/cli/src/github.ts` with
  `resolveCommit` (GitHub commits endpoint, `HEAD` when no ref) and `fetchRepoFiles` (the
  codeload zip for the sha, read in chunks against a 100 MB archive budget, unzipped with
  `fflate` filtering to the subpath, root folder stripped, directory entries skipped,
  binaries dropped into `binaries`, unsafe entry paths refused, the existing MAX_FILES,
  MAX_FILE_BYTES, and MAX_TOTAL_BYTES caps enforced on kept files). Both requests use a
  30 s timeout and a `skillpass-cli` User-Agent. Done when: `github.test.ts` with a stubbed
  fetch proves the sha is read, 404 gives "repository or ref not found, or the repository is
  private", 429 or 403 with `x-ratelimit-remaining: 0` gives the rate-limit message, other
  statuses and network failures give distinct messages, the root folder is stripped, a
  subpath re-roots the tree and an empty subpath errors with the "point at the folder that
  contains SKILL.md" hint, `..` entries are refused, binaries are dropped and listed, and
  each cap trips; `pnpm test` is green.
- [x] 3. **Local pre-flight render and unlisted receipts** - add `renderLocalPreflight` to
  `render.ts` (same layout as `renderPreflightReport` with `Repo`, `Commit`, and an unlisted
  marker; `Version` shows the declared manifest version or `none declared`; findings render
  as in `scan`; a failed report ends with a BLOCKED line) and the optional `unlisted` field on
  `Receipt` in `receipts.ts`. Done when: `render.test.ts` covers a passing single skill, a
  pack, and a failed report; `receipts.test.ts` round-trips a receipt with `unlisted` and
  still reads receipts without it; `pnpm test` is green.
- [x] 4. **`add` from a repo** - in `add.ts`, detect a repo ref before any API call and run
  the unlisted flow: resolve, fetch, load, validate, render, block on failed (exit 1), resolve
  targets and warnings from the manifest's targets, confirm risk, then install through
  `installSingle` or `installPack` with the in-memory files. Refactor `AddContext` so the
  install functions take a files source, a receipt builder, the declared targets, and the
  closing verification line instead of `preflight` and `detail`; the directory path keeps
  its exact behavior. Update `USAGE` in `index.ts`. Done when: `add.test.ts` proves, in a
  temp cwd with a stubbed fetch, that `add github:o/r --target claude-code` writes
  `.claude/skills/<name>/SKILL.md` and a receipt with `unlisted` and the full sha, that
  `--target claude-code --target agents` writes both, that an inferred pack fans out per
  member with pack receipts marked unlisted, that a failed report exits 1 with nothing on
  disk, that medium risk without a confirm exits 2, that an occupied destination exits 2
  untouched, that the stubbed fetch never receives a SkillPass API URL, and that existing
  directory `add` tests still pass; `index.test.ts` covers the usage line; `pnpm test` green.
- [x] 5. **`list`, `outdated`, and `update` awareness** - `list` appends
  `unlisted (owner/repo[/path])` to unlisted rows; `outdated` renders unlisted receipts (and
  unlisted pack families) as `not tracked by the directory (unlisted)`, counts them as tracked,
  and never looks up or compares a directory slug for them; `update` refuses an unlisted
  install with `installed from github:owner/repo, not the directory; remove it and add it
  again to refresh it` and exit 2. Done when: `list.test.ts`, `outdated.test.ts`, and
  `update.test.ts` cover an unlisted install whose name also exists in the directory and prove
  it is neither counted as outdated nor replaced; `pnpm test` is green.
- [x] 6. **Docs** - the CLI README and `apps/web/src/pages/docs/cli.astro` gain an
  "Install from any repo" section: both reference forms, what the local pre-flight shows,
  what unlisted means (validated locally, no directory listing, no maintainer check, no AI
  review), the receipt marker, and that `update` and `outdated` do not track it. Done when:
  `pnpm build` passes and the rendered CLI docs page shows the section; `pnpm verify` is green.
- [x] 7. **Repair F-01: interrupted archive download** - in `github.ts`, await `readCapped`
  inside try/catch and return `{ ok: false, message }` so a body stream that errors mid-download
  (timeout firing, connection drop after the headers) reports through the CLI's own error line
  instead of escaping `runAdd`. Done when: `github.test.ts` proves a stubbed body stream that
  errors on its first pull returns the not-ok result; `pnpm test` is green.

## Files / areas

- `packages/cli/src/repo.ts` (new) + `repo.test.ts` - reference grammar and package naming.
- `packages/cli/src/github.ts` (new) + `github.test.ts` - commit resolve, zip snapshot,
  caps, safety.
- `packages/cli/src/add.ts` + `add.test.ts` - repo branch, `AddContext` refactor, shared
  install paths; export or move the snapshot caps so `github.ts` reuses the same numbers.
- `packages/cli/src/render.ts` + `render.test.ts` - `renderLocalPreflight`.
- `packages/cli/src/receipts.ts` + `receipts.test.ts` - `unlisted` field.
- `packages/cli/src/install.ts` - `receiptFor` gains the unlisted variant (or a sibling
  builder), `confirmRisk` unchanged.
- `packages/cli/src/list.ts`, `outdated.ts`, `update.ts` and their tests - unlisted
  awareness.
- `packages/cli/src/index.ts` + `index.test.ts` - `USAGE`.
- `packages/cli/README.md`, `apps/web/src/pages/docs/cli.astro` - docs.
- No changes to `packages/skill-schema`, `packages/validator`, or `apps/api`.

## Data / contracts

- **Reference grammar** (CLI argument, not an API):
  - repo ref: `github:<owner>/<repo>[/<path>][@<ref>]` or `https://github.com/<owner>/<repo>[.git]`
    or `https://github.com/<owner>/<repo>/tree/<ref>[/<path>]`
  - owner: `^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$`; repo: `^[\w.-]+$`; path segments
    must not be `.` or `..`; `@<ref>` on the short form is split at the last `@`
  - anything else on `add` is a directory ref exactly as today
- **GitHub requests** (no SkillPass API call in this path):
  - `GET https://api.github.com/repos/{owner}/{repo}/commits/{ref or HEAD}` with
    `Accept: application/vnd.github+json`, `User-Agent: skillpass-cli`, 30 s timeout; reads
    `sha`
  - `GET https://codeload.github.com/{owner}/{repo}/zip/{sha}`, 30 s timeout, streamed
    against a 100 MB archive budget before unzip
- **Snapshot rules**: strip the `{repo}-{sha}/` root, keep only entries under `<path>/`
  when a path is given (re-rooted), skip directory entries, refuse absolute, `..`, and
  backslash paths (nothing installed), drop binaries into `binaries`, apply MAX_FILES 500,
  MAX_FILE_BYTES 1 MB, MAX_TOTAL_BYTES 10 MB to kept files; an empty result is an error.
- **Package identity**: `loadPackageFromFiles(files, packageNameFor(target), binaries)`;
  install folder name (the receipt key) is `manifest.data.name`; a pack is
  `manifest.data.skills` with one or more entries and installs through `resolvePackMembers`
  per area layout; declared targets for warnings and the picker are `manifest.data.targets`.
  An installable package always has `manifest.state === 'ok'` because missing or invalid
  manifests fail validation and are blocked.
- **Local pre-flight**: status, risk, permissions, findings, source hash, engine version,
  and `createdAt` come from the `ValidationReport`; `blocked` is `status === 'failed'` with
  reason `validation failed; failed skills cannot be installed`. There is no permission diff
  (no previous version); the report says so in one line.
- **Receipt** (`.skillpass.json`, additive and optional so existing readers keep parsing):

  ```json
  {
  	"<name>": {
  		"version": "<declared manifest version, else the 7-char commit sha>",
  		"sourceHash": "sha256:...",
  		"installedAt": "<ISO-8601>",
  		"pack": { "slug": "<pack name>", "version": "<same rule>" },
  		"unlisted": { "repo": "<owner>/<repo>", "subpath": "<path>", "commit": "<full sha>" }
  	}
  }
  ```

  `pack` appears only on pack members; `subpath` only when given.
- **Exit codes** unchanged: 0 installed, 1 blocked (validation failed), 2 usage, refused
  confirmation, occupied destination, unsafe archive, GitHub or network error.
- **Confirmation rule** unchanged: low risk installs without a prompt; medium+ needs a yes
  or `--yes`.

## Testing

- `repo.test.ts`: grammar accept and reject cases, package naming, `isRepoRef` on slugs.
- `github.test.ts`: stubbed fetch for the commit endpoint (200, 404, 403 rate-limited, 403
  other, 500, network throw) and for zips built with `zipSync` under a `repo-sha/` root:
  root strip, subpath re-root, empty subpath, directory entries, binary drop, `..` refusal,
  each cap, oversized archive.
- `render.test.ts`: local pre-flight for single, pack, and failed reports.
- `receipts.test.ts`: `unlisted` round-trip and tolerance.
- `add.test.ts`: the unlisted flow end to end in a temp cwd (single, multi-target, pack,
  failed, medium risk without TTY, occupied destination, no API URL fetched) plus the existing
  directory cases unchanged.
- `list.test.ts`, `outdated.test.ts`, `update.test.ts`: unlisted rows, no false outdated, no
  replacement by a same-named directory skill.
- `index.test.ts`: usage mentions the repo forms.
- Docs step: build plus a look at the rendered page; no unit test.

## Notes for the AI

- Keep the parser CLI-local. The API's `parseGithubUrl` returns the API's `SourceResult`
  shape and lives in `apps/api`, which the CLI does not bundle; a 40-line mirror with the
  same regexes is the smaller change. Note the mirroring in one comment, like the caps in
  `add.ts`.
- Use the codeload zip, not the tarball: `fflate` is already bundled and Node has no tar
  parser, so no new dependency. Read the response body in chunks and stop at the 100 MB
  budget before calling `unzipSync`; use the unzip filter to skip entries outside the
  subpath and to trip the per-file and total caps on kept files only.
- Reuse `unsafeEntryPath`, `isBinary`, `loadPackageFromFiles`, `validateLoadedPackage`,
  `resolvePackMembers`, `confirmRisk`, `installSingle`, `installPack`, `writeTree`,
  `recordReceipt`, `renderPermissions`, `renderFindings`, and the status and risk colorers.
  Do not add a second install path.
- The `AddContext` refactor is the one structural change: `files: () => Promise<Download>`
  (directory: `downloadVerified`; repo: the in-memory files already hashed), `receipt(packSlug?)`,
  `targets`, and the closing line (`Source hash verified against the Skill Passport.` for the
  directory, `Validated locally from <owner>/<repo>@<sha7>; this install is unlisted.` for a
  repo). Keep every existing directory test green without edits to their expectations.
- The interactive pickers currently read `detail.targets`; pass `targets` in instead so the
  same picker serves both paths.
- `outdated` and `update` must check `receipt.unlisted` before any slug lookup. The hazard is
  real: an unlisted skill named `pdf` and the directory's `pdf` share a receipt key.
- `remove` needs no change: it deletes by receipt key and pack family.
- The `version` receipt field stays a required string; the 7-char sha fallback keeps `list`
  readable and `looksLikeReceipt` unchanged.
- Errors go through `push` and `done(2)` like the rest of `add`; never throw for a network or
  archive problem. Nothing is written before the report, the confirmation, and the
  occupancy checks pass.
- Run `pnpm format` before presenting the diff; lint, format, typecheck, tests, and build all
  gate `pnpm verify`.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":16482,"specSha256":"192ea19e5fd36fb30f6de956114d2eb53448dc9d93fdb0905b633c160dfa804d","branch":"refs/heads/feature/install-from-any-repo-with-local-pre-flight","head":"805433683192da59e3c761325ad8db54b45c9834","baseRef":"refs/heads/main","baseCommit":"f97622e3d7c8b9a5e56c220a6f05656d22382ec9","sourceTree":"4ec0d2e7ab0dda5a525bca2b784d0e680e09b227","absentOptional":[]} -->

## Findings

### 22/F-01 [P2] closed - A rejected archive body read escapes fetchRepoFiles as an exception

**File:** packages/cli/src/github.ts:107
**Found:** 2026-09-26 by /audit (scope: current; lens: quality, security)
**Why it matters:** `fetchRepoFiles` awaits `readCapped(res.body, ...)` outside its try/catch. The request carries `AbortSignal.timeout(30_000)`, and undici errors the response stream when that timer fires or the connection drops after the headers arrive, so a large archive on a slow link (100 MB budget, 30 s timeout) makes `reader.read()` reject and the rejection propagates through `repoSource` and `runAdd`. `main` (packages/cli/src/index.ts:275) catches it and exits 2, so nothing is written and the exit code holds, but the user sees the raw runtime message ("The operation was aborted due to timeout" or "terminated") instead of the CLI's own GitHub error line. The spec's contract for this path ("never throw for a network or archive problem") and the `add.ts` pattern (`push` then `done(2)`) both rule that out. `github.test.ts` covers a fetch that rejects, not a body that fails after the headers.
**Suggested fix:** Wrap the `readCapped` call in try/catch and return `{ ok: false, message: 'the archive download from <url> was interrupted or timed out; nothing was installed' }` (or reuse the existing `cannot reach GitHub at <url>` line). Add a `fetchRepoFiles` test whose stubbed `Response` body is a `ReadableStream` that errors on its first `pull`, asserting the `{ ok: false }` result. No shipped behavior is lost.
**Resolution:** fixed 2026-09-26 by /implement (spec step 7): `fetchRepoFiles` awaits `readCapped` inside try/catch and returns `{ ok: false, message: 'the repository archive download was interrupted; nothing was installed' }`; `github.test.ts` covers a body stream that errors on its first pull. Closed 2026-09-26 by /audit independent current (fresh subagent, claude-fable-5-1) at 8054336: re-examined `packages/cli/src/github.ts:108-112`, where `readCapped` is awaited inside try/catch and a rejected read returns `{ ok: false, message: 'the repository archive download was interrupted; nothing was installed' }`; `repoSource` in `add.ts` pushes that as the CLI error line and exits 2, so no runtime message escapes `runAdd`. The reader lock is released in `finally` on both the cancel and the error path, so the repair adds no new defect. `github.test.ts` "reports a body stream that errors mid-download instead of throwing" errors the stream on its first pull and asserts the not-ok result; `pnpm test` green (94 files, 1186 tests).

## Independent review

**Status:** passed
**Target commit:** 805433683192da59e3c761325ad8db54b45c9834
**Base commit:** f97622e3d7c8b9a5e56c220a6f05656d22382ec9
**Base ref:** main
**Spec hash:** 192ea19e5fd36fb30f6de956114d2eb53448dc9d93fdb0905b633c160dfa804d
**Prepared by:** claude
**Builder model:** claude-fable-5-1
**Requested reviewer:** claude
**Requested model:** runtime default (exact model not known until reviewer starts)
**Requested execution:** automatic
**Requested at:** 2026-09-26T11:28:55Z
**Workflow:** regular
**Check required:** no
**Reviewer adapter:** claude
**Reviewer model:** claude-fable-5-1
**Reviewer context:** fresh subagent
**Actual execution:** automatic
**Reviewed at:** 2026-09-26T11:36:08Z
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** passed
**Check result:** not-required

## Handoff

Review the active spec and the complete `f97622e3d7c8b9a5e56c220a6f05656d22382ec9..805433683192da59e3c761325ad8db54b45c9834` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.

## Commands

- `git rev-parse HEAD`, `git merge-base main HEAD`, `sha256sum blueprint/context/current-feature.md`, `git status --porcelain=v1`: pass (HEAD, merge base, and spec hash match the request; only `blueprint/context/review.md` was dirty before this receipt)
- `pnpm lint`: pass
- `pnpm typecheck`: pass (astro check 0 errors, tsc clean in apps/api, packages/skill-schema, packages/validator, packages/cli)
- `pnpm test`: pass (94 files, 1186 tests)
- `pnpm format:check`: pass
- `pnpm build`: not run (optional for this review; astro check ran inside typecheck)

## Evidence

- Reviewed the complete two-commit delta `f97622e..8054336` (23 files, +1421/-96) fresh with all four lenses together; `blueprint/context/review.md` and `blueprint/context/findings.md` were excluded from the code scope.
- `packages/cli/src/repo.ts`: owner and repo regexes and the `.`/`..` segment refusal match `apps/api/src/github/url.ts`; the URL form requires `https:` and hostname `github.com`, so a `github.com@evil.com` authority is refused; a parsed reference never reaches the filesystem, the subpath serves only as a zip-entry prefix and a display label.
- `packages/cli/src/github.ts`: both requests carry a 30 s `AbortSignal.timeout` and the `skillpass-cli` User-Agent; the archive body is read in chunks against the 100 MB budget and cancelled past it; the codeload root is stripped as the first path component; subpath entries are re-rooted and everything else is skipped before inflation; directory entries are skipped; `cappedFilter` counts kept entries only; every extracted path passes `unsafeEntryPath` before use; binaries are dropped into the findings list; an empty result errors with the SKILL.md hint; nothing in the module touches disk.
- `packages/cli/src/add.ts`: `repoSource` never calls `resolveApiUrl` or the SkillPass API (the `add.test.ts` stub throws on any non-GitHub URL and the recorded calls are exactly the commits and codeload requests); a failed report exits 1 before any write; `confirmRisk` is shared with the directory path; install folder names come from `manifest.name` (`slugSchema`, kebab-case only) or `slugForSkill`, and pack member names from `skillEntrySchema`'s `slugSchema`, so an untrusted SKILL.md or skill.json cannot name a folder outside the area; an invalid skill.json is a `structure.ts` failure and is blocked.
- Directory path keeps its exact behavior: `directorySource` wraps the previous `fetchPreflight`, `renderPreflightReport`, `downloadVerified`, and `receiptFor` calls, and the existing directory `add` tests pass unchanged.
- `packages/cli/src/receipts.ts`: `unlisted` is optional and additive; `looksLikeReceipt` is unchanged; the round-trip and tolerance test is present.
- `list.ts`, `outdated.ts`, `update.ts`: `outdated` and `update` test `receipt.unlisted` before any slug lookup; the `update` guard runs before `fetchPreflight` and its test asserts fetch is never called; `outdated` counts unlisted installs as tracked, never as outdated, and only fetches `/skills`.
- Tests: no `.only`, `.skip`, or todo in `packages/cli`; the spec's Testing section is covered case by case across `repo`, `github`, `render`, `receipts`, `add`, `list`, `outdated`, `update`, and `index` tests.
- F-01 repair re-examined at `github.ts:108-112` together with its test; closed in the ledger.

## Findings

- F-01 [P2] moved from `fixed` to `closed` (the repair holds and introduced no new defect)
- No new findings

## Remaining risk

- `pnpm build` was not run in this review; `astro check` passed inside `pnpm typecheck`, but `astro build` output was not produced here.
- No live GitHub request was made (network-backed verification is outside the audit rules), so `commits/HEAD` resolution, the codeload root layout, and the rate-limit headers are proven only against stubbed responses.
- The 30 s abort signal covers the whole archive body read, so a large archive on a slow link reports "interrupted" instead of completing; this is the spec's timeout and a usability limit, not a defect.
- Peak memory for the largest allowed archive is roughly twice the 100 MB budget (buffered chunks plus `Buffer.concat`) before unzip; bounded by design, not profiled.

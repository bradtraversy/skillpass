# Fix: Declared skill versions

**Type:** Fix
**Status:** verified
**Branch:** `fix/declared-skill-version`
**Fixes:** GitHub issue #9

## The problem

A maintainer following the agentskills.io convention declares
`metadata: { version: "1.4.0" }` in SKILL.md frontmatter, and SkillPass lists
the skill as 1.0.0. The frontmatter reader takes only `name` and `description`,
and publish ignores declared versions entirely: first publish is 1.0.0 and each
republish bumps the major. A `version` in `skill.json` is parsed by the schema
but also ignored at publish.

## The fix

- `readSkillMeta` also reads `version`: a top-level `version:` or the nested
  `metadata.version`, quotes stripped. `inferManifest` sets it on the inferred
  manifest when it is valid semver; anything else is ignored.
- `publishFieldsFrom` passes `manifest.version` through, and `publishSubmission`
  uses the declared version when present, the counter otherwise. A declared
  version that this skill already published is refused before any write with a
  `version_taken` outcome, which the route reports as 409 with a message that
  says to bump it. The unique-index race message no longer promises a retry
  will succeed.
- Export `SEMVER_RE` from `skill-schema` so the validator and the schema agree.
- Docs: the submitting page explains declared versions and the fallback.

Must not break: existing listings (their versions are immutable history), pack
publishes, the CLI's `slug@version` pins, the race handling on the unique index.

## Build steps

- [x] 1. Validator reads the declared version; schema exports `SEMVER_RE`. Done
  when `loadPackageFromFiles` on a SKILL.md with `metadata.version: "1.4.0"`
  yields `manifest.data.version === '1.4.0'` and an invalid value is ignored,
  with tests.
- [x] 2. Publish honors it and refuses duplicates. Done when `publishSubmission`
  creates the version row with the declared version and returns
  `version_taken` for a repeat, with tests, and the route maps it to 409.
- [x] 3. Docs. Done when the submitting page states the rule.

## Verify

Run `pnpm cli scan` on a SKILL.md with a declared version and see it in the
report; publish a skill with `metadata.version` on the dev API and see that
version on the listing; publish it again unchanged and get the 409.

## Verification

Unit tests cover the three paths: frontmatter parsing (nested, top-level, prerelease,
invalid, wrong block), publish using the declared version and refusing a
duplicate before any write, and the route's 409 message. The maintainer's real
SKILL.md from GitHub issue #9 parses to 1.4.0 through the same reader. The live
publish path on the dev API was not exercised; it needs the API server and a
database, which is a manual check for Brad. `pnpm verify` result recorded by the
archive.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":2793,"specSha256":"c4dae0a52d012184d0841b17a3dbce6fc4663fee1cba7a318be0f9aab3151a11","branch":"refs/heads/fix/declared-skill-version","head":"2e68dccdb667063326d79d792f270534c3e76a86","baseRef":"refs/heads/main","baseCommit":"2e68dccdb667063326d79d792f270534c3e76a86","sourceTree":"260fe9b009fa27bdadc5ebc4fa9d3c230c63911f","absentOptional":[]} -->

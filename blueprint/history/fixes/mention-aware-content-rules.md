# Fix: Mention-aware content rules

**Type:** Fix
**Status:** verified
**Branch:** `fix/mention-aware-content-rules`
**Fixes:** GitHub issue #10

## The problem

Security skills describe the attacks they hunt, and the content rules cannot
tell a description from an instruction. The reported skill, js-malware-audit,
gets three warnings for a checklist line ("code that reads or exfiltrates
`.env` files") and for quoting "ignore previous instructions" as an example of
injection text to detect. Every serious security skill in the directory wears
the same medium-risk badge for the same reason, and the AI review anchors on
those flagged lines and says "concern".

## The fix

Give the two language-level rule groups, prompt injection and credential
harvesting, a mention check: a match that sits inside double quotes or
backticks, or that follows detection language on its line (flag, detect, look
for, signs of, examples, e.g., such as, attempts to, "code that", and similar),
is a mention and produces no finding, as is any line inside a fenced code
block or a markdown table row. The credential-exfiltration verb also has to sit
where an instruction puts it (line or sentence start, or after then, and, to,
should, must), so narrative like "timing leaks secret bits" no longer fires.
Dangerous-command, malware, and secret rules are untouched: a quoted command is still a command an agent can run, and
a quoted secret is still a secret. Real instructions keep firing because the
lead-in has to come before the phrase on the same line.

Must not break: any true positive in the existing tests, the fixture-based
statuses, snippet redaction.

## Build steps

- [x] 1. Add the mention check and tests. Done when the three real lines from
  the issue produce no finding, true positives still do, and a quoted `rm -rf`
  still flags.
- [x] 2. Measure. Done when the reported skill scans clean locally and the
  other affected published skills lose their mention-only warnings when
  re-scanned from their live source snapshots.

## Verify

`pnpm cli scan` on the maintainer's skill folder reports no warnings. The
published skills keep their existing passports (immutable); they clear on
their next republish.

## Verification

Validator suite: 188 tests, including the three real lines from issue #10, the
catalog table row and fenced payloads from skill-scanner, four narrative lines
from sharp-edges and agentic-actions-auditor, and true positives that must keep
firing. Re-scan of live source snapshots with the rebuilt CLI:

| Skill | Before | After |
|---|---|---|
| js-malware-audit (issue #10) | warning, 3 findings | passed, 0 |
| skill-scanner | warning, 6 | passed, 0 |
| zeroize-audit | warning, 2 | passed, 0 |
| yara-rule-authoring | warning, 1 | passed, 0 |
| agentic-actions-auditor | warning, 4 | warning, 1 (dangerous-command, kept strict) |
| sharp-edges | warning, 10 | warning, 6 (all dangerous-command) |
| security-review | warning, 3 | warning, 2 (dangerous-command) |
| semgrep | warning, 1 | warning, 1 (dangerous-command) |

Published passports are immutable, so the listed skills clear on their next
republish; the reported skill is a draft and clears on resubmission.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":3197,"specSha256":"e9a16c9b07cbeb302a073a543d984c861113d535defd3814f715530d9c877325","branch":"refs/heads/fix/mention-aware-content-rules","head":"ccc9216e4832cc1c4328af72d7d194db4e25da9c","baseRef":"refs/heads/main","baseCommit":"ccc9216e4832cc1c4328af72d7d194db4e25da9c","sourceTree":"3b470bc3d6b8d6d501d27fed3a172fc41cb144bd","absentOptional":[]} -->

# Independent review record

`blueprint/context/review.md` holds one active request or latest receipt for the
current work item. It is generated workflow state, committed when the project's
visibility permits, archived by `/complete`, and then reset.

## Reset stub

```markdown
# Independent Review

> **Generated file.** Holds the active independent-review request or latest
> receipt for the current work item. `/audit independent current` prepares a
> handoff against an approved checkpoint, a fresh reviewer context completes it,
> and `/complete` refuses stale, pending, or changes-requested review state.

_No independent review requested. Run `/audit independent current` to prepare one._
```

## Pending request

Use full commit SHAs, the exact permitted base ref used to calculate the merge base,
a lowercase SHA-256 hash of the exact
`blueprint/context/current-feature.md` bytes, an ISO-8601 timestamp, and one of
`codex`, `claude`, `copilot`, or `opencode` for each adapter field.
Model fields use the full identifier exposed by runtime or session metadata,
not a generic family label. When unavailable, record
`unknown (runtime did not expose exact model)` instead of guessing. When the
review runtime cannot select a specific model before the session starts, use
`runtime default (exact model not known until reviewer starts)` for Requested
model and record the exact runtime model in the completed receipt.

A pending request without `Requested execution` is a legacy manual request.
Never auto-upgrade it or send it to a subagent. Complete it only from a fresh
reviewer session, keep `Reviewer context: fresh session`, and omit `Actual
execution` so both execution fields remain absent.

```markdown
# Independent Review

**Status:** pending
**Target commit:** <full 40-character checkpoint SHA>
**Base commit:** <full 40-character merge-base SHA>
**Base ref:** <local branch or remote-tracking ref used for the merge base>
**Spec hash:** <64-character SHA-256>
**Prepared by:** <adapter>
**Builder model:** <exact model reported by the builder runtime>
**Requested reviewer:** <adapter>
**Requested model:** <exact model or user-selected runtime default>
**Requested execution:** <manual or automatic>
**Requested at:** <ISO-8601 timestamp>
**Workflow:** <regular or continuous>
**Check required:** <yes or no>

## Handoff

Review the active spec and the complete `<base>..<target>` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.
```

For an independently enforceable receipt, `Base ref` must be a locally recorded
remote default branch, local `main`, or local `master`. It cannot be the current
work branch, and `Base commit` cannot equal `Target commit`. If none of those
base refs reliably covers the active work, stop instead of creating a receipt
whose review range cannot be re-derived.

## Local spec snapshot

For a new request whose verified spec is intentionally ignored, keep application
code in the approved checkpoint and freeze the spec outside Git. Add exactly one
field after `Spec hash`, using a plain path with no backticks:

```markdown
**Spec snapshot:** blueprint/.state/review-specs/<Target commit>-<Spec hash>.md
```

Substitute the request's full lowercase target SHA and lowercase spec hash. This
is the only permitted snapshot path; duplicate fields or another path are
malformed. Tracked-spec requests do not need this field. Existing requests and
receipts without it retain their previous hash, freshness, and execution rules.
Never retroactively add `Spec snapshot` to a pending or completed record.

Phase A prepares the copy before publishing a new pending request:

1. Read the verified active spec as raw bytes and calculate its SHA-256 without
   decoding, trimming, or normalizing line endings. Use that digest as `Spec hash`.
2. Use `lstat` on the selected project root and every directory below it leading
   to the spec and snapshot. Require ordinary directories, a regular spec file,
   and a regular file for any existing snapshot. Reject symbolic links, including
   dangling links. Ancestor aliases above the selected root are not inspected.
   Create missing snapshot directories only beneath verified ordinary parents;
   a missing snapshot leaf is allowed only for exclusive creation below them.
3. Require both paths to be ignored and untracked, absent from the index and
   `Target commit`. Check ignore status separately for each path, require no
   entries from `git ls-files --stage -- <spec-path> <snapshot-path>` or
   `git ls-tree -r --name-only <target> -- <spec-path> <snapshot-path>`, and
   distinguish expected absence from Git failure. Never force-add files or
   change ignore visibility to make these checks pass.
4. Create the snapshot exclusively, for example with Node's `fs.open` using
   `wx`, then write the raw byte buffer and close the handle. If it already
   exists, reuse only an ordinary file whose bytes exactly match the spec.
   Conflicting bytes, unsafe paths, or a failed write stop preparation; never
   overwrite or repair the existing snapshot in place.
5. Read both files back and require identical raw bytes and the recorded hash.
   Recheck their path and Git conditions before writing the request. Keep the
   snapshot unchanged through review and completion; do not automatically delete
   or regenerate it to make an existing receipt pass.

The target/base fields bind application code; `Spec hash` binds both local files.
The snapshot is an input, never another allowed dirty Git path. Manual handoff
names the original checkout, target/base SHAs, snapshot path, and hash. An
automatic child must be able to read those same ignored inputs and installed
project-local skills. If that access cannot be confirmed, retain the request and
use the manual fresh-session handoff in the original checkout. Do not copy local
inputs externally or substitute a clone/worktree that lacks them.

## Completed receipt

Keep the request fields unchanged and replace `pending` with `passed` or
`changes-requested`. Add these fields and sections:

```markdown
**Reviewer adapter:** <adapter>
**Reviewer model:** <exact model reported by the reviewer runtime>
**Reviewer context:** <fresh session or fresh subagent>
**Actual execution:** <manual or automatic>
**Reviewed at:** <ISO-8601 timestamp>
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** <passed or changes-requested>
**Check result:** <passed, failed, unavailable, or not-required>

## Commands

- `<command>`: <pass, fail, or unavailable>

## Evidence

- <safe concise evidence reference>

## Findings

- <finding IDs, or `None`>

## Remaining risk

- <risk or unavailable signal, or `None identified`>
```

Every unavailable verification command must appear under Remaining risk, even
when Check was not required and the receipt may still pass.

All four completed-receipt sections must contain at least one entry. Use
`- None`, `- None identified`, or `- No commands run` when that is the truthful
result. When Check is required, `Check result` must be `passed` before the
receipt can pass. Use `not-required` only when Check was not required.

Use `passed` only when all four lenses covered the complete target delta, every
required check passed, and no P0 or P1 finding is `open` or `fixed`.
P2 and P3 findings may remain with their normal ledger status. Use
`changes-requested` for a blocking finding, failed required check, incomplete
scope, adapter mismatch, or missing a valid fresh-context declaration.

Execution and context must agree. A manual request completes only as actual
`manual` with `fresh session`. An automatic request normally completes as
actual `automatic` with `fresh subagent`; when automatic capability falls back,
it may complete as actual `manual` with `fresh session`. Reject every other
pairing. Legacy receipts with neither execution field remain valid only with
`fresh session`; a legacy receipt can never claim `fresh subagent`.

## Freshness

A receipt is current only when all of these hold:

- `HEAD` exactly equals `Target commit`.
- `Base ref` still resolves and its merge base with `Target commit` exactly
  equals `Base commit`, and it remains a locally recorded remote default branch,
  local `main`, or local `master`.
- The exact current-feature bytes still match `Spec hash`.
- When `Spec snapshot` is present, both raw files match that hash and every
  snapshot path, visibility, and Git condition above still holds. Missing or
  changed snapshot inputs make the record stale; Git failure never passes.
- No tracked, staged, unstaged, or untracked path differs from the target except
  `blueprint/context/review.md` and `blueprint/context/findings.md`.
- The completed reviewer adapter matches `Requested reviewer`.
- The completed reviewer model exactly matches `Requested model`, unless the
  request explicitly selected the runtime-default sentinel above. In that case,
  `Reviewer model` must still contain the exact model exposed after the reviewer
  session starts, never the sentinel itself.
- `Reviewer context` is exactly `fresh session` or `fresh subagent`. A subagent
  receipt is valid only when the runtime started it without the builder
  transcript and exposed its exact adapter and model. The automatic child is a
  generic current-runtime child instructed from the project-local Audit skill
  and this project-local contract. It never depends on a global role, skill,
  prompt, or another workflow.
- `Requested execution` and `Actual execution` form one of the allowed pairings
  above. New requests always record the requested value, and new receipts always
  record the actual value.

Any other code, test, configuration, spec, or acceptance-criteria change makes
the receipt stale. A stale receipt never proves the new state. Product changes
need a new approved checkpoint. A local-spec-only revision may reuse the same
approved product HEAD after normal spec and verification gates, with a new
snapshot, a new request, and a full fresh review. Never create an empty commit
just to capture ignored spec changes or edit a passed receipt into a new review.

The adapter, model, and context fields are declared metadata. Blueprint proves
the target and staleness, but it cannot cryptographically prove that a separate
agent or fresh context performed the review.

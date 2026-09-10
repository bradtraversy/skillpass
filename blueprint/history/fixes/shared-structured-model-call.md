# Current Feature

> **Generated file.** Holds the one feature or fix being built right now. Run
> `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
> an ad-hoc fix. Build one thing at a time; `/complete` archives it (to
> `blueprint/history/features/` or `blueprint/history/fixes/`) and resets this file.

## One structured model call instead of four copies

**Type:** Fix

**Branch:** `fix/shared-structured-model-call`

### The problem

`review.ts`, `classify.ts`, `classify-integrations.ts`, and `display-copy.ts`
in `apps/api/src/review/` each carry the same 25-line scaffold: build an
Anthropic client, call `messages.create` with a system prompt, a JSON-schema
output format, and one user message, bail on refusal, find the text block,
`JSON.parse` it, and turn any throw into `null`. Three of them also build the
identical `<skill_content>` listing block. Every fix to that path (the swallowed
error that hid "credit balance is too low" for ten minutes on 2026-09-09) has to
land four times.

Audit item #7, first cluster, from the 2026-09-08 code audit.

### The fix

- New `apps/api/src/review/structured.ts` with `askStructured(env, { system,
  user, schema, maxTokens })` returning the parsed JSON or `null`, plus
  `REVIEW_MODEL` and `listingContent(lead, listing)` for the shared
  `<skill_content>` block. A failed call logs its message with
  `console.error` so an auth or billing problem is visible in the server log.
- The four callers keep their prompts, schemas, caps, and result validation,
  and delegate the call to the helper.

Must not break: the four existing suites, which mock `@anthropic-ai/sdk` and
assert on the request shape (model, system, user text) and on refusal, empty,
malformed, and thrown paths. They keep passing unchanged, which is the proof the
extraction is behavior-preserving.

### Build steps

- [x] **Step 1 - helper plus four callers.** Add `structured.ts` with its own
  test (no key, refusal, no text, bad JSON, thrown call, happy path with
  request passthrough), then route the callers through it. Done when `pnpm
  test` and `pnpm typecheck` are green with the four existing suites untouched.

### Testing

Pure logic under the Vitest gate.

### Verify

`pnpm test` green; `git diff --stat` shows the four callers shrinking and the
four test files unchanged.

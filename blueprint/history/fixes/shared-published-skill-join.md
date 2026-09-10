# Current Feature

> **Generated file.** Holds the one feature or fix being built right now. Run
> `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
> an ad-hoc fix. Build one thing at a time; `/complete` archives it (to
> `blueprint/history/features/` or `blueprint/history/fixes/`) and resets this file.

## One definition of a published skill record

**Type:** Fix

**Branch:** `fix/shared-published-skill-join`

### The problem

`select({ skill, version, passport, maintainer })` plus the three inner joins
and `status = 'published'` is the definition of a `PublishedSkillRecord`, and it
is hand-copied in `apps/api/src/db/skills.ts` (directory list, maintainer
profile list, detail lookup) and `apps/api/src/db/embeddings.ts` (vector
search, with a different `from`). A change to what "published" means, for
example also requiring a latest version, has to land in all four or the
directory, profile, detail, and AI search drift apart.

Audit item #7, second cluster, from the 2026-09-08 code audit.

### The fix

`PUBLISHED_SELECT` and `joinPublished(qb, extra?)` in `skills.ts`: the helper
applies the three joins and the published predicate (combined with an optional
extra condition) to a dynamic Drizzle select, so each caller supplies only its
`from`, its extra filter, and its order. Vector search imports the same helper.

Must not break: the generated SQL for each of the four queries (same joins,
same predicates, same order and limit); typing stays honest, so a wrong
selection would still fail `tsc`.

### Build steps

- [x] **Step 1 - helper and four callers.** Add `PUBLISHED_SELECT` and
  `joinPublished`, route the four queries through them, and add a test that
  renders the helper with `toSQL()` and asserts the three joins and the
  published predicate, with and without an extra condition. Done when `pnpm
  test` and `pnpm typecheck` are green and a probe assigning the helper's rows
  to the wrong type fails to compile.

### Testing

The helper is exercised through `toSQL()` without a database; the callers are
one-liners over it.

### Verify

`pnpm test` green; `git diff` shows the four join copies collapsing to one.

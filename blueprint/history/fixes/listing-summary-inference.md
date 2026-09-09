# Current Feature

> **Generated file.** Holds the one feature or fix being built right now. Run
> `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
> an ad-hoc fix. Build one thing at a time; `/complete` archives it (to
> `blueprint/history/features/` or `blueprint/history/fixes/`) and resets this file.

## Listing summaries show raw HTML or a mid-sentence fragment

**Type:** Fix

**Branch:** `fix/listing-summary-inference`

### The problem

The AI Blueprint detail page on the dev database shows `<p align="center">` as
the skill summary. Production shows "You provide two short planning docs. The AI
turns them into project context," cut off at a line wrap. Both come from the
validator's description inference in `packages/validator/src/load.ts`:

- `readmeProse` (pack listings) and the SKILL.md fallback in `readSkillMeta`
  (skills with no frontmatter description) each take the first non-heading
  **line** of the file, not the first paragraph, so any wrapped sentence is
  truncated at the wrap.
- `readmeProse` skips lines starting with `<`, which throws away a README's real
  tagline when it is written as `<p align="center"><strong>...</strong></p>`, and
  the SKILL.md fallback skips nothing but headings, so it will happily return an
  HTML or badge line.
- Neither strips a blockquote marker or markdown link syntax, so production has
  `> A repeatable editorial system...` and `...designed for [Cowork](https://...)`.
- The frontmatter reader takes one line of a plain `description:` value, but
  YAML lets a plain scalar continue on indented lines. `skill-scanner` wraps its
  description over four lines, so its summary ends at `"scan a skill",`.
- The dev row was published before the HTML skip existed, and the repair script
  `apps/api/src/seed/backfill-descriptions.ts` only treats a summary as broken
  when it is under 3 characters or a bare YAML block indicator, so it never
  repaired it. Its display copy (tagline) was then generated from that junk.

Production listings affected today: `ai-blueprint`, `editorial-workflow-skill`,
`knowledge-work-data`, `skill-scanner` (4 of 243).

### The fix

- **One prose extractor** in `load.ts`, `firstParagraph(text)`, used by both
  callers. It walks lines, strips HTML tags and markdown link syntax, drops
  headings (`#` and `<h1>`-style), images, badges, horizontal rules, and lines
  that are empty after stripping, removes a leading `> `, then joins the first
  run of surviving lines into one paragraph. The paragraph ends at a blank line
  or a dropped line. Whitespace collapses; the result is capped at 200
  characters on a word boundary.
- **Wrapped plain scalars** in frontmatter: after `key: value`, gather the
  following indented lines and fold them with spaces, the way YAML does.
- **`isBrokenSummary`** also flags summaries containing an HTML tag, starting
  with `>` or `|`, or ending in `,` `;` `:` (the wrap-truncation signature).
- **The backfill** clears `tagline` on every row it repairs, so the existing
  `db:backfill-display-copy` (which fills null copy) regenerates the tagline
  from the corrected summary on its next run.

Must not break: explicit frontmatter descriptions (plain, quoted, folded,
literal) are untouched; the existing `skips README HTML and badge lines` test
still passes; the `A pack of N skills` fallback still applies when a README has
no prose; publish and curate paths are unchanged (they already consume
`manifest.description`).

### Build steps

- [x] **Step 1 - paragraph-based inference in the validator.** Add
  `firstParagraph` to `load.ts`, route `readmeProse` and the SKILL.md fallback
  through it, fold wrapped plain scalars in frontmatter, and add tests: the AI Blueprint README shape (logo block, HTML
  heading, `<p><strong>` tagline) yields the tagline text; a wrapped two-line
  paragraph is joined; a blockquote marker and a markdown link are stripped; a
  SKILL.md whose body opens with a badge line skips it; a 300-character paragraph
  is cut on a word boundary at or under 200. Done when `pnpm test` is green and
  the new cases fail on the old code.
- [x] **Step 2 - repair script catches these rows.** Extend `isBrokenSummary`
  and its tests with the HTML, blockquote, and trailing-punctuation cases, and
  make the backfill clear `tagline` on repair. Done when `pnpm test` and
  `pnpm typecheck` are green.
- [x] **Step 3 - repair the dev database.** Ran `pnpm -C apps/api
  db:backfill-descriptions` against the dev database: 4 rows repaired
  (`ai-blueprint`, `knowledge-work-data`, `editorial-workflow-skill`,
  `skill-scanner`), each now returning a full sentence from the local API.
  `db:backfill-display-copy` first failed on every row because the Anthropic
  account had no credit (a 400 that `generateDisplayCopy` swallows as "(no
  copy produced)"); after a top-up it regenerated display copy for all 4 rows.
  Production gets the same two commands with the production `DATABASE_URL`,
  which is Brad's run.

### Testing

Steps 1 and 2 are pure logic under the Vitest gate; tests ship in the same
diff. Step 3 is a data operation verified by reading the API back.

### Verify

1. Reload the AI Blueprint detail page on http://localhost:3004 and check the
   summary under the title reads as a sentence, not markup.
2. `curl http://localhost:8787/skills/ai-blueprint` and check `summary` and
   `tagline`.

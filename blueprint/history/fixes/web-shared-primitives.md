# Current Feature

> **Generated file.** Holds the one feature or fix being built right now. Run
> `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
> an ad-hoc fix. Build one thing at a time; `/complete` archives it (to
> `blueprint/history/features/` or `blueprint/history/fixes/`) and resets this file.

## Web islands re-declare their shared primitives

**Type:** Fix

**Branch:** `fix/web-shared-primitives`

### The problem

Across `apps/web/src/components`: `SECTION_HEADING` is declared in four files,
`CARD` and `BTN_BASE` and the `Empty` component in both dashboards, `RISK_DOT`
and a one-line `cap` helper in both `Passport.tsx` and `PreflightPanel.tsx`,
and `lib/status-tint.ts` re-spells the pass/warn/fail class triples that
`lib/verdict.ts` already owns. A tweak to a card border or a tint has to be
repeated, and the copies have already started to differ by whitespace.

Audit item #7, web cluster (minus icons), from the 2026-09-08 code audit.

### The fix

- `lib/classes.ts` exports `SECTION_HEADING`, `CARD`, `BTN_BASE`.
- `components/ui/Empty.tsx` is the one empty-state paragraph.
- `lib/risk.ts` exports `RISK_DOT`; `capitalize` joins the other helpers in
  `lib/format.ts` with a test.
- `STATUS_TINT` maps its verdict-shaped statuses to `VERDICT_TINT[...].all`
  and keeps only the two tints (neutral, active) that have no verdict.
- The six components import instead of declaring; unused `RiskLevel` type
  imports go with the removed declarations.

The repeated inline SVG icons are a separate fix: they differ in size and
stroke per use and need their own pass.

Must not break: rendered class strings (identical text), the status-tint and
format suites, and the detail page and dashboards visually.

### Build steps

- [x] **Step 1 - shared modules and the six imports.** Done when `pnpm test`
  and `pnpm typecheck` are green, `pnpm build` passes, and the skill detail
  page renders its passport unchanged on the dev server.

### Testing

`capitalize` gets a unit test; the rest is class-string and component wiring,
verified by the build and a screenshot.

### Verify

Reload `/skills/ai-blueprint` on the dev server: the passport risk dot and
"Low risk" label render as before.

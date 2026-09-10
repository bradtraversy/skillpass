# Current Feature

> **Generated file.** Holds the one feature or fix being built right now. Run
> `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
> an ad-hoc fix. Build one thing at a time; `/complete` archives it (to
> `blueprint/history/features/` or `blueprint/history/fixes/`) and resets this file.

## The same inline SVG icons are pasted across the skill components

**Type:** Fix

**Branch:** `fix/web-shared-icons`

### The problem

Seven skill components carry hand-written `<svg>` blocks for the same handful
of icons: the close X (three copies), download (two), shield (two, one with a
check), file (two), and alert triangle (two). Each copy repeats the full
viewBox, stroke, and aria boilerplate, and they have already drifted in
size and stroke width by accident rather than by design.

Audit item #7, web icons, from the 2026-09-08 code audit. shadcn/ui and
lucide-react are not installed, so hand-rolled SVGs stay the convention; this
just stops copying them.

### The fix

`components/ui/icons.tsx` exports `CloseIcon`, `CheckIcon`, `DownloadIcon`,
`ShieldIcon`, `ShieldCheckIcon`, `FileIcon`, and `AlertIcon` over one `Icon`
frame that takes `size`, `strokeWidth`, and `className`. The repeated blocks
become one-line elements passing the size and stroke each already used, so
nothing changes visually. Icons used in exactly one place stay where they are.

Must not break: the detail page (header shield, passport shield, findings
triangle, source-view file icon, pre-flight close/check/download) renders as
before; `pnpm build` passes.

### Build steps

- [x] **Step 1 - icons module and the nine replacements.** Done when `pnpm
  typecheck` and `pnpm build` are green and the detail page screenshot matches.

### Testing

UI only: build plus a screenshot of the detail page.

### Verify

Reload `/skills/ai-blueprint` on the dev server and open the pre-flight panel:
every icon is present at its previous size.

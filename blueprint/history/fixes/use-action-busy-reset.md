# Current Feature

> **Generated file.** Holds the one feature or fix being built right now. Run
> `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
> an ad-hoc fix. Build one thing at a time; `/complete` archives it (to
> `blueprint/history/features/` or `blueprint/history/fixes/`) and resets this file.

## Dashboard action buttons stay disabled after a successful action

**Type:** Fix

**Branch:** `fix/use-action-busy-reset`

### The problem

Both dashboards carry an identical private `useAction` hook
(`apps/web/src/components/admin/AdminDashboard.tsx:231`,
`apps/web/src/components/dashboard/Dashboard.tsx:212`). Its `run()` sets `busy`
true, awaits the API call, and on success awaits the parent's `onChange()` refetch
without ever setting `busy` back to false. Only the error path resets it.

Cards are keyed by a stable id (`skill.slug`, `submission.id`, `report.id`), so a
card that is still in the list after the refetch keeps the same component
instance and stays `busy === true` until the page reloads. Concrete stuck states:

- Admin `CurationCard`: after one Featured or Verified toggle, both
  `ToggleButton`s render disabled.
- Maintainer `SkillCard` actions: after unlist, the skill flips to `private` and
  the Relist button renders permanently disabled; after relist, Unlist still
  works only because it does not read `busy`, but Confirm unlist is dead.
- Admin `ReportCard` and queue cards: any card that survives its own action
  (for example a status change that keeps it in the current tab) stays disabled.

Audit item #2 from the 2026-09-08 code audit.

### The fix

Move the hook to one shared file, `apps/web/src/lib/use-action.ts`, and reset
`busy` in a `finally` so success, failure, and a throwing `onChange` all
re-enable the buttons:

```ts
async function run(fn: () => Promise<ApiResult<unknown>>) {
	setBusy(true);
	setError(null);
	try {
		const res = await fn();
		if (res.success) await onChange();
		else setError(res.error);
	} finally {
		setBusy(false);
	}
}
```

Both dashboards import it and drop their private copies. Nothing else changes:
the `{ busy, error, run }` contract, the "one action at a time" behavior, the
inline error display, and the parent refetch on success all stay as they are.

Must not break:

- The button is still disabled for the whole round trip (API call plus refetch),
  so a double click cannot fire twice.
- A card that unmounts during the refetch (for example a submission that leaves
  the current tab) is fine: React 19 does not warn on a state set after unmount.

Naming: `lib/` mixes camelCase (`filterSkills.ts`) and kebab-case
(`status-tint.ts`); the coding standards say kebab-case for non-component files,
so the new file is `use-action.ts`.

### Build steps

- [x] **Step 1 - shared hook with the busy reset.** Create
  `apps/web/src/lib/use-action.ts` exporting `useAction(onChange)` with the
  `finally` reset above. Replace both private copies with an import, remove the
  now-unused `useState` import only if nothing else in the file uses it (both
  files still do). Done when `pnpm typecheck` and `pnpm build` pass and neither
  dashboard file defines `useAction`.

### Testing

This is a React island hook, which the coding standards exempt from the unit
test gate (no DOM test runner is installed; Vitest runs in the node
environment). Evidence is the build plus a `/check` pass in the browser. If a
DOM runner is added later, the first test is "run() leaves busy false after a
successful onChange".

### Verify

1. Start `pnpm dev` and `pnpm dev:api` (needs `apps/api/.env`), sign in as an
   admin, open `/admin`, Curation tab.
2. Click Featured on any skill. Expected: the button shows its busy state, the
   list refetches, and both Featured and Verified are clickable again. Wrong: they
   stay greyed out.
3. Open `/dashboard`, unlist a published skill, confirm. Expected: the card now
   shows a clickable Relist button. Click it and confirm the skill returns to
   published with Unlist clickable.
4. Force an error (for example unlist a slug the API rejects) and confirm the
   inline error still shows and the button re-enables.

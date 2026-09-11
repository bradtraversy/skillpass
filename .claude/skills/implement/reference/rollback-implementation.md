# Rollback implementation safeguard

Use this only when `current-feature.md` says `Type: Rollback`.

Do not hand-delete the old feature and do not run a whole-commit `git revert`.
The completed commit also contains Blueprint history and plan bookkeeping.

Before the first rollback step:

1. Read `Target commit` and `Target parent`. Stop unless both values match
   `^[0-9a-f]{40}$`.
2. Resolve the archive's introducing commit and verify it has exactly one parent.
   Stop on a merge target. Confirm the resolved commit exactly equals `Target
   commit` and the resolved parent exactly equals `Target parent`.
3. Confirm the target is an ancestor of `HEAD` and the approved rollback spec is
   the only dirty path. Stop on drift.
4. Preview the target's product diff while excluding `.agents/**`,
   `.claude/**`, `blueprint/**`, `AGENTS.md`, `CLAUDE.md`, and `prototypes/**`.
   Confirm it is non-empty and matches the Product paths in the spec.
5. Apply only the resolved product diff in reverse with three-way conflict
   detection. Use only the resolved full SHA values:

       git diff --binary <target-parent> <target-commit> -- . \
         ':(exclude).agents/**' \
         ':(exclude).claude/**' ':(exclude)blueprint/**' \
         ':(exclude)AGENTS.md' ':(exclude)CLAUDE.md' \
         ':(exclude)prototypes/**' |
         git apply --reverse --3way --index

6. Show the staged diff and status. Stop if any protected path is staged or
   modified.

If the reverse patch conflicts, report the exact paths and later commit involved.
Do not auto-resolve, discard, stash, reset, or broaden the rollback. Ask whether
to resolve only the approved conflict or abandon the attempt.

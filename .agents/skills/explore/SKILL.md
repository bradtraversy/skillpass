---
name: explore
description: Explore an idea against the actual codebase without changing files. Investigate whether a change would help, compare alternatives and tradeoffs, and discuss uncertainty before deciding whether to plan anything. Use for /explore, considering an idea, or weighing options without writing a spec.
---

# explore - investigate an idea before deciding to build

**Context reuse:** Reuse any required file already loaded in project instructions or the current session. Read it again only if absent, changed, or exact current bytes or line references are needed.

Explore is a read-only conversation grounded in the actual project. It can help
with questions such as whether caching would help a dashboard, whether teams
belong in the product, or which upload approach fits existing code.

No plans or active feature are required. Do not require `/overview`, invent a
plan, or treat missing Blueprint context as a blocker to discussing the idea.
This command never writes activity state, including `blueprint/.state/run.json`.

## Start from the question

Use the supplied topic or relevant conversation context. With neither, ask what
the user wants to investigate. For a vague idea, state a tentative interpretation
and ask a focused question only when its answer changes the investigation.

Reuse context already loaded in the session. Read relevant project instructions,
code, tests as text, manifests, and existing plans when they help answer the
question. Follow the actual implementation far enough to support your claims;
point to concrete files or symbols. Avoid scanning unrelated parts of the repo.
Read-only Git inspection can establish what exists or is already in progress.

Authoritative documentation lookup is appropriate when technical uncertainty
needs it. Distinguish documented facts from what this project actually uses.
Missing code or evidence is an uncertainty to explain, not permission to execute
an experiment or to invent current behavior.

## Discuss the options

Keep the conversation proportional to the question. Compare plausible options
against the user's needs and existing project constraints. Include doing nothing
when the current behavior may already be sufficient. Do not invent scale,
security requirements, or new abstractions to justify a change.

Explain the strongest case against your recommendation and how confident you
are. Separate observed facts, assumptions, and unanswered questions. Say what
evidence could change the recommendation without gathering it through execution.
An unresolved question or a recommendation to leave the project alone is a valid
outcome.

Use a small diagram in the response when it makes a relationship or tradeoff
clearer. Do not create diagram files. There is no mandatory output template,
report, question count, or next-step checklist. Follow the user's responses and
let the discussion continue as long as useful.

## Keep the boundaries clear

- Never create, edit, or delete files, including specs, plans, notes, generated
  output, and activity state. Do not save the conversation into the project.
- Never install dependencies, execute product code, run tests or builds, start
  servers, perform browser interactions, or call state-changing tools. Read
  source and existing evidence instead of testing a hypothesis by execution.
- Never create or switch branches, commit, merge, push, publish, or deploy.
- Never turn a request to discuss an idea into approval to plan or implement it.
  If the user asks for changes, explain the appropriate handoff and keep this
  Explore invocation read-only. Do not invoke another command automatically.

## Neighbors and handoff

- `/brief` explains an existing build-plan item, its scope, dependencies, and
  size. Explore can discuss an unplanned idea or question a planned approach.
- `/discovery` develops broader product direction and reviewed planning drafts.
  Explore does not draft either planning file.
- `/debug` reproduces and isolates an actual failure. Explore discusses options
  without executing code to diagnose or verify them.
- `/feature` writes a buildable spec; `/fix` specifies a confirmed small change.
  Suggest the appropriate command only when the user is ready to proceed.

Do not force a handoff at the end of every response. Keep discussing the idea
when that is what the user wants, and leave the project unchanged.

---
name: browser-tests
description: Add or normalize a repository-owned browser test harness, reusing an existing runner or using Playwright when compatible. Use for /browser-tests, Playwright setup, end-to-end tests, or repeatable browser checks. Use check for one-time live verification.
disable-model-invocation: true
---

# browser-tests - set up repeatable browser verification

**Context reuse:** Reuse any required file already loaded in project instructions or the current session. Read it again only if absent, changed, or exact current bytes or line references are needed.

**First action:** Before project inspection, preflight, or any other tool call,
publish `running` to `blueprint/.state/run.json` using the dashboard activity
contract in `AGENTS.md`.

This is an explicit optional setup command. It creates a project-owned browser
test path that later Feature, Implement, Check, and Continuous runs can reuse. It
does not replace live browser inspection, install during another workflow
command, or make browser testing mandatory for every Blueprint project.

## Input

No argument is required. A named runner, browser, application surface, or flow is
a preference to verify against the real project.

## Step 1 - inspect the project

Read enough files to identify the actual browser surface and existing setup:

- `AGENTS.md`, especially Commands and any Verify command
- package or language manifests, lockfiles, workspaces, and runtime versions
- existing browser, integration, and end-to-end test configs and files
- build, dev, preview, extension-build, and test commands
- relevant CI workflows and ignore rules
- `blueprint/context/coding-standards.md`
- Git branch and worktree state

Do not assume Node.js, npm, a web server, or a blank test setup. Do not install
dependencies or edit files during inspection.

## Step 2 - choose the smallest useful harness

Reuse a working browser runner already established by the project. For a
compatible JavaScript or TypeScript web app or browser extension with no runner,
prefer Playwright Test. If the stack or executable surface is unclear, stop and
ask instead of inventing a framework.

Choose one representative smoke path through a real project surface. It must
prove the harness can launch the app and observe behavior, not merely assert that
a static fixture exists. Keep authentication state, profiles, secrets, generated
reports, traces, videos, and screenshots out of Git unless the project already
has a deliberate safe convention.

For browser extensions, use a persistent test browser context and load the built
unpacked extension. Test an extension-owned page or content-script flow that the
runner can reach. Browser toolbar UI, permission prompts, and other browser
chrome may still require Check or Try evidence; do not claim those surfaces are
automated when they are not.

## Step 3 - present the setup

Before editing, state:

- runner selected or reused
- exact dependency install command, when needed
- config, script, test, and ignore files to add or change
- application or extension surface covered by the smoke test
- exact browser-test command that will be documented
- any server, build, authentication, or browser-chrome limitation

Dependency installation and browser-binary downloads require the user's approval
through the current tool's normal approval flow. Do not treat running this skill
as permission to change CI, download unrelated browsers, or add a broad suite.

## Step 4 - create or normalize the harness

Make the smallest practical diff:

1. Add only the required runner dependency and config.
2. Add one project-relevant smoke test.
3. Add or reuse a conventional command such as `test:browser`.
4. Document the exact invocation in the Commands section of `AGENTS.md` as
   `Browser tests: <command>`. Include a working directory when a workspace
   needs one.
5. Configure runner-owned server lifecycle only when the project has a safe,
   documented command and the runner can start and stop it reliably. Do not
   create a duplicate server when the established harness reuses one.
6. Ignore generated browser-test artifacts that should stay local.

Do not add browser tests to the default Verify command or GitHub workflow unless
the user separately asks for that slower gate or the project already requires
it. Preserve existing CI and existing browser coverage.

## Step 5 - verify the path

Run the documented Browser tests command. Confirm that the smoke test exercises
the intended real surface and that the runner exits cleanly. Inspect generated
console, request, trace, screenshot, or report evidence only when relevant to
the claim.

A passing runner with no tests, a test against the wrong surface, or a skipped
browser launch is not a successful setup. If credentials, an external service,
browser chrome, or another unavailable dependency blocks the smoke path, report
the harness as incomplete instead of weakening the test.

## Step 6 - report

Return a concise setup report:

- runner and browser surface
- command documented in `AGENTS.md`
- smoke behavior proven
- files added or changed
- verification result
- remaining manual or environment-specific boundary

Show the diff summary. Do not commit, merge, push, publish, or begin unrelated
feature work.

## Integration contract

Once `AGENTS.md` declares `Browser tests: <command>`:

- Feature may include a focused browser-test expectation for stable behavioral
  done-whens.
- Implement may add and run a focused browser test when it is proportionate to
  the current step.
- Check runs the documented command as repeatable evidence, then directly
  observes any done-when the suite does not prove.
- Continuous needs no separate browser mode. Its configured Check gate uses the
  same command.

The harness supplements direct evidence. A green browser suite does not prove
visual fidelity, authenticated real-profile behavior, browser chrome, or every
done-when unless the test actually observes those claims.

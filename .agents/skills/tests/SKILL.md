---
name: tests
description: Add or normalize stack-native unit testing, reuse or install the appropriate runner, add one example test, document commands, and verify the setup. Use for /tests, adding unit tests, configuring a test runner, or enabling the Blueprint logic-test gate.
---

# tests - add unit testing to the project

**Context reuse:** Reuse any required file already loaded in project instructions or the current session. Read it again only if absent, changed, or exact current bytes or line references are needed.

**First action:** Before project inspection, preflight, or any other tool call,
publish `running` to `blueprint/.state/run.json` using the dashboard activity
contract in `AGENTS.md`.

Where this sits in the workflow:

    any time  ->  [tests]  ->  test command in AGENTS.md  ->  /feature + /implement use it
                  (setup)     (the opt-in testing gate)      (logic steps get tests)

Testing is optional in the Blueprint until the project declares a real test
command in `AGENTS.md`. This skill is the explicit setup path. It adds or
normalizes **unit testing** only; browser automation and end-to-end testing are
separate optional setup through `/browser-tests`.

## Input

No argument is required. If the user names a runner or stack preference, treat it
as a preference and verify it against the project files.

## Step 1 - inspect the project

Read enough files to identify the real setup:

- `AGENTS.md` Commands section
- package or language manifest (`package.json`, `pyproject.toml`, `go.mod`,
  `Cargo.toml`, and similar)
- existing test config (`vitest.config.*`, `jest.config.*`, `pytest.ini`,
  `phpunit.xml`, language-native config, and similar)
- existing test files
- package manager lockfile
- an existing `Verify` command and `.github/workflows/verify.yml`, when present
- `blueprint/context/coding-standards.md`

Do not assume Next.js. Detect the stack from files.

## Step 2 - choose the smallest test setup

Prefer the existing runner if one is already present. If none exists, choose the
stack-native unit test runner:

- TypeScript or JavaScript app: Vitest by default, unless the project already
  clearly uses Jest or another runner.
- Python: pytest.
- Go: built-in `go test`.
- Rust: built-in `cargo test`.
- Ruby: the runner already implied by the project, or Minitest when nothing else
  is present.
- PHP: PHPUnit when the project is Composer-based.

If the stack is unclear, stop and ask what runner to use instead of guessing.

Keep the setup minimal. Do not add coverage, browser testing, CI, snapshots,
mock-service layers, or a large test architecture unless the user explicitly asks.

## Step 3 - make the setup changes

Apply the smallest practical diff:

1. Add missing test dependencies or config.
2. Add or normalize package/script commands.
3. Add one small example test for real project logic if a suitable function
   exists; otherwise add a tiny helper and test that proves the runner works.
4. Update the Commands section of `AGENTS.md` with the real test command and,
   when available, the test watch command.
5. If a `Verify` command already exists, add the real test command to it between
   typecheck and build while preserving any established project checks. Do not
   create verification or CI only because `/tests` was invoked.
6. Update `blueprint/context/coding-standards.md` only if the project needs a
   stack-specific testing note different from the default.

Do not write a broad test suite for existing app code. This skill proves the
testing path and turns on the gate; feature work adds focused tests later.

If adding dependencies requires network access, ask for the needed install command
through the current tool's approval flow. Use the project's package manager.

## Step 4 - verify

If `AGENTS.md` documents a `Verify` command, run the focused test command and
then run `Verify` as the final gate. The combined command should now exercise the
new tests along with its existing typecheck and build checks.

If no `Verify` command exists, run the relevant commands from `AGENTS.md`:

- the test command
- the build command, when one exists
- lint or typecheck only if they are already standard commands and the diff
  touches config or types that should satisfy them

An empty suite must not be treated as a pass. If the runner reports no tests, add
or fix the example test.

## Step 5 - report

Stop with a concise report:

- runner chosen or reused
- commands added or updated
- existing verification command updated, or confirmation that none exists
- example test added
- verification commands run and whether they passed
- any follow-up the user should consider

Show the diff summary. Do not commit, merge, push, or start product feature work.

## Rules

- Unit testing only. Do not set up Playwright, Cypress, browser E2E, CI, or
  coverage here. Use `/browser-tests` for an explicitly requested browser
  harness.
- Reuse existing project conventions before adding new tools.
- Preserve existing CI. This skill may update an existing verification command,
  but it never creates a GitHub workflow on its own.
- Keep the first test boring and small. It exists to prove the workflow.
- Once `AGENTS.md` has a test command, later `/feature` and `/implement` runs
  treat tests as the gate for logic-bearing changes.
- Do not hide install or verification failures. Report exactly what failed and
  what to fix next.

## Formatting

Format the output to match the project's conventions in
`blueprint/context/ai-interaction.md`: concise, scannable markdown, with lists for
enumerations and tables for matrices rather than dense paragraphs.

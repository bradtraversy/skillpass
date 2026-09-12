# Fix: Header GitHub link

**Type:** Fix
**Status:** verified
**Branch:** `fix/header-github-link`

## The problem

The repository is going public and nothing on the site points at it. The header
has Docs, CLI, Submit, and the account slot; the footer links to npm but not
GitHub.

## The fix

Add an icon-only link to `https://github.com/bradtraversy/skillpass` in the
header nav, between the CLI link and the Submit button, using the same GitHub
mark the skill pages already use, with an accessible label and the muted-to-text
hover the other links have. Add a matching "GitHub" text link beside "npm" in the
footer. Both open in a new tab like the npm link.

Must not break: the header layout on mobile, the active-link styling.

## Build steps

- [x] 1. Add the links. Done when the dev server shows the mark in the header
  and the footer link, both pointing at the repo, and `pnpm verify` passes.

## Verify

Load the homepage on the dev server: the mark sits between CLI and Submit,
hovering brightens it, clicking opens the repo in a new tab.

## Verification

The dev server renders the mark between CLI and Submit with the accessible label,
and both header and footer links point at the repository. ESLint passes on the
nav components; `pnpm verify` result recorded by the archive.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":1292,"specSha256":"b249c356c53d6f93b815bd7c8a9d400a1202ead3483c9901b94cd293a8e255c8","branch":"refs/heads/fix/header-github-link","head":"360ad9b23130d3d3a2e7d297f9128d76469059f8","baseRef":"refs/heads/main","baseCommit":"360ad9b23130d3d3a2e7d297f9128d76469059f8","sourceTree":"ea52179799cbcd99b499a48ebf09b7f8e69552f0","absentOptional":[]} -->

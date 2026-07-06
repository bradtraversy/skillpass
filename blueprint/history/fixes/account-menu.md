# Fix: Account menu with sign in/out in the nav

**Type:** Fix
**Status:** complete

## The problem

There is no visible way to sign in or out anywhere on the site. The API has all
three auth paths (`GET /auth/github`, the callback, `POST /auth/logout`) since
5a, but the only UI that knows about auth is the sign-in card inside `/submit`.
The nav (`apps/web/src/components/nav/Nav.astro`, static, zero JS) shows the
same links to everyone; signing out currently means clearing the cookie in
devtools.

## The fix

A small `AccountMenu` React island mounted at the right end of the nav:

- **Checking** (initial): render nothing (the slot is empty for the instant
  before `/me` resolves; a flash of nothing beats a fake state).
- **Signed out** (or API unreachable): a "Sign in" link to `signInUrl()`.
- **Signed in**: avatar + username as a button toggling a minimal dropdown with
  one item, "Sign out", which `POST`s `/auth/logout` through the API client and
  then does a full `window.location.reload()` so every island on the page
  (SubmitForm included) resyncs to the signed-out session.

Plus the one missing API-client helper: `logout()` in `apps/web/src/lib/api.ts`
via the existing `request` funnel (it already sends `credentials: 'include'`).

Must not break: the nav stays an Astro component; only the account slot
hydrates (`client:idle` - nav auth state is not critical-path). No new deps, no
dropdown library - one `useState` and a click-away is plenty. Styling follows
the existing nav classes and theme tokens.

## Build steps

- [x] **Step 1 - logout helper + AccountMenu island + nav mount** -
  `logout()` in `lib/api.ts`; `apps/web/src/components/nav/AccountMenu.tsx`
  with the three states above; mounted in `Nav.astro` with `client:idle`.
  *Done when:* signed out, the nav shows "Sign in" linking to the API's GitHub
  route; signed in, it shows avatar + username with a working "Sign out" that
  lands the page back in the signed-out state (screenshot + build evidence -
  UI-only step, no unit tests per the testing scope rule).

## Verify

1. `pnpm dev` + `pnpm dev:api` running, signed out: nav right edge shows
   "Sign in"; clicking it starts the GitHub OAuth flow.
2. After signing in: nav shows your avatar and username; `/submit` shows the
   form.
3. Click the name -> "Sign out": page reloads signed out - nav shows "Sign in"
   again and `/submit` shows the sign-in card.
4. With the API stopped: nav shows "Sign in" (not a stuck blank), pages still
   render.

## Notes for the AI

- `apps/api/.env`'s `WEB_ORIGIN` already covers CORS + credentials for
  localhost:4321; nothing API-side changes in this fix.
- Reuse `CurrentUser` and the envelope types from `lib/api.ts` /
  `skill-schema`; no new shared types needed.

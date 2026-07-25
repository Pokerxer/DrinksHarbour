# Part 1 Handoff Prompt

Paste the block below into a fresh Claude Code session in this repo.

---

Continue Part 1 of the admin auth overhaul in `client/apps/admin`.

Read `docs/superpowers/specs/2026-07-25-admin-auth-overhaul-design.md` first — it is
the approved spec. Part 0 is already done and pushed (main `82f139fc`); do not redo it.
Work through Part 1 (§1.1–§1.6), then Part 2 if there is room.

**Decisions already made — do not re-litigate:**

- Google sign-in is **removed entirely**, not gated.
- The MFA challenge is **inline on `/signin`** (the card swaps to 6-digit entry),
  not a separate route. The `pendingMfaToken` stays in React state only.
- Testing: **add Vitest** to the admin app and test-drive the auth logic. The app
  currently has no test runner at all.

**The six items, worst first:**

1. **§1.1 Remove `GoogleProvider`** (`src/app/api/auth/[...nextauth]/auth-options.ts:394`).
   It has live credentials in `.env`, `allowDangerousEmailAccountLinking: true`, no
   `signIn` callback, and no button in the UI — but `/api/auth/signin/google` is still
   reachable and mints a session with no role and no backend token. Middleware's only
   gate is `authorized: ({ token }) => !!token` (`src/middleware.ts:167`), and role
   falls back to `'viewer'` (`src/middleware.ts:80`), so `/ecommerce`, `/inventory`,
   `/analytics`, `/support`, `/file-manager` all admit a stranger. Also drop
   `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` from `src/env.mjs`. Leave
   `models/User.js` `googleId` alone — that is storefront data.

2. **§1.2 Role whitelist.** Remove `'customer'` from `validRoles`
   (`auth-options.ts:259-266`). Apply the same whitelist to the `pos-pin` provider
   (`auth-options.ts:338`), which does no role check at all today.

3. **§1.3 MFA challenge.** The backend returns
   `{ success: true, mfaRequired: true, pendingMfaToken }` with **no** `token`
   (`server/services/user.service.js:214`). `authorize()` checks only `data.success`,
   so MFA-enabled admins get a session with `token: undefined` and every API call 401s.
   Plan: `authorize` throws `MFA_REQUIRED::<pendingMfaToken>`; the form matches that
   prefix on `result.error` and swaps to code entry; a new `mfa` credentials provider
   posts `{ pendingMfaToken, code }` to `/api/users/mfa/verify`, which returns the same
   `{ user, token, refreshToken }` shape as login.
   **The storefront already implements this whole flow** —
   `client/apps/platform/src/context/AuthContext.tsx` has `completeMfaLogin` and
   `setMfaToken`. Port from there rather than inventing it.
   Verify first that next-auth 4.24.11 surfaces a thrown `authorize` message through
   `signIn(..., { redirect: false })`. The existing code already assumes it does
   (`sign-in-form.tsx:92-103` branches on `result.error.includes('locked')`), but
   confirm before building on it.

4. **§1.4 Move refresh from `session()` into `jwt()`.** `session()`
   (`auth-options.ts:133-151`) assigns refreshed tokens onto `token`, but NextAuth v4
   never re-encodes the JWT from the session callback, so they are discarded. The server
   **rotates and revokes** (`server/services/user.service.js:354` calls
   `RefreshToken.markRotated`), so the first refresh kills the only refresh token the
   client will present again. Refresh when within ~60s of expiry, not strictly after,
   to narrow the concurrent-refresh race.
   **Do not shorten `JWT_EXPIRES_IN` (currently defaults to 7d) before this lands** —
   that default is the only reason the bug is not firing in production today.

5. **§1.5 Revoke on sign-out.** `src/layouts/profile-menu.tsx:158` calls bare
   `signOut()`. `POST /api/users/logout` exists and is never called. Post to it first,
   then sign out locally — and still sign out locally if that call fails.

6. **§1.6 Middleware gating.** Replace `authorized: ({ token }) => !!token` with a check
   for a recognised role *and* an access token. Delete the `'viewer'` fallback; an
   unknown role must deny.

**Part 2 (if there is room):** delete `/signup` and the demo trees
`(sign-in)/sign-in-1..5`, `(sign-up)/sign-up-1..5`, `(otp)/otp-1..5`,
`(forgot-password)/forgot-password-2..5`. **`forgot-password-1` is REAL** — it posts to
`/api/users/forgot-password` and is the target of the "Forgot password?" link at
`sign-in-form.tsx:298`; promote it to `/forgot-password`. `auth/reset-password/[token]`
is real, leave it. Then prune dead refs from the six layout `menu-items` files,
`src/app/shared/search/page-links.data.ts`, and `routes.auth.*` in `src/config/routes.ts`.
Finally wire `src/app/shared/roles-permissions/create-user.tsx` (a `console.log` stub at
line 24) to the `POST /api/users` endpoint built in Part 0 — without it there is no way
to create an admin now that `/signup` is gone.

**Gotchas:**
- Server tests: `npm test` is broken on Node 22 (`node --test __tests__/` cannot resolve
  the directory). Use `node --test "__tests__/*.test.js"`.
- Baseline is **3 pre-existing server failures** (pricelist tenant-scope, two SO-number),
  visible only in a full-suite run, not in isolation. Do not chase them.
- Admin `tsc --noEmit` has ~546 pre-existing errors. Measure the delta, not the total.
- The working tree has unrelated uncommitted changes (blog, gemini.service, Size.js,
  subproduct.service.js). Commit only auth files.

**§1.1, §1.2 and §1.6 are behaviour-breaking on deploy:** any `customer`-role account
that currently signs into the admin will stop being able to. That is intended, but say so
in the commit message.

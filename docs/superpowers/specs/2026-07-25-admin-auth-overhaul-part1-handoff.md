# Part 1 Handoff Prompt

Paste the block below into a fresh Claude Code session in this repo.

**Status: §1.1 and §1.2 are DONE and pushed (`bf08e631`). Remaining: §1.3–§1.6, then Part 2.**

---

Continue Part 1 of the admin auth overhaul in `client/apps/admin`.

Read `docs/superpowers/specs/2026-07-25-admin-auth-overhaul-design.md` first — it is the
approved spec. Part 0 (`82f139fc`) and §1.1–§1.2 (`bf08e631`) are already done. Do not
redo them. Start at §1.3.

**Already in place — build on it, do not re-derive:**

- **Vitest is set up** in the admin app: `vitest.config.ts`, `npm test` / `npm run test:watch`.
  13 tests currently pass across `auth-options.test.ts` and `authorize.test.ts`
  (both in `src/app/api/auth/[...nextauth]/`).
- `GoogleProvider` is gone; `GOOGLE_CLIENT_ID/SECRET` removed from `src/env.mjs`.
- `assertRoleMayAccessAdmin()` exists in `auth-options.ts` and is applied to **both**
  the `credentials` and `pos-pin` providers. `customer` is excluded.
- `tsc --noEmit` is at **0 errors**. Keep it there. (Older memory claiming ~546
  pre-existing errors is stale — ignore it.)

**Decisions already made — do not re-litigate:**

- MFA challenge is **inline on `/signin`** (the card swaps to 6-digit entry), not a
  separate route. `pendingMfaToken` stays in React state only.
- TDD with Vitest, as above.

**Remaining items:**

1. **§1.3 MFA challenge.** The backend returns
   `{ success: true, mfaRequired: true, pendingMfaToken }` with **no** `token`
   (`server/services/user.service.js:214`). `authorize()` checks only `data.success`,
   so MFA-enabled admins currently get a session with `token: undefined` and every API
   call 401s. Plan: `authorize` throws `MFA_REQUIRED::<pendingMfaToken>`; the sign-in
   form matches that prefix on `result.error` and swaps to code entry; a new `mfa`
   credentials provider posts `{ pendingMfaToken, code }` to `/api/users/mfa/verify`,
   which returns the same `{ user, token, refreshToken }` shape as login. Reuse
   `assertRoleMayAccessAdmin()` in the new provider too.
   **The storefront already implements this whole flow** —
   `client/apps/platform/src/context/AuthContext.tsx` has `completeMfaLogin` and
   `setMfaToken`. Port from there rather than inventing it.
   UI needs: 6-digit input, a "use a backup code instead" toggle (same endpoint accepts
   either), a back link that clears the pending token, and a distinct message for the
   expired 5-minute token so the user restarts rather than retries.

2. **§1.4 Move refresh from `session()` into `jwt()`.** `session()` assigns refreshed
   tokens onto `token`, but NextAuth v4 never re-encodes the JWT from the session
   callback, so they are discarded. The server **rotates and revokes**
   (`server/services/user.service.js:354` calls `RefreshToken.markRotated`), so the
   first refresh kills the only refresh token the client will present again. Refresh
   when within ~60s of expiry, not strictly after, to narrow the concurrent-refresh
   race. On failure set `token.error = 'RefreshAccessTokenError'`; `auth-provider.tsx`
   already signs the user out on that.
   **Do not shorten `JWT_EXPIRES_IN` (defaults to 7d) before this lands** — that default
   is the only reason the bug is not firing in production today.

3. **§1.5 Revoke on sign-out.** `src/layouts/profile-menu.tsx:158` calls bare
   `signOut()`. `POST /api/users/logout` exists and is never called. Post to it first,
   then sign out locally — and still sign out locally if that call fails.

4. **§1.6 Middleware gating.** `src/middleware.ts:167` gates on
   `authorized: ({ token }) => !!token`. Require a recognised role *and* an access
   token. Delete the `'viewer'` fallback at `src/middleware.ts:80`; an unknown role
   must deny.

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
- **NextAuth v4 stores a caller-supplied provider `id` in `provider.options.id`**, not
  `provider.id` (which holds the factory default `'credentials'`). `parseProviders`
  resolves `userOptions?.id ?? defaults.id`. `authorize.test.ts` has a working helper.
- Server tests: `npm test` is broken on Node 22 (`node --test __tests__/` cannot resolve
  the directory). Use `node --test "__tests__/*.test.js"`.
- Baseline is **3 pre-existing server failures** (pricelist tenant-scope, two SO-number),
  visible only in a full-suite run, not in isolation. Do not chase them.
- The working tree has unrelated uncommitted changes (blog, gemini.service, product-seo).
  Commit only auth files.

**§1.6 is behaviour-breaking on deploy**, as §1.1/§1.2 already were: sessions without a
recognised role stop working. Intended — say so in the commit message.

**Operator action still outstanding:** the Google OAuth client secret is live in
`client/apps/admin/.env` and now unused. Revoke the client in Google Cloud Console
rather than only deleting the lines.

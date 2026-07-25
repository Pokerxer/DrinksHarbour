# Part 1 Handoff Prompt

**Status: Part 1 is COMPLETE.** Part 0 (`82f139fc`), §1.1–§1.2 (`bf08e631`) and
§1.3–§1.6 (`c1a828c0`) are all done. Only **Part 2** of the spec remains.

Paste the block below into a fresh Claude Code session in this repo.

---

Continue the admin auth overhaul in `client/apps/admin` at **Part 2** of
`docs/superpowers/specs/2026-07-25-admin-auth-overhaul-design.md`. Part 0 and all
of Part 1 are done — do not redo them.

**Already in place — build on it, do not re-derive:**

- **Vitest**: `npm test` / `npm run test:watch` in the admin app. **47 tests pass**
  across `auth-options.test.ts`, `authorize.test.ts`, `mfa-challenge.test.ts`,
  `refresh.test.ts`, `session-guard.test.ts` (all in
  `src/app/api/auth/[...nextauth]/`), `src/app/api/auth/revoke/revoke-session.test.ts`
  and `src/utils/sign-out.test.ts`.
- `GoogleProvider` is gone; `GOOGLE_CLIENT_ID/SECRET` removed from `src/env.mjs`.
- `ADMIN_ACCESS_ROLES` now lives in `src/types/authorization.ts` (= `PLATFORM_ROLES`
  + `TENANT_ROLES`, no `customer`) and is the single source for both
  `assertRoleMayAccessAdmin()` in `auth-options.ts` and `hasAdminSession()` in
  `session-guard.ts`.
- Three credentials providers: `credentials`, `mfa`, `pos-pin`. All three apply the
  role whitelist.
- MFA is inline on `/signin`: `authorize` throws `MFA_REQUIRED::<pendingMfaToken>`,
  the form matches it via `parseMfaChallenge()` from `mfa-challenge.ts` and swaps to
  code entry (6-digit or backup code), and `signIn(\'mfa\', ...)` finishes the login.
  Verified against next-auth 4.24.11: `core/routes/callback.js` redirects to
  `?error=<encodeURIComponent(error.message)>`, so thrown messages do reach
  `result.error`.
- Token refresh happens in `jwt()` (60s skew), `session()` is a pure copy, and
  `token.error = \'RefreshAccessTokenError\'` drives the existing sign-out in
  `auth-provider.tsx`. **`JWT_EXPIRES_IN` is now safe to shorten.**
- Sign-out revokes: `profile-menu.tsx` calls `signOutAndRevoke()`
  (`src/utils/sign-out.ts`), which posts to the server-side route
  `src/app/api/auth/revoke/route.ts`; that route reads the tokens from the encrypted
  NextAuth JWT via `getToken` and calls `POST /api/users/logout`. The refresh token
  is never exposed to the browser. `auth-provider.tsx` intentionally still calls a
  bare `signOut()` — by then the refresh token is already dead.
- Middleware: `authorized: ({ token }) => hasAdminSession(token)`; the `\'viewer\'`
  fallback is gone and every role check handles an absent role explicitly.

**Remaining — Part 2:**

1. Delete `/signup` and the demo trees `(sign-in)/sign-in-1..5`,
   `(sign-up)/sign-up-1..5`, `(otp)/otp-1..5`, `(forgot-password)/forgot-password-2..5`.
2. **`forgot-password-1` is REAL** — it posts to `/api/users/forgot-password` and is
   the target of the "Forgot password?" link in `sign-in-form.tsx`
   (`routes.auth.forgotPassword1`); promote it to `/forgot-password`.
   `auth/reset-password/[token]` is real, leave it.
3. Prune dead refs from the six layout `menu-items` files,
   `src/app/shared/search/page-links.data.ts`, and `routes.auth.*` in
   `src/config/routes.ts`.
4. Wire `src/app/shared/roles-permissions/create-user.tsx` (a `console.log` stub at
   line 24) to the `POST /api/users` endpoint built in Part 0 — without it there is
   no way to create an admin once `/signup` is gone.

**Gotchas:**

- **NextAuth v4 stores a caller-supplied provider `id` in `provider.options.id`**,
  not `provider.id` (which holds the factory default `\'credentials\'`).
  `parseProviders` resolves `userOptions?.id ?? defaults.id`. `authorize.test.ts`
  has a working helper.
- **tsc baseline is 489 errors app-wide** (measured 2026-07-25 with the workspace\'s
  own `./node_modules/.bin/tsc --noEmit`; `npx tsc` fetches an unrelated package and
  lies). None are in any auth file. The earlier "0 errors" and "546 errors" figures
  were both wrong — check `grep -c "error TS"` before and after your change rather
  than trusting a number in a doc.
- The admin app has **no jsdom/testing-library**, so React components are not
  unit-tested. Keep testable logic in plain modules (that is why `mfa-challenge.ts`,
  `session-guard.ts`, `revoke-session.ts` and `sign-out.ts` exist as separate files)
  and smoke-test the UI in a browser.
- Server tests: `npm test` is broken on Node 22 (`node --test __tests__/` cannot
  resolve the directory). Use `node --test "__tests__/*.test.js"`.
- Baseline is **3 pre-existing server failures** (pricelist tenant-scope, two
  SO-number), visible only in a full-suite run. Do not chase them.
- The working tree has unrelated uncommitted changes (blog, gemini.service,
  product-seo). Commit only auth files.

**Manual smoke tests still outstanding for Part 1** (Atlas blocks this host, so they
were not run): password login, MFA login with a TOTP code and with a backup code,
the expired-pending-token path (wait 5 minutes before submitting — expect "Your
verification window timed out"), sign-out revocation (check the `RefreshToken`
document is revoked), and that a session with no role is bounced by the middleware.

**Operator action still outstanding:** the Google OAuth client secret is live in
`client/apps/admin/.env` and now unused. Revoke the client in Google Cloud Console
rather than only deleting the lines.

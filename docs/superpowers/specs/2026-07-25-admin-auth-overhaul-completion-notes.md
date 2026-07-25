# Admin Auth Overhaul — Completion Notes

**Status: the whole spec is IMPLEMENTED.** Part 0 `82f139fc`, §1.1–§1.2 `bf08e631`,
§1.3–§1.6 `c1a828c0`, Part 2 `4978b213`, plus the requireMfa fix `41a6b8f6`. What remains is operator work and manual
verification, listed at the bottom — no coding tasks are outstanding.

## The requireMfa defect — FIXED (`41a6b8f6`)

`requireMfa` demanded an `x-mfa-token`/`dh_mfa` that nothing in the server ever
issued (`generateMfaVerifiedToken` was exported and never called), so every route
behind `router.use(requireMfa)` — including `POST /api/users` — was a 403 for any
MFA-enabled privileged user. Fixed in two halves:

1. `mfa.controller.verifyLoginMfa` mints the token on a successful login
   challenge, sets the `dh_mfa` cookie, and returns it in the body (the admin app
   authenticates server-side in NextAuth, so it never sees this API's cookies).
2. New `POST /api/users/mfa/step-up` — `protect`, code required, deliberately
   placed **above** `router.use(requireMfa)` so it cannot demand what it issues.
   The token lasts 10 minutes by design; step-up is how a signed-in admin
   re-proves without signing out. It verifies against `req.user` (never a body
   id) and refuses accounts with MFA disabled.

Admin side: the `mfa` provider carries the token into the JWT, `jwt()` accepts a
renewed one via `update()` (the only path back into the cookie), `session()`
exposes it, `createAdminUser` sends it as `x-mfa-token` and distinguishes a
403-for-MFA from an ordinary rejection, and the create-user modal prompts for a
code then retries with the form intact.

## What Part 2 changed

- Deleted `/signup`, `auth/(sign-in|sign-up|otp)/*`, `forgot-password-2..5`,
  `src/app/shared/auth-layout/` (only the demos used it) and
  `validators/signup.schema.ts`.
- `forgot-password-1` was the real page → promoted to `/forgot-password` via
  `git mv`; links in `sign-in-form.tsx` and `reset-password-form.tsx` updated.
  `auth/reset-password/[token]` untouched, so emailed links still work.
- `routes.auth.*` is now just `forgotPassword` + `resetPassword(token)`;
  `routes.signUp` removed; the "Authentication" section is gone from all six
  layout menu-items files and `page-links.data.ts`.
- `roles-permissions/create-user.tsx` posts to `POST /api/users` through the new
  `src/services/adminUser.service.ts`. Form fields now match the endpoint:
  first/last name, initial password (server's own strength rules mirrored in the
  zod schema), role, and a tenant picker required for tenant-scoped roles.

## Reference — what Part 1 left in place

- **Vitest**: `npm test`. **65 tests** across `auth-options`, `authorize`,
  `mfa-challenge`, `refresh`, `session-guard` (in `src/app/api/auth/[...nextauth]/`),
  `revoke/revoke-session`, `src/utils/sign-out` and `src/services/adminUser.service`.
- `ADMIN_ACCESS_ROLES` in `src/types/authorization.ts` is the single source for both
  `assertRoleMayAccessAdmin()` (auth-options) and `hasAdminSession()` (session-guard).
- Three credentials providers — `credentials`, `mfa`, `pos-pin` — all role-checked.
- MFA is inline on `/signin`: `authorize` throws `MFA_REQUIRED::<pendingMfaToken>`,
  parsed by `parseMfaChallenge()`. Verified in next-auth 4.24.11
  (`core/routes/callback.js`): a thrown `authorize` error redirects to
  `?error=<encodeURIComponent(message)>`, so the message reaches `result.error`.
- Refresh runs in `jwt()` (60s skew); `session()` is pure. **`JWT_EXPIRES_IN` is
  safe to shorten now.**
- Sign-out revokes via the server-side route `src/app/api/auth/revoke/route.ts`,
  which reads the tokens from the encrypted NextAuth JWT and calls
  `/api/users/logout`. A bare call with only an access token would be a no-op: the
  endpoint revokes by the refresh token's jti. `auth-provider.tsx` still calls a
  bare `signOut()` on purpose — by then the refresh token is already dead.

## Gotchas for whoever works here next

- **NextAuth v4 keeps a caller-supplied provider `id` in `provider.options.id`**,
  not `provider.id` (the factory default). `authorize.test.ts` has a helper.
- **tsc baseline: 479 source errors** app-wide, none in any auth file (measured
  2026-07-25 with `./node_modules/.bin/tsc --noEmit`; `npx tsc` installs an
  unrelated package and prints nothing useful). Filter out `.next/types/` — that is
  a stale build artifact that still references the deleted demo pages until the next
  build. The old "0 errors" and "546 errors" figures were both wrong.
- The admin app has **no jsdom/testing-library**, so React components are not
  unit-tested. Keep logic in plain modules (`mfa-challenge.ts`, `session-guard.ts`,
  `revoke-session.ts`, `sign-out.ts`, `adminUser.service.ts`) and smoke-test the UI.
- Server tests: `npm test` is broken on Node 22. Use `node --test "__tests__/*.test.js"`.
  Baseline is **3 pre-existing failures** (pricelist tenant-scope, two SO-number).

## Outstanding — not code

**Manual smoke tests** (Atlas blocks this host, so none were run): password login;
MFA login with TOTP and with a backup code; the expired-pending-token path (wait 5
minutes — expect "Your verification window timed out"); sign-out revocation (check
the `RefreshToken` doc flips to revoked); a role-less session bounced by the
middleware; creating a user from Roles & Permissions (and, with MFA enabled, the step-up
prompt that appears once the 10-minute window lapses); the forgot → reset round trip
against `/forgot-password`; and that `/signup` and `/api/auth/signin/google` both 404.

**Operator action:** the Google OAuth client secret is still live in
`client/apps/admin/.env` and now unused — **revoke the client in Google Cloud
Console**, not just delete the lines. Also still unrun:
`scripts/audit-privileged-accounts.js` from Part 0 (read-only; needs a permitted host).

# Admin Auth Overhaul — Design

**Date:** 2026-07-25
**Scope:** `client/apps/admin` login/authentication, plus the `server/` endpoints that back it
**Status:** Approved, pending implementation plan

---

## Summary

The admin app's authentication has two unauthenticated paths to `super_admin`, an
unguarded OAuth provider, and a token-refresh implementation that cannot work.
This spec closes those holes, adds the MFA challenge step the backend already
supports but the client never implemented, and removes the Isomorphic template
auth routes still shipping in the bundle.

The work splits into three parts. **Part 0 is blocking** — it is a live
privilege-escalation fix and everything else is cosmetic next to it.

---

## Part 0 — Privilege escalation (server)

### 0.0 The vulnerabilities

**V1 — `POST /api/users/register` mints super admins.**
The route is public (`server/routes/user.routes.js:175`, PUBLIC ROUTES section,
guarded only by `registerLimiter`). Its validator explicitly permits the caller
to choose their own role:

```js
// server/routes/user.routes.js:94-97
body('role')
  .optional()
  .isIn(['customer', 'tenant_admin', 'admin', 'super_admin'])
  .withMessage('Invalid role'),
```

`userController.registerUser` passes `req.body` through untouched
(`server/controllers/user.controller.js:21`), and `userService.registerUser`
honours the role after validating it against the same permissive list
(`server/services/user.service.js`, `validRoles`). A single unauthenticated
request with `"role": "super_admin"` creates a platform super admin. No email
verification, no approval, no allowlist.

**V2 — `POST /api/verification/verify-code` hard-codes super admin.**
Marked `@access Public` (`server/routes/verification.routes.js:76`). On a valid
6-digit email code it calls:

```js
// server/controllers/verification.controller.js:98-102
const result = await userService.registerUser({
  ...userData,
  role: 'super_admin',
  isEmailVerified: true,
});
```

Anyone who can receive email at any address becomes a super admin. The admin app
ships the front door for this at `/signup`, titled "Admin Registration".

Both are remotely exploitable from an unauthenticated start and grant the highest
privilege in the system. V1 does not even require an email round-trip.

### 0.1 Public registration becomes customer-only

- Remove the `role` field from `registerValidation` entirely.
- In `userService.registerUser`, stop accepting a caller-supplied role. The
  public path always produces `role: 'customer'`.
- Extract the elevated-role creation logic into a new
  `userService.createUserAsAdmin(data, actor)` used only by the authenticated
  endpoint below.

Rationale for ignoring rather than rejecting an unexpected `role`: a hard
rejection turns existing storefront clients that send `role: 'customer'`
explicitly into errors. Silently normalising is the compatible choice, and the
regression test in §0.5 pins the behaviour.

### 0.2 New authenticated create-user endpoint

`POST /api/users` — `protect` + `authorize('super_admin')`.

- Accepts `role` from the body, validated against the full role list.
- Only a `super_admin` may create another `super_admin`; an `admin` creating a
  `super_admin` is rejected. (Currently moot since the route is super-admin-only,
  but the rule belongs in the service so it survives any later loosening of the
  route guard.)
- Returns the created user without a token — this is administration, not login.

**This endpoint is a prerequisite for removing `/signup`.** There is no other
working way to create an admin: `client/apps/admin/src/app/shared/roles-permissions/create-user.tsx:24`
is an untouched template stub that `console.log`s the form data behind a fake
600ms timer and never calls an API.

### 0.3 Verification flow demoted

`verification.controller.js` stops passing `role: 'super_admin'`. That flow is
storefront email verification and yields a `customer`, consistent with §0.1.

### 0.4 Rogue account audit

A read-only script listing every `super_admin` and `admin` with `createdAt`,
`lastLogin`, `lastLoginIp`, `isEmailVerified`, and `googleId`. Output is handed
over for review.

**No account is deleted, suspended, or modified by this work.** Deciding which
accounts are legitimate requires knowledge of the team that the codebase does not
contain, and a wrong automated call locks out real staff. The disposition of
anything suspicious in that list is the operator's decision.

### 0.5 Tests

- `POST /api/users/register` with `role: 'super_admin'` produces a `customer`.
- `POST /api/users/register` with `role: 'admin'` produces a `customer`.
- `POST /api/verification/verify-code` produces a `customer`.
- `POST /api/users` unauthenticated → 401; as `admin` → 403; as `super_admin` → 201.
- `POST /api/users` as `admin` requesting `role: 'super_admin'` → 403.

---

## Part 1 — Admin client authentication

### 1.1 Remove the Google provider

`GoogleProvider` (`auth-options.ts:394`) is registered with live credentials from
`.env`, carries `allowDangerousEmailAccountLinking: true`, and has no `signIn`
callback to check the account against the backend. There is no Google button
anywhere in the UI, but `/api/auth/signin/google` is a live endpoint regardless.
Any Google account yields a valid NextAuth session cookie carrying no `role` and
no backend access token.

Middleware's only gate is `authorized: ({ token }) => !!token`
(`middleware.ts:167`), and role falls back to `'viewer'` (`middleware.ts:80`),
which is in neither `PLATFORM_ROLES` nor `TENANT_ROLES`. `/executive` and
`/financial` block it; `/ecommerce`, `/inventory`, `/analytics`, `/support`,
`/file-manager` do not. Backend data calls 401 without a token, but the admin
shell is reachable by a stranger.

Delete the provider and the now-unused `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
from `env.mjs`. The `models/User.js:145` `googleId` field stays — it is storefront
data and unrelated.

### 1.2 Role whitelist correctness

- Remove `'customer'` from `validRoles` (`auth-options.ts:259-266`). A storefront
  customer signing into the admin dashboard is not intended.
- Apply the same whitelist to the `pos-pin` provider (`auth-options.ts:338`),
  which performs no role check at all today.

### 1.3 MFA challenge step

The backend implements MFA fully and the client ignores it. `loginUser` returns
`{ success: true, mfaRequired: true, pendingMfaToken }` with **no** `token`
(`server/services/user.service.js:214-228`). `authorize()` checks only
`data.success`, so it builds a session with `token: undefined` — the user appears
signed in and every subsequent API call 401s. MFA-enabled admins cannot use the
dashboard.

**Flow:**

1. `credentials.authorize` detects `mfaRequired` and throws
   `MFA_REQUIRED::<pendingMfaToken>`. No session is created.
2. The sign-in form matches the `MFA_REQUIRED::` prefix on `result.error`, holds
   the pending token in React state, and swaps the card to 6-digit code entry.
3. A new `mfa` credentials provider posts `{ pendingMfaToken, code }` to
   `/api/users/mfa/verify`, which returns the same `{ user, token, refreshToken }`
   shape as login (`server/controllers/mfa.controller.js`, `verifyLoginMfa`) and
   is handled by the same user-mapping code.

The pending token lives in memory only — never a URL, never storage — and expires
in 5 minutes server-side. This is why the challenge is inline on `/signin` rather
than a separate route: a navigation boundary would force the token into
`sessionStorage` or a query param, both strictly worse.

**UI:** 6-digit input, a "use a backup code instead" toggle switching to a free-text
field (the backend accepts either at the same endpoint), a back link that clears
the pending token, and a distinct message for the expired-session case so the user
knows to restart rather than retry.

Relying on the thrown message reaching the client is consistent with existing
behaviour — `sign-in-form.tsx:92-103` already branches on `result.error.includes('locked')`.
The plan will verify this holds on next-auth 4.24.11 before building on it.

### 1.4 Move token refresh into `jwt()`

`session()` (`auth-options.ts:133-151`) refreshes the access token and assigns the
result onto `token`. NextAuth v4 does not re-encode the JWT from the session
callback, so the rotated tokens are discarded every time.

This is not merely wasteful. The server **rotates and revokes**: `refreshAuthToken`
issues a new refresh token and calls `RefreshToken.markRotated(decoded.jti, ...)`
on the old one (`server/services/user.service.js:354`). The first refresh
therefore revokes the only refresh token the client will ever present again, and
every later attempt fails against a dead `jti` → `RefreshAccessTokenError` → forced
sign-out via `auth-provider.tsx:11-13`.

It survives in production only because `JWT_EXPIRES_IN` defaults to `7d`, so the
path is rarely hit. Shortening the access-token lifetime — a normal hardening move —
would break every session.

**Fix:** perform refresh in `jwt()`, where the return value is re-encoded into the
cookie. `session()` becomes pure, copying token fields onto the session. On
failure set `token.error = 'RefreshAccessTokenError'` and let the existing
`auth-provider.tsx` handler sign the user out.

**Concurrency:** parallel requests can enter `jwt()` together and race to spend the
same rotated token. Refresh when the access token is within a 60-second skew of
expiry rather than strictly after it, so the common case is a single early refresh.
This narrows the window but does not close it; the residual risk is one spurious
sign-out under an exact race, which is acceptable and no worse than today.

### 1.5 Revoke on sign-out

`profile-menu.tsx:158` calls bare `signOut()`. `POST /api/users/logout` exists
(`server/routes/user.routes.js:339`) and is never called, so refresh tokens stay
live in the database until natural expiry.

Add a wrapper that posts to `/api/users/logout` with the current access token,
then calls `signOut()`. Local sign-out proceeds even if the revoke call fails —
failing to clear the local session because the network hiccuped would be worse
than a stale server-side token.

### 1.6 Middleware gating

Replace `authorized: ({ token }) => !!token` with a check that the token carries
both a recognised role and an access token. Remove the `'viewer'` fallback at
`middleware.ts:80` — an unknown or absent role denies rather than silently
receiving the permissions of a role that does not exist in `UserRole`.

---

## Part 2 — Route cleanup

### 2.1 Delete

- `src/app/signup/` (page + 868-line form) — the `/signup` front door from §0.2.
- `src/app/auth/(sign-in)/sign-in-1..5`
- `src/app/auth/(sign-up)/sign-up-1..5`
- `src/app/auth/(otp)/otp-1..5`
- `src/app/auth/(forgot-password)/forgot-password-2..5`

These are unmodified Isomorphic template demos. Confirmed unreferenced except by
each other and by menu/search data. This mirrors the earlier demo-route prune that
addressed the admin build's memory ceiling.

### 2.2 Keep and promote

`(forgot-password)/forgot-password-1` is **real** — it posts to
`/api/users/forgot-password` and is the target of the "Forgot password?" link at
`sign-in-form.tsx:298`. Move it to `/forgot-password` and update the link.

`auth/reset-password/[token]` is real and stays as-is. Reset emails link to the
token route, not to `forgot-password-*`, so no emailed link breaks.

### 2.3 Prune references

Dead entries in `src/layouts/{hydrogen,carbon,lithium,helium,boron}/*menu-items*`,
`src/layouts/beryllium/beryllium-{fixed,sidebar}-menu-items.tsx`,
`src/app/shared/search/page-links.data.ts`, and the `routes.auth.*` block in
`src/config/routes.ts`.

### 2.4 Wire the create-user modal

Point `roles-permissions/create-user.tsx` at the new `POST /api/users` from §0.2,
replacing the `console.log` stub. Without this there is no way to create an admin
after `/signup` is removed.

---

## Breaking changes

1. **Customer-role accounts lose admin access** (§1.2, §1.6). Intended, but anyone
   currently relying on it is locked out at deploy.
2. **`POST /api/users/register` ignores `role`** (§0.1). Any caller depending on
   self-assigned elevated roles silently gets `customer` instead.
3. **`/signup` returns 404** (§2.1). Admin creation moves to §2.4.

---

## Testing

Repo convention is `node:test`, not jest.

**Server:** the §0.5 privilege-escalation suite; refresh-token rotation and reuse
rejection; MFA two-phase handshake including expired and reused pending tokens.

**Client:** `authorize()` role rejection per provider; `MFA_REQUIRED::` parsing;
`jwt()` refresh persisting rotated tokens; middleware denying a role-less token.

Manual smoke: password login, MFA login with TOTP and with a backup code, forgot →
reset round trip, sign-out revocation, and confirmation that `/api/auth/signin/google`
and `/signup` both 404.

---

## Out of scope

Sign-in visual redesign, session-device management UI, password rotation policy,
and admin-side MFA enrolment (`/api/users/mfa/enable` exists and is unused by the
admin app — enrolment is a separate feature from the login challenge built here).

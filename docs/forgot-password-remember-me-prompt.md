# Continuation prompt: complete Forgot-Password & Remember-Me

Use this in a fresh session. The admin sign-in page was just redesigned to the
DrinksHarbour brand; this task finishes the two auth flows that were deferred.

## Context / where things stand

- App: `client/apps/isomorphic` (Next.js app-router, NextAuth v4 credentials,
  rizzui + `@core/ui/form`, framer-motion, react-hook-form + zod).
- The redesigned sign-in lives in:
  - `src/app/signin/page.tsx` — two-panel layout. Left = red brand panel
    (`BRAND_RED = '#b20202'`, gradient + blurred circles), logo `/brand-logo.svg`
    on a white badge, value props. Right = white form panel.
  - `src/app/signin/sign-in-form.tsx` — themed form. Accent via CSS var
    `--accent` (`tenant?.primaryColor || '#b20202'`). **Mirror this styling**
    for the new pages so everything matches.
- Tenant theming: pages resolve a `tenant` (logo + `primaryColor`) from the
  subdomain / `x-tenant-slug` header / `?_tenant=` param. Reuse the
  `fetchTenantBySlug` + tenant-resolution block already in `signin/page.tsx`.

## Backend (already exists — do NOT rebuild)

- `POST /api/users/forgot-password` — body `{ email }` → `{ success, message, data }`.
  Always responds success-ish (don't leak whether the email exists).
- `POST /api/users/reset-password/:token` — body `{ newPassword }` →
  `{ success, message, data }`. Controller: `server/controllers/user.controller.js`
  (`requestPasswordReset`, `resetPassword`); routes: `server/routes/user.routes.js`.
  `API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'`.

## Task 1 — Forgot-password (request)

- Retheme `src/app/auth/(forgot-password)/forgot-password-1/page.tsx` and its
  `forget-password-form.tsx` to the new two-panel brand layout (drop the stock
  `AuthWrapperOne` + S3 image + blue accent). Keep it a client form.
- Wire submit → `POST /api/users/forgot-password` with `{ email }`.
  - Loading state on the button; on success show a calm confirmation panel
    ("If an account exists for X, we've sent reset instructions") — do NOT reveal
    account existence. On network/500 error show an inline error.
- Validate email with a small zod schema (mirror `validators/login.schema.ts`).
- Keep a "Back to sign in" link → `routes.signIn`.

## Task 2 — Reset-password (with token) — NEW PAGE

- No reset page exists today, so the email link 404s. Create one.
  - Route: `src/app/auth/reset-password/[token]/page.tsx` (+ client form). Add
    `routes.auth.resetPassword = (token) => '/auth/reset-password/' + token` to
    `src/config/routes.ts`, and make the backend email link point there.
- Fields: `newPassword` + `confirmPassword` (zod: min length, must match, show/
  hide toggle like sign-in). Submit → `POST /api/users/reset-password/:token`.
  - On success: toast + redirect to `routes.signIn`. On invalid/expired token:
    inline error + link back to forgot-password.
- Same brand two-panel styling.

## Task 3 — Remember-me (currently captured but ignored)

- In `sign-in-form.tsx`, `rememberMe` is registered in the form but `onSubmit`
  never uses it — it has no effect. Decide + implement persistence:
  - NextAuth v4 JWT session `maxAge` is global (in
    `src/app/api/auth/[...nextauth]/auth-options.ts`). Per-login remember-me
    needs custom handling. Recommended approach: pass `rememberMe` through
    `signIn('credentials', { ... })`, read it in the `authorize`/`jwt` callback,
    and stamp the token with a `remember` flag + a longer `exp`; in the `session`
    callback / cookie config honor it. If that's too invasive, the acceptable
    fallback is: default short session, and when `rememberMe` is true set a
    longer cookie `maxAge`.
  - Verify the chosen behavior actually changes session lifetime (don't just
    wire the prop and claim done — confirm the cookie/JWT `exp` differs).

## Constraints / definition of done

- Match the sign-in brand styling exactly (red accent, `--accent` var, logo,
  two-panel). Keep motion restrained (one entrance + error shake — no perpetual
  animations).
- `npx tsc --noEmit -p tsconfig.json` clean except the pre-existing TS2688 noise.
- Manually verify in the browser: request reset → email/log → open reset link →
  set new password → sign in; and remember-me actually extends the session.
- Use systematic-debugging if anything misbehaves; commit on a feature branch
  (not directly on main) and open a PR.

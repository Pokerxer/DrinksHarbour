# Continuation prompt: fix Platform storefront login + chatbot errors

Use this in a fresh session. The customer-facing storefront app was just renamed
from `apps/isomorphic-starter` to **`apps/platform`** (package name `platform`).
Two things are broken and were deferred: **login** and the **chatbot widget**.

> ⚠️ FIRST: capture the actual symptoms. This prompt was written without the
> exact error text. Before changing anything, reproduce both bugs and record:
> - Login: what happens on submit? (network status code, response body, console
>   error, redirect-or-not). Is it every account or specific ones?
> - Chatbot: does it fail on open (greeting) or on send (query)? Status code +
>   response body + any server log line.
> Use **systematic-debugging** — find root cause before proposing a fix.

## App / stack

- Storefront: `client/apps/platform` (Next.js app-router). Auth is a **custom
  React context** (NOT NextAuth) calling the shared Express backend.
- Backend: `server/` (Express + Mongoose), default `http://localhost:5001`.
- Frontend API base: `client/apps/platform/src/lib/api.ts` → `API_URL`
  (`NEXT_PUBLIC_API_URL` || `VERCEL_URL` || `http://localhost:5001`).

## Login — where it lives

- `client/apps/platform/src/context/AuthContext.tsx`
  - `login()` → `POST ${API_URL}/api/users/login` (~line 176)
  - `register()` → `POST ${API_URL}/api/users/register` (~line 211)
  - `refreshAuth()` → `POST ${API_URL}/api/users/refresh-token` (~line 259)
  - Stores `token`/`refreshToken`; `AuthUser` requires `isEmailVerified` /
    `isAgeVerified` — a customer flow may block on these.
- Page: `client/apps/platform/src/app/login/`
- Schema: `client/apps/platform/src/utils/validators/login.schema.ts`
- Backend login: `server/controllers/user.controller.js` + `server/services/user.service.js`
  (`/api/users/login`). Same endpoint the admin app uses, so compare behaviour.

### Login hypotheses to check (verify, don't assume)
1. **`NEXT_PUBLIC_API_URL` not set** for the platform app → requests hit the
   Next app's own origin (`/api/users/login` 404) instead of the backend.
   Check `client/apps/platform/.env*`.
2. **CORS**: backend `cors` allowlist may not include the platform dev origin
   (check `server/server.js` / `app.js` CORS config and allowed origins).
3. **Role/verification gate**: backend may reject `customer` role or require
   `isEmailVerified`/`isAgeVerified`; trace `userService` login for the customer
   path. (Admin login expects admin-ish roles — see
   `client/apps/admin/src/app/api/auth/[...nextauth]/auth-options.ts`.)
4. **Response shape mismatch**: confirm `AuthContext` reads the same
   `{ success, data: { user, token, refreshToken } }` envelope the backend sends.

## Chatbot — where it lives

- Widget: `client/apps/platform/src/components/Chatbot/ChatbotWidget.tsx`
  - on open → `POST ${API_URL}/api/chatbot/greeting` (~line 195, JSON)
  - on send → `POST ${API_URL}/api/chatbot/query` (~line 248, **FormData** — image
    upload supported)
- Backend service: `server/services/chatbot.service.js` (AI is **Groq**, not
  Gemini). NOTE from project memory: the AI/chatbot backend was deleted in
  commit `41377adf` and **restored 2026-06-16 + remounted in `server.js`** — so
  first confirm the `/api/chatbot/*` routes are actually mounted and the route
  file exists (`grep -rn "chatbot" server/server.js server/routes`).

### Chatbot hypotheses to check
1. **Route not mounted / 404**: confirm `app.use('/api/chatbot', …)` is present
   in `server/server.js` and the router file exists.
2. **Missing `GROQ_API_KEY`** (or equivalent) in the server env → 500 from the
   service. Check `server/.env` and `chatbot.service.js` for the key it reads.
3. **FormData handling**: `/api/chatbot/query` is sent as multipart — confirm the
   route uses the right body parser / multer middleware (JSON parser won't read
   FormData).
4. **Same `NEXT_PUBLIC_API_URL`/CORS issues as login** apply here too.

## Definition of done

- Both flows reproduced, root-caused, and fixed (no prop-wiring-only "fixes").
- Login: a customer can sign in and the session persists across reloads
  (token in storage + `refreshAuth` works).
- Chatbot: opening shows the greeting; sending a text query returns a reply;
  sending with an image still works.
- Verify against the **running** stack (server on :5001 + `apps/platform` dev),
  not just code reading. Capture the before/after for each.
- Commit on a feature branch and open a PR (no direct commits to `main`).

## Pointers / gotchas

- Don't confuse the two apps: **`apps/admin`** (package `admin`, the dashboard,
  NextAuth) vs **`apps/platform`** (package `platform`, the storefront, custom
  `AuthContext`). This bug is the **platform** one.
- `apps/isomorphic-dnd` and `apps/isomorphic-intl` were deleted in the same
  rename change; ignore any stale doc references to them.
- `pnpm` can't run in the Node 20 sandbox (needs `node:sqlite`); the lockfile was
  hand-updated. If you add deps, regenerate `client/pnpm-lock.yaml` in a Node 22+
  environment.

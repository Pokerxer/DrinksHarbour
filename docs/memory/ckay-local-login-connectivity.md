# CKay local login connection refusal

2026-09-22: Admin NextAuth `authorize` fetch failed with ECONNREFUSED because
the local backend was stopped. Admin API URL and backend port both correctly
target localhost:5001; the Next.js frontend was running on localhost:3000.

Started `npm run dev` inside `server/`. Verified backend health HTTP 200 and
CKay login HTTP 200 with role tenant_owner and tenant `6aabec2b9294f4afed5ce61f`.
Credentials did not need resetting. Keep both frontend and backend running for
local login. See `docs/superpowers/specs/RESUME-ckay-local-login-connectivity.md`.

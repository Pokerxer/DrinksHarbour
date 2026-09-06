---
name: korapay_redirect_url_outage
description: The one-missing-prod-env-var outage precedent — FRONTEND_URL unset in production made every Korapay checkout redirect to a broken URL. Lessons for any future env-var cutover.
type: memory
---

# The Korapay redirect_url outage

## What happened

`FRONTEND_URL` (or `PLATFORM_URL`) was not set in the production backend
environment. `frontendUrl.js` falls back to `FRONTEND_URL` → `NEXT_PUBLIC_BASE_URL`
→ `DEFAULT_BASE_URL`, so on that box the fallback chain ended at a localhost
value. Every Korapay checkout was given a `redirect_url` pointing somewhere
meaningless, and the storefront payment flow broke until the var was set.

Lesson recorded in the referral plan (2026-09-05), where the same class of
failure was found on `PLATFORM_URL`: a share link resolved to
`http://localhost:3002/register?ref=…` because the var was missing.

## The general pattern (why `PAYSTACK_SECRET_KEY` inherits this)

The failure class is: **a production env var is missing; the config code has a
fallback chain that resolves to a value that only exists in local development;
and nothing loud fails, so it ships.** The subscription/billing work hardened
this surface twice:

1. `verifyPaystackSignature` now refuses outright when `PAYSTACK_SECRET_KEY` is
   missing — an HMAC keyed on `undefined` is reproducible by anyone, so a silent
   fallback would be a security hole, not just an outage.
2. `checkErmBillingConfig.js` exists to be run IN the environment the server
   actually reads, listing which of the seven `PAYSTACK_PLAN_*` codes are unset
   and what each missing one breaks.

## The checklist

When wiring any new env-dependent surface, check in production — never assume a
laptop `.env` is representative:

- `node scripts/checkErmBillingConfig.js --verify-remote` where it exists.
- For outbound-host surfaces (redirects, share links, webhooks), confirm the
  exact public URL the payload will carry, not what the fallback chain chose.
- An "unset" default that points at localhost is not a safe default anywhere
  but localhost.
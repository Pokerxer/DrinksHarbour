---
name: Wyn City checkout login gate
description: Live checkout pages and API require a validated tenant customer session.
type: project
---

2026-10-09: standalone Wyn City checkout and payment-return pages validate the
encrypted store-bound customer session against REST before rendering. Guests
redirect to sign-in with checkout next; cart is preserved. Quote, checkout creation
and status APIs reject guests. Expired access refreshes through an allowlisted
auth continuation handler that persists the rotated HttpOnly cookie. MFA-only,
revoked/forged/wrong-tenant/staff sessions cannot bypass the gate. Nonpaying demo
remains available only for isolated design preview.

Auth forms disable until hydrated/provider ready and use POST so native GET
cannot place passwords into the URL. Checkout sign-in copy confirms cart saving.
No backend source changes or real orders/payments. Verification and runtime
details: docs/superpowers/specs/RESUME-wyn-city-checkout-auth.md.


## Verification

74 units, types and production build passed.30 distinct browser cases passed
across development runs and targeted reruns; full-batch/production-HTTP limitations
are recorded in the handoff. Live guest quote/checkout/status calls401. Payment
recovery begins busy to prevent a click racing automatic initial verification.
Cart remains preserved through login and cancellation. No real orders/payments.

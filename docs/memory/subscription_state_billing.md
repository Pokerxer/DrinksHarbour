---
name: subscription_state_billing
description: Subscription state machine on the Tenant — trialing/active/past_due gating, resolveEntitlements, trialEndsAt backfill, Paystack webhook wiring, add-ons, and the read-only decision.
type: memory
---

# Subscription state & billing — what the write gate actually does

Canonical rules: `server/config/README-plan-entitlements.md`. This file is the
pointer + the gotchas that do not belong in the rules document.

## The one decision that shapes everything (2026-09-06)

**`past_due` is read-only, not a lockout.** `requireTenant` admits
`active`, `trialing` AND `past_due`; the write gate (`assertWritesAllowed`
inside `requireTenant`/`requireOwnTenant`/`verifyActiveSubscription`) refuses
POST/PUT/PATCH/DELETE when `resolveEntitlements(...).writesAllowed === false`.
`canceled` / `incomplete` / `incomplete_expired` are still refused outright.

Why: `/api/erm` sits behind `requireTenant`, so a full lockout shuts the page
the tenant needs to pay. Dunning with no route back to paying is not dunning.
**Do not re-tighten this** — it was settled after the invoice.payment_failed
webhook path was built.

## Resolution lives in ONE function

`server/services/entitlements.service.js` → `resolveEntitlements(tenant, now)`.
Everything that decides what a tenant may do reads it: the write gates, the
capability gates, `GET /api/erm/status`, and the audit script. **Never
reimplement the policy anywhere** — a second copy is how the trial/comped
categories got misread.

Same function exports `readOnlyMessage(reason)` — the ONE copy of the
read-only sentence, used by the gate, the capability gate, the email body and
`entitlementMessage`. `entitlementNotices.test.js` fails if a second copy
appears in client code.

## State populations an audit must recognise (auditTrialState.js)

- `trial_elapsed` — trialing + past trialEndsAt → **READ-ONLY on deploy**.
- `trial_open_ended` — trialing + NO trialEndsAt → permanently free; the
  pre-save hook only stamps NEW documents, so backfill is a one-time write.
- `comped` — `active` + `plan: free_trial` → writable, never degrades, and
  invisible to the trial-ending email. NOT a paying customer, but looks like
  one in every other report.
- `trial_running`, `active`, `past_due`, `lapsed`, `tenant_disabled`.

## trialEndsAt

- Populated by the Tenant pre-save hook `applyTrialWindow` (TRIAL_DAYS in
  `erm-plans.js`), every creation path. Existing docs are never re-stamped.
- `subscription.create` webhook CLEARS it — a paying tenant must not degrade
  when an old trial date passes.
- Live data moved between reads on 2026-09-06: `ufg-legacy-limited` went
  `active/free_trial` (comped) → `trialing` with trialEndsAt 2026-09-20.

## Paystack webhook

- Bytes come from the global `express.json()` `verify` hook → `req.rawBody`;
  HMAC-SHA512 over those exact bytes vs `timingSafeEqual`.
  **Do NOT re-add `express.raw()` to the route** — the global parser already
  consumed the stream; a route-level raw parser yields no Buffer.
- Missing `PAYSTACK_SECRET_KEY` = hard refusal (never HMAC over `undefined`).
- `addOnTypeForEvent` decides add-on vs tenant events from OUR metadata first,
  then the plan code — an add-on's `invoice.payment_failed` must NOT set the
  tenant `past_due`, and its `subscription.disable` must NOT cancel the tenant.

## Env that must exist in PRODUCTION (checked by checkErmBillingConfig.js)

- All seven `PAYSTACK_PLAN_*` codes (STARTER/GROWTH/PRO/ENTERPRISE/VENUE/
  EXTRA_SHOP/EXTRA_WAREHOUSE). None are set anywhere as of 2026-09-06 —
  `POST /api/erm/subscribe` and `/add-ons` both refuse by design until they are.
- `PAYSTACK_SECRET_KEY` must be `sk_live_` in prod. Precedent:
  `korapay_redirect_url_outage` — one missing prod env var on this surface
  already caused one outage.
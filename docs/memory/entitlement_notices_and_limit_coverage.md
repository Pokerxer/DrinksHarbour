---
name: entitlement_notices_and_limit_coverage
description: Two-session workstream — entitlement notices on the client (toast + banner + one source of copy) and closing unguarded creation paths behind SKU/staff/shop/warehouse/capability limits. Branches to cut and commits to split.
type: memory
---

# Entitlement notices & limit coverage

What happened in the two entitlement sessions (2026-09-06), so the commit split
and the leftover verification make sense to a cold reader.

## Notices — the seam

- Root cause: the server always raised `SUBSCRIPTION_READ_ONLY`,
  `PLAN_UPGRADE_REQUIRED`, `ADD_ON_LIMIT_REACHED` with structured `details`,
  and the admin understood none of it — a lapsed tenant got an anonymous 403 on
  every save button; only `/settings/billing` told them the truth.
- Fixed by serialising `err.code` in `server/server.js`, then building the
  client seam: `src/lib/entitlement-error.ts` (puritanical, tested),
  `src/components/entitlement-error-toast.tsx`, `src/components/read-only-banner.tsx`,
  wired into `app/layout.tsx`. Copy is `readOnlyMessage` server-side; the toast
  text is never re-authored client-side.
- **Correction vs the goals doc:** the named seam `lib/api-client.ts` was dead
  code (zero imports). The wrap happens at `window.fetch` time.
- Deploy-ordering hole closed in `billing-page.tsx`: falls back to
  `ENTITLEMENT_MESSAGE_FALLBACK` when the API hasn't shipped
  `entitlementMessage` yet — otherwise an old client exposes no amber box at
  all.

### Browser verification (this session)

Playwright against the real admin app on the scratch harness page
`/scratch/billing-readonly` (now deleted) with a stub route returning crafted
403s through the real fetch wrapper:

- standing banner renders on an ordinary screen with a `/settings/billing` link;
- 5 parallel `SUBSCRIPTION_READ_ONLY` (trial_expired) 403s → exactly ONE toast;
- `past_due` and trial variants each show ONE toast with "Go to billing";
- `PLAN_UPGRADE_REQUIRED` toast names the plan label ("Growth");
- non-billing 403 → NO toast; 200 → NO toast.

## Limit coverage — three unguarded doors + five routers

- `checkSkuLimit` was mounted only on `subproduct.routes.js` create; wired
  now on `/:id/duplicate` and the bulk routes (`checkSkuLimitFor(len)`),
  plus a `skuBudgetFor`-aware CSV import path that reports `skippedOverLimit`
  instead of dying.
- `checkStaffLimit` was imported by no route file — wired on
  `POST /employees` and `POST /pos/cashiers`.
- `checkShopLimit` was written and wired nowhere — wired on `POST /pos/shops`.
- `requireCapability('purchase_orders')` added to the seven purchase-module
  routers that were open (purchaseOrder/purchaseAgreement/vendor/vendorBill/
  vendorReturn/vendorPricelist/reorder).

Gates that stay intentionally absent (api_access, venue POS features, five
legacyMinPlan routes) are recorded as deliberate in the README §5a and the
`plan_based_route_protection` memory.

## Commits to split (goal D)

Nothing on this branch is committed as of this writing. The body spans three
sessions' worth of uncommitted work (entitlements + routing, subscription
state + billing, then notices + limit coverage + emails + usage cache). Split
into coherent commits; the branch name should not be `feat/referral-rewards`.
Never `git add -A`; stage paths explicitly.
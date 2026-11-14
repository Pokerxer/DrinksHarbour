# Sponsored ads & prepaid ad-wallet agreement

Authoritative plan: `docs/superpowers/plans/2026-11-14-merchandising-phase2.md` (Part B).
Execution commits: 174ddecb, 39506e75, 6c5c28f4, fce11c35, 84d5269a, 8c663f2d,
172956a8, 2f657d52 (branch `feat/plan-entitlements-billing`).

Advertising is prepaid-only. A campaign can never spend money the tenant has not
loaded. No discounts, no credit, no negative balances; tenant payouts are
untouched by ad spend.

## Ledger invariants

Money lives in two records, mutated together, exactly like the customer wallet
(`server/models/WalletTransaction.js`):

- `Tenant.adWalletBalance` (default 0, min 0) is the running balance.
- `server/models/AdWalletTransaction.js` is an append-only ledger: `credit` /
  `debit`, positive integer `amount`, required `balanceAfter` snapshot,
  timestamps createdAt only — rows are never updated or deleted. Every balance
  change appends a row; no row, no balance change.

Debits use one atomic operation:
`Tenant.findOneAndUpdate({ _id, adWalletBalance: { $gte: tariff } },
{ $inc: { adWalletBalance: -tariff } })` (`server/services/adWallet.service.js`
`debitForClick`). The balance guard in the filter IS the concurrency control —
never a read-check-write race, never an overdraw. On the guard failing the
service returns `{ ok: false, reason: 'insufficient_balance' }` and the CALLER
(click handler) owns pausing the campaign.

Credits are idempotent by Paystack reference: `creditAdWallet` first looks for
an existing ledger row with the same `reference` + `type: 'credit'` and returns
it untouched, so verify re-fires and webhook echoes cannot double-credit.

## Tariff is a decision, not a market rate

`server/config/ads.js` exports `CPC_TARIFF_NGN` (default 50, env override
`ADS_CPC_TARIFF_NGN`). This number is a deliberate platform pricing decision:
no bid/market data exists (docs/memory/ads-promo-break-even-2026-11-10.md —
MISSING, do not estimate). Never present it as a "market rate" in UI copy; the
dashboard campaign form takes its tariff figure from the
`GET /api/ads/campaigns/summary` response (`cpcTariff`), never a client-side
hard-code.

## Top-up flow (existing Paystack seam only)

Top-up rides the existing initialize/verify path — no new payment provider:

1. Tenant dashboard calls `POST /api/payments/paystack/initialize` with
   `metadata: { purpose: 'ad_wallet' }` and an `Idempotency-Key` header
   (required for payment initialization). `initializePaystackPayment` stamps
   `tenantId` from the JWT (`req.user.tenant`) into the persisted metadata —
   the claim record is the only durable carrier of purpose/tenant
   (`server/services/marketplacePaymentTrust.js` `initialize`).
2. On settlement, `server/services/adWalletTopup.service.js`
   (`settleAdWalletCredit(reference)`) re-verifies the reference through
   `payment.service.verifyPaystackTransaction` itself (never trusts a caller's
   copy), and on success + `metadata.purpose === 'ad_wallet'` credits the
   wallet with the verified amount. Tenant and user come from the stored
   metadata / initialization claim, never from the verify request. It NEVER
   throws — a settlement failure logs for reconciliation instead of failing
   the payment response or webhook ack.
3. It is wired into BOTH settlement paths: the verify controller path
   (`server/controllers/payment.controller.js`, after success handling) and
   the Paystack webhook (`server/services/paystackWebhook.js`), so
   verify-only and webhook-only settlements both credit.

Double-spend guard on the order side: `marketplacePaymentTrust.evidence`
refuses any `ad_wallet` receipt from funding an order
(`ConflictError: 'Ad wallet top-ups cannot fund orders'`). Ad-wallet money is
not order money.

## Click billing and dedupe

`server/services/adClick.service.js` `recordClick(campaignId, visitorKey, ip)`:

1. Unknown campaign → refuse `not_found`.
2. Sweep: `endsAt` past → persist `expired`, refuse; stored status ≠ active →
   refuse with that status.
3. Daily rollover: `spentDay` ≠ today → reset `spentToday` 0.
4. `dailyBudget - spentToday < tariff` → persist `budget_exhausted`, refuse.
5. Dedupe: `server/models/AdClickDedupe.js` with unique index
   `{ campaign, visitorKey, day }`; E11000 → refuse `duplicate` (not billed).
6. Wallet debit refused → persist `paused` (wallet-empty pauses; the
   `budget_exhausted` status is reserved for the daily cap), refuse
   `insufficient_balance`.
7. Success: `$inc` `clicksTotal`, `spentToday`, `spentTotal`; redirect to
   `/product/<slug>`. Impressions (`recordImpression`) are fire-and-forget
   counters that never throw into the request path.

The visitor key is a stable localStorage uuid (`dh_ad_visitor`) — a dedupe
key, not identity. The beacon endpoints are anonymous BY DESIGN and are
allowlisted in `server/__tests__/routeGuardCoverage.test.js` `PUBLIC_ALLOWLIST`
(write-only counters, same class as banner impression/click).

## Campaign lifecycle

`server/models/AdCampaign.js` statuses: `draft` (start) → `active` →
`paused` / `budget_exhausted` / `expired` / `suspended`. Activation requires a
wallet balance ≥ tariff ("Load your ad wallet to activate") and a daily budget
≥ tariff; a daily-budget-exhausted campaign cannot reactivate until its budget
is raised. Delete is only allowed for draft/paused/expired — an active
campaign must pause first. Surfaces are `pdp` and/or `cart`; sweeps run
on-read and on-click (`server/services/adCampaign.service.js`).

## Storefront surfacing & disclosure

The merchandising engine (`server/services/merchandising.service.js`) merges at
most ONE sponsored card per response, tagged `source: 'sponsored'` +
`adCampaignId`. Order on a tenant storefront: manual pairing first, sponsored
second, then organic tiers; on the marketplace, sponsored leads. A paid card
surfaces exactly once (removed from the other arrays when served). Disclosure
is MANDATORY: `SponsoredBadge.tsx` renders wherever `source === 'sponsored'`
renders — pdp campaigns surface in the disclosed sponsored list ABOVE the
Step-Up rail (the rail itself stays 100% organic), cart campaigns in the cart
cross-sell strip. Card click/quick-add first fires
`POST /api/ads/clicks/:adCampaignId` via `fireSponsoredClick`
(`useMerchandising.ts`), then proceeds.

## Explicitly NOT built (phase 2 scope boundary)

- CPM billing or any display/banner ad inventory — CPC clicks only.
- Invalid-traffic/fraud controls beyond per-campaign+visitor+day dedupe.
- Campaign reporting dashboards (counters are exposed; no analytics).
- Wallet withdrawals/refunds, credit lines, invoiced billing, bidding/auction.
- Rate tiers, targeting, frequency capping, or A/B rotation of creatives.

Any of these requires a new user-approved agreement — do not extend the money
path silently.

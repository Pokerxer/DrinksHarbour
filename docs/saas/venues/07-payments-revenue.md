---
title: Venue payments and commercial rules
date: 2026-10-17
status: proposed
---

# Payments, minimum spend and revenue

[Back to the main design](README.md). Payment-provider facts are cited. Proposed commercial choices are [Likely]; example amounts and unapproved channel charges are [Guessing]. This is software design, not a tax or legal determination.

## 1. Keep five concepts separate

| Concept | Meaning | Financial treatment in the product |
|---|---|---|
| Deposit | Money collected in advance for a future visit | Unapplied guest credit/advance until allocated or otherwise resolved |
| Minimum spend | An agreed eligible-spend commitment | Compare eligible consumption with the commitment; not another bottle or duplicate deposit |
| Table/room hire | A distinct charge for use of space | Explicit disclosed service line if the contract includes it |
| Admission | Right to enter a particular occurrence | Separate entitlement and charge; no drink stock unless inclusions are explicit |
| Tip/service charge | Tip is a voluntary gratuity; service charge is a configured fee | Separate lines and accounting policies; do not merge either into beverage price invisibly |

A mandatory charge must never be presented as an optional tip. Tax and service-charge treatment depends on the actual jurisdiction and business arrangement; use reviewed configuration and the existing tax engine rather than hard-coded legal assumptions.

## 2. Authoritative money rules

Use integer minor units for new venue payment/allocation calculations: NGN kobo. Existing models often store Naira Numbers; adapt explicitly at boundaries and avoid silently reinterpreting old records as kobo. Every amount includes currency and a named unit. Never mix different currencies in one bill or reuse an FX display estimate as the collectible amount.

Freeze quote/line prices, discounts, recipe version, policy version, revenue agreement and fee allocation. Existing marketplace clean-hundred price rules do not justify rounding deposits, split balances or partial refunds to the nearest ₦100.

Only verified receipts can settle obligations. Validate provider transaction success, expected reference, amount, currency and stored transaction purpose. A successful API response is distinct from a successful charge. [Paystack verification](https://paystack.com/docs/payments/verify-payments/)

Verify webhook signatures against the preserved payload, durably record receipt, and apply each business effect once. Account for retries and reconcile missed notifications using server verification. [Paystack webhooks](https://paystack.com/docs/payments/webhooks/)

## 3. Deposit workflow

1. Snapshot deposit amount, payment deadline, cancellation/no-show terms, eligible credit scope and refund rules with the booking.
2. Acquire a capacity hold or obtain staff acceptance with a payment hold; create one stored payment attempt for that quote and payer.
3. Initialise Paystack server-side. Browser redirect is navigation, not payment evidence.
4. On verified success, record the receipt and deposit credit exactly once. Confirm the booking only if its capacity/policy condition still holds.
5. If payment arrives after capacity expires, attempt a fresh valid allocation. Otherwise mark `paid_requires_resolution`, notify the operator/customer and initiate the documented refund/rebooking path. Never oversell to hide the conflict.
6. At bill finalisation, allocate verified available credit once and reduce outstanding balance. An unallocated receipt remains visible until refunded, transferred with permission or applied.
7. On cancellation/no-show, apply the snapshotted policy through an auditable refund/forfeiture decision. Do not auto-debit a saved card merely because a booking became a no-show.

For request-only bookings, the recommended initial rule is no deposit before venue acceptance. If a venue declines, the customer should not need to recover a speculative charge.

Do not call collected funds “escrow” or promise delayed settlement unless the actual provider/account arrangement supports and permits it. Automatic later charges and preauthorisation require a separate verified payment-channel and consent design.

## 4. Minimum-spend calculation

Define which lines count: e.g. food/beverage after eligible discounts, excluding tax, tips, admission and room hire unless terms explicitly say otherwise. Freeze that eligibility policy on confirmation.

```text
shortfall = max(0, agreed minimum - eligible net spend)
bill total = item charges + disclosed shortfall + fees + tax + tip
balance due = bill total - valid deposit allocations - other valid payments
```

The minimum is satisfied by eligible spend, not by collecting the deposit. Any shortfall charge requires disclosed, reviewed terms and its own tax/revenue classification.

Example, excluding tax/other fees: agreed minimum ₦200,000; deposit ₦50,000; eligible consumption ₦230,000. There is no shortfall and remaining due is ₦180,000.

If eligible consumption is ₦160,000 under the same terms, shortfall is ₦40,000 and remaining due is ₦150,000. The customer does not owe ₦160,000 + ₦200,000 − ₦50,000.

If consumption is ₦40,000, there is no minimum, and deposit is ₦50,000, show ₦10,000 excess credit for the policy's refund/credit resolution. Do not silently convert it to a tip or negative cash collection.

Allocate credit only up to the remaining bill balance. In that last example, ₦40,000 is allocated and ₦10,000 remains unapplied; the bill's amount due is zero. An excess credit is never a negative payment request.

## 5. Payments and splitting

One service session has one final payable Order and an allocation ledger. Support exact amounts, seats/items, equal-value split and mixed tender as distinct operations. Equal-value splitting distributes remainders deterministically: ₦10,000 among three payers is ₦3,333.34 + ₦3,333.33 + ₦3,333.33.

Keep invoice ownership distinct from payer identity. Friends may pay part of the same bill without gaining access to the organiser's booking, phone or refund authority.

Under concurrent collection, atomically allocate a bounded outstanding amount before opening a payment attempt. Expired/failed attempts release collection reservations; verified late overpayments create an explicit excess-credit/refund case. Do not drop a real receipt because another payer settled first.

Cash, verified bank transfer and gateway receipts have different evidence. A transfer screenshot alone is not verified settlement. Restrict manual confirmations to authorised staff with evidence and audit. Cash change is not another sales discount.

Do not close a bill with unexplained balance. Approved house accounts/credit need explicit existing receivable authority, customer consent and manager permission. A table cannot be made “paid” by silently writing off debt.

## 6. Commission by channel

**[Certain] Current repository state:** the Venue plan has a 9% commission rate; the booking-checkout service also hard-codes 9%. Marketplace agreements now have additional rules in `docs/memory/revenue-agreement-pricing.md`.

**[Likely] Recommendation:** preserve Tenant as commercial authority, with explicitly versioned channel agreement overrides where needed. Resolve rules centrally; menu items and client payloads cannot set platform commission.

| Channel | Recommended policy / decision status |
|---|---|
| Marketplace beverage delivery | Existing agreed Tenant markup/commission rules remain authoritative |
| Platform-origin venue table-service order | Existing business-plan starting point is 9%; use approved channel agreement, not a hard-coded calculation |
| Direct tenant-site reservation/service | Requires explicit agreement; do not assume identical acquisition commission |
| Walk-in/offline venue POS | Recommend no additional acquisition commission by default; business approval needed before changing existing behaviour |
| Admission, room hire and minimum-spend shortfall | No fee policy established here; configure only after commercial approval |
| Deposits | No second merchandise commission merely for collecting an advance |

Retain acquisition source and later payment channel independently. A platform-sourced booking remains platform-sourced when its balance is paid by cash; opening a POS screen must not erase its agreed source. Attribution windows, no-shows, waivers and enforcement are commercial decisions, not inferred rules.

For commission agreements, start from eligible net merchandise under the agreed percentage; do not add hidden platform markup. For markup agreements, preserve the agreed fixed Tenant payout and discount-funding constraints. Reuse the existing agreement helper where compatible; do not force wholesale cost-plus maths onto arbitrary food/service fees.

Taxes, tips, delivery and processing costs are outside the existing gross merchandise split. A service fee or shortfall requires a separately approved basis. Example: ₦100,000 eligible merchandise at 9% is ₦9,000 platform share and ₦91,000 Tenant share before separately accounted costs; collecting it as a deposit then a balance must not produce ₦18,000 commission.

Paystack split settlement is a provider distribution mechanism, not proof that internal revenue/deposit allocation is correct. Document recipient, fee bearer, refund funding and platform-versus-Tenant ledger ownership before using it. [Paystack transaction splits](https://support.paystack.com/en/articles/2132802)

## 7. Refunds, cancellations and accounting

Refund requests progress through provider states and have their own idempotency/reconciliation keys. Marking a booking cancelled does not prove the money was returned. Full and partial refunds are supported by Paystack as provider operations. [Paystack refunds](https://paystack.com/docs/payments/refunds/)

Allocate partial refunds to original items/fees and original payment sources, up to remaining refundable amounts. Reverse frozen revenue/commission shares proportionally using exact minor-unit allocation. Amount-only refunds without a line/fee basis go to settlement review; never guess the commission reversal.

An overpaid deposit refund reverses unapplied credit. An earned sale refund reverses the corresponding recognised sale/fees. An approved forfeiture is a separately classified event, not beverage revenue. Define account mappings with the existing accounting module before rollout; the platform and Tenant books are not interchangeable.

Keep stock decisions separate: consumed cocktails remain consumed; unused sealed bottles may follow the return workflow. A chargeback also needs a tracked dispute and revenue/payout review rather than automatic stock restoration.

Reports must reconcile receipts, allocations, refunds, unapplied credits, sales and settlement liabilities without counting a deposit and its redemption as two receipts or two sales. Use append-only reversal records and freeze historical commercial terms.

## 8. Subscription lapse and recovery

The existing entitlement middleware blocks writes in certain dunning states. Proposed settlement/refund continuity therefore needs an explicit safe-action policy, not merely “keep the page readable.”

Stop new paid-feature commitments according to subscription policy while allowing tightly scoped fulfilment, settlement, cancellation/refund and export of existing obligations. Authorise those actions separately; do not bypass all subscription checks. Keep suspended/publicly delisted venues out of new customer bookings while showing existing customers their obligations and support path.

## 9. Reference-feature financial adapters

[R11–R16](10-restaurant-integration.md) cover payer allocation, invoice/receipt, tip and self-order behaviour; [N07–N10/N16](11-nightlife-integration.md) cover guest spend, experience payments and historical imports. All use the same receipt/allocation and revenue rules in this chapter.

Do not implement source-style split views as duplicate ordinary sales, reuse wallet balances as booking deposits, count historical imports as gateway receipts, or adopt foreign terminal post-authorisation behaviour as Paystack support. Pay-per-order visit batches must retain their payment allocations at final settlement; printed pro-formas and kiosk checkout success screens do not prove a charge was verified.

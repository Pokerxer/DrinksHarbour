# Marketplace revenue agreement correction

2026-10-17. User approved correcting pricing to distinguish commission from
markup, after confirming the goal is a compelling customer offer rather than
optimizing platform margin in isolation.

## Authoritative rules

- Commission: final merchandise after catalogue/listing sales and allocated basket
  coupons is split at the Tenant's agreed percentage. No extra platform markup,
  automatic undercut or wholesale substitution. Tenant retail is the default
  customer basis. Missing/invalid commission blocks pricing; zero percent is valid.
- Markup: existing supplier/wholesale cost-plus agreed tenant markup remains the
  payout. Product/admin marketplace markup remains applicable. Customer discounts
  reduce platform contribution, not the fixed tenant payout. Checkout/review
  reject amounts that cannot cover that payout; no hidden negative contribution.
- Commission discounts are shared in the same agreed proportion. Markup discounts
  are platform-funded. Delivery, taxes and processing/operational costs are outside
  this gross merchandise split; no fee deductions from the agreed tenant share.
- Pack commission rates apply only to an explicit cheaper pack offer at its earned
  quantity threshold. A reduced commission alone never implies a customer discount.
  Active catalogue/listing sales suppress pack offers. Markup pack behavior retained.
- Prices retain the existing clean-NGN-hundred rule. Commission split allocates
  kobo commission first and tenant receives the remainder. Basket coupons use
  exact integer allocation and deterministic largest remainders.

## Files and contracts

`server/utils/revenueAgreement.js` is the settlement/snapshot authority;
`commissionPricing.js` owns commission retail/override pricing. `pricing.js`
selects the agreement and refreshes commission payout after listing sales.
Catalogue (including search), cart, checkout and sales pricing now pass the model.

Additive schema: SubProduct/Size.commissionPriceOverride is a pre-catalogue-sale
absolute marketplace price; Size.packCommissionPriceOverride is a per-unit pack
price. Review approval validates owned records and writes these fields without
changing tenant retail, supplier cost or contractual percentages. Existing markup
percentage overrides are retained only for markup calculations. No new endpoint.
Relevant projections include the additive fields. Main order checkout handles
sizeless listings, rejects foreign sizes/client price fallbacks and derives its
total from server merchandise, coupon and shipping figures.

New Order item snapshots: revenuePolicyVersion=merchandise-v2, revenueBasisAmount,
discountFunding, plus existing model/rate/tenantRevenueShare/platformCommission/
vendorPriceAtPurchase. Share fields are LINE amounts; vendor price is per unit.
Shipping/tax never increase the commission basis. Email breakdowns/zero-commission
analytics honor v2 snapshots without another coupon deduction. Accounting already
uses frozen shares; no current agreement lookup is introduced.

Full admin-marked refunds store the original per-tenant reversal shares in
refundDetails.settlement. Amount-only partial refunds explicitly need settlement
review because that request does not identify refunded items. Automatic partial
stock restoration is disabled. Snapshot helpers support cumulative item-quantity
refund allocation with exact reconciliation. Existing accounting still requires
review of marketplace refund reversal evidence; this change does not execute
Paystack refunds or automate partial-refund accounting.

Admin review previews commission payout dynamically. Agreed commission is locked;
only the tenant margin target is adjustable for commission. Suggestions solve for
supplier cost / ((1 - tenant target) * (1 - commission)); listing sales are inverted
for the editable pre-sale price. Higher prices are flagged against tenant retail.
Markup suggestions preserve the fixed payout. Target controls never update terms.
All profits remain gross estimates, not market valuations or net profit claims.

## Rollout and limits

No production DB writes, backfills or deployment performed. New fields are
additive; old orders and their historical shares are not repriced. Old commission
platformMarkupOverridePct/packPlatformMarkupOverridePct are intentionally ignored,
not converted into a new contract. Review affected commission listings/prices and
missing rates before rollout; clear/bump search response caches at deployment so
old commission prices do not survive their cache TTL. Models alone do not migrate
old orders. Current payment verification architecture is unchanged; no claim of a
new gateway verification or money-transfer implementation is made.

## Verification

Final backend: 3,970 passed, 16 skipped, zero failures. Full admin: 3,112 passed
across 391 files, zero failures. Review-focused: 33 passed, including fixed-rate
commission UI, dynamic payout and zero-sale-price approval protection. Latest
pricing/controller/ownership tests: 34 passed. Scoped lint, syntax and whitespace
checks pass. Project type check retains 359 existing errors, none in review files.
No authenticated browser visual check; prior browser session required sign-in.
Logs: `docs/superpowers/specs/RESUME-revenue-agreement-pricing.md`.

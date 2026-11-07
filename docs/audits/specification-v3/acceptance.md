---
title: Acceptance coverage and verification limits
date: 2026-10-22
status: evidence-record
---

# Acceptance coverage and verification limits

## V3 end-to-end requirements

The first15 rows summarize specification section14; the final two expand its ERM independence and settlement promises into explicit transition tests. **[Certain]** Existing unit tests and source do not establish these complete integrated promises. Status reflects inspected code, not production certification.

| # | Required journey | Current evidence / missing proof | Work packages |
|---|---|---|---|
| 1 | Nigeria default active market | Nigeria defaults/NGN exist; configurable activation and API market guard absent. | 05/18 |
| 2 | Unauthorized NG beverage seller blocked | Publication/status controls exist; country/category/effective Wyn exclusivity not found. | 04/06 |
| 3 | POS, Wyn website and marketplace share store stock | Location POS/venue and separate aggregate website counters exist; common authority absent. | 08/09/12 |
| 4 | Wyn website pays own merchant account | Integration gateway uses global Paystack key. | 10/11/12 |
| 5 | Marketplace fees apply only under marketplace rules | Tenant revenue snapshots exist; named channel policy/fee exception absent. | 08/10 |
| 6 | Gift and food fulfillment stay distinct | Gift types/cards, venue and local delivery are reusable; independent gift/food workflows incomplete. | 13–16 |
| 7 | Future reservations cannot exceed capacity | Request-only and atomic arrival exist; future capacity scheduling deferred. | 17 |
| 8 | UK postcode returns eligible retailers | General catalogue/routing exists; UK eligibility contract absent. | 21 |
| 9 | Best delivered-cost Smart Cart with override | Offer comparison exists; bounded basket optimizer/quotes absent. | 22 |
| 10 | UK child orders and shipments | Parent order with tenant lines exists; child/UK provider shipment contract absent. | 13/23 |
| 11 | ERM without marketplace membership | Billing/entitlements exist; distinct enrollment/lifecycle contract missing. | 07 |
| 12 | Merchant tenant isolation | Existing tests/guards; parent detail still exposes other merchant lines. | 02/13 |
| 13 | Repeated webhooks cannot duplicate orders | Integration/venue idempotency and tests exist; marketplace create/payment trust must be hardened and unified. | 01/10 |
| 14 | Parallel final-unit purchases cannot oversell | Conditional location/aggregate checks exist separately; cross-channel/location proof missing. | 09 |
| 15 | Add country without duplicating application | Reusable apps exist; country configuration and localization foundation absent. | 05/19/24 |
| 16 | ERM independent use retains entitled operations | Covered explicitly as a negative transition test: marketplace rejection/suspension cannot implicitly terminate paid ERM/direct access. | 07 |
| 17 | Partial multi-merchant settlement stays reconcilable | Adds explicit coverage for section14 multi-vendor checkout's settlement implications; account/child/refund allocations not certified. | 10/13/23 |

Rows16–17 are derived acceptance expansions, not additional quoted section14 bullets. Section14 has15 source bullets; these expansions make two hidden transitions testable.

## Additional regression contracts [Likely]

- Guest cannot submit `paid`, `confirmed`, a provider account ID, fee-exempt channel or another tenant's stock location as authority.
- A receipt is accepted once, only for matching provider account/order/reference/currency/minor-unit amount; late success after expired stock goes to a recoverable review state.
- Each tenant sees only its child order lines; notifications, exports, invoices, caches and admin searches follow the same projection.
- Hold creation changes reserved stock; physical issue changes on-hand once; cancellation/expiry releases exact remaining ownership and preserves other channels' holds.
- Goods receipt updates physical stock; merely creating/confirming a purchase order does not.
- Domain mapping requires reviewed ownership; stale/unknown/reassigned/spoofed hosts cannot choose another tenant or payment account.
- A country switch does not relabel or silently convert an existing cart's prices; server requotes or explains ineligibility.
- Country suspension blocks new orders but retains authorized access to paid orders/refunds/previous reservations.
- Future seating tests cover concurrent request/confirm/amend/cancel, duration overlaps, table combinations and timezone/DST boundaries.
- Smart Cart tests cover multiple shipments, quote expiry, failed courier calls, split stock, merchant minimums and a cheaper non-nearest retailer.
- Backup restore, webhook replay, worker restart and stock/ledger reconciliation have named dated operational evidence.

## Fresh verification performed [Certain]

Read all extracted document text, including39 application pages, architecture/API sections, end-to-end requirements and open cautions. Rendered source DOCX to15 physical pages; inspected all pages in contact sheets to confirm outline/table/page context. This is a requirements review, not a typography certification or edited DOCX deliverable.

Backend runtime: Node `v22.23.1`. Used repository test entry rather than relying on historical handoff results.

1. Standard full command from `server`: `node --test '__tests__/*.test.js'`. Exit1: **4,180 tests;3,984 passed;159 failed;37 skipped**. HTTP fixtures could not bind local ports in the sandbox (`listen EPERM`, null server address). Do not report these159 as159 confirmed application bugs.
2. Repeated with approved local network access: `node --test --test-concurrency=2 --test-timeout=60000 '__tests__/*.test.js'`. Result: **4,085 tests;4,041 passed;0 assertion failures;8 cancelled;36 skipped**. Eight files hit timeout; this is not a passing full baseline. Timeouts: `adminTierBoundary`, `appraisal.helpers`, `appraisalCycle.launch`, `appraisalCycleListCounts`, `billingNotices`, `billingReconciliation`, `journalEntry.service`, `mfaVerifiedToken`. Do not label these timeouts fixed or proven logic failures without isolated reruns.
3. Focused run covers storefront checkout/cart/pricing/settlement/webhook/catalogue/shipping, order scoping, plans, tenant isolation, bookings, effective permissions, purchasing receipt helpers and warehouse stock helpers. Initial sandbox run:137 passed/4 failed from booking HTTP fixtures unable to bind. Approved-network rerun: **141 passed;0 failed/cancelled/skipped**, exit0. This is targeted regression evidence, not proof of the missing v3 journeys.
4. Markdown check: **39/39 page rows and24/24 work packages**, all relative links resolve, no trailing whitespace. `git diff --check` for report/handoff files exits0. Checked all seven new Markdown files, including ignored resume output.

Session diagnostic logs are in `/private/tmp/drinksharbour-v3-audit-tests.log`, `/private/tmp/drinksharbour-v3-audit-tests-network.log`, `/private/tmp/drinksharbour-v3-focused-tests.log` and `/private/tmp/drinksharbour-v3-focused-tests-network.log`. These are temporary execution logs, not durable substitutes for this evidence record. Counts differ because file timeouts prevent all nested tests from registering.

No application source changed. No new application tests were written to mirror documentation. No production DB, credentials, DNS, deployment or provider account was inspected/modified; no real charge, email or merchant activation occurred. Live cross-channel concurrency and opt-in real-Mongo tests were not run. Frontend builds/browser tests were not rerun in this documentation audit. Historical venue/production handoffs are context only.

CodeRabbit CLI was unavailable; manual source tracing was used. No automated CodeRabbit review result is claimed. Scope was requirements comparison, not a diff-only review or exhaustive penetration test.

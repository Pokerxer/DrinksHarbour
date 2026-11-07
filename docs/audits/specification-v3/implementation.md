---
title: Prioritized implementation backlog for specification v3
date: 2026-10-22
status: proposed-not-authorized-for-execution
---

# Prioritized implementation backlog for specification v3

**Local Phase A continuation (2026-10-23):** V3-01/02 implementations and V3-03 fresh checks are recorded in the [Phase A handoff](../../superpowers/specs/RESUME-phase-a-transaction-safety.md) and [verification evidence](phase-a-verification.md). Final local backend:4248 passed/0 failed/0 cancelled/18 named skips; Phase A17/17 and direct website13/13; both application types/builds passed. V3-01/02 are locally implemented and V3-03 locally verified with the linked limitations. The rows below remain acceptance requirements, not production activation approval. Operational preparation, hosted certification and allocated multi-merchant fulfillment/refunds remain gated.


Current delivery sequence/status is in [the full platform strategy](strategy.md). This backlog originated before the API implementation; its package IDs remain stable. Wyn City's website is already a separate project: implement and validate its API connection, not another website application here.

**[Likely]** This is the recommended dependency order. P0 means trust/data/financial correctness before expanded trading; P1 means Nigeria foundation or launch capability; P2 means international activation after Nigeria correctness. Work package IDs are durable references, not ticket IDs or approved commitments. Each package must include scoped API tests, failure/replay tests and the indicated user journey.

## Gate 0 Correct existing transaction boundaries

| ID | Work and code anchors | Depends on | Acceptance evidence |
|---|---|---|---|
| V3-01 P0 | Harden `order.routes.js`, `order.controller.js`, `payment.controller.js`, `payment.service.js`: ignore/reject customer settlement/lifecycle claims; bind verified payment to order, owner, account, reference, currency and exact amount. Add owned/admin-only refund authority. | None | Guest/customer cannot self-mark paid, attach another order's payment, reuse a receipt or refund another order. Legitimate cash/COD/admin paths use explicit privileged commands. |
| V3-02 P0 | Fix tenant projections in order list/detail and related exports/status/payment operations. Reuse `items.tenant` participation only to locate authorized lines, not expose parent internals. | None | Two-tenant order: each merchant receives its own lines and permitted customer/fulfillment data; customer gets its own overview. Cross-tenant mutation/read tests cover list, detail and export. |
| V3-03 P0 | Establish clean runtime baseline and record unresolved test cancellations, opt-in Mongo gaps and hosted operational gates. Preserve unrelated work. | None | Relevant backend suites clean; focused transaction tests use disposable replica DB; no hidden skips presented as proof. Hosted CI, backup restore and provider testing tracked separately. |

## Gate 1 Agree policy and implement the global foundation

| ID | Work and proposed file locations | Depends on | Acceptance evidence |
|---|---|---|---|
| V3-04 P1 | Record decisions in `docs/saas/`: one platform vs app merge, NG exclusivity and exceptions, providers/account owners, direct pricing/fees, customer data rights, trial/pricing policy. | Review owner | Named decisions and effective dates; no production suspension or pricing change inferred from a document attachment. |
| V3-05 P1 | Add `server/models/CountryConfiguration.js`, `server/services/country/`, `server/routes/country.routes.js`, admin countries UI and shared market types/config. Include version, ISO code, locale, transactional currency, timezone policy and capability flags. | V3-04 | Inactive/unknown market denied on server; activation requires reviewed prerequisites; Nigeria default; other markets configurable but disabled. |
| V3-06 P1 | Add market/category enrollment and policy evaluation under `server/services/marketPolicy/`; connect tenant onboarding, SubProduct creation/publication, catalogue filters and checkout. | V3-05 | NG beverage policy permits configured Wyn City Tenant only in effective period; gift/food merchants and UK beverage sellers evaluated independently; policy changes audited. |
| V3-07 P1 | Split ERM subscription status, marketplace enrollment and storefront enrollment; update Tenant projection, register/apply UI and effective capability checks. | V3-04–06 | An ERM-only tenant can subscribe/use entitled tools without marketplace approval. Marketplace rejection does not disable permitted independent operations. |
| V3-08 P1 | Add `SalesChannel`/Storefront configuration and immutable order/payment snapshots; explicit legal/provider account owner. Extend existing Order/source reports, integration key scope and channel pricing policies. | V3-04/05/07 | Server distinguishes POS, WYN_WEBSITE, DRINKSHARBOUR_NG; direct transaction never receives unagreed marketplace fees; settled terms never change with current tenant config. |

## Gate 2 Prove Wyn City across three channels

| ID | Work and code anchors | Depends on | Acceptance evidence |
|---|---|---|---|
| V3-09 P0 | Unify online reservation allocation with tenant/location/variant balances. Extend existing `salesReservations`, `WarehouseStock`, venue inventory patterns and movement history; replace aggregate-only website/marketplace writes through a reviewed cutover. | V3-01/03/08 | Parallel POS+website+marketplace attempts at final unit: at most one succeeds; on-hand/reserved/available reconcile. Retry/expiry/cancel/late payment cannot double consume/release. |
| V3-10 P0 | Resolve payment configuration by country/channel/legal owner. Refactor `storefrontGateway`, marketplace adapters and verified webhook ingress; preserve proven checkout attempt/receipt/reconciliation patterns. | V3-01/08 | Wyn website initializes/verifies against own account; marketplace uses configured marketplace account; reference replay across accounts rejected. Signed callback and uncertain-state recovery tested. |
| V3-11 P1 | Connect the already separate Wyn website through the documented server-side API/key/customer contract and approved return origins. Hosted custom-domain management is conditional on later choosing to host merchant storefronts here. | V3-07/08/10 | Tenant/account cannot be chosen by client input; website accounts/order history work without browser exposure of integration secrets. If hosted domains are added, verify ownership/HTTPS/removal/reassignment and unknown-host denial. |
| V3-12 P1 | Validate the separate Wyn website frontend against the implemented backend API and reviewed marketplace/store publication. Do not build another Wyn website in this repository. | V3-06/09–11 | External browse→cart→checkout→payment→receipt→stock→account journey across three channels, with matching stock and separate money; reviewed cancel/refund handling. External source/provider environment must be inspected before claiming completion. |

**[Likely] First implementation milestone:** V3-01/02 plus the minimum V3-04–10 needed for one reviewed Wyn store/channel pair. Prove one real vertical slice before generalizing every dashboard or opening additional seller categories.

## Gate 3 Nigeria marketplace categories and fulfillment

| ID | Work and code anchors | Depends on | Acceptance evidence |
|---|---|---|---|
| V3-13 P1 | Extend Order with merchant child-order responsibilities, location allocations and private projections; add shipment/payment/refund allocation identities where absent. Keep current historical snapshots. | V3-02/08–10 | Mixed merchant order gives independent acceptance, partial fulfillment/refund and tenant views, with one reconciled parent total and no cross-merchant leakage. |
| V3-14 P1 | Extend `storefrontShipping`, Delivery and shipping methods with provider adapters and durable quote/booking/tracking records under `server/services/deliveryProviders/`. | V3-05/13 | Quote capability/coverage/expiry validated; parcel, local dispatch, food and collection distinct; failed booking retries do not create duplicate charges/shipments. |
| V3-15 P1 | Build independent gift merchant workflows and `/ng/gifts` from existing gift product types and catalogue. Add recipient/message/wrapping/privacy and fulfillable component stock for bundles where required. | V3-06/07/13/14 | Independent gift seller can fulfill/track/refund own orders; wrapping fees and bundle stock validated; alcohol in hampers retains restrictions. |
| V3-16 P1 | Extend venue design for restaurant discovery and prepared food sales: menu kinds/modifiers/availability, kitchen acceptance/preparation, collection/food dispatch, hours/zones and cancellation policy. | V3-06/07/09/13/14 | Modifier-priced order arrives at correct location/station; stock strategy is explicit; food lifecycle and stage-aware refund remain separate from parcel and venue bill. |
| V3-17 P1 | Implement venue Phase2 future capacity scheduling, slot/overlap rules, atomic allocation, amendments/cancellations, no-shows and optional deposits. Reuse Booking and location/table/visit identities. | V3-09/10 plus approved capacity policy | Concurrent future requests cannot exceed seats/resources; amend/cancel frees exactly owned capacity; deposit/refund reconciliation and timezone boundaries tested. Request-only mode retains honest messaging. |
| V3-18 P1 | Integrate Nigeria route/context, destination-aware cart, customer merchant groups, orders, restaurants/gifts and market controls using shared platform screens. Preserve legacy URLs and SEO. | V3-05/06/12–17 | All NG routes share server policy; market switching revalidates cart; mixed-fulfillment contract explicit; mobile, keyboard and account flows tested. |

## Gate 4 International ERM and UK activation

| ID | Work and code anchors | Depends on | Acceptance evidence |
|---|---|---|---|
| V3-19 P2 | Internationalize addresses, tax/money/timezone, translation resources and plan configuration. Extend existing Tax, ExchangeRate, plans/billing/accounting; add original currency and FX provenance to reporting. | V3-05/07/08/13 | Country-specific address rules, correct rounding/minor units, transaction-currency preservation, no raw cross-currency sums; plan updates preserve existing contracts. |
| V3-20 P2 | Build platform payment/delivery/merchant/country/subscription administration and reconciled global dashboard around reviewed domain services. | V3-05/06/10/13/14/19 | Authorized edits with audit and readiness gates; country/channel totals reconcile to source transactions and explicit conversion snapshots. |
| V3-21 P2 | Implement UK postcode eligibility, retailer offers/location stock, coverage/restriction checks and real delivery quotes. | V3-06/09/14/19 | Ineligible retailer cannot be selected by UI or direct API; quote depends on basket/address/merchant and expires. |
| V3-22 P2 | Implement bounded Smart Cart under `server/services/smartCart/`, optimizer API and UK cart UI. | V3-13/21 | Tests compare merchandise+quoted shipping+mandatory charges; stock/minimum-order/restrictions enforced; deterministic bounded fallback, expiry/requote and manual eligible overrides. Never label a heuristic globally optimal without proof. |
| V3-23 P2 | Integrate approved UK marketplace payment/account onboarding, commission/refunds/settlements and courier shipments. Stripe Connect/PayPal/couriers remain candidates pending approval. | V3-10/13/14/19/21 and external approvals | GBP multi-merchant charge allocation, partial refund/settlement and provider reconciliation; per-shipment tracking/labels/age capabilities tested. |
| V3-24 P2 | Country legal version publishing/consent, durable job retries/dead-letter/operator replay, monitoring and restore/cutover exercises; then reviewed market activation. | Starts in V3-05, gates every release | Operator can recover uncertain payments/stock/jobs; named legal/provider readiness and successful restore evidence; future country configured without app duplication. |

## API integration plan [Likely]

Keep existing `/api/products`, `/api/subproducts`, inventory/POS/ERM/venue routes and `/api/integrations/v1` contracts where they fit. Do not duplicate them under a second API just to match illustrative v3 URLs.

| Responsibility | Add or extend contract |
|---|---|
| Countries | Public active-country/config DTO; privileged versioned configuration/review/activation commands. Inactive market response must not expose secrets. |
| Enrollment/policy | Tenant market/category application, review, effective permission; authorized listing publication with same policy evaluator as checkout. |
| Cart/checkout | Server quote and validate including market/channel/location/fulfillment, quote version/expiry, exact totals and idempotent checkout create. Market/account resolved from trusted context. |
| Reservation | Owned stock hold, consume/release/reconcile; separate future seating availability/request/confirm commands. Do not conflate inventory and seats. |
| Payments | Initialize, verify, signed webhook, refund and reconciliation bound to immutable account/order snapshots. Privileged manual tender commands separate. |
| Delivery | Capability/coverage quote, booking, label, cancel and deduplicated tracking event ingress; merchant-private shipment status. |
| Storefronts | Verified-domain config/public DTO, publication/stock locations, server-scoped customer auth and channel/account management. |
| Smart Cart | Versioned optimize request/result with eligible assignments, quote references, expiry and manual override validation. |

Frontend state: extend market/destination context and cart versioning; keep cart's transaction currency/channel and invalidate dependent quotes on changes. Separate sensitive admin configuration from public market DTO. Existing tenant auth, customer auth and POS identities must not collapse into one browser flag.

## Decisions to record before dependent implementation

1. Is “one app” a shared global product or a literal merge of admin/platform? Recommendation: preserve existing apps and API.
2. Which stable Wyn Tenant ID, domains, physical stock locations and effective exclusivity agreement apply? How do existing Nigerian beverage tenants transition?
3. Which country/channel/legal entity owns each provider account, customer charge, refund, fee and settlement? What is approved for NG marketplace checkout given current Korapay code and Paystack repository policy?
4. Does a direct website use cost/retail/marketplace prices, and which existing fees must disappear? Do not assume `platformCommission=0` also produces the correct selling price.
5. Can one customer checkout mix food, gifts and reservations? Recommendation: permit explicit fulfillment groups only after allocation/refund contracts exist; keep seating outside shipped-merchandise checkout.
6. What capacity resources/time slots/durations, deposits/no-show terms, food categories and preparation-stage cancellation rules are commercially approved?
7. What country billing prices/trials, taxes, legal documents, merchant data permissions and provider approvals are approved? V3 deliberately does not fix pricing or dates.

**Handoff:** ready for business/architecture decisions and targeted trust fixes; not an approved structural implementation plan. No new AI integration is required for this scope. Existing semantic search and occasion AI can remain; Smart Cart correctness should come from deterministic constraints and real quotes, not model guesses.

## Current local execution status — 2026-10-28

| Packages | Verified local result | Remaining acceptance |
|---|---|---|
| V3-01–03 | Original trust boundaries preserved; dedicated PhaseA17/direct13 and19opt-inDBfiles/91tests now pass independently. Final current whole-suite evidence is in the Phase D acceptance ledger below. | Hosted certification, production restore/cutover and clean-lock CI remain; local checks are not release approval. |
| V3-04 | Explicit engineering decisions and unresolved commercial facts recorded. | Stable real tenant/account/fee/legal/exclusivity/stock-cutover decisions are not fabricated. |
| V3-05–08 | Country readiness, independent enrollment/policy, actual publication/catalogue/checkout/payment/direct-channel ingress, immutable terms, protected settings/menus, index readiness and accepted retry are implemented locally. | Reviewed production config/index preparation and real commercial/provider readiness. |
| V3-09–12 | Existing direct stock/late-payment/report authority preserved; actual separate Wyn BFF customer-token/cookie identity corrected;7actual BFF/API/DB,75externalunit,8browser checks and full external types/build pass. | Actual physical-stock cutover, original key drain/legacy-cookie reconciliation, hosted provider callbacks and release readiness. |
| V3-13/14 | V1/V2 original-unit/cost/refund authority, private queues, pickup/own-rider delivery, explicit failed-drop reattempt and quarantined receipt; original Paystack/platform merchandise refunds; default-off reviewed Shipbubble parcel protocol with original budget/one submission/uncertainty/callback/cancel/tracking. Actual merchant/customer interfaces and local recovery/restore checks pass. | Shipping/tax/Kora/stored-value/payout allocation and post-quarantine disposition remain unsupported; zero-only cancellation needs policy. Real carrier/account/handling/legal/hosted operational acceptance is not established. |
| V3-18 (partial) | Owning-customer merchant groups, account/tracking quantities, distinct local return and external provider-report labels, original user/channel ownership and read-only snapshot projection. | Wider Nigeria category/cart/gift/food/capacity integration depends on remaining packages. |
| V3-20 (partial) | Platform-only paged local-delivery review/history and explicit carrier account/capability/version confirmation/revocation; safe private reads and finance readiness. | General country/payment/provider/subscription/global administration and real approval/activation remain. |
| V3-24 (partial) | Explicit isolated19-file DB acceptance pilot, actual local recovery browser and synthetic dump/restore/replay exercise. | Production backup/restore, hosted callback/provider certification, legal/commercial approval, stock/index cutover and clean-lock hosted CI remain unproved. |
| V3-15–17/19/21–23 | Not implemented by this continuation. | Depend on remaining commerce/international/legal/provider/capacity packages and their independent exit gates. |

Exact final commands/counts, first failures and fixes, named skips and cleanup: [verification](../../superpowers/specs/global-phases-verification-2026-10-26.md). Current handoff: [resume](../../superpowers/specs/RESUME-global-platform-phases.md). No local result authorizes production activation, provider migration or financial transactions.

Latest delivery/configuration/customer continuation evidence supersedes only those package counts: [Oct27 package verification](../../superpowers/specs/delivery-customer-verification-2026-10-27.md), with linked frontend/browser and focused RED/GREEN ledgers. Earlier snapshots above remain historical evidence. No full Phase D or launch completion claim.

Current recovery/finance/carrier evidence: [Phase D local acceptance](../../superpowers/specs/phase-d-acceptance-2026-10-27.md) and [focused resume](../../superpowers/specs/RESUME-phase-d-recovery-acceptance.md). The final backend run must be read from that ledger, not inferred from the older milestones above. Item2 financial scope and the full PhaseD/production exit remain open as listed; no amount, tax/fee/payout policy or approval was invented.


## Final recovery/finance/carrier acceptance — 2026-10-28

[Certain] Supported local engineering is implemented and verified. Full item 2 financial completion and the full Phase D exit are OPEN; local passes do not supply missing policy or production approval. Fresh required backend: 4540 pass/18 skip/0 fail; all 18 broad skips independently covered by opt-in 19 files/91 pass. Admin3347, platform284/13/9, carrier17, restore1, both frontend types/lint/full builds and extended actual browser passed. All task fixtures stopped, owned outputs/wrappers removed and default bindings restored. No commit, deployment or real transactions.

Shipping/tax refunds and fee journals, Kora/wallet/gift refunds, payout transfers, zero-only cancellation policy and post-quarantine stock/cost disposition remain unsupported pending original financial authority and reviewed policy. Real carrier/account/handling/legal approval, hosted callbacks, production restore/cutover and clean-lock hosted CI remain unverified. E–H remain unimplemented. Final canonical repository ledger: `docs/superpowers/specs/phase-d-acceptance-2026-10-27.md`; current resume: `docs/superpowers/specs/RESUME-phase-d-recovery-acceptance.md`. Earlier running/pending checkpoints are superseded by that final ledger.

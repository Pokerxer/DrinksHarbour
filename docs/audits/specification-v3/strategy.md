---
title: DrinksHarbour full platform strategy
updated: 2026-10-27
status: strategy-and-delivery-roadmap
scope: specification-v3-and-seven-revenue-streams
---

# DrinksHarbour full platform strategy

DrinksHarbour should grow from its existing ERM and beverage commerce foundation into a country-configurable marketplace and business operating platform. The immediate priority is safe payments and tenant isolation, followed by a controlled Nigeria launch, broader merchant categories and international ERM, then UK activation. Building more pages before resolving these foundations would increase operational and financial risk.

This is the main strategy for the whole platform, including work beyond the separate Wyn City website API. **[Certain]** records inspected implementation or documented requirements; **[Likely]** marks recommended engineering/product sequencing; **[Guessing]** marks an assumption requiring evidence. Recommendations are not approved prices, launch dates, commercial contracts or permission to activate production.

## 1 Product direction and boundaries

**[Certain]** The v3 specification describes Nigeria-first commerce, Wyn City as the exclusive Nigerian beverage marketplace seller, other eligible merchant categories, independent storefronts, standalone ERM subscriptions, and later multi-retailer UK commerce. The existing project also defines seven revenue streams. Both are mapped below; conflicts require a recorded decision before behavior changes.

**[Certain] User correction:** Wyn City's website already exists as a separate project and connects through the API. Do not build or merge another Wyn website into this repository. Its server consumes the catalogue, customer, stock, checkout and order services. External website changes require inspecting that separate project; its production integration is not established by local backend tests.

**[Likely] Architecture direction:** Preserve the existing platform Next app, admin Next app, Express API, mobile app and shared packages. “One global application” means shared business services and country configuration. Do not duplicate the application per country or assume a physical app merge is necessary. Reconcile the older proposed super-admin/tenant app split separately; enforce permissions in the API regardless of panel layout.

Retain Tenant for the paying business, Product for the central catalogue, SubProduct for its tenant selling instance, Size for variants, and Warehouse/WarehouseStock for location capabilities and balances. Vendor remains an external supplier. Country of product origin, merchant incorporation, shopping market, shipping destination and display currency are separate concepts.

## 2 Where we are now

| Area | Current position [Certain] | What remains |
|---|---|---|
| Existing ERM | POS, purchasing/receipts, location inventory, sales/returns, accounting, staff, appraisals and subscription entitlements already have substantial implementations. | Preserve and verify workflows; expand independent enrollment, international settings and channel reporting. |
| Separate website API | Opt-in channel binding, location holds shared with POS/mapped marketplace, merchant Paystack account selection, signed callback, customer-owned orders, direct accounting and channel report implemented locally. | Reviewed real tenant/key/location/account/origins, stock cutover, external website hookup and hosted provider certification. Not activated in production. |
| Marketplace safety | Phase A locally implements verified once-only receipts, purpose-bound stored value, authorized payment commands and tenant-private order projections. | Complete operational preparation/provider certification; independent merchant fulfillment and allocated refund settlement remain Phase D. |
| Venue operations | Discovery, reviewed profiles, beverage menus, request-only bookings, arrival/table authority and canonical bill/payment operations exist locally behind rollout gates. | Future capacity confirmation, deposits/splits, prepared food and later events/admissions. |
| Global markets | Country/currency fields and reusable catalogue/UI exist. | Country lifecycle, enrollment/category policy, country-aware money/tax/legal/provider rules and guarded activation. |
| Gifts, food and UK | Gift product types/cards, occasion tools, local delivery, offer comparison and venue foundations are reusable. | Independent gift marketplace, food lifecycle, future capacity, UK postcode eligibility, Smart Cart and marketplace provider/courier integration. |

Latest website API verification: **4,162 backend tests passed, 37 skipped; 13 dedicated real-database/HTTP checks passed**. These are the previous implementation session's recorded results, not a new test run for this strategy edit. They do not establish hosted payments, production cutover or completion of all v3 requirements.

## 3 Seven revenue streams and their role

| Revenue stream | Delivery strategy [Likely] | Dependencies and boundaries |
|---|---|---|
| Marketplace | Nigeria eligible beverages/gifts first, restaurant commerce in a separate release, then UK multi-retailer shopping. Preserve snapshotted commission agreements. | Seller eligibility, payment trust, private merchant orders, fulfillment/refunds and settlement reconciliation. Earlier broad beverage onboarding must be reconciled with v3 Wyn exclusivity. |
| ERM SaaS | Retain and sell the working operational tools; allow ERM without marketplace membership. Expand multi-location, reporting, storefront API and international configuration. | Paid capabilities remain independent of category eligibility. Existing tier prices are a baseline in `erm-plans.js`; v3 does not authorize repricing or reset existing contracts. |
| Advertising | Extend banner/analytics foundations into explicitly sponsored listings and managed campaigns, then self-service campaign budgets and CPC/CPM charging. | Eligible active listings, event deduplication, invalid-traffic controls, budget caps, billing evidence and reporting. Existing promotional banners are not proof of a complete advertising business. |
| Corks & Points | Preserve loyalty/referral foundations; complete tier benefits, earn/redeem/reversal rules and birthday/lapsed automations after settlement is reliable. | Auditable points/credit ownership, consent and replay-safe reversals. Points are not cash; avoid counting stored value as new merchandise revenue. |
| Clubs and lounges | Release reviewed venue operations first, then future capacity/deposits, food/preparation and later events/admissions. | Tenant/location authority, bill/stock/payment recovery and agreed source-based fees. Existing rules describe 9% platform-sourced venue merchandise commission; commercial changes need review. |
| Subscriptions and gifting | Deliver gift marketplace and corporate/occasion gifting first; later Stock My Bar, hampers, party pre-orders, bottle tracking and recommendations. | Recurring authorization, component stock, substitutions, recipient privacy, delivery windows and cancellation/refund contracts. Customer reorder subscriptions differ from ERM subscriptions. |
| Direct distribution | Keep as the documented later physical/B2B phase, not a prerequisite for Nigeria software launch. Reuse procurement, warehouses and fulfillment when operationally approved. | Working capital, premises, supplier terms, ownership and logistics. The earlier cost-plus25% model is a documented proposal, not a new live price decision. |

Do not launch all streams simultaneously. Marketplace correctness and dependable ERM are the foundation; advertising and loyalty cannot compensate for inaccurate stock or settlement.

## 4 Delivery sequence and exit gates

Each phase delivers a complete user journey and observable recovery behavior. Engineering can prepare later phases while commercial decisions are pending, but activation must follow the relevant exit gates. There are no defensible calendar dates or completion percentages from the current audit alone.

| Phase | Deliverable [Likely] | Required exit gate | Backlog |
|---|---|---|---|
| A Transaction safety | Server-owned settlement, reference/account/amount/currency binding, authorized attach/refund commands and tenant-private order projections. | Guest cannot self-mark paid; receipt cannot be reused; customer/merchant cannot access or alter another party's payment/order data. | V3-01–03 |
| B Global foundation | Country configuration, independent service enrollment, merchant/category permissions, channel/legal/payment ownership and reviewed policies. | Inactive market cannot trade; ERM-only customer retains entitled tools; Nigeria beverage restriction cannot leak into UK eligibility. | V3-04–08 |
| C Nigeria beverage and Wyn integration | Activate the implemented API for one reviewed Wyn location; connect separate website, POS and marketplace; prove pricing, stock, money and recovery. | External website journey and hosted payment callbacks certified; last-unit concurrency, cancellation/late payment and ledger reconciliation pass. | V3-09–12 |
| D Nigeria marketplace fulfillment | Merchant child orders, delivery adapters/quotes, private operational queues, partial fulfillment and allocated refunds. | Parent customer totals match merchant orders/shipments/receipts and every merchant sees only permitted records. | V3-13/14 |
| E Gifts and restaurant commerce | Independent gift sellers, restaurant discovery/food ordering, future seating capacity and explicit fulfillment groups. | Gift parcel, prepared food and seating each have correct stock/capacity, cancellation, refund and customer status behavior. | V3-15–18 |
| F International ERM and operations | Country-aware addresses, currency/tax/timezone, versioned plans, legal/consent, payment/delivery administration and global reports. | Original-currency figures reconcile; configuration changes preserve historical terms; operator recovery and backup restore demonstrated. | V3-19/20/24 |
| G UK activation | Postcode eligibility, retailer offers, real quotes, bounded Smart Cart, approved marketplace payments and courier shipments. | Full GBP multi-retailer purchase/partial-refund/delivery journey passes commercial, provider and legal readiness gates. | V3-21–24 |
| H Additional markets and revenue expansion | Activate reviewed future markets and staged advertising, loyalty, customer subscriptions and distribution capabilities. | New country uses existing services/configuration; each new revenue feature has its own approved economics, tests and operator ownership. | Follow-on work packages |

Country controls and operational/legal foundations start in B and gate every launch; they are not postponed until F. Nigeria restaurant delivery and future reservations can ship separately after their own dependencies pass.

## 5 Workstream requirements

Currency settings, language settings, payment integrations and the delivery system are explicit required product capabilities. **[Certain]** The user requested all four in this strategy. The configuration design and acceptance requirements below are **[Likely]** recommendations until implemented and verified; listing a setting here does not mean it exists today.

### Settings ownership and inheritance

| Settings surface | Controls and authority |
|---|---|
| Platform and country administration | Approved markets, enabled currencies/languages, country defaults, payment/delivery providers, legal-account ownership and readiness. Only authorized platform operators can activate these capabilities; changes are versioned and audited. |
| Tenant ERM and storefront settings | Choose among permitted currencies/languages, approved merchant payment accounts, fulfillment locations, delivery zones/hours and pickup options. Tenant settings cannot enable an inactive market or bypass provider, category or account restrictions. |
| Customer header and account preferences | Market/delivery destination, supported language and optional display currency. Persist signed-in preferences and a limited guest preference; these selections never grant merchant access or silently change settlement ownership. |

Resolve defaults in order: platform baseline → country policy → permitted tenant/storefront settings → permitted customer display preferences. Country/provider restrictions always constrain the result. Keep language, shopping market, destination and display currency independently selectable where supported. Expose only a public settings projection through the API; credentials and internal account configuration stay private. Apply the same settings contract to the platform, ERM, mobile app and separate website API.

### Currency settings

Implement a currency settings screen and shared money service, not scattered currency symbols. Configure enabled currency codes, country default transaction currency, tenant price-list currency, optional customer display currencies and provider-supported payment/settlement currencies. Preserve the current NGN path while adding reviewed market support; currency choices do not activate a country.

Use explicit amount+currency values and currency-specific minor units/rounding. Record merchandise, shipping, tax, discounts, commissions and refunds in their original transaction currency. Store settlement currency and any provider conversion separately. Never add NGN and GBP totals directly or treat a changed symbol as a conversion.

For converted display/reporting values, configure an approved FX source, rate timestamp, refresh policy, maximum age, rounding and outage behavior. Snapshot the rate/version used for an accepted quote; show the payable currency before confirmation. Requote expired quotes and explain changed totals rather than silently repricing. Refund against the original payment/currency and record any actual provider conversion or fee difference explicitly.

**Acceptance:** Changing display currency cannot change existing payable amounts; unsupported provider/currency combinations are blocked; stale/unavailable FX has a clear fallback; ledger/report totals remain reconcilable by original currency; historical orders retain their currency/rate snapshots. Map to V3-05/08/19/20 and specification pages16/20/32/34/36/38.

### Language and locale settings

Implement supported-language management, a visible customer language selector and permitted tenant defaults. Nigeria starts with the documented English experience; additional languages are enabled only when the required translations are complete and reviewed. Future country examples include English for UK, Romanian, Italian and French; language availability is configuration, not proof of a launched market.

Use shared translation keys with locale resources, explicit fallback language and missing-translation checks. Persist preferences across refresh/login and carry locale through server rendering, APIs and customer communications. Localize navigation, forms, validation/errors, product/category content where provided, checkout, receipts/invoices, order updates, support and approved legal content. Country-specific legal documents remain reviewed versions; a fallback translation cannot authorize unapproved terms.

Format dates, timezones, numbers, addresses, units and money for the selected locale without changing stored quantities or transaction currency. Keep canonical catalogue IDs stable across translations. Return stable API error/status codes for clients to translate, retain the chosen locale on communications, and include locale in relevant cache keys. Provide localized URLs/metadata and hreflang/canonical behavior where translated public pages are published; preserve existing links.

**Acceptance:** Language persists; missing optional content falls back predictably; checkout has no untranslated required controls; server/client formatting agrees; translated content cannot leak across tenant caches; switching language does not switch market, merchant, stock or payment currency. Map to V3-05/18/19/24 and specification pages1/26/37/38/39.

### Payments and settlement

Close legacy marketplace trust gaps without breaking valid hosted-payment, wallet, gift-card, cash or COD workflows. Every settlement needs server evidence, transaction ownership, exact amount/currency, account binding and replay identity. Model parent charge, merchant shares, platform fees, shipping, tax, refunds and settlements explicitly. An HTTP success or browser return is not payment proof. Uncertain and late payments need an operator queue, not a second charge or automatic restock.

Paystack is the current repository policy; customer marketplace code also contains Korapay and legacy Stripe. Direct API/ERM/venue paths use Paystack. V3 proposes UK Stripe Connect subject to approval. Decide the country/channel/provider matrix before migration. A dependency being installed is not provider approval or a marketplace settlement integration.

Provide payment settings for country, tenant, storefront/channel, legal account owner, supported currencies/methods, test/live mode, callback configuration, allowed return origins, commission rules and settlement/refund capabilities. Keep credentials in server secret storage behind scoped references, with role restrictions, rotation/revocation and audited changes. Platform marketplace collection, Wyn website collection, ERM subscription billing and customer recurring orders are separate money flows.

Standardize provider adapters for supported initialization, verification, signed webhooks, refunds and reconciliation. Declare unsupported capabilities explicitly. Select eligible methods from country/channel/account/currency and order rules; do not silently fall back to another provider/account. Preserve valid wallet, gift-card, cash/COD and POS tender paths through their own server-authorized evidence instead of trusting browser payment flags.

Expose customer payment status and a private operator queue for failed/uncertain/late collections, duplicate events, partial refunds, payout discrepancies and chargebacks/disputes where the provider supports them. Bind every payment operation to order/customer/account/reference/amount/currency and an idempotency identity. Keep shipping/tax/commission allocation and merchant child-order refunds reconciled with the parent payment.

**Acceptance:** Hosted test-mode initialization→payment→webhook→order→ledger succeeds for each approved account/currency; forged/repeated/wrong-account callbacks fail safely; uncertain outcomes do not create another charge; partial refund and reconciliation match stored allocations. Keep production methods disabled until applicable commercial/provider readiness passes. Map to V3-01/08/10/13/20/23/24 and specification pages6/12/25/30/32/36.

### Delivery system and provider integration

Implement delivery settings and operations as a complete system: platform-approved providers and capabilities; tenant/store fulfillment locations; country/address/postcode or zone/radius coverage; opening/cutoff times, delivery windows, minimum orders, pickup, pricing/free-delivery rules and capacity. A customer enters a destination before the API offers an eligible merchant/method. Country and tenant controls apply server-side even if a client submits a different method.

Support separate parcel couriers, local dispatch/riders, prepared-food delivery and customer collection. Reuse existing rider trips, shipping metadata and zone/distance tools. Add provider adapters for capability/coverage checks, rate quotes, shipment booking, labels, tracking, cancellation and proof of delivery where supported. Confirm fragile/alcohol handling and age-check capability before offering a restricted service; a missing provider capability must never be presented as available.

Quotes bind destination, merchant/location, basket quantities, weight/dimensions where required, service, currency, charges, estimated window and expiry. Revalidate stock, store hours, coverage and quote at checkout. Separate multi-merchant shipments and food preparation from parcel dispatch; a seating reservation has no shipment. Explain partial deliveries and costs to the customer, and feed actual eligible delivery quotes into Smart Cart.

Provide merchant/dispatcher queues for acceptance, picking/preparation, assignment, dispatch, delivery/collection, failures, reattempts, cancellations and returns. Deduplicate provider events, reject stale state regressions, retain proof/status history and reconcile shipping charges/refunds. Provider outages or expired quotes require a requote or an explicitly approved alternative; retries must not create duplicate bookings or charges.

**Acceptance:** Only covered/eligible services can be purchased; quoted shipping equals the accepted charged amount; failed booking/retry cannot duplicate a shipment; each merchant sees its own dispatch data; tracking and proof reflect real events; food/parcel/pickup/reservation states remain distinct. Map to V3-09/13/14/16/18/21/22/23 and specification pages8–13/24/29/31/33.

### Countries and seller eligibility

Add versioned CountryConfiguration with DRAFT → CONFIGURING → READY_FOR_REVIEW → ACTIVE → SUSPENDED. Resolve market server-side; configure marketplace/ERM/storefront capabilities, permitted categories, payment/delivery/tax/legal/locale rules and readiness evidence. Keep future markets off by default.

Represent exclusivity as country+category+Tenant+effective period, with reviewed exceptions and contract references. Enforce at onboarding, listing creation/publication, public offer query, cart and checkout. Use stable IDs rather than display names. Preserve ERM/direct-storefront rights when marketplace enrollment is unavailable; do not automatically suspend existing Nigerian sellers from this document.

### Inventory and order fulfillment

Use one location/variant stock authority with owned holds, batch evidence and transactional consume/release/movements. The new API supports an opt-in mapped location; broader allocation across multiple stores remains to be implemented. Parent stock totals are projections. Choose fulfillment location before accepting the commitment and revalidate availability at checkout.

Extend current Order into customer overview plus tenant-private merchant-order responsibilities and independent shipments. A list filter on participating tenant does not redact another tenant's lines. Separate parcel, food, pickup and seating lifecycles, while preserving one reconciled payment/fee/refund allocation contract. No shipment should be created for a seating reservation.

### ERM and platform administration

Retain functioning POS, receipt-based purchasing, stock transfers/valuation, quotations/returns, contacts, staff/appraisals and accounting. Improve role/store/channel visibility rather than rebuilding these modules. Keep location capabilities abstract for retail, warehouses and hospitality. Add independently reviewed enrollment and country/versioned subscription plans without rewriting current customer contracts.

Build country, merchant, payment-account, delivery-provider, subscription and global reporting screens around shared services. Original transaction currencies must remain visible; converted reports need explicit FX source/time. Display-currency preference must not silently change payment currency or reprice an existing cart. Preserve private/noindex account/admin surfaces.

### Gifts and subscriptions

Gift sellers need their own eligible tenant listings, wrapping/message/recipient metadata, inventory, shipping, tracking and refunds. Gift cards are payment instruments, not a substitute for this marketplace. Hampers need component-level stock and reviewed substitution rules; alcoholic components retain age restrictions. Corporate gifting needs quoting, bulk recipients, invoicing and privacy controls.

Later customer subscriptions require consented recurring charges, schedules, pre-charge communication, stock/substitution decisions, skip/pause/cancel and payment recovery. Bottle tracking and recommendations should follow reliable purchase/consumption data; do not invent availability or fulfillment promises from AI output.

### Restaurants and venues

Reuse existing venue identity/profile/menu/visit/payment foundations and the [venue design](../../saas/venues/README.md). Current booking requests do not guarantee future seats. Add capacity calendars, overlapping-resource/time rules, atomic confirm/amend/cancel, no-shows and reviewed deposits separately from arrival/table assignment.

Food requires explicit menu/service metadata, modifier pricing, availability, kitchen acceptance/preparation, collection/delivery windows and stage-aware cancellation/refund. Decide recipe/ingredient stock versus finished-unit stock per item. Later venue releases can add splits, devices, guest lists, ticketed events and admissions without creating a second catalogue or payment engine.

### UK and future markets

First implement postcode coverage/restrictions and actual merchant/location courier quotes. Smart Cart compares merchandise+delivery+mandatory charges under stock, coverage and merchant constraints; implement bounded computation, quote expiry, requote/fallback and manual eligible retailer choice. A nearest-store recommendation is not cheapest delivered cost; a heuristic must not claim a proven global optimum.

Then deliver approved connected-account payment/commission/refund/settlement flows, merchant shipments, tracking and provider capability controls. Providers named in v3 remain candidates until reviewed. Romania/Italy/France are inactive configurations until ready; correct the specification's Romania EUR assumption using the audit's RON reference and recheck currency policy at activation. Do not clone application stacks per market.

## 6 Current backlog status after local Phase A work

| Packages | Position [Certain] | Next action |
|---|---|---|
| V3-01/02 | Implemented locally in Phase A: server settlement evidence, durable receipts, purpose-bound stored value, authorized refunds, private projections and mixed-parent mutation guards. | Review [Phase A evidence](phase-a-verification.md) and [handoff](../../superpowers/specs/RESUME-phase-a-transaction-safety.md); complete operational/provider gates before release. |
| V3-03 | Locally verified: final backend4248 passed/0 failed/0 cancelled/18 named skips; Phase A17/17 and direct website13/13; both frontend types/builds passed. Production assurance remains gated. | Keep exact failures/skips and installed-runtime limitations visible; hosted CI/provider/restore are separate gates. |
| V3-04–07 | Strategy/policy decisions documented; global configuration/enrollment not implemented by API task. | Record commercial choices, then implement country and enrollment services. |
| V3-08 | Partial: direct channel/account/order snapshots and reporting exist. | Generalize country/legal ownership and global channel administration. |
| V3-09 | Local implementation and concurrency tests for opt-in mapped stock. | Reviewed cutover and multi-location allocation; preserve legacy order authority. |
| V3-10 | Direct merchant-account path implemented locally. | Hosted certification, global provider/settlement/refund expansion and legacy trust fixes. |
| V3-11 | External API architecture implemented and documented. | Connect/review actual separate website. Hosted custom-domain lifecycle is conditional, only if DrinksHarbour later provides that service. |
| V3-12 | Backend slice implemented; end-to-end production journey incomplete. | External frontend integration, reviewed publication/location and provider/operator validation; no website rebuild here. |
| V3-13–18 | Reusable foundations exist; complete new category/fulfillment/capacity journeys remain. | Follow D/E phase dependencies and the detailed backlog. |
| V3-19–24 | Proposed international/UK/operations expansion remains. | Build on country, money, eligibility and fulfillment foundations before UK activation. |
| Seven-stream follow-ons | Existing partial advertising/loyalty/gifting foundations are not completion claims. | Inventory each feature's current behavior before its detailed implementation plan. |

## 7 Decisions and evidence required

| Decision | Evidence to record | Proposed accountable role [Likely] |
|---|---|---|
| Wyn exclusivity and transition | Stable tenant/category/country IDs, term dates, exceptions, contract/data rights and existing-merchant transition. | Business owner with legal review |
| Account and fee ownership | Provider/legal entity per channel, direct prices/fees, payout/refund/shipping/tax treatment and signed commercial terms. | Finance/business owner |
| Actual website hookup | External repository/server, key custody, exact callback origins, stock locations and customer identity/token flow. | Website/backend owner |
| Country readiness | Active capabilities, currencies, approved policies/providers, category permission and named activation/rollback owner. | Platform/business owner |
| Currency and language settings | Enabled currencies/locales and defaults, payment versus display currencies, FX source/staleness policy, translation owners/review and fallback behavior. | Product/finance/content owners |
| Delivery operations | Providers/capabilities, tenant stock origins, coverage/hours/cutoffs, quote/pricing policy, dispatch ownership and failure/return handling. | Logistics/merchant operations owners |
| Mixed basket behavior | Which food/parcel groups may share payment, quote/expiry behavior and seating checkout boundary. | Product/operations owner |
| Venue and food policy | Capacity resources/durations, deposits/no-shows, kitchen workflow, stock basis, zones/hours and cancellation rules. | Venue/restaurant operator |
| ERM/subscription terms | Plan versions, country currency, trials, add-ons, limits, transition/dunning and grandfathering. | Commercial/finance owner |
| Customer data | Permitted merchant relationship fields, marketing consent/purpose, retention and country legal versions. | Privacy/business owner |

No named owners, launch dates or commercial approvals were supplied for these remaining decisions. Do not fill them in as facts. Current NGN plan configuration remains the implementation baseline until a new commercial decision is approved.

## 8 Migration, operations and launch measurement

Use additive schemas and reviewed indexes, read-only inventory/account/channel mapping reports, disposable-database transaction tests and gated releases. Never infer historical website versus marketplace source from today's settings. Where source evidence is absent, retain legacy/unknown. Drain or reconcile old holds before switching stock authority; do not double-decrement legacy aggregates and location balances.

Feature rollback stops new commitments while retaining financial, order, stock and audit history. For the implemented direct API, pause via channel enabled status, not deleting its mapping or Tenant authority flag. Preserve old account references for reconciliation. Provider secrets stay in server secret storage; website API keys never reach browser JavaScript. Monitor uncertain payments, abandoned holds, failed reconciliation/jobs, stock drift and settlement differences, with retries and reviewed replay/dead-letter procedures.

Release gates require tenant/customer isolation, duplicate webhook/idempotency tests, simultaneous final-unit tests, traceable purchase receipt/fulfillment/returns, correct partial refunds, capacity concurrency, hosted provider journeys, successful backup restore and operator rollback evidence. For frontend changes add mobile/keyboard/accessibility, browser and production-build checks. Existing test skips must be explicitly classified; a large passing test count does not certify a missing journey.

Measure each release with reconciled GMV/revenue/fees, stock discrepancy, payment/refund mismatch, fulfillment time/failure, oversell/capacity conflicts and merchant support incidents. ERM growth should track activation, retained paid use and billing recovery; advertising tracks billable versus invalid events; loyalty/subscriptions track approved benefits and retained use. Establish baselines before targets; no numerical targets are invented here.

## 9 Navigation and next action

- [Phase A implementation prompt](../../prompts/implement-phase-a-transaction-safety.md) is the ready-to-use handoff for payment trust, tenant-private orders and fresh verification.
- [All 39 specified pages](page-coverage.md) maps the UI scope to existing source and gaps.
- [24 detailed work packages](implementation.md) supplies dependencies, APIs and acceptance expectations.
- [Architecture and source evidence](architecture.md) records ownership, isolation and migration contracts.
- [Acceptance coverage](acceptance.md) records the original audit evidence and requirement coverage.
- [Separate website API guide](../../../server/services/storefront/README.md) is the integration/setup contract for the already separate website.
- [API implementation handoff](../../superpowers/specs/RESUME-independent-storefront-api.md) records actual local changes, tests and production gates.

**[Likely] Next implementation:** Phase B country/enrollment foundations, followed by a reviewed Wyn integration pilot. Phase A is local safety implementation, not production certification; see its exact evidence and migration/recovery limitations. The earlier strategy request did not activate a country, change fees, suspend merchants or authorize production rollout.

## Phase A implementation continuation — 2026-10-23

[Certain] The Phase A prompt was executed locally with one agent. New receipt claims, stock/order transactions, wallet/gift purpose binding, safe projections and guarded mixed-order commands preserve existing identities and separate website/POS/venue workflows. [Storage preparation and rollback](../../operations/phase-a-transaction-safety.md), [fresh verification](phase-a-verification.md) and [resume](../../superpowers/specs/RESUME-phase-a-transaction-safety.md) are the current handoff. No commit, deployment, live configuration, real money or production mutation was performed. Later settings, providers, countries and courier expansion remain separate phases.


## Authorized continuation — 25 October2026

User now authorizes local next-phase implementation with collaborating agents, descendants and no clarification questions. The prior stop-after-A limit is superseded; no production/financial/commit permissions inferred. Phase B country/enrollment/channel foundation and real ingress/management UI are implemented and undergoing final integration. Phase C now inspects the actual separate Wyn website and corrects customer-token/cookie identity, with no website rebuild. Phase D opt-in merchant/location fulfillment and delivery are in progress. See [current continuation](../../superpowers/specs/RESUME-global-platform-phases.md) and its ledgers for actual evidence and unresolved gates. Earlier proposed/unimplemented rows above are historical starting state, not the latest execution status. No all-phases-complete or release-ready claim.

## Local continuation milestone — 2026-10-26

[Certain] Phase B country/enrollment/channel foundations and actual ingress/settings are implemented locally; Phase C corrected and verified the existing separate Wyn website customer/token/cookie integration. Phase D now includes an opt-in paid NGN merchant/location fulfillment slice, original Stripe/platform merchandise refund compatibility, private operational queue and zero-shipping pickup. D remains partial: quantity splits, other-provider/shipping/tax refunds and return/payout allocation, real dispatch/carriers and customer shipment journeys remain. E–H remain future implementation. No provider choice, commercial permission, production activation or historical cutover is inferred. Current verified counts, runtime limits and operational preparation are maintained in [final local evidence](../../superpowers/specs/global-phases-verification-2026-10-26.md) and [resume](../../superpowers/specs/RESUME-global-platform-phases.md).
# Continued Phase D package checkpoint — 2026-10-26

The first B/C/local-D baseline is superseded only for the specific implemented packages below, not for launch acceptance. Optional V2 original-line holds now support partial unit shipments/delivery/cancellation with exact unit-range refund evidence and original accepted-cost reversal; V1 history is preserved. Reviewed own-rider local dispatch uses existing trip/driver/stock authority and accepted shipping budget. Merchant queues now paginate own work and provide operational quantity/refund/rider panels. Server-only creation flags remain default off; no production/index/cutover/provider activation occurred.

Independent review is closing actual managed-delivery closure, legacy rider claim/cancellation and accounting reversal bypasses with observed regression tests. Final assembled checks are in progress; consult `docs/superpowers/specs/RESUME-global-platform-phases.md` and the dated verification ledger rather than reusing earlier suite counts. Phase D exit remains incomplete: other payment/stored-value/shipping/tax refunds, return/payout allocation, real carrier/hosted roundtrips, customer shipment UI and reviewed commercial/configuration/cutover acceptance remain. Zero-only unit cancellation has no approved no-money policy; zero-valued ranges can be bundled with a positive supported refund. E–H remain unimplemented.
# Verified next-D local milestone — 2026-10-27

The quantity, refund/cost, own-rider and paged-queue package passed final local verification: **4,381 backend tests passed, zero failures, 18 named skips**; Phase A17/17 and separate website13/13 passed independently. Full admin3,260 tests, post-label focused8, actual Next browser acceptance, types, lint and final production build passed. Detailed counts, skipped groups, observed failures/corrections, process cleanup and limitations: `docs/superpowers/specs/global-phases-next-d-verification-2026-10-27.md`.

This closes the local package, not Phase D overall. Other financial/delivery adapters, customer/configuration-review screens, failed-drop recovery and real operational acceptance remain; E–H remain unimplemented. Default-off controls and all production prohibitions remain intact. Strategy/backlog status must retain these exit gates.

## Delivery review and customer progress continuation — 2026-10-27

[Certain] The next local package implements platform-only delivery review configuration and owning-customer shipment progress on the existing account and tracking screens. Configuration uses saved location ownership, explicit reviewed terms, immutable versions and exact-ID revocation. Customer reads require original marketplace order ownership, use a consistent read-only snapshot and expose independent safe projections. No separate payment, stock or delivery engine was introduced. Existing V1 history and separate website/POS/venue workflows retain their authority.

Fresh frontend suites, types, lint and complete builds passed; actual local browser review/revoke, tenant denial, partial customer shipments and foreign-customer denial passed. Backend final verification and fixture cleanup are recorded in the [current package ledger](../../superpowers/specs/delivery-customer-verification-2026-10-27.md); consult its final status rather than earlier counts above. The screens are locally implemented, not production activated. V3-20 delivery administration is partial: this package covers reviewed local delivery only, not general payment/provider management.

Next independent package: failed-delivery recovery with preserved goods/driver/booking authority, followed by explicitly scoped refund/return/payout allocation and external provider readiness. Phase D exit remains open; E–H remain unimplemented. Shipping/tax and other-provider/stored-value refunds, zero-only cancellation policy, real operational/hosted acceptance, stock/index cutover, restore and clean-lock CI remain unresolved. Creation controls remain default off; no commercial/provider/legal approval is inferred from successful local screens.

## Recovery, original-provider refunds and parcel candidate — 2026-10-28

[Certain] User authorized the next four workstreams with collaborating leads/reviewer descendants. Failed local delivery now supports explicit original-goods reattempt and separately confirmed quarantine receipt; old trip/booking/charge and foreign rider claims remain protected. Original Paystack/platform merchandise V1/V2 refunds join existing Stripe compatibility with exact original transaction and journals, pending/uncertain recovery and no repeated create. Default-off reviewed Shipbubble parcel responsibilities use saved manual-shipped allocations, original account/capabilities and shared shipping budget; actual merchant review/confirmation/recovery and safe customer observation views are integrated. This is implementation of a limited reviewed parcel protocol, not provider certification or production activation.

Fresh local acceptance includes all19opt-inDBfiles/91tests (the formerly unexecuted16groups plus dedicated trust/direct/POS), synthetic dump/restore/replay and actual Next/JWT/Mongo recovery journeys; current frontend suites/types/lint/full builds pass. Exact final backend counts/failures/corrections and cleanup are in [current acceptance](../../superpowers/specs/phase-d-acceptance-2026-10-27.md); consult its status before asserting completion. All separate website/POS/venue/wallet/gift/inventory identities remain their own authoritative workflows.

PhaseD exit and item2 full financial completion remain open. Shipping/tax/Kora/wallet/gift/payout transfer allocation and post-quarantine stock/cost disposition need original financial authority and reviewed policy before implementation/execution can safely complete. Zero-only cancellation remains policy-gated. Food/dropoff/COD/duties/insurance and provider return labels are outside the current parcel adapter. Real account/handling/legal/provider approval, hosted callbacks, production restore/cutover and clean-lock CI remain external acceptance gates; E–H remain unimplemented. No local test grants those approvals or authorizes real financial/provider actions.


## Final recovery/finance/carrier acceptance — 2026-10-28

[Certain] Supported local engineering is implemented and verified. Full item 2 financial completion and the full Phase D exit are OPEN; local passes do not supply missing policy or production approval. Fresh required backend: 4540 pass/18 skip/0 fail; all 18 broad skips independently covered by opt-in 19 files/91 pass. Admin3347, platform284/13/9, carrier17, restore1, both frontend types/lint/full builds and extended actual browser passed. All task fixtures stopped, owned outputs/wrappers removed and default bindings restored. No commit, deployment or real transactions.

Shipping/tax refunds and fee journals, Kora/wallet/gift refunds, payout transfers, zero-only cancellation policy and post-quarantine stock/cost disposition remain unsupported pending original financial authority and reviewed policy. Real carrier/account/handling/legal approval, hosted callbacks, production restore/cutover and clean-lock hosted CI remain unverified. E–H remain unimplemented. Final canonical repository ledger: `docs/superpowers/specs/phase-d-acceptance-2026-10-27.md`; current resume: `docs/superpowers/specs/RESUME-phase-d-recovery-acceptance.md`. Earlier running/pending checkpoints are superseded by that final ledger.

## Item-2 continuation verified — 2026-10-28

[Certain] The four remaining item-2 workstreams (return disposition, refund-source readiness/discovery, settlement statements, platform-ops readiness) are implemented by leads with independent review and verified locally: server glob 4,569 pass / 0 fail / 18 named skips (4 load-timeout cancellations in untouched Mongo-heavy files, all passing focused with original timeouts); admin 3,364/3,364 after the new `/platform-ops` route was registered in the session-middleware matcher (its coverage test caught the initial fail-open — the gate worked as designed); platform suites/types/lint/builds pass; four assembled browser journeys pass with 0 page errors, including conserved settlement figures, once-only disposition with a verbatim fail-closed effects gate, exact reviewed queue wordings and customer leak checks. Payout, shipping/tax/Kora/wallet/gift refund effects and post-quarantine stock/COGS effects remain fail-closed `review_required` pending recorded policy — the fail-closed surfaces now exist, the refunds do not. E–H remain unimplemented. No commit/deployment/production activation; full assignment and per-lead evidence: `docs/superpowers/plans/2026-10-28-phase-d-item2-assignment.md` and the dated `phase-d-*` ledgers.

## Component-refund authority package — 2026-11-02 (root, agents)

[Certain] The final four buildable mechanisms (shipping-refund allocation S2; tax + discount component authority T; zero-only no-money release Z) are implemented by parallel leads, reviewed (APPROVE with hardening/test fixes verified applied) and consolidated on a fresh local `venuePhase0` replica: closeout battery 44/44 (three new families + unmodified pre-existing families); full glob 4,791 tests — 4,766 pass / 0 fail in every package-touched file / 18 named skips / 5 known venue load-timeout cancellations / 2 failures reproducing focused in the user's in-flight concurrent venue work (excluded from claims). Production still holds ZERO policy records; all five mechanism flags default off; every surface fails closed verbatim. Six of nine open items are "record a policy → executable under review" (quarantine, stored-value, shipping, tax, discount, zero-only); Kora, payout transfers and fee bearer remain blocked on external evidence/decisions. Consolidated state: `docs/superpowers/plans/global-phases/phase-d-open-policy-decisions.md`. No commit/deploy/real actions; E–H unimplemented.

## Final-mechanisms package — 2026-11-02 (last three items; all nine complete)

[Certain] The last three "blocked" items received their mechanisms the honest way. (K) Kora: standalone gated adapter — the transport has NO network code and its built-in transport refuses; six reviewed protocol contract fields + `acceptFallbackTransactionId` are recorded verbatim by a super-admin; fallback identity stays refused until recorded `true`; reserve-then-post proved (mixed-transport race: loser never POSTs); coupling into `refundAuthority` documented as the next reviewed step (reviewed spine byte-untouched). (P) Payout: contract fields all recorded (schedule/FX source-with-snapshot/destination-binding source/holds/clawback/netting/threshold); transferable base conserved exactly against the settlement statement's pinned version; transport PHYSICALLY SEALED; uncertainty settled only by authenticated evidence (session-transaction review fix with genuine raw-E11000 RED). (Fb) Fee bearer: pure record authority with `figures:"none"` honesty — nothing measured, historical fees unknown forever, no executor shipped by design; `activeForFlow` import point adopted by Kora. (UI-W) Operations integration: policy-registry projection for TEN mechanisms + kora/payout queue + readiness v1→v2 (v1 wordings byte-unchanged; all mechanism gates verbatim); command execution stays service-level.

Final verification: grand server joint battery 71/71 pass / 0 fail / 0 skipped (all nine mechanism families + platform-ops + unmodified pre-existing families); admin platform-ops/merchant-orders vitest 49/49, type:check clean, lint 0 errors. Consolidated END STATE: **9 of 9 items mechanism-complete** — six execute the moment an operator records a policy; Kora additionally demands the real protocol review; payout additionally demands a real money-rails contract; historical fee measurement stays permanently unknown. Production holds ZERO policy records; all flags default off; readiness claims no execution capability. Consolidated requirements: `docs/superpowers/plans/global-phases/phase-d-open-policy-decisions.md`. No commit/push/deploy/real actions; E–H unimplemented.

Closing evidence: assembled browser journeys 4/4 PASS (super_admin registry/readiness/queue verbatims, recorded states via each mechanism's own route, tenant 403; 0 page errors); production admin build green (194/194) after a mechanical fix to one uncommitted broken file in the user's tree; the server glob's last 2 genuine failures resolved (one by the user's edits, one by root's one-line test-side fix); zero genuine glob failures remain outside the known load-timeout cancellations.

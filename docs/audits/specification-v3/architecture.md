---
title: Architecture gaps and source evidence
date: 2026-10-22
status: audit-and-proposed-contracts
---

# Architecture gaps and source evidence

## Evidence register

Paths link to inspected source. Line numbers identify the reviewed behavior; the working tree can subsequently move.

| ID | Source evidence | Observation [Certain] |
|---|---|---|
| E01 | [Product](../../../server/models/Product.js), [SubProduct](../../../server/models/SubProduct.js), [Size](../../../server/models/Size.js), [integration catalogue](../../../server/services/storefrontCatalog.service.js) | Central master and tenant offers/variants already exist. Integration filters tenant/publication/status and permits submitting tenant's own pending master. No country activation/exclusivity contract found here. |
| E02 | [Tenant](../../../server/models/Tenant.js), [Address](../../../server/models/Address.js), [Warehouse](../../../server/models/Warehouse.js) | Tenant country/default/supported currencies and addresses exist. Customer country enum excludes Romania/Italy/France; tenant geocoding uses `country:NG`. These fields are not CountryConfiguration. |
| E03 | [WarehouseStock](../../../server/models/WarehouseStock.js), [POS location](../../../server/services/posLocation.service.js), [venue stock](../../../server/services/venue/inventory.js) | Location balance unique by tenant/warehouse/subproduct/size; available=current−reserved. Venue reserves conditionally inside a transaction and records owned effects/movements. |
| E04 | [Integration routes](../../../server/routes/storefrontIntegration.routes.js), [checkout](../../../server/services/storefrontCheckout.service.js), [stock](../../../server/services/storefrontStock.js) | Scoped API-key routes, payload-fingerprint idempotency, transaction and provider attempt recovery exist. Web stock mutation changes aggregate SubProduct/Size counts, not WarehouseStock. |
| E05 | [Gateway](../../../server/services/storefrontGateway.js), [cart quote](../../../server/services/storefrontCart.service.js), [settlement](../../../server/services/storefrontSettlement.js) | Gateway reads global PAYSTACK_SECRET_KEY; quote uses tenant revenue agreement and persists commission. Hard-coded NGN. No separate merchant account selection. |
| E06 | [Sales reservation contract](../../../server/services/salesReservations/README.md), [sales reservations](../../../server/services/salesReservations/index.js) | Sales order-owned warehouse reservations, transactional consumption/release and replay identity already provide patterns to reuse. |
| E07 | [Marketplace order creation](../../../server/controllers/order.controller.js:50), [reserve](../../../server/services/inventory.service.js:126) | Marketplace reserves before save with compensation rather than one transaction. Size update is unawaited and its result discarded. Reserve is called with null order ID. No marketplace create idempotency contract found. |
| E08 | [Public order route](../../../server/routes/order.routes.js:79), [payment fields](../../../server/controllers/order.controller.js:322), [payment method lookup](../../../server/services/payment.service.js:446) | optionalProtect permits guest create; request paymentStatus/status are used in orderData. Method lookup falls back and does not prove money received or bind amount/reference to this order. |
| E09 | [Payment routes](../../../server/routes/payment.routes.js), [attach controller](../../../server/controllers/payment.controller.js:76), [attachment service](../../../server/services/payment.service.js:96), [refund controller](../../../server/controllers/payment.controller.js:212) | Attach/refund routes use protect without general ownership/admin guard. Attach controller checks tenant only for table bills; ordinary attachment trusts supplied payment data. Canonical venue/integration guards are narrower safeguards, not ordinary-order authorization. |
| E10 | [Order detail](../../../server/controllers/order.controller.js:694), [list query](../../../server/controllers/order.controller.js:563), [Order schema](../../../server/models/Order.js) | Tenant participation authorizes detail, then returns whole parent document. Filtering parent orders by items.tenant does not redact foreign lines. Existing fulfillmentStatus map is not isolated merchant child orders. |
| E11 | [Venue README](../../../server/services/venue/README.md), [requests](../../../server/services/venue/reservations.js), [booking service](../../../server/services/booking.service.js), [Phase1 handoff](../../superpowers/specs/RESUME-venue-phase-1.md) | Public directory/location/menu, requests and canonical visit/payment flows exist locally. Future capacity, deposits/splits and food remain deferred; activation/provider gates remain. |
| E12 | [Plan config](../../../server/config/erm-plans.js), [entitlements](../../../server/services/entitlements.service.js), [billing](../../../server/services/erm.service.js) | Capability sets, prices, limits, trials, add-ons, recurring Paystack and degradation already exist. No country plan configuration UI/model found. |
| E13 | [Purchase controller](../../../server/controllers/purchaseOrder.controller.js), [receipt helpers](../../../server/services/poReceive.helpers.js) | Goods receipt/returns and warehouse/batch workflows are substantial existing code. Preserve receipt ownership and verify no stock effect at draft PO creation. |
| E14 | [Order source](../../../server/models/Order.js:450), [storefront pricing](../../../server/services/storefrontPricing.js), [payment service](../../../server/services/payment.service.js:21) | Sources are web/pos/app/manual, insufficient for named marketplace/direct channels. Website quote/checkout uses NGN. General payment gateway defaults to Korapay and retains ordinary Stripe code. |
| E15 | [Tenant authority](../../../server/utils/tenantContext.js), [effective permissions](../../../server/services/effectivePermissions.service.js), [auth](../../../server/middleware/auth.middleware.js) | Existing JWT-authoritative tenant context, roles and effective permission framework. Extend rather than replace; do not infer every handler is scoped merely from these helpers. |
| E16 | [Platform middleware](../../../client/apps/platform/src/middleware.ts), [tenant resolution](../../../client/apps/platform/src/lib/tenant.ts) | Known DrinksHarbour subdomain resolution exists. Arbitrary verified custom-domain lifecycle is not implemented by this hostname matcher. |
| E17 | [API keys](../../../server/services/apiKey.service.js), [customer service](../../../server/services/tenantCustomer.service.js), [customer routes](../../../server/routes/tenantCustomer.routes.js) | Tenant API scopes, revocation, entitlements, rate limits and separate customer auth/session identities exist. Keys are not proof of domain ownership or separate settlement. |
| E18 | [Delivery](../../../server/models/Delivery.js), [Shipping](../../../server/models/Shipping.js), [website shipping](../../../server/services/storefrontShipping.service.js) | Local rider trips/stops/proof, product shipping metadata and Nigeria zone/distance pricing exist. They do not implement UK courier purchase/labels/quotes or child-order shipments. |
| E19 | [Jobs](../../../server/jobs), [operations](../../operations/README.md), [production audit](../production-readiness-2026-10-19.md), [MFA](../../../server/services/mfa.service.js) | Cron/reconciliation/recovery and operational runbooks exist; hosted restore/monitoring/provider evidence remains external. MFA has RFC6238 crypto code, superseding AGENTS' placeholder note. |

## Required ownership contract [Likely]

| Responsibility in v3 | Reuse or additive design | Boundary |
|---|---|---|
| Organization/MerchantProfile | Tenant plus market/category enrollments and capabilities | Avoid a second Vendor seller identity. Tenant country of incorporation need not equal every market served. |
| LegalEntity/payment owner | Explicit owner and provider account reference | A tenant, platform and provider account are distinct authorities; credentials stay server-side in secret storage. |
| Country configuration | Add reviewed configuration/version and resolved market context | DRAFT→CONFIGURING→READY_FOR_REVIEW→ACTIVE→SUSPENDED; ACTIVE requires configured capabilities and readiness evidence. |
| Category eligibility/exclusivity | Add country/category/Tenant/effective-period policy | Central checks at onboarding, create/publish, public offer query, cart, checkout and direct API ingress. Preserve accepted transaction obligations on policy change. |
| CanonicalProduct/listing/variant | Product/SubProduct/Size | Country eligibility attaches to offer/enrollment; catalogue originCountry is provenance, not shopping market. Extend food/service metadata deliberately. |
| Store/InventoryBalance | Warehouse capabilities/WarehouseStock | Every allocation picks authorized tenant+location+variant. Parent aggregates become derived projections, never competing stock authority. |
| StockReservation | Reuse proven owned reservation patterns; generalize only as needed | Durable identity, expiry, exact quantities, operation keys, transaction, release and reconciliation. Hold changes reserved, fulfillment changes physical on-hand. |
| SalesChannel/Storefront/DomainMapping | Add stable channel/storefront identity and verified host mapping | Server resolves market/Tenant/locations/payment owner; client cannot choose another settlement account or declare fee exemption. |
| ParentOrder/MerchantOrder | Retain Order customer overview; add child responsibilities | Per-merchant/location fulfillment, merchant-private DTO and refund allocation. Existing line snapshots/history remain immutable. |
| Shipment/CourierQuote | Add shipment identity and adapter quote/booking/event records | Local Delivery remains a trip; Shipping remains product constraints. Quote has scope, price, capability and expiry. Reservation has no shipment. |
| Payment/Refund/Settlement | Extend receipt/attempt/accounting patterns, explicit account binding | Reference, account, country, channel, currency and exact amount verified; idempotent allocation and reversal. PlatformSettlement stored-value model is not a general marketplace payout ledger. |
| Subscription | Extend existing ERM plans/events/transitions | Versioned country pricing does not rewrite active contracts; ERM eligibility independent of marketplace publication. |
| Legal/Consent | Add reviewed country policy versions and purpose-scoped receipts | Customer preference is not proof of consent to share all history with merchants. |

## Trust and isolation map [Likely]

- **Platform admin:** cross-tenant country/provider/policy changes require explicit permission, actor, target, justification and immutable audit history. Country activation is not a normal tenant mutation.
- **Tenant owner/staff:** JWT Tenant authority plus permission and location scope on every new record/command. Category enrollment narrows capabilities; a paid plan alone cannot publish restricted offers.
- **Customer:** marketplace identity sees own parent orders/reservations; tenant website identity stays bound to its tenant session. Parent ownership does not grant staff/customer access to another merchant's private detail.
- **Public browsing:** verified host or allowed route selects destination/market, never staff authorization. Cache keys include market, tenant, policy version, currency and location/eligibility dimensions where relevant. Private records stay uncached publicly.
- **Providers:** signed callback plus verified provider account/reference/amount/currency; persisted event/operation identity, replay safety and uncertain-state reconciliation. Browser confirmation cannot mark a sale paid.
- **Permission order:** preserve the existing effective-permission engine and explicit denies; country/category/enrollment/plan/location constraints all apply. Do not add generic super-admin bypasses to provider or financial validation.

## Migration and coexistence [Likely]

1. Inventory existing tenant IDs, listings, stores, terms, provider accounts, stock counters and channel uses in a read-only report. Counts require an explicitly authorized data audit; none was performed here.
2. Add optional/versioned fields and collections first. Create reviewed scoped uniqueness/operation indexes before enabling concurrent writers. Test transactions on a replica set.
3. Define migration mapping for old NG orders. Do not invent historical WYN_WEBSITE versus marketplace identity from `source:web`, current hostname or present terms. Use unknown/legacy where evidence is absent.
4. Reconcile aggregate and location stock before switching authority. Use comparison reads and a controlled writer cutover; do not dual-decrement two stock systems. Plan release/rollback for active holds and uncertain payments.
5. Gate each market/category/channel separately. Preserve old URLs, public catalogue visibility rules, accepted orders and subscriptions throughout rollout. Feature rollback stops new commitments without deleting financial/movement history.
6. Update AGENTS and capability rules only after business decisions are approved. This review intentionally leaves current platform rules intact.

---
title: All 39 specification pages compared with existing code
date: 2026-10-22
status: source-comparison
---

# All 39 specification pages compared with existing code

All current-state entries are **[Certain]** source observations; gaps and changes are **[Likely]** implementation work unless explicitly specified by v3. Exact proposed URLs need reconciliation; absence of `/ng` or `/erm` is not absence of the underlying feature. No row is certified as fully v3-complete.

This is the original audit snapshot. After clarification that the Wyn website already exists separately, backend integration for pages6/12/17/18/20/25 progressed in [the API implementation handoff](../../superpowers/specs/RESUME-independent-storefront-api.md). Do not build another Wyn website here; connect the separate website through the documented API.

Paths below are relative to the repository. `platform` means `client/apps/platform/src/app`; `admin` means `client/apps/admin/src/app`. Admin route groups such as `(hydrogen)` do not appear in public URLs. Evidence references E01–E19 are defined in [architecture](architecture.md).

## Global and Nigeria customer pages

| Spec page | Proposed surface | Current foundation | Required implementation |
|---|---|---|---|
| 1 | `/admin/countries` | Missing country configuration model/API/UI; E01/E02. | Country lifecycle, capabilities, readiness, reviewed activation and suspend behavior enforced on reads and writes. |
| 2 | `/ng` | `platform/page.tsx`, discovery/header/category/offer UI. | Nigeria market context, eligible listing filter, destination selection, category and restaurant entry points. |
| 3 | `/ng/shop` | `platform/shop/page.tsx`, categories, search and catalogue service; E01. | Country/category permission and delivery coverage filters before count/pagination; preserve current offer pricing. |
| 4 | `/ng/product/[slug]` | `platform/product/[slug]/page.tsx`, variants/ABV/age messaging. | Market-eligible merchant offers, destination availability and authoritative checkout revalidation. |
| 5 | `/ng/stores/wyn-city` | `platform/vendors/[slug]/page.tsx`, Tenant branding. | Stable tenant-ID policy, effective country/category exclusivity; enforce create/publish/read/checkout. Confirm actual slug rather than assuming the display name. |
| 6 | Custom Wyn City domain | E04/E05 integration catalogue/cart/checkout, E17 scoped customer auth, subdomain middleware. | Verified domain mapping or approved external-site integration, channel identity, own payment credentials, shared location reservations, direct fees and account/order communications. Existing external Wyn City deployment was not inspected. |
| 7 | `/ng/gifts` | Product types include gift sets/baskets; gift-card/occasion features. | Independent gift merchant onboarding, catalogue and wrapping/message metadata, parcel allocation/tracking/refunds. Gift cards do not fulfill this page. |
| 8 | `/ng/restaurants` | `platform/venues/page.tsx` and location profiles; E11. | Restaurant capabilities, cuisine, service zones, hours and delivery/collection eligibility. |
| 9 | `/ng/restaurants/[slug]` | Venue detail/menu and POS preparation surfaces; E11. | Prepared food catalogue/modifiers, allergen content policy, kitchen acceptance/preparation, takeaway delivery/collection states and stage-aware cancellations. |
| 10 | `/ng/reservations/[merchantSlug]` | Venue location request forms, owned requests and atomic check-in; E11. | Future time-slot/capacity allocation, overlap and concurrent booking prevention, policy snapshots, deposits/no-show handling. |
| 11 | `/ng/cart` | `platform/cart/page.tsx`, `CartContext`, storefront cart quoting. | Group by merchant/location/fulfillment, quote expiry and country revalidation; explicit policy for mixed food/parcel/reservation baskets. |
| 12 | `/ng/checkout` | `platform/checkout/page.tsx`, order/payment controllers, idempotent integration checkout; E04/E07–E09. | Apply safe idempotent checkout to marketplace path, channel/account selection, policy checks, location stock, provider-certified settlement/recovery. |
| 13 | `/ng/account/orders` | `platform/my-account/orders/`, tracking and current refund/fulfillment fields. | Parent overview plus merchant-private child orders and independent shipments/partial refunds; fix E10 disclosure. |

## Merchant and ERM pages

| Spec page | Proposed surface | Current foundation | Required implementation |
|---|---|---|---|
| 14 | `/business/register` | `platform/vendors/register/`, tenant application and approval. | Separate ERM, marketplace and direct-storefront selections and statuses; country/category/document/payment review. |
| 15 | `/merchant/dashboard` | Existing admin dashboard and effective plan/role gates; E12/E15. | Capability/category/channel-aware entry points; retain tenant authority and apply store permissions consistently. |
| 16 | `/erm/dashboard` | Existing admin analytics, accounting and POS reports. | Original-currency country/store/channel dimensions and reconciled shared measures. `/erm` on platform is currently a public ERM entry surface, not this dashboard. |
| 17 | `/erm/pos` | `admin/pos/sell/`, POS sessions/receipts, staff/location context; E03. | Reuse POS; align shared reservation consumption and immutable channel/account snapshots with online sales. |
| 18 | `/erm/inventory` | `admin/(hydrogen)/inventory/`, WarehouseStock, batches, adjustments, transfers; E03/E06. | One shared online/POS reservation authority, operation ownership/release/reconciliation and cross-channel concurrency proof. |
| 19 | `/erm/purchasing` | `admin/(hydrogen)/purchases/`, supplier orders/bills/receipts/returns; E13. | Preserve receipt-owned stock effects; country money/address settings and v3 cross-channel regressions. Not a rebuild. |
| 20 | `/erm/sales` | `admin/(hydrogen)/sales/`, quotations, reservations, returns, accounting. | Distinguish POS/direct website/marketplace by immutable channel and settlement owner; E14. |
| 21 | `/erm/customers` | Contacts, POSCustomer, scoped integration customer identities; E17. | Explicit marketplace relationship permissions, consent purpose/country and privacy-aware merchant projections. |
| 22 | `/erm/employees` | `admin/(hydrogen)/employees/`, roles, location assignments; E15. | Extend country/store permission coverage; verify new country/channel administration stays privileged. |
| 23 | `/erm/appraisals` | `admin/(hydrogen)/appraisals/`, cycles, peer reviews/exams and access checks. | Preserve existing workflows and sensitive-role boundaries; country/timezone readiness tests. |
| 24 | `/erm/stores` | `admin/(hydrogen)/inventory/locations/`, Warehouse and POS configuration. | ISO market reference, timezone/address rules, operating hours and fulfillment capabilities; avoid a parallel Store stock system. |
| 25 | `/erm/storefronts` | API-key settings/docs and branded tenant/subdomain support; E04/E16/E17. | Storefront management, domain verification/lifecycle, payment onboarding, location/publication selection and channel analytics. |

## UK activation pages

| Spec page | Proposed surface | Current foundation | Required implementation |
|---|---|---|---|
| 26 | `/uk` | Reusable platform homepage components. | Inactive-by-default UK configuration; postcode eligibility, GBP policies and approved listings. |
| 27 | `/uk/shop` | Central Product with many tenant SubProducts; E01. | Postcode-filtered retailer listings, courier eligibility and country-aware price/stock ranking. |
| 28 | `/uk/product/[slug]` | Existing product/offer comparison/variants. | Country/provider restrictions and real postcode delivery quotes per eligible retailer/location. |
| 29 | `/uk/cart` | Standard cart and comparison UI. | New bounded optimization over item allocation, available stock, quoted delivery and mandatory charges; quote expiry, deterministic fallback and manual override. |
| 30 | `/uk/checkout` | Existing multi-tenant item snapshots, payment services. | Approved marketplace provider/connected accounts, GBP money, merchant child orders, fee/refund/settlement allocations and reconciliation. Legacy Stripe is not Stripe Connect. |
| 31 | `/uk/orders/[id]` | Customer order tracking and local Delivery trips; E18. | Shipment-per-merchant tracking with provider event deduplication, labels, independent states and proof capabilities. |

## Platform operations and account pages

| Spec page | Proposed surface | Current foundation | Required implementation |
|---|---|---|---|
| 32 | `/admin/payments` | Accounting payment UI, subscription settings and provider services. | Country/legal-entity/channel account configuration, safe credential references, settlement ownership and immutable reconciliation. |
| 33 | `/admin/delivery` | Delivery/rider operations, shipping zones, shipping methods and routing; E18. | Courier capability adapters, coverage/quotes/booking/labels/tracking, alcohol/age-check configuration, operational failures. |
| 34 | `/admin/global` | Existing admin analytics/accounting. | Country/currency/channel GMV, fees, subscriptions/disputes; original currency plus explicit sourced FX conversion. |
| 35 | `/admin/merchants` | `admin/(hydrogen)/tenants/`, approvals/suspension. | Country/category enrollment and effective exclusivity policy; ERM lifecycle independent from marketplace permission. |
| 36 | `/admin/subscriptions` | `settings/billing`, ERM plan config, Paystack recurring billing/dunning; E12. | Country/currency/versioned configurable plans and approval workflow; preserve existing contracts/trials and entitlement behavior. |
| 37 | `/[country]/account` | `platform/my-account/`, orders, addresses, notifications, reservations, MFA. | Country consent/legal versions, allowed merchant data projections, account-market navigation. Keep tenant-specific website identities scoped. |
| 38 | Country/language/currency controls | Currency fields/exchange-rate tooling, scattered NGN display code; E02/E14. | Market context and language resources; separate display/payment currencies; revalidate rather than silently convert cart. |
| 39 | Country legal/policy pages | Existing `terms`, `privacy-policy`, `returns`, `shipping-info`, `cookie-policy`. | Reviewed country/version/effective-date publishing and consent records; suppress inactive/unapproved policies and alcohol capabilities. |

## URL migration rules

**[Likely]** Decide market URLs once, then implement country-aware layout/context and shared screens. Keep public old URLs working through reviewed aliases or redirects, preserve query parameters, update canonical/hreflang/sitemap and test existing product links. Do not create39 disconnected screens or relocate admin routes merely to reproduce the document's examples. Ensure country context is enforced in the API, not just URL presentation.

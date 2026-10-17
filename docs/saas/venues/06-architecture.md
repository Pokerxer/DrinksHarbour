---
title: Venue domain and API contracts
date: 2026-10-17
status: proposed
---

# Architecture, data and APIs

[Back to the main design](README.md). Target contracts are [Likely] recommendations. All new names below are proposed until an implementation plan fixes exact schema and compatibility details.

## 1. Boundaries and eligibility

Use the current Node/Express/MongoDB backend and Next.js admin/platform apps. Do not create another application per business type. Keep the planned super-admin/tenant-dashboard app separation independent from these venue features.

Separate four inputs:

- **Identity:** `Tenant.businessType` and proposed `businessCapabilities` identify retail/hospitality operations.
- **Configuration:** location services, menus, tables and service periods say what is configured and open.
- **Entitlement:** `resolveEntitlements()` and capability gates say what subscription access permits.
- **Publication:** approved public venue profile and channel flags say what customers may discover/book.

Proposed policy `resolveVenueEligibility({ tenant, location, actor, action, now })` returns `{ allowed, code, bookingMode, capabilities }`. It must be shared by API, staff navigation and public discovery. Do not replace it with `plan === 'venue'` or treat `isBarRestaurant` as permission to use every paid feature.

Preserve existing settings initially: legacy `isBarRestaurant` informs migration and permitted basic POS behaviour. Enforcing new paid gates on existing POS users requires an explicit grandfathering decision; never silently disable their live tables.

Keep existing plan capability names (`table_management`, `guest_crm`, `event_booking`, `bar_inventory`, `pos_realtime`). Add finer capabilities only when a shipped feature requires a new commercial boundary. Multiple arguments to current `requireCapability()` mean ANY, not ALL; composite eligibility needs explicit conjunctive checks.

Keep physical locations abstract. Kitchen/bar preparation stations and seating zones can belong to one existing location without becoming new billable warehouses. Add service-area metadata rather than hard-coding every restaurant as a new location type or charging a location add-on per table/station.

## 2. Entity contracts

Every tenant-owned entity includes Tenant ownership, timestamps, actor audit and relevant location scope. Cross-references must be validated as belonging to the same Tenant and compatible location before write.

| Entity | Decision and minimum data |
|---|---|
| Tenant | Extend identity/capability settings; preserve subscription and revenue authority |
| Warehouse (existing location persistence) | Expose as Location in domain/UI; add venue service configuration or companion profile; preserve stock IDs |
| VenueProfile | Public content, publication/review state, Tenant and location; no KYC or financial secrets |
| POSTable | Add location, zone, supported party/combination rules and version; retain current tab reference |
| Booking | Add location, linked tables/claim, service-session link, request expiry, customer ownership and policy/payment references |
| CapacityClaim | Resource(s), half-open time interval, party/count, hold expiry, status, booking and idempotency key |
| VenueServiceSession | One visit: Tenant/location, business date, Booking if any, table assignment, heldOrderId, billOrderId and version |
| Order | Existing final payable/revenue record; add service-session identity, typed line kinds and immutable pricing/consumption references |
| PaymentAttempt | Provider/reference, purpose, Tenant, payer, amount/currency, verified state and retry key |
| PaymentAllocation | References verified receipt/credit and target bill/session; applied/reversed amount; append-only effects |
| VenueMenu / VenueMenuItem | Location/service publication and SubProduct-linked presentation; no independent price authority |
| RecipeVersion / opened-stock record | Component quantities, yield and version; source stock/batch, remaining amount and consumption history |
| PackageOffer | Sellable SubProduct and included stock/service/admission entitlements; occurrence/time eligibility |
| VenueEvent / EventOccurrence | Reusable event identity and dated service/capacity/policy snapshot |
| Admission | Occurrence, ticket/list/party entitlement, opaque token hash, counts and atomic redemption |
| Tenant guest profile | Extend/link existing POSCustomer identity with consent/preferences and limited visit facts; restricted sensitive notes |

These are logical responsibilities, not instructions to create every collection immediately. Stage them in chapter 8. Reuse an existing payment/credit model only if its ownership, purpose and idempotency semantics fit; do not overload a vendor payment as a guest deposit.

## 3. One visit and one bill authority

`VenueServiceSession` connects a Booking, a walk-in or an event table to the existing held POS Order. The held Order remains the working tab; it is not posted revenue.

At first bill collection, `ensureBillOrder(sessionId, expectedVersion)` freezes the current quote and resolves/creates exactly one final payable Order with a unique service-session key. Preserve accepted service-line prices; freezing the bill must not reprice already-served items using today's menu. `billOrderId` points to that record; `heldOrderId` is operational provenance. Deposit allocation and subsequent payer payments target the final bill, not separate duplicate sales.

After collection starts, further ordered rounds require explicit bill revision/append rules that preserve settled allocations, frozen line history and new stock events. Initially require staff to finish ordering before entering closing/partial-payment mode. Reopening needs manager permission and cannot reduce a bill below valid prior allocations without an explicit refund/credit action.

Both `/api/bookings/:id/checkout` and POS settlement become adapters to this use case for migrated visits. Do not charge both paths, post two revenues, or consume the hold twice. Existing retail and legacy split flows remain on their existing contract until their own compatible migration.

Do not implement canonical venue splitting by sending one ordinary POS sale per payer. Each payer creates a receipt allocation against the same final Order; the balance is authoritative on the server.

## 4. Proposed API groups

`/api/venue-ops` is the proposed new staff namespace. Existing `/api/bookings`, `/api/pos` and `/api/venues` are retained as adapters during migration. Final naming can change in implementation planning; the authority and effect contracts cannot.

| Endpoint | Effect / access |
|---|---|
| `GET /api/venues` | Existing public directory; add pagination/filtering and shared public eligibility |
| `GET /api/venues/:slug/locations/:locationSlug` | Approved public profile only |
| `GET .../menus` | Public published menu projection; compatible pending-product menu policy |
| `GET .../availability` | Fresh options for service date, party size and duration; no promise beyond response validity |
| `POST /api/venues/:slug/bookings` | Existing authenticated customer request; extend to validated location and offer |
| `POST /api/venues/:slug/locations/:locationSlug/holds` | New short-lived claim for instant/reservation payment modes |
| `GET/PATCH /api/me/venue-bookings/:id` | Owner-only booking read/amendment; policy/availability checks |
| `POST /api/me/venue-bookings/:id/cancel` | Owner cancellation command; explicit financial result |
| `POST /api/me/venue-bookings/:id/payment-attempts` | Quote-bound deposit/preorder collection |
| `GET/PATCH /api/venue-ops/locations/:id/profile` | Permission-controlled private profile edit; publish separately |
| `GET/POST /api/venue-ops/menus` | Staff menu management; scoped location and publication |
| `GET/POST /api/venue-ops/recipes` | Recipe definitions; revision creates a new version |
| `POST /api/venue-ops/stock/open` | Atomic sealed-to-opened transformation |
| `POST /api/venue-ops/stock/waste` | Permission/approval-controlled movement with reason |
| `GET /api/venue-ops/reservations` | Staff queue with pagination and service-date filter |
| `POST .../reservations/:id/confirm` | Allocate capacity and apply required payment policy |
| `POST .../reservations/:id/check-in` | Link/create the visit, seat or mark waiting |
| `POST /api/venue-ops/service-sessions` | Walk-in visit creation and optional table claim |
| `POST .../service-sessions/:id/transfer` | Move same visit between allowed tables/servers |
| `POST .../service-sessions/:id/lines` | Validated priced/recipe-aware order lines |
| `POST .../service-sessions/:id/fire` | Idempotent selected-line preparation and stock action |
| `GET /api/venue-ops/preparation` | Station/location-scoped queue |
| `POST .../preparation/:id/transition` | Expected-state transition with role and station validation |
| `GET .../service-sessions/:id/bill` | Server quote/balance and immutable receipt allocations |
| `POST .../service-sessions/:id/collections` | Freeze/resolve bill and initiate validated payment/record tender |
| `POST .../service-sessions/:id/close` | Check balance, preparation and table-reset requirements |
| `POST .../bills/:id/refunds` | Authorised asynchronous refund request; no implied restock |
| `GET/POST /api/venue-ops/events` | Event templates and occurrences managed separately |
| `POST .../admissions/:id/check-in` | Atomic count redemption against the right occurrence |

Public event read/list and purchase endpoints are added only in the event phase. Existing Paystack callbacks/webhook routes remain the provider ingress and dispatch verified events by stored payment purpose, never by untrusted metadata alone.

## 5. Mutation protocol

Collection, confirmation, admission, preparation and stock commands require an `Idempotency-Key`. Store Tenant + operation + key + request hash + result. Same key/same input replays; same key/different input returns conflict. Define retention beyond supported retry/reconciliation windows before launch.

Mutable visits/tables/bills use `expectedVersion`. Return `409 STATE_CHANGED` with a safe refresh instruction if another device changed state. Other stable errors include `CAPACITY_UNAVAILABLE`, `HOLD_EXPIRED`, `STOCK_UNAVAILABLE`, `PAYMENT_PENDING`, `SUBSCRIPTION_READ_ONLY` and `PLAN_UPGRADE_REQUIRED`.

Quote responses include `quoteId`, version, currency, item/fee/tax/deposit breakdown and expiry. Commands reference the quote; clients do not provide authoritative prices, commission, tax, Tenant or balances. Validate all types, ID formats, limits, ownership and service times before side effects.

## 6. Capacity and transaction safety

A query for overlapping bookings followed by an insert is not safe under concurrency, even inside a transaction if competing operations never update a common conflict record.

For table-time allocation, serialise claims through one shared resource-version document per physical table within the transaction, re-read active overlaps, then write the claim. The common conflict record spans service dates so midnight cannot split overlapping bookings into unrelated locks. Multi-table claims touch all relevant resource documents in stable order. Retry transaction conflicts with bounded attempts. Use half-open intervals `[start,end)` including cleanup buffer.

For event capacity, atomically claim counts against a shared occurrence counter, with separate category caps and an overall room cap. Link VIP included admissions to that same counter. Persist allocation/release effects with unique keys so expiry/cancellation cannot decrement twice.

Treat hold expiry in every availability/confirmation operation using server time. TTL deletion is cleanup, not the booking clock or the only mechanism returning capacity. Cancellation and expiry preserve financial references and audit history.

MongoDB deployment must support the required transactions. Test concurrent real requests against a replica set; mocked service tests cannot prove these properties.

## 7. Isolation and public access

Staff Tenant authority comes from verified JWT context via existing helpers. Every resource query includes ownership and applicable location/assignment constraints; never trust `body.tenantId`, `x-tenant-id` or an arbitrary object reference. Platform cross-tenant support uses existing explicit admin routes and audit; own-tenant venue routes do not gain a silent admin bypass.

Public routes may resolve a target Tenant from an approved slug because customers legitimately book venues outside a staff Tenant. This is target selection, not staff authority. Customer reads/mutations additionally require owner identity or a restricted guest-session token; an opaque URL is not sufficient on its own for broad access.

Use explicit public DTO projections. Exclude costs, recipes, bank details, KYC, internal notes and other guests. Tenant guest profiles never become a shared global customer list. Restricted allergy/access notes need defined access, retention and consent handling; do not put them in generic analytics or AI prompts.

Reuse the existing effective-permission resolver and deny rules, then apply location/assignment and entitlement constraints. A grant cannot override resource ownership. Return a non-enumerating 404 for another Tenant's resource. Audit profile publication, booking/capacity overrides, table transfers, fired cancellations, stock adjustments, manual tenders, refunds, policy/permission changes, guest exports and platform support access. Record actor, Tenant/location, reason, correlation key and safe before/after values. Preserve existing privileged-audit retention; define operational/guest-data retention separately and redact sensitive notes/payment tokens from audit payloads.

## 8. Realtime, notifications and deployment

Publish only after durable commit. Use an outbox or equivalent persisted retry record for preparation, booking notifications and payment follow-up. Reconnect always fetches current server state; realtime messages are hints, not ledger entries.

Use token-derived Tenant/location/station subscriptions and recheck access on reconnect. Rate-limit public availability, booking, scans and payment attempts; QR tokens must be high-entropy, expiring and revocable.

Retain current host map: main/tenant storefronts in platform, dashboards in admin. Unknown venue/location returns 404; unknown hosts do not fall through to another Tenant. Preserve host-only auth cookies and sanitised platform-rendered tenant content. No arbitrary tenant scripts or parent-domain authentication cookies are introduced. Wildcard DNS, HTTPS and routing remain deployment prerequisites, not features assumed complete.

Sensitive records and private pages use `no-store`. Published content caches include Tenant/location/version; invalidation occurs on publication, suspension and menu change. Scheduled hold expiry, payment recovery and event jobs must work independently of a browser staying open.

## 9. Reference-feature contracts

The [shared integration chapter](12-integration-contracts.md) extends this architecture with floor/layout, service presets, stations/devices/print jobs, guest profile/consent, conversations, staged imports and operational readiness. It maps all R01–R18/N01–N18 feature groups to existing files and proposed focused services.

All features obey the current Tenant/JWT boundaries, SubProduct price authority, resource-version capacity claims, canonical final Order and existing stock/accounting services. Its additional API commands and post-commit events complement this chapter; they are not a parallel restaurant/nightlife backend.

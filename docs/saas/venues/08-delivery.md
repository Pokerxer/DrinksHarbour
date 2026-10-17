---
title: Venue delivery roadmap and acceptance
date: 2026-10-17
status: proposed
---

# What to create and in what order

[Back to the main design](README.md). This is a phased design handoff, not an approved coding plan. Recommendations are [Likely]; duration and staffing estimates are intentionally not invented.

## 1. Priority and release boundaries

| Phase | Deliverable | Dependencies and completion gate |
|---|---|---|
| 0 — reconcile foundations | Shared eligibility; compatibility decisions; location and visit identity; canonical bill/allocation contract | Audit current callers; agree paid-feature continuity and commission policy; prove one visit cannot create two bills |
| 1 — venue experience | Venue workspace, location profiles, beverage menus, request reservations, floor/host workflows and public detail pages | Reuse existing tables/kitchen; requests never claim instant availability; migrate visit billing before enabling collection on migrated visits |
| 2 — reliable bookings and money | Atomic table capacity, deposit credit, minimum-spend policy, exact bill splits and recovery | Concurrency and reconciliation tests; approved policies, account mappings and refund handling |
| 3 — restaurant and bar production | Prepared drinks/food, modifiers, station routing, recipes, opened bottles and waste | Product-kind compatibility, stock adapter, preparation-time consumption and staff allergy handoff verified |
| 4 — club operations | Event occurrences, guest lists, door, shared room capacity, VIP offers and optional paid tickets | Table/deposit/package foundation; atomic admissions, cancellation/refunds and pilot validation |
| 5 — optimisation | Advanced reports, forecasting, optional self-order and scheduled pickup; later integrations | Clean data and measured operator demand; separate plans for delivery, custody and complex production |

Release a useful request-only discovery/service experience before instant booking and ticketing. A pilot restaurant may need phase 3 to run its full food operation; phase 1 is not advertised as a complete restaurant-management replacement.

## 2. Proposed implementation file map

Create only files needed for the active phase. Naming is a recommended split; recheck nearby instructions and current working-tree changes before fixing an executable plan.

```text
server/
  services/venue/
    README.md                      domain boundaries and invariants
    eligibility.js                 business/config/plan/publication policy
    locations.js                   existing Warehouse IDs exposed as locations
    reservations.js                 Booking/claim/visit orchestration
    capacity.js                     transaction-safe table/event allocation
    service-sessions.js             visit, held-tab and canonical bill linkage
    billing.js                     one final Order, quote and balance authority
    payment-allocations.js          verified receipts, advances and reversals
    preparation.js                 frozen rounds and station transitions
    menu.js                        publication and service availability
    recipes.js                     immutable recipe versions and quantities
    inventory.js                   existing movement service adapters
    admissions.js                  guest list and occurrence redemption
  controllers/venue/                small request/response adapters by concern
  routes/venue-ops.routes.js        staff commands and permission wiring
  models/                          additive schemas introduced phase by phase
  __tests__/                       policy, HTTP, concurrency and adapter tests

client/apps/admin/src/
  app/(hydrogen)/venue/             venue route group and page composition
  app/shared/venue/
    dashboard/                     shift and exception overview
    reservations/                  host queue, timeline and amendments
    floor/                         table list/map and visit actions
    service/                       waiter order entry and rounds
    menus/                         menu sections, choices and publication
    recipes/                       component editor and costing
    preparation/                   kitchen/bar station interfaces
    billing/                       bill review, collections and credit
    events/                        occurrences, guest lists and door
    profile/                       public content and service settings
  services/venue/                  typed API clients by concern

client/apps/platform/src/
  app/venues/[slug]/               venue/location/menu/reservation pages
  app/events/                     discovery and occurrence pages, later phase
  app/account/reservations/        customer-owned management
  components/Venues/
    directory/                     server-backed filters and venue cards
    profile/                       gallery, facts, location and policies
    menu/                          sections, choices and eligibility
    reservation/                   dates, quote, deposit and confirmation
    events/                        guest-list/admission/table options
  lib/venue/                      serialisable contracts and API adapters
```

Preserve and adapt existing `booking.service.js`, `tableCheckout.service.js`, POS controller routes and `VenuesDirectory.tsx`. Extract into the proposed folders gradually; do not duplicate pricing, inventory or settlement implementations.

Use MongoDB/Mongoose and CommonJS on the current backend, typed TypeScript on the frontend, current validation conventions, existing permissions and existing accounting/payment services. No Odoo runtime, new orchestration framework or multi-agent system is required.

## 3. Compatibility and migration

1. Inventory all current venue-mode users, plan entitlements, active bookings, held Orders, table assignments and payment obligations before enabling flags.
2. Add nullable location/session/version fields and new indexes compatibly. Identify duplicate candidates before building unique indexes.
3. Assign legacy records to an explicit verified location. Where the business has multiple plausible locations, mark for operator review; do not silently choose a default that moves stock or guests.
4. Backfill session links with a dry-run report and stable idempotency keys. Do not infer a POS tab and a Booking are the same visit merely because names or times look similar.
5. Establish a unique final-bill key for migrated sessions and re-route both collection entry points together. Preserve already-paid orders, receipts, historical commission and stock effects.
6. Upgrade readers before writers emit new status/line kinds. Keep old pending booking values compatible during migration.
7. Pilot per Tenant and location behind explicit flags; observe a full opening/service/closing cycle before expanding.
8. Rollback disables new commitments and returns to compatible readers. It does not delete payment receipts, admissions, allocations or stock consumption created during the pilot.

Respect already-running services and unrelated edits in the current working tree. No commits, migrations, live data edits or deployment are authorised merely by this design document.

## 4. Acceptance scenarios

| Area | Required proof before its release |
|---|---|
| Shop regression | Retail-only Tenant keeps normal POS/storefront; venue UI and food offers do not leak into retail discovery |
| Entitlement | Exact plan name is not the public gate; configured custom/eligible plans work; forbidden capabilities are denied through direct API calls |
| Isolation | Tenant A cannot query/mutate B's tables, menu, visit, recipe, stock, payment or admission using IDs, headers, slug or socket subscription |
| Location scope | A staff member assigned to one location cannot operate another location's tables/stations; profile roles remain constrained |
| Requests | Customer sees pending after a request; venue decline/expiry releases claims and communicates the real outcome |
| Capacity race | Two simultaneous claims on one overlapping table cannot both confirm; combined tables and buffers block all resources |
| Hold expiry | Expired claims stop blocking even before TTL cleanup; a late payment cannot revive sold capacity automatically |
| Visit uniqueness | Check-in retries and POS/booking checkout races resolve one visit, one payable Order and one set of stock effects |
| Recipe stock | 750 ml → two 50 ml pours + 20 ml waste leaves 630 ml; sealed source cannot also be sold; invalid unit conversions fail |
| Cancellation | Before-fire cancellation releases reservations; after-fire cancellation preserves consumption and approved waste history |
| Package stock | Included bottles/mixers and admissions are allocated once; table capacity and physical stock failure are compensated visibly |
| Allergies | Required choices validated; staff receive relevant warnings; ingredient changes do not falsely certify allergen-free preparation |
| Preparation race | Repeated fire/transition commands do not duplicate rounds or stock; stale screens get conflict and refresh |
| Payment identity | Wrong reference, amount, currency, provider state or purpose cannot settle; signature failures do not mutate money |
| Deposit allocation | One deposit is applied once across repeated collection requests; deposit receipt and redemption do not double revenue |
| Minimum spend | Both chapter 7 examples reconcile; tax/tips/ineligible charges do not falsely meet the minimum |
| Split collection | Exact remainder allocation; partial success survives retry; simultaneous devices cannot claim the same outstanding balance |
| Refund | Full/partial/cumulative refunds never exceed original refundable credit; original commercial shares reverse; no automatic cooked-food restock |
| Admission | Reused token, wrong event and excess party count fail; VIP guests share the overall occurrence cap |
| Business date | Friday-night service after midnight stays in the correct configured service date; overseas booking targets venue-local time |
| Connectivity | Browser refresh/reconnect recovers committed state; unknown payment remains pending; public/private cache boundaries hold |
| Subscription lapse | New commitments follow policy while safe settlement/refund of prior obligations remains possible without a broad bypass |
| Accessibility | Reservation, menu, bill and door search work without colour-only status, hover, map dragging or mandatory camera input |

Use pure tests for money, units and state rules; HTTP tests for auth/ownership; real MongoDB replica-set integration tests for competing allocations; and browser tests for full customer/staff journeys. Write failing behavioural tests before each implementation slice, then verify the intended failure and passing behaviour.

Focused baseline command:

```sh
cd server
node --test __tests__/booking.test.js __tests__/posVenueGate.test.js __tests__/posTableModel.test.js __tests__/posTableCrud.test.js __tests__/posKitchenRounds.test.js __tests__/tableCheckout.test.js
```

Run the full backend suite before an implementation release using `node --test '__tests__/*.test.js'` and the relevant client checks. The design-session evidence is not a substitute for future integration/production checks.

## 5. Pilot and operational acceptance

Pilot one restaurant and one lounge/club if available. Observe actual staff workflows instead of assuming identical operations. Record menu complexity, service hours, station responsibilities, payment channels, network reliability, table turnover, package handling and end-of-shift reconciliation.

Agree measurable acceptance with the operators before release: no unexplained duplicate receipts/consumption, no oversold tables/admissions in test scenarios, traceable manual adjustments, recoverable pending payments and a shift-close report that reconciles. Response-time targets and device/printer support need a measured deployment baseline; no benchmark is promised here.

Track preparation latency, claim conflicts, expired holds with payments, unapplied deposits, stale tablets, refund failures and stock variance. Alerts must include a safe operator action and avoid guest/payment secrets.

## 6. Decisions before enabling affected features

| Decision | Recommended default | Needed before |
|---|---|---|
| Catalogue scope | Add prepared-beverage/food kinds while preserving SubProduct selling identity and channel separation | Any food/cocktail recipe sale |
| Paid access | Preserve existing Venue tier and resolve features by capability; explicitly grandfather legacy mode where needed | New entitlement rollout |
| Acquisition commission | Distinguish platform-sourced service from direct/walk-in; use versioned Tenant terms | New venue payment/fee release |
| Deposit/minimum policy | No charge before request acceptance; explicit time-bound terms and excess-credit handling | Deposit/minimum collection |
| Refund/tax/account ownership | Approved account mappings, funding responsibility and reviewed local terms | Any new financial obligation |
| Admission and age policy | Venue/jurisdiction-specific checks; placeholder gate never claimed as complete compliance | Alcohol ordering or paid admission launch |
| Location limits/add-ons | Reuse existing allowances initially; do not invent new shop/warehouse fees for tables or kitchens | Multi-location venue sales |
| Connectivity support | Online authority for capacity, deposits and admissions; scoped offline service only where proven | Offline product claims |
| Sensitive guest data | Minimal tenant-scoped data, narrow roles, retention/consent policy and audited exports | Guest CRM/allergy notes/marketing |
| Hosting/realtime | Reuse existing transport with polling fallback; validate persistent transport for station promises | Realtime service SLA |

These decisions do not block reading or refining the design. They block selling the corresponding unsupported promise. After review, create small executable implementation plans per phase, each with exact schema changes, call sites and failing acceptance tests.

## 7. Design-session verification

See [the resume file](../../superpowers/specs/RESUME-venue-design.md) for executed checks and limitations. Application code is unchanged by this documentation work; no claim is made that the proposed acceptance scenarios already pass.

## 8. Reference expansion and feature coverage

The target now includes all **R01–R18 restaurant** and **N01–N18 nightlife** groups mapped in chapters [10](10-restaurant-integration.md) and [11](11-nightlife-integration.md). Chapter [9](09-reference-evidence.md) records evidence/unknowns; chapter [12](12-integration-contracts.md) maps services, data, commands, events and seven integrated acceptance journeys.

Use chapter 12's delivery placement to include floor editing, presets, courses, devices, guest communication, branding, import tooling and staff UAT within the phases above. QR browsing and hosted reservation entry can arrive early; transactional self-order, kiosks and partner adapters follow their shared bill/capacity/provider dependencies. No feature row may be marked delivered solely because a corresponding settings flag or proposed endpoint exists.

## 9. Phase 0 implementation plan

[Exact Phase 0 plan](../../superpowers/plans/2026-10-17-venue-phase-0.md) records the 17 October 2026 code audit, file/schema/service changes, task-by-task failing tests, rollout boundaries and decisions. User has selected paid eligibility before migration, 9% on future platform-sourced venue service with no new direct/walk-in commission, and narrow completion after subscription lapse. The proposed Phase 0 establishes foundations without live canonical collection; scope and public-listing compatibility remain review decisions. This link does not authorise application implementation or live migration.

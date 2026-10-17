---
title: Venue current-state audit
date: 2026-10-17
status: code-inspected
---

# What already exists and what is missing

[Back to the main design](README.md)

## Verified baseline [Certain]

Evidence is the current working tree, including existing uncommitted work. This is not a production audit. Preserve unrelated edits and re-read these files before implementation.

| Area | Inspected evidence | Existing behaviour |
|---|---|---|
| Business type | `server/models/Tenant.js` | Includes Restaurant, Bar / Lounge, Nightclub / Club, Hotel and retail types |
| Venue mode | `server/services/posVenue.service.js` | Restaurant, Bar / Lounge and Nightclub / Club are venue presets; POS handlers check `posSettings.isBarRestaurant` |
| Subscription | `server/config/erm-plans.js` | Venue plan has table management, guest CRM, event booking, bar inventory and realtime POS capability names; ₦150,000/month and 0.09 commission rate |
| Tables | `server/models/POSTable.js`, `server/controllers/posTable.controller.js` | Tenant tables, sections, seats, status and active held-Order reference |
| Open tabs | `server/controllers/pos.controller.js` | Table claims, held carts and settlement linkage already exist |
| Preparation | Same controller; `pos-kitchen-board.tsx`, `pos-kitchen-panel.tsx` | Fired-round snapshots and forward preparation states; standalone and compact interfaces |
| Bill allocation UI | `pos-split-helpers.ts`, `pos-split-modal.tsx` | Item/unit allocation and sequential payer sales; only final payer carries table settlement context |
| Reservations | `server/models/Booking.js`, `server/services/booking.service.js` | Guest, party size, date, duration, table label, source and status transitions |
| Staff booking routes | `server/routes/booking.routes.js` | Authenticated own-tenant access and `table_management` entitlement |
| Public venue API | `server/routes/venue.routes.js` | Lists at most 100 approved active-subscription Tenants whose plan is exactly `venue`; authenticated booking requests |
| Public website | `client/apps/platform/src/app/venues/page.tsx`, `src/components/Venues/VenuesDirectory.tsx` | Directory, text/city filters, expandable request form and feedback |
| Booking bill | `server/services/tableCheckout.service.js` | Checked-in booking checkout, stock reservation, Paystack verification, accounting and completion; commission fixed at 9% |
| Physical stock | `server/models/Warehouse.js`, `WarehouseStock.js`, `WarehouseBatch.js` | Existing locations, stock and batches; Warehouse is currently the location persistence model |
| Revenue agreements | `server/utils/revenueAgreement.js`, `docs/memory/revenue-agreement-pricing.md` | Current merchandise agreement rules distinguish commission and markup; historical shares are snapshots |

Capability names are not proof that a complete guest-list or event-ticketing module exists. No recipe, ingredient or event-admission implementation was established by this inspection.

## Important gaps and consequences [Certain → Likely]

### 1. Venue identity and paid access are inconsistent

The POS uses a setting, bookings use a capability, and public discovery tests an exact plan value. Consequently these paths do not share one eligibility definition. A custom-plan business may have relevant entitlement without matching the directory's exact plan filter.

**Recommendation:** maintain business identity, location capabilities, subscription entitlements and public publication as separate inputs to one eligibility policy.

### 2. Bookings do not reserve physical capacity

The inspected Booking model uses `tableLabel`, not a POSTable reference or location, and creation does not atomically allocate a time interval. A successful request is not proof of a free table.

**Recommendation:** preserve request mode initially. Introduce location/table allocation, opening sessions, turnover buffers and atomic capacity claims before claiming instant confirmation.

### 3. Booking checkout and POS tabs are separate paths

Booking checkout creates an Order from selected sizes. POS uses held Orders and table bindings. No common visit identity linking both was established in these paths.

**Recommendation:** introduce a service-session link and authoritative bill facade. Both paths must find the same visit bill before collecting money. This is a prerequisite for deposits and cross-device partial payments.

### 4. Stock depletion is designed for units, not full hospitality consumption

Existing booking checkout reserves selected item quantities and consumes at completion. Measured pours, perishable ingredient recipes and preparation waste need a different consumption trigger.

**Recommendation:** keep sealed-item support, then add a recipe/portion inventory adapter. Never infer that creating a “50 ml” Size automatically depletes an opened 750 ml bottle correctly.

### 5. Current splits are not an authoritative shared outstanding balance

The inspected UI splits whole units among payers and submits separate sales sequentially. Its “equal” allocation approximates amounts by distributing units; it is not exact monetary division.

**Recommendation:** retain this tool where appropriate, but introduce server-side bill balances and allocation records before promising exact equal-value splitting, cross-device settlement or deposit redemption.

### 6. Existing data lacks the full venue presentation contract

The directory selects only `_id`, name, slug, logo, description and city. It cannot establish an event schedule, table availability, bookable package inventory or a complete venue menu.

**Recommendation:** add approved public venue profiles and location pages with dedicated response projections. Replace the customer-facing “Venue tier” badge with venue type or a truthful service label.

### 7. Existing realtime has deployment limits

`server/services/pos.realtime.js` explicitly tolerates no Socket.IO server on serverless deployments. Its kitchen room is tenant-wide, not location/station-specific.

**Recommendation:** support authenticated location/station subscriptions and reconnect refresh. Use a persistent backend or managed realtime transport if required; preserve polling when no socket is available. Hosting changes need a separate operational decision.

## Reuse boundaries

- Retain Tenant ownership, JWT authority, SubProducts, Sizes, stock movement records, accounting entries, audit logs and Paystack integration.
- Keep existing held Orders as the initial open-tab implementation. Add typed service metadata and version checks rather than replacing the POS in one release.
- Keep Booking and POSTable as the initial reservation/table entities. Add missing references and constraints compatibly.
- Reuse current staff permission machinery; define venue permissions inside that catalogue.
- Reuse menu/combo presentation where useful, but validate component inventory, location, prices and tenancy before treating a POS combo as a bookable package.
- Do not interpret the historical August design's “pending implementation” text as current truth: table, kitchen and split code is now present.

## Verification boundary

Existing booking, venue-gate, table-model, table-CRUD, kitchen-round and booking-checkout tests are the focused baseline for this documentation session. Record the actual result in the [session handoff](../../superpowers/specs/RESUME-venue-design.md).

No browser run, live venue observation, production inventory reconciliation or real payment was performed for this design. Passing mocked tests does not prove reservation race safety or hospitality readiness.

## Reference-expansion audit [Certain]

`Tenant.posSettings` already declares tip, preparation printer/display, customer display, IoT and other hardware flags. POS controller allow-listing can persist several such settings. These fields do not establish functional device drivers, kiosk ordering, two-way guest messaging or station delivery.

`POSCustomer` already stores Tenant ownership, tags, notes, loyalty, wallet and price-list references. Extend that identity for hospitality rather than adding an unrelated guest database. Because tags already affect price-list targeting, new marketing/service tags need a separate namespace and explicit eligibility mapping.

Further source evidence and feature-to-code mapping are in [chapter 9](09-reference-evidence.md). The editable floor, course policy, station/device contracts, guest messaging and shared allocation ledger are target extensions, not newly verified existing behaviour.

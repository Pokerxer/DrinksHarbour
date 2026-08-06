# Logistics Dispatch & Delivery Module

**Date:** 2026-08-03
**Route:** `/logistics` (admin)
**Status:** approved, implementation pending

## Problem

`/logistics` already exists but is 100% Isomorphic template demo. All 41 files under
`client/apps/admin/src/app/shared/logistics/` are `@ts-nocheck` with hardcoded arrays
modelling an international freight company: a Fleet Status pie chart (20 available /
18 in maintenance / 35 on the move), "Costs $57,890", "Top Shipment **Countries**",
complaint-rate and complaint-reason charts. None of it reads the database.

DrinksHarbour is last-mile drinks delivery in Abuja from Wyn City, Maitama. The data
that actually exists is on `Order`:

- lifecycle `pending → confirmed → processing → shipped → delivered` with
  `confirmedAt` / `processingAt` / `shippedAt` / `deliveredAt`
- `shippingAddress` including `coordinates.latitude/longitude` and `landmark`
- `shippingInfo`: `distanceKm`, `zone`, `zoneLabel`, `routeType`, `stops`, `daysMin/Max`
- `shippingMethod`: `standard | express | pickup | partner_delivery`
- `fulfillmentStatus` — a per-tenant `Map` of tenantId → status

There is no `Shipment`, `Driver`, `Vehicle`, or `Route` model anywhere on the server.

## Scope

Build a real dispatch module: two new server models, a service + REST API, and rebuild
`/logistics` as a live dispatch board. Add a driver CRUD page. The demo
`/logistics/shipments`, `/logistics/tracking` and `/logistics/customer-profile` pages are
**out of scope** and stay as they are, but their sidebar links are hidden so the fake
pages are not reachable from navigation alongside a real module.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Driver representation | standalone `Driver` collection with an **optional** `user` ref | most riders are contractors who never log in; the optional ref still allows a rider self-service view later without a migration |
| Unit of dispatch | a **trip** with an ordered list of order stops | real Abuja runs are 3–5 drops per rider; a 1:1 Delivery-per-Order design cannot represent batching without rework |
| Vehicles | fields on `Driver`, no `Vehicle` model | enough for a fleet-mix widget without a third collection; riders are not rotated across a shared pool |
| Order status sync | automatic, through the **existing** order status path | see "The inventory constraint" below |
| Page role | KPI strip **plus** working dispatch board | sub-pages are deferred, so the module must be operable from this one page |

## The inventory constraint

`orderController.updateOrderStatus` is not a plain field write. It carries side effects:

```js
if (status === 'shipped' && previousStatus !== 'shipped')
  inventoryService.commitShipment(stockItems, order._id, actorId);
else if (status === 'cancelled' && previousStatus !== 'cancelled')
  inventoryService.isShipped(previousStatus)
    ? inventoryService.restoreStock(...)
    : inventoryService.releaseReserve(...);
```

If the delivery module set `order.status = 'shipped'` directly, dispatching a trip would
ship goods **without decrementing stock or releasing the reservation** — silently
corrupting inventory, in the same family as the Size-stock double-count incident.

**Therefore:** extract the transition body of `updateOrderStatus` into
`services/orderStatus.service.js` as `applyOrderStatus(order, status, actorId, opts)`,
covering timestamp stamping and the inventory calls. `orderController.updateOrderStatus`
becomes a thin HTTP wrapper (validation, tenant scoping, response). `delivery.service.js`
calls the same function. One code path, one set of side effects.

This is the only change to existing server code.

## Data model

### `models/Driver.js`

```
tenant        ObjectId → Tenant   required, index
user          ObjectId → User     optional — riders who do have a login
name, phone, email
vehicle:      { type: bike|tricycle|car|van|truck, plateNumber, capacityKg }
licenseNumber, licenseExpiry, licenseDocUrl
status        available | on_trip | off_duty | suspended
currentLocation { lat, lng, updatedAt }
isActive, notes, createdBy
```

Indexes: `{ tenant: 1, status: 1 }`, `{ tenant: 1, isActive: 1 }`,
`{ tenant: 1, phone: 1 }` unique.

### `models/Delivery.js` — a trip

```
tenant, deliveryNumber            "TRIP-000123", sequential per tenant
driver        ObjectId → Driver
status        draft | assigned | dispatched | in_progress | completed | cancelled
scheduledFor, dispatchedAt, completedAt
zone, zoneLabel                   dominant zone across stops
stops: [{
  order       ObjectId → Order
  sequence    Number
  addressSnapshot, zone, zoneLabel, coordinates { lat, lng }
  status      pending | delivered | failed
  deliveredAt, failureReason
  proofOfDelivery { recipientName, note, photoUrl, capturedAt }
  codExpected, codCollected
}]
totals        { stopCount, distanceKm, codExpectedTotal, codCollectedTotal }
codSettlement { status: pending|settled, amount, settledAt, settledBy, notes }
createdBy, notes
```

Indexes: `{ tenant: 1, deliveryNumber: 1 }` unique, `{ tenant: 1, status: 1 }`,
`{ tenant: 1, driver: 1 }`, `{ tenant: 1, scheduledFor: -1 }`.

### Index discipline

Neither `deliveryNumber` nor driver `phone` carries a field-level `unique: true`.
Uniqueness is expressed **only** as the compound index including `tenant`. A field-level
unique would enforce global uniqueness across tenants and break the second tenant's first
trip — exactly the `poNumber_1` failure already fixed once in this repo. Mongoose never
drops a de-declared index nor re-options an existing one, so getting this wrong the first
time requires a migration script to undo.

`deliveryNumber` is generated the same way as `poNumber`:
`TRIP-${String(lastSeq + 1).padStart(6, '0')}`, scoped to the tenant.

## Status transitions

| Trip event | Effect on orders |
|---|---|
| `dispatch` | each stop's order → `shipped` (fires `commitShipment`); driver → `on_trip` |
| stop → `delivered` | that order → `delivered`; its `fulfillmentStatus` entry for the tenant updates |
| stop → `failed` | order stays `shipped`; `failureReason` recorded on the stop |
| `complete` | trip → `completed`; driver → `available` |
| `cancel` (pre-dispatch only) | stops released back to the unassigned queue |

A trip may only be dispatched from `assigned` (driver set, ≥1 stop). Stops may only
transition from `pending`. Cancelling a dispatched trip is not supported in v1.

## API

`routes/delivery.routes.js` and `routes/driver.routes.js`, both mounting
`protect → attachTenant → requireOwnTenant`, matching `warehouse.routes.js`.
This is tenant-owned data: tenant comes from the JWT claim only — no `?tenant=` or
`x-tenant-slug` pivot, no client-supplied `tenantId`, no platform-admin bypass.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/deliveries/dashboard` | KPI aggregation in one call |
| GET | `/api/deliveries/unassigned` | orders `confirmed`/`processing` not already on an active trip |
| GET | `/api/deliveries` | trip list, filterable by status / zone / driver / date |
| POST | `/api/deliveries` | create trip from selected orders |
| GET/PATCH | `/api/deliveries/:id` | detail; edit driver, schedule, stop sequence |
| POST | `/api/deliveries/:id/dispatch` | dispatch |
| PATCH | `/api/deliveries/:id/stops/:stopId` | deliver / fail, with POD and COD collected |
| POST | `/api/deliveries/:id/complete` | close trip |
| POST | `/api/deliveries/:id/settle-cod` | reconcile rider cash |
| — | `/api/drivers` | full CRUD + deactivate |

COD is **derived, never entered**:
`codExpected = paymentMethod === 'cash_on_delivery' && paymentStatus !== 'paid' ? totalAmount : 0`.

### Dashboard KPIs

Due today, out for delivery, late (past `daysMax` and not delivered), delivered today,
average delivery time (`deliveredAt − shippedAt`), COD outstanding, active drivers,
plus a zone breakdown and delivery-method mix.

## Client

`client/apps/admin/src/app/shared/logistics/`:

- `api.ts`, `types.ts` — mirroring the POS module's pattern, over `src/lib/api-client.ts`
- `dashboard/` — **replaces** the 13 demo widgets:
  - `index.tsx` orchestrator
  - `kpi-cards.tsx`
  - `unassigned-orders.tsx` — queue, zone-filterable, multi-select
  - `trip-card.tsx`, `stop-row.tsx` — active trips with per-stop actions
  - `assign-trip-drawer.tsx` — pick driver, pull selected orders, sequence, dispatch
  - `pod-modal.tsx`, `cod-summary.tsx`, `zone-filter.tsx`
- `drivers/` — list + create/edit drawer

Deleted: `avg-delivery-time`, `complaint-rate`, `complaint-reason`, `delivery-status`,
`dispatch-planning`, `fleet-status`, `loading-workflow`, `open-sales-order`, `profit`,
`stat-cards`, `top-customer`, `top-shipment-countries`, `shipment-table`.

New route `routes.logistics.drivers` → `/logistics/drivers`, with a sidebar entry.
The Shipments / Track Shipment / Customer Profile sidebar links are commented out; the
pages and routes remain for whoever rebuilds them.

New components are written without `@ts-nocheck` and must not add to the admin tsc
baseline (461 errors).

## Testing

Server tests are `node:test`, run with `node --test '__tests__/*.test.js'` — `npm test`
is broken. Baseline is 939/942 with 3 known pre-existing failures (1 pricelist populate,
2 SO-number). New tests:

- `applyOrderStatus` fires `commitShipment` exactly once per order on dispatch
- dispatch is rejected from `draft` and from a trip with no driver or no stops
- a stop may only transition out of `pending`
- COD totals: derived correctly, excluded for prepaid orders, summed per trip
- two tenants can each hold `TRIP-000001` (the compound-index guard)
- `requireOwnTenant` rejects a cross-tenant trip read

Test stubs of `auth.middleware` must export `requireOwnTenant`, or every route file
importing it throws at require time.

## Out of scope

Route optimisation, live GPS tracking, customer-facing tracking pages, rider mobile app,
third-party courier integration, and rebuilding the three deferred demo sub-pages.

---
title: Odoo-informed restaurant functionality integrated into DrinksHarbour
date: 2026-10-17
status: proposed-integration
---

# Restaurant functionality and current-system integration

[Main design](README.md) · [Evidence ledger](09-reference-evidence.md) · [Shared integration contracts](12-integration-contracts.md)

Feature labels reference official evidence O1–O4; target behaviours below are **[Likely] DrinksHarbour requirements**, not claims about Odoo's internals. Existing foundations D1–D10 are defined in the evidence ledger. `Extend` means partial infrastructure exists, not that the complete feature works today.

## 1. Complete feature mapping for the reviewed scope

| ID | Capability / evidence | Current anchor | Required integration | Acceptance |
|---|---|---|---|---|
| R01 | Restaurant mode/start screen · O1 | D1, D4 | Venue workspace plus location/user Tables/Register preference; server eligibility remains authoritative | Retail unchanged; venue lands in its configured permitted view |
| R02 | Floor configuration · O1 | D2, D4 | Layout metadata, editor, rooms/zones, geometry, image, clone/archive and seat validation | Editing layout preserves live tab/resource identity |
| R03 | Floor navigation/status · O1 | D2–D4, D6 | Number lookup, floor filters, arrivals, overdue and preparation cues | Viewing a table alone never seats/charges someone |
| R04 | Resource bookings · O1 | D2, D6, D10 | Booking-to-table/combined-resource capacity and POS host panel | Overlapping combined-table confirmations cannot both win |
| R05 | Table/named orders · O1 | D3–D5 | Walk-in, named standing tab and later seating through one visit | Assigning a table retains all existing line/payment references |
| R06 | Transfer/merge · O1 | D2–D5 | Atomic whole-tab transfer, controlled joins and selected-line movement | No duplicate firing, stock usage, credit or bill revenue |
| R07 | Courses · O1 | D3, D4 | Ordered course groups and explicit fire/hold/reassign rules | Kitchen receives each accepted line once at its release point |
| R08 | Service presets · O1, O3 | D1, D3, D8 | Location service policy wrapping existing pricing/tax and preparation capacity | Dine-in/pickup context is server-owned and snapshotted |
| R09 | Preparation printers · O1 | D1, D3, D9 | Registered station devices, category routes, cancellation/reprint jobs | Retry/reprint is identifiable and does not add a new order |
| R10 | Preparation display · O2 | D3, D4, D9 | Location/station queues, timers, per-line progress and safe corrections | One station cannot complete another station's work |
| R11 | Item-based bill split · O1 | D5, D6 | Shared bill allocations; keep exact equal-value split as our enhancement | All payer receipts reconcile to one payable Order |
| R12 | Bill/receipt/invoice · O1 | D3, D5, D8 | Unpaid bill preview, final receipt, scoped invoice adapter and reprints | Preview never claims payment; invoice never posts revenue twice |
| R13 | Tips · O1 | D1, D3, D5 | Preserve existing gratuity collection and add staff/shift allocation policy | Tip remains outside merchandise commission and food margin |
| R14 | QR menu · O4 | D10; menu proposal | Public table/location menu, printable/downloadable QR assets | Public code exposes no guest identity, tab or payment authority |
| R15 | Mobile ordering · O4 | D3–D6; visit proposal | Scoped guest session, validated menu/choices and payment timing | Duplicate submit yields one line set and one preparation effect |
| R16 | Kiosk · O4 | Platform menu/checkout proposal | Locked location/service UI, per-order collection, handoff and reset | Next guest cannot recover prior guest/order/payment details |
| R17 | Customer status board · O2 | D4, D9 | Anonymised pickup references and derived progress; stale status indication | No guest names, allergy notes, spend or ticket tokens on board |
| R18 | Self-order configuration · O3, O4 | D1; branded platform | Locale, safe links, images, preview and open-service gating | Closed service browses only; branding cannot execute tenant scripts |

## 2. Floor and seating contract

Add logical `VenueFloor` and `TableLayout` responsibilities scoped by Tenant/location. `POSTable` remains the physical table and claim identity. Layout holds `floorId`, `x`, `y`, `width`, `height`, `shape`, `colour` and optional approved background asset; a visual clone creates new IDs and never copies an occupied tab, QR session or future claim.

Keep seats, active/inactive and resource combinations in operational configuration rather than treating geometry as capacity. Background images are decorative; a map/list equivalent and keyboard edits are required. Save with version checks; a waiter opening a tab must not race with an administrator deleting its table.

Archive used resources rather than deleting historical references. Deny retirement while active visits/future obligations exist unless an explicit reassignment flow resolves them. Existing tenant-wide table-name uniqueness needs migration planning before location-scoped numbering is allowed; a floor filter alone does not change the index.

Clicking opens details. Explicit “Seat party” or “Open tab” claims occupancy. This is our chosen interaction, preventing accidental seating during staff inspection. Overdue arrivals and upcoming reservations are computed overlays, not mutually exclusive physical table statuses.

## 3. Tabs, movement and course contract

Each accepted line has stable `lineId`, visit, original quote/price, serving/choices, course, station, fired quantity and consumption references. A visual move changes ownership/assignment through a command; it does not clone a line or reset its preparation history.

Use distinct operations:

- **Move visit:** transfer the same visit to free tables in the same location after capacity validation.
- **Join parties:** group visits operationally while keeping bills, deposits and payer privacy separate by default.
- **Consolidate bills:** explicit manager action only before either bill has collections/finalised financial effects; otherwise retain bills and offer coordinated payment views. Do not rewrite a paid sale.
- **Move selected lines:** allow unfired/unpaid quantities between compatible visits with explicit repricing consent if context differs. Initially block fired or allocated lines; later support only through traced amendment rules.
- **Release table:** require no unresolved occupants/tab commitment and an explicit reset outcome; never cancel a paid booking as a side effect.

Give courses an order and release state; rounds are individual sends. Reassign unfired lines freely within the visit, but already-fired items require a station-visible correction. A transfer to the same source is an idempotent no-op or validation error, never a tab cancellation.

## 4. Presets and scheduled service

Proposed `VenueServicePreset` holds location, allowed mode, price-list reference, tax-context reference, service zone, hours/exceptions, required contact/guest fields, payment timing and preparation-slot policy. It refers to existing price/tax authorities; it contains no independent price calculator or automatic tax-rate rule.

Start with dine-in and counter pickup. Delivery appears only after real dispatch/radius/support capability exists. A “delivery” label is not a courier integration. Members/VIP presets require server-verified eligibility and existing price-list targeting, not a customer-selected discount switch.

Seat capacity and preparation capacity are separate. A free table does not prove the kitchen can accept twenty new orders. Slot claims need server-owned limits and idempotent release. Scheduled items carry `dueAt` and a preparation release time; accepting tomorrow's order does not print it as today's immediate work.

## 5. Station and hardware contract

Represent `PreparationStation` with location, allowed service/menu categories, assigned staff/device IDs, stage policy and alert thresholds. Extend the current fired-round path instead of creating a second queue disconnected from held Orders.

Keep semantic pending/preparing/ready/served states stable; stations may configure labels and timers, not bypass financial/stock invariants with arbitrary terminal stages. Corrections append `from`, `to`, actor, reason and original transition reference. Resetting a display does not unconsume ingredients. A remake is a new preparation/consumption action with an explicit waste/complimentary policy.

Bulk actions list affected versions and fail/reconcile changed items; they never blindly wipe tickets. Clearing completed work removes it from active display, retaining service/audit history. Include category/service-time filtering, accessible card density and stale/reconnect states.

`PreparationPrintJob` stores job ID, station, line revision, action type, device, acknowledgement and attempts. Use category routing and readable delta tickets. A cancellation after firing generates an amendment/cancel notification requiring staff acknowledgement. Manual duplicate output is visibly labelled and points to the original job.

Current `preparationPrinters`, `eposPrinter`, `iotBox` and terminal settings are configuration fields, not proof of working device drivers. Register and test an approved local bridge/device adapter before enabling hardware controls. Never let a public browser or arbitrary tenant-supplied URL turn the backend into a general network printer scanner.

## 6. Billing, tips and documents

Keep one canonical payable Order per visit and separate payer allocations. Item-based split views reference the same underlying lines, taxes and prior payments. Equal-value splitting remains a DrinksHarbour requirement; it is not attributed to the reviewed Odoo item-split workflow.

Unpaid bills/pro-formas and paid receipts have distinct titles/status. Reprinting keeps the same document identity with duplicate metadata. Link a customer invoice using the existing accounting document source/reference rules, after verifying Tenant ownership and totals. Creating the invoice does not create another sale, payment or stock movement.

Use current tip support and keep gratuity separate from service charges. If a guest adds a tip after paying, collect a separate authorised amount and record its allocation; do not silently increase a completed Paystack charge. Vendor-specific US terminal post-authorisation behaviour is not adopted as Nigerian capability.

## 7. Mobile, kiosk and customer display

Three modes are explicit: browse only, order with staff/cashier settlement, and order with verified online settlement. A long-lived public QR code identifies a location/table for browsing; joining an actual visit requires a short-lived server-authorised session or staff approval. Rotating visit authority does not require reprinting a table menu sign.

For pay-after-meal, submit lines to the shared visit under configured staff/credit policy. For pay-per-order, freeze a chargeable batch within that visit, verify payment and release only those lines for preparation; append later batches as bill revisions with preserved allocations. Initial implementation may lock further ordering while that batch is unresolved. It must never create a second sale for already-collected lines at final tab close.

Kiosk sessions are location/device-bound, clear private state after completion/timeout and expose staff recovery without payment credentials. Cashier payment is labelled unpaid until the cashier records it; a kiosk “cash” tap cannot mark an order settled. Use Paystack-supported flows only after validation; no imported Stripe/Adyen/IoT promise.

Public pickup boards show short-lived order aliases, not personal identifiers. Optional received/ready messages use the shared notification outbox and consent/channel policy. Branded menu links allow safe approved HTTPS destinations, appropriate tenant scope and no executable HTML; translation changes labels but never prices, item identity or allergens.

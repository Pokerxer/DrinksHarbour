---
title: Venue operating workflows
date: 2026-10-17
status: proposed
---

# How the businesses operate

[Back to the main design](README.md). Requirements below are [Likely] recommendations; operational examples are [Guessing] until validated with pilot venues.

## 1. Configure the actual operation

Onboarding asks what the business does, then which services each location offers. Presets suggest settings but do not grant paid capabilities.

| Profile | Recommended starting tools | Optional tools |
|---|---|---|
| Restaurant | Reservations, floor, waiter orders, kitchen/bar routing, courses, bills | Takeaway, pre-orders, private dining, deposits |
| Bar | Walk-in tabs, bar preparation, pours, shift cash | Food, seating reservations, tabs with deposits |
| Lounge | Seating zones, groups, bottle packages, bar, minimum spend | Events, food, guest lists, private rooms |
| Club | Event calendar, door, guest lists, capacity, VIP tables, bottle service | Tickets, promoter attribution, food |
| Hybrid | Explicitly selected venue tools plus retail tools | Different profile per location and service period |

A lounge may serve food by day and operate nightlife services at night. Use service periods and menus rather than forcing a single business-type switch each evening.

## 2. Daily restaurant workflow

1. **Before service:** manager opens the shift, verifies the floor and opening hours, checks bookings, assigns servers, confirms menu availability and preparation stations, and records opening stock/cash.
2. **Arrival:** host finds the booking or records a walk-in, confirms party size and relevant requests, and seats the party. A walk-in creates a visit without requiring a customer account or advance booking.
3. **Order:** waiter opens the visit's tab, adds dishes and beverages, required choices, paid extras, seat numbers and allergy notes. Confirm potentially unsafe substitutions with staff; software does not certify food safety.
4. **Preparation:** send only the selected unfired items. Kitchen and bar see their own items, instructions and promised order, without bank data or broad customer history.
5. **Courses:** send starters immediately, hold mains until released, track readiness and record served items. “Ready” and “served” are different states.
6. **Changes:** distinguish an unsent edit from cancelling a fired dish. Fired cancellations notify the station, require a reason and may create waste; never silently erase preparation evidence.
7. **Bill:** preview the bill with taxes, service charge and any deposit allocation. Split by item, seat or exact amount using the shared balance. A table stays occupied while money remains due.
8. **Close:** confirm settlement or an approved receivable, record departure, clean/reset the table and release it for the next party. Financial settlement alone does not prove the table is physically ready.

Counter-service takeaway uses the same menu, preparation and settlement rules with a pickup identifier instead of a table. Delivery requires separate fulfilment scope and must not be enabled by default.

## 3. Bar and lounge workflow

1. Open a table, seat, standing-party or named walk-in tab; record a server and optional spending limit.
2. Order drinks in rounds. An open tab is operational state, not an unpaid sale posted repeatedly to accounting.
3. Route cocktails and sealed bottles to the relevant bar station. Track modifiers such as single/double and mixer selections.
4. Validate package components and stock before accepting a bottle-service order. An included mixer is not a second free-stock pool.
5. Open bottles against a specific location stock unit when measured pours are enabled; record servings, waste and remaining quantity.
6. Support table transfer and server handover with permission and an audit trail. A transfer moves the same visit; it must not duplicate the tab or deposits.
7. Warn when a configured spend limit is approached. Manager overrides are explicit; a warning is not a payment guarantee.
8. Settle, reconcile tips and close the visit. Track any approved retained-bottle balance separately, with custody and disposal policy, only in a later release.

Minimum-spend commitments need a live meter: eligible spend, remaining minimum, deposit already paid and amount currently due. A table priced “₦200,000 minimum spend” must not appear as a ₦200,000 table fee unless it is genuinely an additional hire fee.

## 4. Nightclub workflow

### Before opening

Create a dated event occurrence with start/end time, admission rules, room capacities, table allocations, available packages, guest-list cutoff and cancellation policy. One recurring event template produces distinct occurrences; Friday's ticket cannot admit someone on Saturday.

Allocate shared spaces across admission modes. VIP table guests, guest-list arrivals, paid-ticket guests and walk-ins all affect the same relevant physical capacity. Selling a table must not create extra room capacity.

### Door operation

- Search or scan an opaque admission token; show event, party allowance, admission status and necessary staff instructions.
- Use atomic check-in to stop two devices redeeming the same admission simultaneously.
- Record admitted count, remaining party allowance, arrival time and staff identity. Do not allow a party booking for six to admit unlimited guests.
- Distinguish a reservation, an event ticket and guest-list eligibility. A list entry is not guaranteed admission unless its terms say so.
- Handle age/identity checks, capacity refusal and management exceptions with explicit reasons. Do not imply that a checkbox replaces staff checks.
- Track exits and re-entry according to a configured policy; use occupancy counters distinct from lifetime ticket scans.
- Show minimal personal data at the door. Promoters can see only assigned list entries and permitted totals, not the venue's customer database.

### During and after service

Host checks in the group and seats it at its allocated table. Waiter serves against the same visit, package entitlement and deposit. Door check-in alone must not redeem bottle stock.

Manager monitors admissions, table commitments, bar queue, cash and incidents. At close, reconcile admitted guests, table bills, issued bottle components, waste, complimentary items, tips and promoter attribution. Promoter payouts require separately agreed rules and approval; attribution is not automatic debt.

## 5. Reservation rules

| Concept | Required behaviour |
|---|---|
| Request | No guaranteed seat; staff acceptance or rejection has a response deadline |
| Capacity hold | Short-lived allocation with explicit expiry; prevents competing allocations |
| Confirmation | Valid capacity allocation and any required verified deposit |
| Arrival | Grace period, no-show handling, changed party size and approved reassignment |
| Seating | Table assignment consistent with seats, zone and overlapping bookings |
| Completion | Visit finished; linked financial obligations are settled or explicitly transferred |

Offer request mode first. Instant mode is enabled per location/service period only after capacity rules pass concurrency tests.

Availability must account for opening exceptions, event overrides, duration, cleanup buffer, blocked tables, party size, allowed table combinations, lead time and booking horizon. Tables combined for a group block every constituent table. Prevent overlaps using resource allocation, not `Booking.status` alone.

Booking modifications are amendments: check new capacity before releasing old capacity, preserve policy/payment history, and collect or refund a difference only after explicit confirmation.

## 6. Separate lifecycles

Use independent status dimensions so “paid” does not mean “seated” or “served.”

| Record | Proposed progression |
|---|---|
| Booking | requested → awaiting_payment or confirmed → checked_in → completed; rejected/cancelled/no_show are explicit terminal outcomes |
| Capacity allocation | held → confirmed → released; held → expired |
| Visit | open → closing → closed; exception review for abandonment or disputes |
| Table | available → occupied → cleaning → available; blocked and inactive are separate conditions |
| Preparation item | pending → preparing → ready → served; cancellation uses a reason and acknowledgement |
| Bill | open → partially_settled → settled; controlled adjustments/refunds remain linked |
| Admission | issued → checked_in; cancellation/refund/re-entry are separate rules |

These proposed values require compatible migration; existing Booking uses `pending`, and POSTable lacks `cleaning`. Do not deploy new enums without reader compatibility.

## 7. Shift, inventory and exceptions

Assign a business date and venue timezone. A club service starting Friday at 22:00 and ending Saturday at 04:00 belongs to one configured service day. Store UTC instants and show local times; do not group all reporting by UTC midnight.

Opening, mid-shift and closing counts should cover sealed bottles, opened bottles, draught where applicable, key perishables, cash and payment exceptions. Approve variance adjustments separately from sales.

Operational exceptions need usable queues: overdue requests, late deposits, failed payments, late arrivals, duplicate scans, stockouts, failed station delivery, stale terminals, abandoned tabs, refunds in progress and unreconciled cash. A manager must see an owner, next action and recorded outcome for each.

If connectivity fails, show last-sync time and stop making authoritative promises about live capacity or another device's balance. Locally queue only idempotent commands supported by the server. Do not confirm paid reservations or redeem deposits offline. Printer delivery needs an acknowledgement/retry identifier; replay must not produce an unnoticed duplicate preparation ticket.

## 8. Expanded operational requirements

The [restaurant integration chapter](10-restaurant-integration.md) defines the exact target behaviour for floor editing, named tabs, table/line transfers, controlled party joins, course release, presets, station corrections and guest self-ordering. Viewing a table is distinct from claiming it; presentation corrections never reverse ingredient consumption automatically.

The [nightlife integration chapter](11-nightlife-integration.md) adds the setup/readiness process, private/public capacity allocation, waitlist offers, guest recognition, communication inbox, channel attribution, data import and role-specific practice. Every entry point uses the [shared contracts](12-integration-contracts.md); none creates a competing booking or money path.

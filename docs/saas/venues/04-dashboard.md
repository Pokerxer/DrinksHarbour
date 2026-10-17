---
title: Venue dashboard experience
date: 2026-10-17
status: proposed
---

# The venue dashboard

[Back to the main design](README.md). This chapter specifies [Likely] product and interaction recommendations, not new implemented screens.

## 1. Give venues a different workspace

Use the existing admin app initially. Venue operators land in a hospitality workspace instead of the retail sales overview. Shared finance, purchasing, staff and inventory remain reusable modules.

The active Tenant, location, service date and shift stay visible. A business with retail and hospitality can switch workspaces without changing identity or sharing another location's table state.

Recommended primary navigation:

```text
Today / Tonight
Reservations and waitlist
Floor and service
Menus and offers
Kitchen and bar
Events and door                 when enabled
Guests                         permission controlled
Stock and recipes
Purchases
Bills and payments
Reports
Staff and permissions
Venue profile and settings
```

Use “Today” for restaurants and “Tonight” for nightlife presets. Menu names describe staff work; do not show Product/SubProduct terminology to waiters or customers.

## 2. Key screens

| Screen | Essential content | Primary action | Critical failure state |
|---|---|---|---|
| Today/Tonight | Arrivals, covers, occupied tables, pending requests, delayed preparation, unpaid bills and exceptions | Open service / continue shift | No location, closed service, stale data |
| Reservations | Timeline/list, party size, status, deposits, zones, notes and source | Confirm request / create walk-in | Capacity conflict or missing verified payment |
| Floor | Zones, table labels, seats, occupied duration, server, ready items and outstanding balance | Seat party / open tab | Another device changed table |
| Service tab | Seats, courses, ordered/fired/served items, modifiers, allergy notes and running bill | Send selected items | Stale version, stockout, station unavailable |
| Kitchen/bar | Station queue, timers, table/pickup, course, changes and acknowledged cancellations | Start / ready / served | Reconnect, unacknowledged ticket, printer failure |
| Menus | Sections, publication, schedules, locations, item availability and preview | Publish menu / mark sold out | Invalid recipe/price or wrong location |
| Recipes/stock | Components, units, yields, opened stock, batches, counts and variance | Receive / open bottle / record waste | Insufficient component or invalid conversion |
| Events | Occurrences, capacities, guest lists, VIP allocations and admissions | Publish occurrence | Capacity or refund obligations unresolved |
| Door | Search/scan, party allowance, admission and current occupancy | Admit guest | Used code, wrong event, offline, capacity reached |
| Bills | Items, payments, deposit credit, split allocations, fees, refunds and amount due | Collect balance | Unknown gateway result or existing collection |

No decorative KPI should imply data the backend cannot establish. A “live” badge requires a recent verified refresh. Show empty, loading, denied, unavailable and error states for every screen.

## 3. Layout contracts

### Floor and service

```text
Location · Friday service · Shift · Connection / last sync
Zones and service filters                  Arrivals / waitlist
-------------------------------------------------------------
Table list or floor map                    Selected table
T1   4 guests   42 min   server A           Party / booking
T2   Available                             Open tab / notes
VIP1 Deposit paid · not arrived             Ready items / amount due
-------------------------------------------------------------
Primary action: Seat / Open tab / Continue service
```

Provide a table-list alternative to the visual map. A floor plan is a schematic, not an architectural safety drawing. Dragging a table never changes capacity or merges financial records without an explicit action.

### Waiter order screen

```text
Table T1 · 4 guests · Assigned server · Visit reference
Menu categories    Search / item availability    Current order
Menu item choices                              Seat / course
                                               Unsent items
                                               Sent items
                                               Send selected
Running total · Deposit credit · View bill
```

Large touch targets and quick repeat-round entry matter more than product-administration controls. Avoid refreshes that discard unsent work; preserve a draft while forcing stale server state to be reconciled before submission.

### Customer bill review

Show item subtotal, discounts, fees, tax, minimum-spend adjustment, tip, applied deposit, previous payments and amount due as distinct lines. “Pay” must never conceal an extra minimum-spend charge.

## 4. Staff roles and permissions

| Role | Allowed by default | Restricted |
|---|---|---|
| Owner/tenant admin | Configure business, finance, staff and authorised locations | Other tenants; platform catalogue approval |
| Venue/location manager | Service configuration, tables, requests, limits, approved refunds/waste | Other locations unless assigned; changing platform terms |
| Host | Reservations, waitlist, seating and arrival | Cost prices, payouts, bulk customer export |
| Waiter | Assigned visits, orders and served status | Refunds, stock adjustment, customer-list export |
| Bartender/chef | Assigned station queue and relevant instructions | Full guest profiles, finance and menu price changes |
| Cashier | Bills, payment collection and assigned shift | Unapproved refunds, own permission elevation |
| Door/security | Event admission, capacity and necessary identity result | Order history, costs and broad guest contact lists |
| Promoter | Assigned list, attribution and limited agreed reports | Other promoter lists, settlement and full guest CRM |
| Stock controller | Assigned-location receipt, transfer, count and waste requests | Sales discounts, staff rights and bank details |

Map these to the existing permission catalogue, not an unrelated role hierarchy. Proposed permissions include `venue:profile:write`, `venue:reservations:manage`, `venue:floor:manage`, `venue:orders:write`, `venue:preparation:update`, `venue:admissions:scan`, `venue:bills:collect`, `venue:refunds:approve`, `venue:stock:adjust` and `venue:guests:export`.

Each permission also has location/assignment constraints. A generic POS PIN must not automatically give kitchen or door staff cashier powers. Apply step-up authentication to sensitive refunds, exports and bank-account changes through existing authentication policy.

## 5. Settings and onboarding

Collect venue types, location address/map, timezone, service hours, exceptions, contact details, public images, cuisine/music tags, accessibility facts, admission/age policy, table zones, preparation stations, booking policy, allowed payment channels and menu services.

Publish only after an operator previews the public page and completes the minimum required data. Display a checklist: profile, hours, venue services, staff permissions, tables, active menu, payment setup and policy review. Do not expose bank/KYC uploads on public pages.

Business-type presets may suggest settings but may not silently enable public booking or upgrade billing. Show exactly which features the paid plan unlocks. Existing work must remain accessible for settlement and refund handling when new bookings are disabled after subscription lapse.

## 6. Reports that help run service

Report covers and table turns, booking acceptance/no-show rates, average eligible spend per cover, time seated, order-to-ready and ready-to-served duration, sold-out demand, recipe usage and waste, gross/discount/net item sales, channel commission, unapplied deposits, cash variance and outstanding bills.

Define denominators and exclusions in tooltips. Do not compare restaurant table turns with club admissions as if they were the same metric. Revenue excludes tax, tips and unapplied deposits. Missing cost stays labelled, not presented as zero-cost profit.

Use the venue's configured business date and allow a location filter. Drill down to underlying visits, bills or movements. No invented occupancy, popularity, star ratings or sales figures.

## 7. Design and accessibility

Reuse existing design tokens and primitives. The distinctive operational element is a service timeline connecting arrival, preparation and settlement, not a new decorative dashboard theme. Restaurant and nightlife presets can change content emphasis without separate CSS systems.

Use readable light surfaces for management, optional dim station mode, tabular numbers, labels/icons in addition to status colours, visible focus and at least 44 px touch targets as a design target. Floor editing, timers, modals and door scanning need keyboard/manual alternatives. Never require animation, hover or a map drag to complete a core task.

Keep components focused: venue shell, shift summary, reservation timeline, floor list/map, service tab, station queue and bill review. Target 200–300 lines per implementation file; extract policy calculations from UI components.

## 8. Additional integrated surfaces

Add floor-layout editing, course/preset controls, station/device setup, print-job recovery, pickup-display controls and self-order/kiosk preview as specified by [R01–R18](10-restaurant-integration.md). Keep them within this workspace and the existing POS; a separate restaurant admin product is unnecessary.

Add onboarding/readiness, requests/waitlist offers, guest profiles/tags, assigned inbox, consent/campaign drafts, safe imports and staff practice as specified by [N01–N18](11-nightlife-integration.md). Navigation and actions remain permission/capability scoped; campaign approval is not permission to export the customer database.

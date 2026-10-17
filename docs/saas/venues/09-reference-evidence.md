---
title: Odoo and SevenRooms reconstruction evidence
date: 2026-10-17
status: documentation-based-reconstruction
---

# Reference evidence and reconstruction boundaries

[Main design](README.md) · [Restaurant integration](10-restaurant-integration.md) · [Nightlife integration](11-nightlife-integration.md) · [System integration contracts](12-integration-contracts.md)

## 1. Method and scope

The user requested reverse-engineering of the linked Odoo 19 restaurant and SevenRooms nightlife functionality into the DrinksHarbour design. This pass reconstructs capabilities from official public documentation and maps them to inspected DrinksHarbour source. It does not claim access to either company's private implementation.

The `reverse-engineer-anything` skill requires observations, inferences and unknowns to remain distinct. It also says ordinary source-repository analysis should use repository tools rather than binary-analysis readiness commands. No binary, application package, authenticated account or traffic capture was supplied; no REA runtime trace, decompilation or authenticated product test was performed. Installing an analysis server would not supply that missing evidence.

**[Certain]** evidence below establishes documented capabilities or inspected local code only. **[Likely]** integration requirements in chapters 10–12 are our proposed implementation. **[Guessing]** covers local policy, unverified provider support and unstated vendor internals. No source justifies claiming full commercial-product parity.

“Integrated” means functionality implemented through DrinksHarbour's existing services and apps. Connecting to an actual Odoo database or SevenRooms account is a different, conditional adapter project requiring API contracts, credentials and commercial access. Neither service becomes a mandatory runtime dependency.

## 2. Official source ledger

Read on 17 October 2026. Odoo's `19.0` documentation branch and public onboarding pages are mutable; the URLs and section names identify what was read, not a pinned software build. Summaries below are deliberately compact. Chapters 10–12 specify our own behaviour rather than reproducing the manuals.

| ID | Source and inspected section | Documented observation [Certain] | Coverage limit |
|---|---|---|---|
| O1 | [Odoo restaurant documentation source](https://raw.githubusercontent.com/odoo/documentation/19.0/content/applications/sales/point_of_sale/restaurant.rst): start screen, floors, booking, orders, printing, bills, tips | Floor editing, resource bookings, named tabs, transfers/merges, courses, category printers, item splits, invoicing and tips | Public manual; neither application code nor a running Odoo deployment was traced |
| O2 | [Odoo preparation documentation source](https://raw.githubusercontent.com/odoo/documentation/19.0/content/applications/sales/point_of_sale/extra/preparation.rst): configuration, interface, status screen | Category/POS routing, stages, timers, filters, per-item progress, recall/reset, clearing and customer pickup display | Documentation may describe separately packaged modules; availability in Community is not established |
| O3 | [Odoo presets documentation source](https://raw.githubusercontent.com/odoo/documentation/19.0/content/applications/sales/point_of_sale/extra/presets.rst): preset form and application | Sale-mode settings combine price/tax context, hours, scheduling capacity, identification and guest count | No Nigerian tax treatment is established by these examples |
| O4 | [Odoo self-order documentation source](https://raw.githubusercontent.com/odoo/documentation/19.0/content/applications/sales/point_of_sale/extra/self_order.rst): configuration and use | QR browsing/ordering, kiosks, service/payment modes, branding, languages and preparation handoff | Vendor device/provider support is not a DrinksHarbour compatibility guarantee |
| S1 | [SevenRooms nightlife onboarding](https://sevenrooms.com/newcustomer/nightlife/): setup, training, payments, private line, events and client data | Guest lists, VIP/table service, requests, event offers, guest tags, POS-linked insights, marketing and private messaging | Public overview establishes feature categories, not private schemas or algorithms |
| S2 | [SevenRooms account setup](https://sevenrooms.com/newcustomer/settings/): required settings, channels, payments and POS | Role/floor/availability configuration, language/widgets, imports and partner integrations | Partner availability is market/account-specific; no Nigeria integration entitlement inferred |
| S3 | [SevenRooms training](https://sevenrooms.com/newcustomer/training/): managers, hosts and marketers | Role-specific learning, practice/UAT, waitlist handling, offers, auto-tags and guest-feedback workflows | Training indexes are visible; linked videos/manuals were not independently inspected |

The original Odoo HTML page timed out during the first design pass. This pass successfully read the official documentation repository source, including the linked preparation, presets and self-order pages. It replaces the earlier search-excerpt-only limitation for those documents.

## 3. SevenRooms help-centre boundary

Attempts to follow official links for floor settings, availability, data transfer and event creation did not return usable detail. Do not infer hidden field names, capacity algorithms, import formats, list quotas, cancellation rules or API routes from those link labels.

The requirements for atomic capacity, exact bill balances, secure imports and messaging consent are DrinksHarbour design choices. They are not represented as reconstructed SevenRooms internals. The public “enhanced settings” link is not evidence that every setting behind it has been covered.

The reference also names booking-channel, payment and POS partners. Preserve those as conditional integration categories; do not create an imitation partner catalogue suggesting those relationships already exist for DrinksHarbour.

## 4. Inspected DrinksHarbour anchors

Paths below are repository-relative implementation evidence, not external APIs.

| ID | Files | Observed foundation |
|---|---|---|
| D1 | `server/models/Tenant.js`; `server/services/posVenue.service.js`; `server/middleware/plan.middleware.js` | Business type, restaurant flag, POS settings and paid capability checks |
| D2 | `server/models/POSTable.js`; `server/controllers/posTable.controller.js`; `server/routes/pos.routes.js` | Table records/CRUD and protected open-tab/preparation routes |
| D3 | `server/controllers/pos.controller.js` | Holds, table settlement, fired rounds, preparation transitions, tips and settings allow-list |
| D4 | Admin `point-of-sale/components/pos-table-strip.tsx`, `pos-table-map-modal.tsx`, `pos-kitchen-board.tsx`, `pos-kitchen-panel.tsx` | Table selection/map and kitchen interfaces; editable geometry not established by the current map component |
| D5 | Admin `point-of-sale/components/pos-split-helpers.ts`, `pos-split-modal.tsx`, `pos-payment-modal.tsx` | Item/unit splitting and payment/tip UI; shared venue allocation ledger still proposed |
| D6 | `server/models/Booking.js`; `server/services/booking.service.js`; `server/services/tableCheckout.service.js`; booking routes | Booking lifecycle and separate table-booking checkout |
| D7 | `server/models/POSCustomer.js`; `server/services/loyalty.service.js`; `server/services/platformLoyalty.service.js` | Tenant customer tags/loyalty and separate platform points ledger |
| D8 | `server/services/posTax.service.js`; `server/services/tax.service.js`; CustomerInvoice/CustomerPayment models | Existing financial services to extend through validated adapters, not proof of every venue invoice scenario |
| D9 | `server/services/pos.realtime.js`; notification/email services | Realtime/notification foundations; settings flags do not prove hardware or SMS/WhatsApp delivery |
| D10 | Platform `VenuesDirectory.tsx`; `server/routes/venue.routes.js` | Current public directory and authenticated request flow |

Admin component paths above are relative to `client/apps/admin/src/app/shared/`; the platform component is `client/apps/platform/src/components/Venues/VenuesDirectory.tsx`.

## 5. Questions answered and still unknown

| Investigation question | Outcome |
|---|---|
| What should the restaurant workflow include? | Answered at documented capability level; R01–R18 map it into the current system |
| What should nightlife onboarding/operation include? | Answered at public capability-category level; N01–N18 map it into the current system |
| Can the current system provide the shared foundation? | Existing anchors identified; important billing, capacity and station gaps remain explicit |
| Are these commercial products fully replicated? | No; private/runtime behaviour and exhaustive product catalogues are outside the evidence |
| Can foreign partner devices/APIs work here? | Not established; conditional adapter acceptance is required |
| Have the proposed extensions been implemented? | No; this pass updates Markdown requirements and integration contracts |

The detailed chapters define acceptance conditions for each feature so future implementation can prove outcomes rather than claiming parity from a checkbox or a screenshot.

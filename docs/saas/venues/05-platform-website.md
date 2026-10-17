---
title: Customer venue discovery and commerce
date: 2026-10-17
status: proposed
---

# The customer-facing platform website

[Back to the main design](README.md). These are [Likely] recommendations for `client/apps/platform`, covering both the main marketplace and venue subdomains.

## 1. Make the customer intent explicit

The platform should support “Shop drinks” and “Find a venue” as distinct primary journeys. Venues are not simply more sellers in the product grid. Restaurant bookings, event attendance and sealed-bottle delivery have different fulfilment promises.

Preserve the existing multi-tenant merchandise cart for ordinary goods. Use a venue visit context for one Tenant, one location and one occurrence/service time. Scheduled food pickup/delivery, when later enabled, has its own fulfilment context. Never silently combine incompatible contexts into one payment.

The same user account can access shopping orders, reservations and event admissions through separate account tabs.

## 2. Proposed route map

Routes below are targets, not existing route claims. Keep `/venues` and evolve it compatibly.

| Main-site page | Job |
|---|---|
| `/venues` | Discover restaurants, bars, lounges and clubs |
| `/venues/[slug]` | Tenant venue overview; select location if multiple |
| `/venues/[slug]/locations/[locationSlug]` | Definitive location, services, hours, menus and booking entry |
| Same location path + `/menu` | Browse location/service menus |
| Same location path + `/reserve` | Request or instant-book a visit with policy and price review |
| `/events` | Find published dated experiences |
| `/events/[eventSlug]/[occurrenceId]` | Occurrence, admission and eligible table offers |
| `/account/reservations` | Customer-owned booking management |
| `/account/reservations/[reference]` | Booking, payments, changes, pre-orders and support |
| `/account/tickets` | Issued event admissions, where enabled |
| `/visit/[opaqueToken]` | Short-lived, scoped guest service/bill access; no indexing |

On `<slug>.drinksharbour.com`, the homepage adapts to enabled services. A venue opens with location, menu and reservation CTAs; a shop retains its store. Hybrid businesses offer an explicit Shop / Visit choice. Use the same services and component contracts, not a separate venue backend.

## 3. Discovery page

Start with city/area, visit date/time, party size and venue type. Add cuisine, music/experience, price band, accessibility attributes and “takes reservations” only when those fields exist and are maintained. Use list-first browsing; a map is optional, with list parity.

Venue cards show a real cover image, name, type, area, relevant service time, transparent price label, booking mode and primary action. The public does not need a “Venue tier” subscription badge.

Truthful labels:

- “Request a table” when staff acceptance is required.
- “Tables available at 8:30 pm” only from a fresh authoritative availability response.
- “Deposit from ₦X” means an advance credit, with remaining payment explained.
- “Minimum spend ₦X per table” identifies the scope and inclusions.
- “Menu from ₦X” must identify what that amount buys; do not conflate it with a package or admission price.

Support server pagination and filters; the existing capped list of 100 Tenants is not a scalable discovery API. Order sponsored listings transparently. Do not fabricate reviews, claim “open now” without service-hour logic, or use “best” as a factual ranking without evidence.

## 4. Venue/location detail page

Recommended desktop composition:

```text
Photo gallery · Restaurant / Lounge / Club · Area
Name · concise description · verified public facts
-------------------------------------------------------------
Menu / Experiences / About / Location / Policies | Plan your visit
Real menu sections and service schedules        | Date and time
Upcoming dated events                           | Party size
Amenities and access information                 | Zone / offer
Map / address / directions                       | Price / deposit
Cancellation and admission terms                 | Request / Reserve
-------------------------------------------------------------
Contact/support · related eligible venues
```

On mobile, use a short sticky action bar with the actual selected time/price summary. Do not cover menu content with a permanent oversized booking widget.

Required content: public photos, location address, hours/exceptions, menu, available services, policies, access needs, contact path and customer support. Family dining and nightlife need different content emphasis; never apply “late-night alcohol” copy to all restaurants.

Expose accessibility claims only as supplied/verified facts with a correction path. Do not imply a generic icon proves step-free access.

## 5. Reservation journey

1. Select location, service date/time and party size; server returns request mode or available options.
2. Select zone, table category or offer. Explain whether the exact table is guaranteed.
3. Show seating duration, admission implications, deposit, minimum spend, exclusions, taxes/fees and cancellation terms before commitment.
4. Identify the customer using the existing account flow. Browsing stays public. Preserve the chosen context across sign-in.
5. Create an idempotent request or short-lived capacity hold. A request returns “Awaiting venue confirmation,” not “Booked.”
6. Collect any required payment only when capacity is safely allocated. A verified payment and confirmation policy determine the final outcome.
7. Show confirmation, reference, arrival instructions, policy snapshot and remaining balance. Customer receives transactional confirmation through configured channels; do not promise a channel that is not integrated.
8. Offer change/cancel/support actions according to policy. Late payment, hold expiry or a capacity failure after payment produces a visible recovery/refund outcome.

Do not use a browser-local datetime as the venue timezone implicitly. Show `Africa/Lagos` venue-local time for the Abuja pilot and send an unambiguous UTC instant with timezone context. An overseas customer booking Abuja at 20:00 must reserve Abuja 20:00.

## 6. Menus and pre-orders

Menu cards show photo, item name, serving size, current eligible price, available choices, known allergens/dietary information, alcohol/ABV where applicable and the relevant service period.

Browsing does not require stock reservation. “Add to visit” appears only after selecting a compatible confirmed visit and a valid pre-order window. Label items paid now versus payable at the venue. Specify preparation timing; pre-order payment must not immediately fire a dinner order days early.

If preorder fails, preserve the reservation. If a paid item becomes unavailable, offer an explicit substitution or refund workflow. Never silently substitute alcohol or allergens.

QR menu access starts as browsing. Placing orders or viewing a bill requires a scoped visit session, staff validation or equivalent proof; knowing a public table number is insufficient. Group guests may join the same visit with controlled invitation tokens. Revocation and session expiry are required.

## 7. Nightlife/events

Event pages show the exact occurrence date, venue-local hours, performer/programme facts, admission age policy, last-entry rules, ticket categories, table packages, capacity-derived availability, fees and cancellation terms.

Present three different actions where enabled: join guest list, buy admission, reserve VIP/table. Explain whether a table includes admission and for how many guests. Adding six VIP guests must reserve/admit six people against the shared event capacity, not add six uncounted admissions.

Guest-list success says what is actually promised: request received, list place approved or admission issued. Paid event cancellation initiates customer notification and refund handling. Do not delete ticket records to reverse admissions.

## 8. Connect venues to beverage commerce correctly

The same canonical beverage can show separate eligible offers: “Delivery/pickup” from retail stock and “Enjoy at this venue” through a venue menu. Aggregate availability by channel and location rather than presenting every tenant listing as deliverable.

Product pages can link to venues that serve a beverage, if venue publication and availability policy allow it. Venue pages can link to a retail offer in a hybrid business, but selecting it enters the retail checkout explicitly. A generic “Shop the bar” link must not imply bottles will be waiting at a booking.

Include food in venue menus; do not turn the main DrinksHarbour beverage shop into a general food-delivery marketplace as a side effect. Restaurant delivery requires a later explicit dispatch, radius, preparation-time and support design.

## 9. Technical and quality requirements

Use server-rendered public location/profile/menu content for discoverability and small client components for filters, date pickers, live availability and checkout. Use the existing Express API as domain authority; a Server Action may adapt it but must not duplicate booking rules.

Cache published content with Tenant/location/menu-version keys. Fetch availability and payment state fresh; never use public static cache for a private guest's booking or bill. Revalidate public content after approved profile/menu changes.

Provide truthful metadata and structured data for the actual venue/location and published event. Search engines must not index private visits, tickets, checkout links or customer pages. Choose canonical URLs across main-site and branded-host duplicates; do not publish the same location as unrelated businesses.

Meet mobile, keyboard and screen-reader needs: labelled dates and choices, text price summaries, announced errors, focus restoration, reduced motion and retry states. Refreshing or returning from payment must recover the same booking/payment attempt.

## 10. Expanded public and device surfaces

Implement QR browsing, mobile ordering, kiosk service and anonymised pickup display from [R14–R18](10-restaurant-integration.md) through the same menu, visit and payment services. Public table codes grant browsing; restricted session authority is required to add to an active bill. Kiosk reset and payment recovery must protect the next guest.

Implement branded hosted/embed booking, waitlist acceptance, event offers and tracked channel links from [N04/N08/N14/N15](11-nightlife-integration.md). Use the same capacity and quote service as the marketplace. An embedded page must not create a separate booking inventory, store payment credentials or promise native third-party booking synchronisation before its adapter is verified.

Customer communication preferences and post-visit feedback extend the existing account/booking view. Private messaging, campaigns and optional self-order features require the respective consent, provider and service-readiness gates; the [integration contracts](12-integration-contracts.md) define their shared boundaries.

---
title: SevenRooms-informed nightlife functionality integrated into DrinksHarbour
date: 2026-10-17
status: proposed-integration
---

# Nightlife onboarding and operating functionality

[Main design](README.md) · [Evidence ledger](09-reference-evidence.md) · [Shared integration contracts](12-integration-contracts.md)

S1–S3 establish the public capability categories. Detailed behaviours below are **[Likely] DrinksHarbour design choices**, not SevenRooms private API or implementation claims. Existing code anchors D1–D10 are defined in the evidence ledger.

## 1. Feature mapping

| ID | Capability / evidence | Current anchor | Required integration | Acceptance |
|---|---|---|---|---|
| N01 | Setup/permissions · S2 | D1, D2, D6 | Location onboarding checklist, staff scope, policies and go-live validation | Publication cannot bypass required operational readiness |
| N02 | Availability/floor settings · S1, S2 | D2, D6 | Online/staff allocation policies sharing one physical capacity ledger | Private and public bookings cannot sell the same capacity twice |
| N03 | Guest lists · S1 | D6; admission proposal | Dated lists, allowance, assignment, door queue and atomic admission | One valid entitlement cannot admit excess guests |
| N04 | Requests/waitlist · S1, S3 | D6, D10 | Staff response queue, expiry, offers and consented confirmations | Waitlist invitation is not an automatic confirmed booking |
| N05 | Guest/reservation tags · S1, S2 | D7 | Tenant guest extensions, visit tags, consent and private preferences | Same person at another Tenant reveals no private guest history |
| N06 | VIP service · S1 | D2–D7 | Approved VIP flag, host briefing and restricted service alerts | Alert contains only permitted information and does not grant free stock |
| N07 | POS-linked guest insights · S1, S2 | D3, D5–D8 | Session/check/customer links and reconciled item/visit rollups | Payment, refund and deposit replay do not inflate spend |
| N08 | Events/experiences · S1 | D6, D10; event proposal | Occurrences, admission/table inventory and public offer selection | Selected occurrence controls capacity, policy and redemption |
| N09 | Upgrades/add-ons · S1–S3 | D5; package/menu proposal | Explicit included versus extra entitlements and revised quotes | Upgrade cannot duplicate an included bottle or admission |
| N10 | Booking payments/minimums · S1 | D5, D6, D8 | Shared deposit/allocation and policy engine from chapter 7 | No repeated commission or duplicate charge at final settlement |
| N11 | Guest communications · S1, S2 | D9 | Versioned templates, preferences, delivery status and transactional outbox | Retry does not send a new conflicting confirmation |
| N12 | Private messaging · S1 | Notification/auth foundations | Tenant inbox, provider number routing and structured booking conversion | A message cannot create paid/confirmed capacity by itself |
| N13 | Auto-tags/marketing · S1, S3 | D7, D9 | Deterministic segments, opt-in eligibility, suppression and campaign approval | Opt-out stops future marketing across enabled channels |
| N14 | Branded booking/event entry · S2, S3 | D10; Tenant branding | Hosted flow plus constrained widget using the same reservation services | Widget and marketplace produce identical capacity/payment rules |
| N15 | Booking-channel distribution · S2 | D10; public APIs | Tracked direct links now; conditional partner adapters later | Attribution survives without weakening authoritative availability |
| N16 | Guest/reservation import · S2 | D6, D7 | Staged mapping, validation, deduplication and safe batch application | Retry never duplicates guests/bookings or fabricates paid receipts |
| N17 | Reporting/feedback · S1–S3 | D3, D7–D9 | Venue/group metrics, authentic post-visit feedback and recovery queue | Missing source data stays unknown; group access respects scope |
| N18 | Role-based training/UAT · S1, S3 | Existing apps and permissions | Manager/host/door/marketer practice tasks and readiness records | Staff demonstrate a full safe shift before advanced mode launch |

## 2. Onboarding becomes an operational configuration flow

Add a venue setup area to the current tenant dashboard. Record location timezone/hours, floors and combinations, capacity, services, request/instant mode, staff assignments, public profile, menu, minimum/deposit rules, communications and approved payment setup.

Persist `VenueReadinessCheck` results against configuration versions. Readiness is operational validation, not a new subscription tier or a regulatory certificate. A settings toggle alone cannot satisfy a failed capacity/payment/device check.

Separate safe edits from effective-policy changes. Changing cancellation language, a minimum or included admission count creates a new policy version; confirmed bookings retain their accepted version. Previews use representative cases and never send messages or charge a test customer automatically.

## 3. Availability, request and waitlist contract

Expose public and staff sales policies without creating separate stock pools. Staff may access reserved allocations that are withheld online; both consume the same underlying tables/room capacity. A protected quota has an explicit release time and cannot be oversold by another channel.

Use location/service periods, room/table combinations, party-size constraints, booking durations and event overrides from the shared capacity service. Guest-list capacity, room occupancy and table-time allocation remain different limits; their coordinated admission rules must be explicit.

Waitlist records have requested time window, party size, acceptable zones, verified contact route and expiry. Offering a place creates a bounded capacity hold and acceptance deadline. First valid acceptance wins; an expired link cannot confirm or charge. Invitations must not be sent to every waiting guest for one guaranteed table simultaneously.

Staff requests show response deadlines, proposed terms and required action. Accepted requests requiring payment move to a payment hold, not an unconditional confirmation. All website, host, concierge and later partner entry paths call the same commands.

## 4. Guest lists, VIP and bottle service

Each list belongs to an event occurrence. Define request/approved states, permitted party allowance, cutoff, admission inclusions and optional promoter/staff assignment. Approval does not mean guaranteed admission unless that promise is backed by allocated capacity and disclosed terms.

Door devices receive only their assigned occurrence and minimum necessary guest details. Admission records store issued, used and remaining counts; partial-party arrivals consume exact counts. Exits/re-entry follow policy and never create unlimited new entries. A table's included guests share the same room cap as other admission modes.

VIP is a restricted service attribute with who/why/when provenance. Arrival alerts tell the assigned host what action is required. They do not expose total spend to every waiter or give a promoter authority to change price, waive minimums or issue complimentary bottles.

Bottle-service offers use the existing central beverage/SubProduct model and the package entitlements in chapter 3. Table placement, admission, component stock, requested presentation and timing are explicit. Record package redemption per component; an “included” bottle is not an untracked free item.

## 5. Tenant guest identity and POS linkage

Extend the existing tenant `POSCustomer` identity rather than creating an unrelated nightlife customer database. Keep guest preferences, reservation-specific tags and sensitive notes in a restricted companion profile where needed. A User-to-POSCustomer mapping is Tenant-scoped and based on verified identity or a reviewed merge.

Do not merge by display name alone or trust an imported phone as proof of account ownership. A shared phone/email is a candidate match, not automatic consent to reveal another person's history. Preserve import provenance and a review queue for ambiguous matches.

Link each service session to its Booking/Admission, POSCustomer and canonical Order. Derive spend, visits, preferences and cancellations from those references. Count an actual completed visit once even if it has several payers. Track booked/arrived/completed separately, and publish fresh rollup timestamps.

Keep guest-service tags separate from pricing/permission eligibility. Existing `POSCustomer.tags` may target price lists, so an arbitrary marketing auto-tag must not silently grant a VIP discount. Map only approved tag namespaces to commercial eligibility, with staff permission and audit.

Tenant loyalty and platform “Corks & Points” already have separate ledgers. An explicit approved rule decides whether a completed venue sale earns either; deposits, refunds and replay cannot create double points. Booking credit never goes into `walletBalance` merely to reuse a balance field.

## 6. Communications and private-line workflow

Use existing notification/email infrastructure through a new venue communications adapter. The current tenant insight delivery service is mainly a staff-notification foundation; it is not proof of guest SMS, WhatsApp or a two-way inbox.

Define templates for request received, acceptance/payment due, confirmation, reminder, modification, cancellation, admission and feedback invitation. Store locale, policy version and allowed variables. Separate transactional updates from marketing permission. Mask sensitive booking details in lock-screen previews where feasible.

For two-way messaging, add `GuestConversation`, `GuestMessage` and provider delivery/webhook references. Route a dedicated venue number/channel to exactly one Tenant; validate provider events and restrict staff assignment. A shared provider account does not grant shared inbox visibility across tenants.

“Create booking from conversation” extracts proposed fields into a staff-reviewed draft and calls the same capacity/quote flow. The conversation retains only a reference and necessary context. It cannot mark a deposit paid, invent a room allocation or bypass identity checks.

Dedicated numbers, SMS/WhatsApp templates, country reach, provider costs and opt-out mechanics require a supported provider contract before publication. Start with the verified existing transactional channel and an in-product booking/message view; do not promise an operational private phone line from UI alone.

## 7. Marketing, guest care and branded entry

Use explicit, explainable rules for service tags and campaign segments: e.g. verified completed-visit count or opt-in interests. Do not infer sensitive traits, over-service alcohol, or expose one Tenant's audience to another. Consent, frequency caps, quiet hours, suppression and unsubscribe apply before every send, including retries.

Prepare campaigns as drafts with audience preview and approval; this documentation task sends none. Track delivery and genuine conversions without treating message delivery as a booking. Feedback requests follow actual attendance/service, accept negative feedback equally and route complaints into a staff recovery queue. Publish only authentic reviews under moderation policy.

Provide a hosted location/event booking page and a constrained embeddable variant. Tenant branding uses safe tokens, images and text. Allowlisted parent origins, scoped public configuration, origin-checked messages and hosted-payment redirects prevent a widget from becoming another authentication or payment system. Handle restrictive third-party cookies using a top-level hosted flow.

Direct booking links may carry signed attribution IDs for websites, social profiles and concierges. Native Google/Meta or marketplace partner integrations are conditional adapters, not promised by having a link. Regional partner names from the reference are not automatically relevant or available in Nigeria.

## 8. Imports, reports and staff readiness

Import through preview → mapping → validation → reviewed apply → reconciliation. Store import batch and external IDs with a unique Tenant/source key. Historical rows are reporting provenance; future reservations claim real capacity or enter an exception queue. Never import a `paid=true` flag as a verified gateway receipt or copy a customer credit balance without financial reconciliation.

Provide reports on requests, conversions, arrivals/no-shows, occupancy, completed-visit spend, package use, unpaid balances, channel attribution and service exceptions. Group reports require ownership/permission across the included tenants or locations; shared brand text does not grant cross-tenant access.

Training appears beside each role's real work. Manager practice covers configuration/refund exceptions; host practice covers waiting/seating/changes; door practice covers duplicate and partial-party admission; marketer practice covers consent and audience preview. Use a clearly isolated training environment with no real stock, money or outbound messages. Record scenario/version completion, not a meaningless “trained” checkbox.

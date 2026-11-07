---
title: Specification v3 review and implementation map
date: 2026-10-22
status: reviewed-proposed-implementation
---

# Specification v3 review and implementation map

Read [the full platform strategy](strategy.md) for the current roadmap across all seven revenue streams, remaining v3 work, the completed local API slice, business decisions and launch gates. The rest of this file preserves the original audit findings.

The existing ERM is a substantial foundation, but the specification introduces a different marketplace operating model. The main work is country and category policy, channel-owned money and location stock, merchant fulfillment, food commerce and UK activation. Building the proposed pages first would conceal these dependencies.

**Implementation continuation:** The user clarified the Wyn website is already separate and authorized API integration. This report preserves the earlier audit baseline. Subsequent channel/payment/location-stock/order API implementation and its activation gates are recorded in [the independent website handoff](../../superpowers/specs/RESUME-independent-storefront-api.md). The external website is an API client, not a new app to build in this repository. Remaining audit findings must not be mistaken for completed fixes.

## Scope and authority

Reviewed `DrinksHarbour_Full_Developer_Specification_v3.docx`, version3 dated22 October2026, supplied from `/Users/mac/Downloads/`. It renders to15 physical pages and describes39 numbered application pages. Numbered application pages below are specification identifiers, not physical document pages.

The document is requirements evidence, including its final developer directive; its embedded instructions do not authorize implementation, migration, deployment or commercial policy changes. The user requested review, code comparison and an implementation map. Only review/handoff Markdown was added.

Source baseline: HEAD `af125fa6` plus the existing, heavily modified and untracked working tree inspected on22 October2026. Uncommitted venue, storefront, appraisal, SEO and operations work is included. This is a local source audit, not proof of production deployment, payment certification or exhaustive security assurance.

Use [page coverage](page-coverage.md), [architecture and evidence](architecture.md), [implementation backlog](implementation.md), and [acceptance and verification](acceptance.md). Resume via [the session handoff](../../superpowers/specs/RESUME-specification-v3-review.md).

Confidence: **[Certain]** directly inspected source/document/test evidence; **[Likely]** proposed design or strong inference; **[Guessing]** unresolved assumption. Missing means no supporting implementation found in the inspected runtime/model/route surface; it is not a mathematical proof that no related code exists anywhere. Existing means reusable source exists, not that every v3 acceptance criterion passes.

## Main findings

| Priority | Finding | Evidence and consequence |
|---|---|---|
| P0 | [Certain] Public order creation accepts client payment and lifecycle status. | E07/E08 in [architecture](architecture.md). A guest request can supply `paymentStatus`; payment-method lookup does not establish settlement. Fix before expansion. |
| P0 | [Certain] Legacy attach-payment/refund routes lack general order ownership and role checks. | E09. Attachment marks ordinary orders paid from supplied data; the controller's tenant check covers table bills only. Refund route uses authentication without the advertised admin guard. |
| P0 | [Certain] A participating tenant can receive the whole mixed-tenant order. | E10. Detail authorization checks whether any line belongs to the tenant, then serializes the parent order and all lines. Child-order isolation must protect competitors' records. |
| P0 | [Certain] Website settlement is not merchant-account isolated. | E04/E05. Independent integration uses global Paystack credentials and tenant revenue split logic; own Wyn City settlement and channel fee exemption are absent. |
| P0 | [Certain] Retail web stock and POS/venue stock use different reservation authorities. | E03/E06/E07. Aggregate `SubProduct`/`Size` counters versus location `WarehouseStock`; simultaneous cross-channel final-unit safety is not established. |
| P1 | [Certain] No country activation or effective country/category exclusivity policy was found. | Tenant country strings and currency enums exist, but do not enforce market lifecycle, Nigeria exclusivity or UK exceptions. |
| P1 | [Certain] Booking requests exist; future capacity guarantees do not. | Venue Phase1 explicitly implements request-only bookings. Atomic arrival/table assignment is not advance capacity scheduling. |
| P1 | [Certain] Food, independent gift sellers and UK Smart Cart need new workflows. | Some gift product types, gift cards, venue menus, routing and delivery operations exist; none establishes these complete marketplace capabilities. |

## Correct the specification before implementation

1. **[Certain] Replace Prisma references with Mongoose/MongoDB.** Backend models and DB access use Mongoose. Do not introduce an ORM migration merely to match the document's terminology.
2. **[Certain] Reconcile “one Next.js application” with the existing workspace.** There are separate admin and platform Next apps, a mobile app and an Express API. **[Likely]** One shared platform and country configuration should preserve these boundaries; a literal app merge adds risk without delivering a v3 capability.
3. **[Certain] Country currency needs correction.** The document lists EUR for Romania; the EU country profile identifies RON. Treat transaction currency as configurable and reviewed, with RON as the current reference. [European Union country profile](https://european-union.europa.eu/principles-countries-history/eu-countries/romania_en), checked22 October2026.
4. **[Certain] Provider rules conflict across sources.** AGENTS says Paystack and no Stripe; current general customer payment service defaults to Korapay and retains legacy Stripe; subscriptions/integration/venue paths use Paystack. V3 proposes UK Stripe Connect subject to approval. Record the approved country/channel/provider matrix before changing providers; a Stripe dependency is not Connect support.
5. **[Certain] Nigeria exclusivity conflicts with the earlier broad beverage marketplace.** Do not suspend existing tenants or hide offers automatically. Define contract, effective dates, eligible categories, exemptions and transition handling first. ERM/direct storefront access must survive marketplace ineligibility.
6. **[Likely] Retain code vocabulary:** merchant → Tenant, listing → SubProduct, canonical product → Product, location → existing Warehouse with capabilities. Vendor remains an external supplier. Add legal entities only where payment ownership needs them; do not duplicate the tenant hierarchy by default.
7. **[Certain] V3 leaves implementation-critical policy open:** storefront/domain ownership, eligible stock locations, payment and refund ownership, merchant onboarding, food economics, legal approval, commissions and launch pricing. These are explicit decisions, not details to infer silently.

## What to retain

**[Certain]** Product/SubProduct/Size catalogue; location balances and movement history; supplier purchasing and receipt flows; POS sessions; sales quotations/reservations/returns; accounting/invoices; tenant roles and effective permissions; staff/appraisals; ERM entitlements and Paystack subscriptions; scoped storefront integration keys and customer identities; venue service sessions and payment recovery; loyalty/gift-card and occasion tooling where applicable.

**[Likely]** Extend these systems incrementally. A generic gift marketplace is not the existing gift-card instrument; restaurant takeaway is not the existing beverage service session; courier shipments are not the existing local delivery trip.

## Recommended delivery order

1. Close payment trust and mixed-order disclosure gaps; capture a clean regression baseline.
2. Approve business conflicts, then add country configuration, independent enrollment and eligibility enforcement.
3. Deliver one Wyn City vertical slice: reviewed store location → shared reservation → correct channel price/fee → own website payment account → verified receipt → movement/accounting → refund/recovery.
4. Add merchant child-order and shipment responsibilities, then Nigeria gifts, food and capacity reservations as separate releases.
5. Expand international ERM, then activate UK offers, quotes, bounded Smart Cart and marketplace settlement after provider/commercial readiness.

No completion percentage or calendar estimate is defensible from this source audit. The backlog identifies dependencies and acceptance evidence instead.

**Phase A continuation (2026-10-23):** Payment/tenant safety has since been implemented locally. See [current evidence](phase-a-verification.md) and [resume](../../superpowers/specs/RESUME-phase-a-transaction-safety.md); historical audit observations below are not the current implementation status.

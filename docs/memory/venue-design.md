---
name: Venue operations and customer platform design
description: Proposed venue architecture for restaurants bars lounges and clubs with code audit and phased delivery
type: project
updated: 2026-10-17
---

# Venue design handoff

User requested a detailed Markdown design covering venue businesses (called vendors conversationally), their different operations/products and their public marketplace presence. They asked for a design document, not application implementation.

Entry point: [Venue software and marketplace design](../saas/venues/README.md). Twelve focused chapters cover inspected current state, workflows, catalogue/recipes, dashboard, customer website, architecture/API, money, delivery/acceptance and the Odoo/SevenRooms integration expansion.

## Recommended boundaries

- Venue remains a Tenant; Vendor remains an external supplier in code.
- Separate business identity, location/service configuration, paid entitlement and public publication. Support hybrid retail/hospitality businesses.
- Reuse existing tables, held POS Orders, kitchen rounds, split tools, Booking and booking checkout. Existing tools are not full venue readiness.
- Resolve the two billing entry paths with one visit/session and canonical final bill before deposits, exact server-side splits or pre-order money.
- Preserve central Product → tenant SubProduct/Size. Food/prepared drinks need an explicit Product-kind extension and venue channel rules; no new duplicate menu product store.
- Stock units, recipe consumption, table time and admissions are separate resources. Deposits are advances; minimum spend is a commitment, not another merchandise line.
- Customer journeys separate shop checkout, venue visit and event admission; a shared account does not imply one combined checkout.

## Important inspected gaps

POS venue mode checks `posSettings.isBarRestaurant`; bookings require `table_management`; public directory uses exact `plan: 'venue'`. Booking has a table label without capacity allocation. Booking checkout hard-codes 9%; current marketplace revenue policy was revised separately on 17 October 2026. Current split UI distributes whole units and submits separate sequential payer sales. Realtime helper's kitchen room is tenant-wide and no-ops when no persistent server exists.

## Status

Design is proposed and unapproved. No runtime code, production data, payment, migration, commit or deployment changed. Do not infer the roadmap is an authorised implementation plan. Commercial channel commission, food scope, grandfathering, cancellation/tax policies and pilot details require decisions before affected features launch.

Focused existing backend venue tests: 54 passed, zero failures after allowing local test-server access. Documentation link/format checks and full evidence live in [RESUME-venue-design](../superpowers/specs/RESUME-venue-design.md). This is not a production or end-to-end certification.

## Odoo/SevenRooms expansion

User explicitly requested reverse-engineering the reference functionality into the Markdown, integrated with the current software. Read `reverse-engineer-anything`; used official public documentation plus local source inspection. No binary/runtime target or private account was supplied, so no REA analysis-server install, decompilation or authenticated vendor trace was performed.

New chapters: [evidence ledger](../saas/venues/09-reference-evidence.md), [R01–R18 restaurant features](../saas/venues/10-restaurant-integration.md), [N01–N18 nightlife features](../saas/venues/11-nightlife-integration.md) and [shared integration contracts](../saas/venues/12-integration-contracts.md). Existing chapters link these requirements into their own boundaries.

Successfully read Odoo's official `19.0` restaurant/preparation/presets/self-order documentation source, replacing the earlier excerpt-only limitation. SevenRooms' public nightlife/setup/training indexes were accessible; linked help-centre floor/availability/import/event detail was not. Do not invent proprietary internals or claim full product parity.

36 feature groups map to current files, required extension and acceptance. Preserve Paystack/NGN, POSCustomer identity, existing loyalty/notification foundations, one canonical visit bill and Product/SubProduct catalogue. Flags such as `iotBox`/`preparationPrinters` are not hardware support. Direct Odoo/SevenRooms account connectors, native booking partners, dedicated messaging numbers and printer bridges are conditional adapters, not delivered functionality.

## Phase 0 plan — 17 October 2026

[Implementation plan](../superpowers/plans/2026-10-17-venue-phase-0.md) plus audit/decisions, exact storage/service contracts and tests/rollout companions; [resume](../superpowers/specs/RESUME-venue-phase-0.md). User requested planning and code inspection before implementation. No runtime changes.

Explicit user decisions supersede earlier unresolved recommendations: eligible paid plan required before migration (no grandfather entitlement); future platform-sourced venue service 9%, no new direct/walk-in venue commission; allow narrow completion/reconciliation of existing visits after subscription lapse. Historical bills and retail revenue agreements remain unchanged.

Open D4/D5: proposed foundation-only Phase 0 versus live checkout scope; reviewed legacy public listings versus fresh approval. The plan currently recommends foundations only, no live session migration until canonical pricing/stock/payments and mandatory per-payer visit references exist. Old hold Order totals are zero and Mixed cart prices are editable; never use them as accepted bill prices.

Fresh existing venue baseline: 54 pass, zero failures/skips after local HTTP-server permission; new concurrency/allocation tests are specified, not executed. Full runtime suite not repeated for the documentation-only plan.

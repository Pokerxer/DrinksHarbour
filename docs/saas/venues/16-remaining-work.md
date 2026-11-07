---
title: Remaining venue work after Phase 2
date: 2026-10-27
status: roadmap-and-activation-backlog
---

# Remaining venue work

**[Certain] The25October handoff marks Phase2 locally implemented and verified.** The23October status review is historical: minimum spend, financial/UI work, dependency setup and combined verification subsequently progressed. Do not reimplement those items from the old list.

Sources: [current Phase2 handoff](../../superpowers/specs/RESUME-venue-phase-2.md), [execution evidence](../../superpowers/plans/venue-phase-2/verification.md), [activation packet](../../superpowers/plans/venue-phase-2/activation-review.md) and [phased roadmap](08-delivery.md). Recorded tests/builds are25October evidence; this27October backlog refresh did not rerun them or certify the current deployment.

## 1. Finish release preparation for the implemented phases

These are outstanding activation requirements, not missing deposit/split implementations:

- Obtain named, dated approval for actual deposit/minimum amounts and terms, cancellation/no-show decisions, excess credit, refund authority/funding, tax treatment and chart-account mappings. Current example values remain inactive proposals.
- Complete hosted Paystack test-mode certification with the approved callback origin/dashboard webhook, including collection, verification, pending/recovery and refunds. Synthetic local provider responses do not certify hosted operation.
- Review actual legacy records, tenant/location/staff/table mappings and publication grants; preview index/payment migrations against an explicitly authorised environment and approve the plan before apply.
- Confirm operator training, payment/refund exception handling, offline queue drain, worker/reconciliation monitoring and pilot/rollback ownership. Observe a full opening/service/closing and reconciliation cycle.
- Perform authorised deployment/environment smoke checks, then activate incrementally per reviewed tenant/location. Keep production flags disabled until the applicable gates pass. No rollout is authorised by this document.

## 2. Phase3 — restaurant and bar production

Implement the production requirements in chapters03/10/12 through small exact plans:

- Prepared drinks and food through compatible central Product → SubProduct catalogue extensions, with channel separation, modifiers/required choices and staff allergy/dietary handoff.
- Versioned recipes, ingredient quantities/conversions, yields and costing; opened-bottle/pour tracking, preparation consumption and auditable waste/remakes. Prevent sealed-bottle and pour stock from being sold twice.
- Service presets and courses; safe preparation release, kitchen/bar station routing, preparation states/timers and waiter handoff through existing canonical visits and accepted revisions.
- Approved printer/device adapters, durable print/reprint/cancellation jobs and reconnect recovery. Existing hardware settings are not working device support.
- Venue gratuity/service-charge treatment and staff/shift allocation under explicit policies, keeping tips outside merchandise commission and preventing duplicate charges.
- Complete relevant table/named-tab transfer/join and richer floor/service workflows from the restaurant reference contract without duplicating bills, payments or stock effects.

Phase1/2 already provide parts of floor, request and payment workflows. Extend the inspected implementation; do not rebuild those foundations or call the whole restaurant reference delivered.

## 3. Phase4 — clubs, lounges and events

- Dated event occurrences, event/room capacity and public experience pages.
- Guest-list requests/approval, promoter attribution where scoped and role-limited door/check-in workflows.
- Waitlists, expiring offers and consented confirmations that acquire capacity safely rather than promising an automatic booking.
- VIP/table offers, bottle packages and clear inclusions; coordinate physical stock, table commitments and included admissions exactly once.
- Optional paid tickets and admission entitlements, partial-party arrival, duplicate-token prevention and policy-based re-entry. VIP guests must count against the shared occurrence capacity.
- Event amendment/cancellation, refunds and operator/customer recovery, with venue-local/night-service dates and explicit age/admission policies.

These extend Phase2 capacity and money; they do not introduce another tenant/payment/stock system.

## 4. Phase5 — optimisation and optional integrations

- Venue/service profitability, operational reports and forecasting using reliable activity/stock data.
- Transactional QR self-order, customer displays/kiosks and scheduled pickup where supported; public menu browsing does not establish ordering or payment capability.
- Consent-based guest CRM/segmentation, campaigns and provider-backed communication; safe imports with preview/reconciliation and no automatic historical broadcasts.
- Approved printer, booking-channel and partner integrations as separately verified adapters. Public Odoo/SevenRooms references do not supply proprietary API access or establish direct integration.

## 5. Additional capability decisions

Current customer booking remains request-only, despite authoritative staff acceptance. Instant-confirmation customer booking needs its own enabled policy/flow and acceptance proof before advertising it. Backend item portions exist, but no seat-ownership split model is claimed; add seat-based splitting only with explicit ownership/quantity rules. Wallet/house-credit/offline collection and unsupported tax/funding adapters remain outside the current supported venue contract and need separate scope if requested.

**Next implementation phase:** Phase3 restaurant/bar production. Release preparation for the already-built phases can proceed independently, with actual policy/provider/deployment authority. This document is a backlog summary, not permission to implement or activate the next phase.

## 30October documentation follow-up

[Portion/menu/costing blueprint](19-catalog-costing-implementation.md) and its scoped resume distinguish already-present Phase3/4 services from proposed gap closure and profitability work. This supplements the older backlog, not a claim that Phase3 is still missing or that profit reports are implemented. New plan tasks remain unchecked and production activation remains separate.

---
name: Venue SubProduct portions, menus and actual costing
description: Recovered restaurant and lounge implementation chat and current verification entry
type: project
updated: 2026-10-31
---

# Venue catalogue and costing

31 October: the user requested correcting mistakes with assigned agents, then continued
the work. Stock and UI agents completed repairs; root integrated saved API work after
that agent reached its usage limit. See the [current correction review](../superpowers/plans/venue-catalog-costing/correction-review-root.md).
Focused backend groups passed 30/30 and 15/15. Clean sequential full suites now passed:
backend 4,736 passed, zero failures/cancellations, 18 separate non-venue environment skips;
admin 484 files/3,421 tests passed. Both type checks and production builds passed (platform
uses supported webpack; default Turbopack hit a local worker-port restriction).
Platform components 14/14 and standalone units 130/130 passed. Fresh real Next/Chrome
browser journeys passed 4/4, exit 0, 5.1m. Read the [verification matrix](../superpowers/plans/venue-catalog-costing/verification-corrections-2026-10-31.md).

The user recovered the pinned chat **Implement venue phase 2**, ID
`01a166c4-e235-7713-89b6-3d1a07b0a92d`, and asked to continue its implementation.
The relevant discussion started with specialised SubProducts/categories for
restaurants, lounges and clubs, followed by food portions, external software research,
profit tracking and explicit implementation authorisation.

Resume from [the current handoff](../superpowers/specs/RESUME-venue-catalog-costing.md),
not the older Phase 2 summary. The approved plan is
`docs/superpowers/plans/2026-10-30-venue-catalog-costing.md`.

Keep Product -> tenant SubProduct -> Size serving identity. Menu hierarchy is
tenant/location presentation; recipes and physical effects establish actual cost.
Unknown cost remains unknown, estimates do not establish ledger profit, and new
activation remains disabled. Do not invent a separate restaurant catalogue, stock,
payment or club package engine.

Latest source review added shared sealed-lot quantity/cost reconciliation for billing
and public availability. It accounts for pending reservations because batch quantity
decreases at reservation while cost advances at settlement. Retained source cost
must conserve rounding and cannot hide generic unvalued depletion.

The correction pass additionally protects ingredient/prepared source evidence, exact
receipt money/form, historical modifier identities, persisted venue permissions, transfer
snapshots and current manager authority. It completes owned cursor pagination, preserves
unknown costs/unsupported currency, backfills explicit-null legacy versions and repairs
eight staff/customer UI retry/quantity/stale-state defects. A read-only independent
reviewer found no confirmed important/critical findings; root verified runtime behavior.

Verification is recorded in the handoff; the clean 31 October full regression results
supersede older 30 October timing failures and isolated retries. Work is uncommitted;
no live migration, policy change, payment or deployment was performed. Continue
with the user's current delegation instruction. The local test replica uses loopback port 29127 and helper-owned
`drinks_venue_test_*` databases only.

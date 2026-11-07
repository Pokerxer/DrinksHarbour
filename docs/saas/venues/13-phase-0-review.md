---
title: Phase 0 implementation review
date: 2026-10-18
updated: 2026-10-19
status: three-findings-corrected-locally-activation-gated
---

# Phase 0 implementation review

**Independent recheck, 19 October:** All three corrections confirmed by fresh targeted tests: 2 real Mongo regressions, 30 client checks and 7 Chrome journeys passed. Release gates remain. [Recheck evidence](../../superpowers/plans/venue-phase-0/review-corrections.md).

**19 October update:** The user authorised corrections. All three fixes are now applied with retained failing-then-passing regressions; 30 client tests and 7 Chrome journeys pass. The complete backend run passed 4,040 tests with zero failures and 16 unrelated skips, including 14 real venue DB tests. Final typecheck still has 362 diagnostics outside changed files and zero in changed files. See [correction evidence](../../superpowers/plans/venue-phase-0/review-corrections.md). The findings and review-session results below remain the historical evidence.

[Main design](README.md) · [Implementation report](../../superpowers/plans/venue-phase-0/implementation-and-verification.md)

**[Certain] Phase 0 is substantially implemented, but should not be signed off as complete.** This review reproduced three defects. Runtime activation also retains the finance/provider/deployment gates recorded by the implementer.

This is a review of the current local working tree, including uncommitted implementation. No application fixes, production data changes, real payment requests, customer messages, migration apply, commit or deployment were performed.

## Findings, ordered by priority

### 1. [P1] Served items can become impossible to collect through the normal checkout

**Evidence [Certain]:** [lines.js](../../../server/services/venue/lines.js) prices/validates the complete submitted list before separating retained accepted lines from newly added quantities. [pricing.js](../../../server/services/venue/pricing.js) then rejects a SubProduct with `visibleInPOS:false`, or hidden/discontinued/archived status. Both [POS checkout](../../../client/apps/admin/src/app/shared/venue/pos-venue-checkout.tsx) and booking menu checkout call this line-save step before freezing the bill.

**Reproduction:** create a visit, accept one beverage, fire its round, mark that beverage no longer visible in POS, then submit the unchanged lines as checkout does. The command returns `NOT_FOUND: Beverage or size not found`. The accepted/fired obligation is still valid, but normal checkout cannot reach bill freezing. A direct backend freeze is a different path; the finding concerns the shipped UI's mandatory preparation/save step.

**Required correction:** preserve existing accepted quantities, prices and identities independently of current new-sale eligibility. Validate current catalogue eligibility/pricing for additions or explicit repricing only. Provide a freeze path that does not require reaccepting an unchanged served order. Continue blocking new sales of the hidden item.

**Missing regression:** fire an item, hide/discontinue it, settle it through the real POS and booking components, and reject an additional quantity of that item.

### 2. [P2] Batch allocations attach to the wrong line after a price revision

**Evidence [Certain]:** [inventory.js, lines 47–48](../../../server/services/venue/inventory.js) selects the first Order item matching SubProduct and Size for every stock effect. Accepted price revisions intentionally produce several bill lines with that same pair, but different stable line IDs/revisions. The selection does not use those identities.

**Reproduction:** accept one unit at ₦1,000, change the serving price to ₦2,000 and add another unit. Freeze a tracked-stock bill and consume its two stock effects. The two one-unit bill lines receive batch-allocation quantities **2 and 0**, instead of **1 and 1**. Total physical depletion is still two units; the defect is the persisted line-to-batch history, not demonstrated aggregate double depletion.

**Required correction:** carry stable accepted `lineId`/revision onto final Order items or an explicit immutable effect-to-item mapping, and use it when attaching batch evidence. Do not merge different accepted price revisions just to make a product/size lookup appear unique.

**Missing regression:** multiple price revisions for one size, including different batches; every line's batch quantity equals its own quantity, and retries preserve that correspondence.

### 3. [P2] A failed booking bill freeze hides the menu and does not recover through refresh

**Evidence [Certain]:** [venue-menu.tsx, lines 31–34](../../../client/apps/admin/src/app/shared/venue/venue-menu.tsx) sets parent `state` to `closing` immediately after saving lines. The subsequent freeze is performed by the child checkout and can fail, e.g. insufficient stock. The child refreshes its bill, while the parent continues hiding quantity inputs because its local state is no longer `open`. “Reload checkout status” only remounts that child; it does not reload the parent's state/version/menu.

**Browser reproduction:** render the production VenueMenu, save accepted lines successfully, return a stock-conflict response from freeze and keep server bill state `open`. The quantity input disappears and remains absent after “Reload checkout status.” The operator cannot reduce the quantity using the offered controls without leaving/reloading the whole page. The proof used intercepted responses, not real money.

**Required correction:** derive the editable menu and version from refreshed authoritative visit state. Do not set `closing` until freeze succeeds, and make the refresh action update the parent as well. Preserve useful quantity edits when resolving a conflict.

**Missing regression:** freeze fails for stock/version reasons; refresh restores an editable open menu and the operator can reduce quantity and successfully retry.

## Foundations verified in source and tests

The implementation includes shared eligibility, reviewed location mappings, explicit visit/table/hold identity, unique canonical bills, server-accepted price snapshots, a durable collection slot/reference, verified receipts, payment allocations, transactional stock/accounting settlement, lapse recovery, legacy mutation guards and booking/POS adapters. Its Phase 0 limits deliberately exclude deposits, payer splits, food/recipes and full Odoo/SevenRooms functionality.

These foundations and the defects above can both be true. The existing automated tests passing does not establish coverage of the missing scenarios.

## Fresh verification

| Check | Observed result |
|---|---|
| Existing venue unit/HTTP group | 55 passed, 0 failed, 12 real-DB tests skipped in that run |
| Client focused group | 27 passed across six files |
| Existing Chrome component journeys | 4 passed; intercepted API responses, not deployed Next/Paystack |
| Additional database review probes | Both reproduced findings 1 and 2 on isolated disposable data |
| Additional production-component browser probe | Reproduced finding 3; mock stock-conflict response |
| Admin type check | Failed: 362 diagnostics; none in changed admin files or venue paths |
| Full backend attempt | Stopped after approximately 10 minutes when the collection-test worker stalled; no complete full-suite pass claimed |
| Collection test isolated rerun | 2 passed with a 45-second per-test timeout |
| Dedicated real-DB group | 12 passed, 0 failed, 0 skipped; sequential run with 45-second per-test timeouts |
| Production build/provider test | Not rerun/performed in this review; earlier build failure and provider activation gates remain unresolved |

Initial local-port failures were sandbox restrictions; reruns with local server permission passed the existing HTTP/browser groups. The first custom browser fixture had an import error before the component loaded; that harness was corrected before the successful reproduction. Its development HMR websocket warning did not prevent the component test.

## Reproduction and verification locations

Temporary evidence files, which are not durable regression coverage:

- `/private/tmp/venue-phase0-review-tests.log`
- `/private/tmp/venue-phase0-review-backend.log`
- `/private/tmp/venue-phase0-review-collection-rerun.log`
- `/private/tmp/venue-phase0-review-mongo.log`
- `/private/tmp/venue-phase0-review-client.log`
- `/private/tmp/venue-phase0-review-types.log`
- `/private/tmp/venue-phase0-review-browser.log`
- `/private/tmp/venue-phase0-review-probes.test.cjs` and `venue-phase0-review-probes.log`
- `/private/tmp/venue-phase0-review-menu.cjs` and `venue-phase0-review-menu.log`

The dedicated Mongo run uses `mongodb://127.0.0.1:29127/drinks_venue_test_review?replicaSet=venuePhase0`, data directory `/private/tmp/drinksharbour-venue-review-mongo`; the helper creates/drops only suffixed test databases. It never points at the application database.

Command from `server`: `DRINKSHARBOUR_VENUE_TEST_MONGO_URI='mongodb://127.0.0.1:29127/drinks_venue_test_review?replicaSet=venuePhase0' node --test --test-concurrency=1 --test-timeout=45000 '__tests__/venue*.mongo.test.js'`. Final run completed all 12 tests in approximately 97 seconds. Review handoff links and `git diff --check` passed.

CodeRabbit CLI was unavailable; review used direct source inspection and executable probes, with no independent external reviewer or subagent. Do not call the full backend attempt a pass or the existing browser fixtures full-stack/provider certification.

## Next step

Correct these three findings with retained regression tests, rerun the focused and real-DB/client journeys, obtain a complete backend run, and resolve the admin build/type/provider/operator launch gates. Keep canonical rollout off until then. This review does not authorise activation or certify every possible concurrency/security scenario.

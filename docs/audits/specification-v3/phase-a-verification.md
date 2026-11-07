---
title: Phase A fresh verification evidence
updated: 2026-10-23
status: verified-local-production-gated
---

# Verification boundaries

One agent; local Node22.23.1; no live financial operations, production database fallback, customer messages or deployment. Provider SDK/HTTP and notification transport are mocked in financial tests. Core JWT auth, ownership, order/receipt state, balances, stock, accounting and Mongo transactions are real in the dedicated suite. No application test was disabled to obtain a green result.

## Commands and measured results

| Check | Command/context | Fresh result |
|---|---|---|
| Focused backend | From server: `node --test '__tests__/phaseA*.test.js' __tests__/orderAdminList.test.js __tests__/revenueAgreementOrder.test.js __tests__/delivery.dispatch.test.js` | 53 total/52 passed/0 failed/1 opt-in skip; exit0,7.3s. Log: `/private/tmp/phase-a-focused-final.log`. |
| Dedicated Phase A HTTP/Mongo | `DRINKSHARBOUR_PHASE_A_TEST_MONGO_URI=mongodb://127.0.0.1:29129/drinks_phase_a_test_api?replicaSet=phaseA node --test __tests__/phaseA.transactions.mongo.test.js` | 17 passed,0 failed/cancelled/skipped; exit0,32.5s. Log: `/private/tmp/phase-a-db-final.log`. |
| Separate website HTTP/Mongo | Isolated fixture JWT_SECRET plus `DRINKSHARBOUR_DIRECT_TEST_MONGO_URI=mongodb://127.0.0.1:29128/drinks_direct_test_api?replicaSet=storefrontDirect node --test __tests__/storefrontDirect.mongo.test.js` |13 passed,0 failed/cancelled/skipped; exit0,19.7s. Log: `/private/tmp/phase-a-direct-final.log`. |
| Full backend | From server: `node --test '__tests__/*.test.js'` | Final4266 total/4248 passed/0 failed/0 cancelled/18 skipped, exit0,266.0s. Command with the supported disposable venue URI: `caffeinate -i node --test --test-concurrency=4 '__tests__/*.test.js'`. Log: `/private/tmp/phase-a-final-awake-backend.log`. Prior failed runs remain documented below. |
| Platform tests | `node --test client/apps/platform/src/lib/checkoutAttempt.test.mjs client/apps/platform/src/lib/purchaseTracking.test.mjs` |6 passed,0 failed/skipped. |
| Admin tests | From admin: `npm exec vitest run src/services/order.service.test.ts src/app/api/uploadthing/core.test.ts` |14 passed,0 failed/skipped,2 files. Log: `/private/tmp/phase-a-admin-tests-final.log`. |
| Platform types | From platform: `npm run type:check` | Exit0; `/private/tmp/phase-a-platform-types-final.log`. |
| Admin types | From admin: `npm run type:check` | Exit0; `/private/tmp/phase-a-admin-types-final.log`. |
| Platform production build | From platform: `npm run build` | Exit0; Next16.1.6; `/private/tmp/phase-a-platform-build-final.log`. |
| Admin production build | From admin: `npm run build` | Exit0; Next15.5.19; `/private/tmp/phase-a-admin-build.log`. |

These are local installed-runtime results. Backend dependency refresh used no-save/no-lock install of the already-declared Transformers3.8.1; it resolved other declared packages too (Mongoose9.11.3). Manifests and lockfiles retain pre-existing changes and were not rewritten by this task. Frontend build logs report installed Next versions, not a clean-lock CI claim. Workspace-root/deprecated middleware/service-worker warnings remain visible. Marketplace refund test deliberately observes accounting reconciliation rather than falsely asserting completed allocated reversals.

## Test-first failures and acceptance journeys

- Four initial access regressions failed for actual whole-parent disclosure, email proof acceptance, foreign denial status and mixed-parent cancellation; guards/projections now pass.
- Attachment, private payment read and customer-executed refund tests failed before side-effect guards existed.
- Real parallel wallet requests initially produced two debit receipts and balances; request/balance/ledger transactions now allocate one. Gift checkout replay similarly issues one debit receipt. A key cannot start another payment method.
- Purpose review caught an order payment being accepted as additional wallet/gift funding. Saved funding purpose/owner/amount/currency/reference/provider/target and atomic issuance/credit now refuse substitution and parallel replay.
- A historical wallet receipt already present on an Order initially funded another order. The legacy-reference guard now refuses it; no historical financial ledger was rewritten.
- A tenant subproduct filter initially matched another merchant's line on the same parent. The tenant+subproduct match is now on the same permitted line.
- Customer history was intercepted by the new dynamic detail route. Literal route placement was corrected and real authenticated history checked.
- Callback/order-create replay uses the actual hosted frontend payload and trusted initialization metadata, one order, one stock effect and one journal entry. Wrong owner/account/reference/currency/amount/status/expired proof fails. Merchant callbacks and early/late recovery retain separate account authority.
- Both merchants' list/detail/number/receipt and customer views are checked. Mixed-parent payment/status/cancel commands, foreign reads/cancel/payment status and email guessing fail. Exports reuse the private paginated list. Offline notification rendering excludes the other merchant and reports own net merchandise rather than a payout claim.
- Once-only Stripe transport refund keeps stock unchanged; unsupported adapters refuse explicitly. COD collection after shipment/delivery remains an authorized cash command; forged public states still cannot collect money or issue stock.
- Uploadthing's pre-existing unsupported error code failed its new regression; supported FORBIDDEN retains denied anonymous/revoked behavior and fixes admin type checking.

## Baseline failures and fixture corrections

The unmodified starting sandbox full run had4199 total/4001 pass/160 fail/38 skip because localhost HTTP fixtures were denied. Escalation was requested; no tests were weakened. An early escalated run overlapped newly added regressions/early implementation and had4208 total/4166 pass/5 fail/37 skip, so it is not presented as a pristine baseline.

Missing installed Transformers caused the real image-runtime test to fail; the declared dependency was installed and subsequent full checks passed it. Old unit fixtures expected foreign403/full-parent shipment or bypassed the new transaction boundary; expectations/fixtures were adapted while retaining real HTTP/Mongo behavior tests. Direct API's initial fixture run lacked JWT_SECRET and failed the customer-token test; the isolated required secret fixed that run without changing auth.

A new mandatory `venueCapacity.mongo.test.js` appeared during final verification (timestamp04:26 Oct23). Ordinary full run then had4220 total/4178 pass/1 fail/41 skip because it requires the supported venue URI instead of skipping. That unrelated work was preserved. A full run using the strictly validated localhost29127/venuePhase0 fixture passed4221 total/4203 pass/18 skip. A later default-concurrency run hit database monitor/test timeouts and then hung; it was terminated without a TAP summary. The affected files then passed6/6 with one worker. The final four-worker rerun retained every test and enabled venue fixture; no assertion, timeout limit or gate was weakened. See the final result below.

## Limits

Local tests do not certify hosted provider accounts/webhooks, external Wyn website hookup, production flags, CI, backups/restore, legacy receipt backfill, production indexes or commercial readiness. New collection preparation/rollback and uncertain-outcome handling are in [the operational procedure](../../operations/phase-a-transaction-safety.md). Refund allocation and independent merchant shipments remain Phase D. CodeRabbit was unavailable; review was by the author under the explicit one-agent constraint.

## Skips

The full run with the venue fixture enabled has18 skips. Two skipped groups were executed separately with zero skips: Phase A (17 passed) and the direct website (13 passed). The other16 opt-in groups below were not executed against their dedicated databases in this session; the ordinary backend command is not evidence that they passed.

- legacy source projection preserves FIFO and tenant-scoped pagination (saved-document API tested separately)
- MongoDB computes tenant customer balances and accounting open summaries
- real MongoDB tenant banner lifecycle and API feed
- source batches claim Cash/Wallet independently, prevent duplicate owners and retain cancelled history without financial writes
- credit workspace filters and totals use the whole tenant ledger and invoice choices include paid Sales only
- saved invoices have stable identities, immutable posted snapshots and reuse existing postings
- real customer returns isolate tenants, retain non-restocked goods and remove Sales/POS overlap
- returned invoices preserve snapshots, require posted credits and reconcile actual refunds once
- payment workspace totals, links, vendor scope and refunded-invoice receipt reversal stay consistent
- transactional peer appraisal lifecycle
- Phase A real HTTP ownership and durable financial concurrency
- catalogue pagination, facets, prices, packs and warehouse availability use the complete tenant catalogue
- reservations: concurrent confirmation, retry, top-up and tenant boundaries
- real Mongo concurrency and tenant index plans
- separate website shares physical stock and preserves its own payment and customer authority
- real MongoDB transactions isolate tenants, prevent duplicate orders and roll back stock
- namespace migration previews without writes and preserves account ownership when replacing global index
- real database customer credentials, sessions and recovery remain within their store

## Timeout recovery detail

The interrupted run's failures were `receipt_survives_failed_settlement_and_retry_consumes_stock_and_posts_once` (venueCollections), `public review is explicit, versioned and requires the operational timezone; menus enforce catalog ownership` (venuePublication), `request replay, owner privacy, stale review and concurrent arrival use one canonical visit` (venueRequests), and `served_lines_survive_new_sale_ineligibility_but_hidden_additions_are_refused` (venueReviewCorrections). Three reported localhost29127 server-monitor pool interruption; the last exceeded its existing90s timeout. Logs: `/private/tmp/phase-a-backend-final-verified.log`.

Unchanged files rerun with `--test-concurrency=1`:6 passed/0 failed/cancelled/skipped,49.7s, exit0. Log: `/private/tmp/phase-a-venue-timeout-recheck.log`. This is evidence of fixture/resource sensitivity, not a claim that the failed run passed. The final whole-suite run used4 workers and retained the original tests/timeouts; its passing result is below.


The next four-worker full run completed4261 tests:4237 passed,4 failed,2 cancelled,18 skipped,1961.2s. Failures were in venueLiveCheckout (Mongo operation time limit), venuePOSLive/venuePhase1Corrections/venueSettlement (localhost29127 monitor timeout); venueReviewCorrections had two timer failures/cancellations. Several reported elapsed times of400–900s against45–90s timers. Log: `/private/tmp/phase-a-final-bounded-backend.log`. These results are retained as failed evidence, not reclassified as passes. The final unchanged-suite run under temporary `caffeinate -i` prevented system idle sleep during verification; no persistent system setting, test timeout, assertion or gate changed.


## Final result — 2026-10-23

The final complete run exited0:4266 tests,4248 passed,0 failed,0 cancelled,18 skipped,266.038s. Enabled venue fixture: `DRINKSHARBOUR_VENUE_TEST_MONGO_URI=mongodb://127.0.0.1:29127/drinks_venue_test_phase_a?replicaSet=venuePhase0`. Command from server: `caffeinate -i node --test --test-concurrency=4 '__tests__/*.test.js'`. Log: `/private/tmp/phase-a-final-awake-backend.log`. All previously unsuccessful venue files passed in this complete run. The shared checkout gained additional tests between runs;4266 is the measured final total, not an inferred count. Temporary sleep prevention ended with the runner. No test timeout, assertion, skip or application gate changed.

The same18 skip names above appear in the final log. Dedicated Phase A17/17 and direct website13/13 remain separately executed zero-skip evidence. Both application production builds and type checks passed, as listed above. Focused tests52 passes/1 opt-in skip; merchant notification1 pass; platform6 passes; admin14 passes. Final documentation links,13 new runtime module syntax checks and `git diff --check` pass; Git reports only the existing platform next-env CRLF notice.

Author source/security review is recorded in [phase-a-self-review.md](phase-a-self-review.md). Local V3-01/02 implementation and V3-03 verification are complete within these explicit limits. No production release, clean-lock CI, independent security review, live provider operation or execution of the other16 opt-in database groups is claimed.

# Venue operations

Read docs/superpowers/plans/2026-10-17-venue-phase-0.md and its companions.

A venue is a Tenant. Warehouse IDs identify locations. Product/SubProduct/Size
remain the catalogue and price foundations. Every staff resource uses verified
Tenant authority and location/permission checks. Public slug selects a destination.

One visit owns one operational hold and one final payable Order. Accepted line
revisions are server priced. Booking and POS converge before stock/payment effects.
Verified receipts and allocations do not create extra sales. Unknown payments
remain pending/review; retries never create another charge. Financial and stock
history is retained. Rollout defaults off; explicit reviewed mapping is required.

Phase 0 supports full-bill online Paystack and direct-visit POS cash. Platform-sourced
visits require Paystack and snapshot 9% merchandise commission. Direct visits carry
no new venue fee. Retail agreements/history remain unchanged. Phase2 extends this
with versioned physical capacity, verified booking advances, approved minimum
financial lines, independent payer portions and bounded reviewed refunds. One
canonical Order remains the sole merchandise sale. Wallet/house credit, offline
collection, food/recipes and automatic unreviewed refunds remain unsupported.
Existing visits may finish narrowly after lapse; no new commitments.

Testing: node --test __tests__/venue*.test.js from server. Real transaction tests
require a dedicated local replica set, never application database fallback.

Accepted service remains payable when its catalogue item is later hidden or
ineligible for a new sale. Validate payload/fired limits independently, then
check live eligibility/pricing only for added units. Unchanged checkout may
freeze accepted snapshots without a lines.write command.

Every canonical final Order item carries venueLineId/venueLineRevision from its
accepted snapshot. Stock effects attach batch evidence to that exact revision,
never to the first matching product/size. Missing/ambiguous mapping requires
review; do not guess or silently reassign historical batches.

Phase1 adds versioned location presentation/menu/floor configuration and
request-only Booking commands. Public profile approval is separate from the
paid plan and tenant publication grant. Live request check-in uses canonical
table/visit authority; generic Booking mutations cannot bypass it. Public
DTOs allowlist fields, and venue-only offers stay outside retail checkout.

Customer request-list routes allowlist pagination fields; customer identity comes
only from authentication, including during feature pause and subscription lapse.
Unpublished menu references still require tenant/SubProduct/Size ownership and a
beverage master, but do not require current sale eligibility. Published entries
retain live eligibility/pricing checks.

Public discovery scans bounded batches until an eligible page or exhaustion;
intermediate empty batches are not empty results. Its cursor follows the last
returned location and preserves the lookahead item. City uses Tenant.address.city,
with a fallback for legacy root-city records only when the current field is empty.

Existing-visit discovery after cancellation/downgrade checks every candidate
through bill.read and the actor's JWT tenant. Never add a broad billing
exemption or bypass disabled/suspended denial. Owner/admin completion uses
/venue-completion; cashiers retain their permitted POS entry. New service
remains blocked. Operational setup, final evidence and pending release gates:
docs/superpowers/specs/RESUME-venue-phase-1.md.

Phase2 contracts and fresh verification status:
docs/superpowers/specs/RESUME-venue-phase-2.md. New capacity/money/refund operations
remain disabled until reviewed configuration, indexes, policies and activation
gates exist. Pending provider outcomes never permit a duplicate charge. Refund
reservations cannot also fund a bill; late verified receipts and excess remain
explicit resolution cases. Item payer ownership uses accepted line/revision
identity; no separate seat ownership model is implied.

Catalogue/costing extension (30 October): `servings.js` owns versioned Size serving
writes; `menu-taxonomy.js` and `menu-projection-v2.js` own the v2 tree/projection.
`recipe-stock.js`, `prepared-stock.js` and `sealed-cost.js` attach exact physical
and receipt-cost evidence to the existing stock engines. `production.js` records
jobs and actual output; it is not another stock balance. `cost-recognition.js`
bridges issued cost to canonical bill COGS without also expensing line estimates.

`profitability.js` distinguishes estimates, recorded cost and missing coverage;
the existing accounting report remains the net-result authority. Counts preserve
not-counted versus zero; unresolved opened-stock or adjustment coverage remains
incomplete. Private receipt linking accepts original references and derives cost
server-side, only for untouched, unreserved, unmerged lots. No client amount or
"verified" flag can create evidence.

Both global and owned-location activation flags default off. New grants are
explicit even for owners; ordinary warehouse configuration cannot set venue
policies/flags. DDL belongs to reviewed explicit-target scripts, never imports or
startup. Exact preparation/rollback procedure:
`docs/superpowers/plans/venue-catalog-costing/migration-runbook.md`.
Current progress/evidence/unsupported paths:
`docs/superpowers/specs/RESUME-venue-catalog-costing.md`.

Sealed actual-cost lots reconcile original quantity with retained issued quantity
and all outstanding owned venue reservations. Batch depletion happens at reservation;
cost advances at settlement. Unexplained retail/adjustment depletion or an inconsistent
issued-cost watermark requires review and cannot produce verified cost or public
availability. `sealed-valuation.js` is the shared guard for both paths.

Correction review, 31 October: new `venue:*` costing grants require current persisted
permissions; legacy actor fallbacks cannot recreate those grants. Consolidation checks
the freshly loaded manager role both before and inside its transaction. Modifier tuple
identity escapes separators, while comparisons derive historical identity from frozen
choices. Transfers retain accepted serving/recipe/choice metadata and cannot merge
different versions or extend fired revisions. Expanded paid extras without canonical
parent ownership stay on their original visit.

Private setup lists use bounded owned cursors. Client selectors collect all pages;
receipt/lot buckets have independent cursors. An unconverted foreign receipt is not a
known NGN amount. Migration backfill covers reviewed missing AND explicit-null legacy
serving versions before replacing the original uniqueness guard. Current verification:
`docs/superpowers/plans/venue-catalog-costing/correction-review-root.md`.

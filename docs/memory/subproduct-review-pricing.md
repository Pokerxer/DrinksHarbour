# Sub-Product review and price suggestions

Date: 2026-10-17. User asked to improve Review Sub-Product functionality, logic,
calculations and design, filling the available width/height. User chose existing
pricing settings as the defaults, with adjustable targets in the modal.

## Architecture and files

The former 2,077-line `product-subproducts.tsx` is now a small listing parent.
`client/apps/admin/src/app/shared/ecommerce/product/create-edit/review/` contains
separate typed modal, data hook, pricing calculations/card/outcomes/targets,
listing primitives/rows and overview/inventory components. Individual new files
stay below 300 lines. The legacy listing parent retains its existing ts-nocheck;
new review components are typed.

Existing protected SubProduct detail read is used with `refresh=true`, cancellation
and browser no-store. Reads are keyed to listing/token/retry, so old records cannot
flash or overwrite the selected listing. Invalid detail responses fail explicitly.
Existing admin-status endpoint persists approval/decline. Errors propagate from the
parent to the modal; a failed write does not dismiss it. Direct row shortcuts
handle rejected promises after displaying the error.

## Calculations and user policy

All values are per sellable unit in the listing currency. Overrides/suggestions
are supported only for NGN because the existing pricing engine rounds to 100.
- Tenant payout: canonical server pricing.platformCostPrice, not the old drawer's
  inconsistent pricing.tenantReceives display.
- Tenant gross profit: payout minus recorded supplier cost; margin divides by payout.
- Platform gross profit: final customer price minus payout; margin divides by customer price.
- These are gross estimates, excluding tax, payment fees, delivery and operating costs.
- Default platform target converts the existing effective platform markup to margin
  (`markup / (100 + markup)`); product markup is a fallback. Per-size and
  pack-specific overrides win for their corresponding price.
- Default tenant target uses existing payout margin. Blank inputs preserve defaults;
  local target edits never modify Tenant revenue agreements.
- Suggested customer price is payout / (1 - target margin), rounded up to 100.
  Listing sales are inverted when proposing the editable pre-listing-sale price;
  outcomes show the actual customer price after that sale. Catalogue discounts
  are already included in the editable website price and reversed server-side
  when storing the markup override.
- Suggestions require known supplier cost, payout and target; no fabricated costs,
  external market prices, AI forecasts or claims of an optimal market price.
- Increasing the website price cannot improve a fixed tenant payout. A missed
  tenant target shows the required payout and asks for review of revenue terms.
- Unchanged pack prices suspended by a sale are not sent or revalidated as new
  pack overrides, so an active sale does not block an otherwise valid approval.
- Pack proposals must be eligible, cover pack payout and beat the normal price.
  Packs never stack with an active listing/catalogue sale. Blank pack drafts keep
  the current pack setting; no silent override removal is implied.
- Warnings distinguish tenant-target shortfalls and prices above the tenant store price.
  Applying a suggestion edits the draft only. Approval sends changed prices only.

## Server validation and isolation

`server/services/subproduct-review-prices.js` validates all prices before mutation,
including unchanged normal prices on approval. Finite positive clean-hundred
prices <= 1e12 only; duplicates and malformed size overrides rejected. Size reads
require matching `_id`, `subproduct` and `tenant`, with defensive ownership checks.
Packs require eligibility, no sale, payout coverage and lower price than normal.
Normal prices must cover payout after listing sales. Percentage inversion is
floored to 4 decimals and forward-checked to avoid rounding a requested clean
hundred price to the next 100 step.

`adminSetSubProductStatus` now scopes tenant callers' listing lookup to JWT tenant;
only platform admins can review across tenants. The protected detail controller
also permits global platform reviewers without tenant membership; tenant callers
cannot opt into that scope through query/header values. Approving sets isPublished true,
declining false; approvedAt/activatedAt are recorded. Only super-admins can approve/publish a pending central Product from review;
listing approval by admin/tenant roles cannot bypass that catalogue approval gate. Archive/reactivation Size writes use the actual lowercase subproduct
field plus tenant; archive uses valid discontinued availability, reactivation
checks stock minus reserved before choosing available/out_of_stock. Reservations
are not created/released by this review.

All input validation precedes document writes. The legacy approval still writes
multiple documents sequentially; it is not a MongoDB transaction, and a storage
failure can require reload/retry. This work does not claim atomic publication.
No schema migration, automatic tenant-price/cost/rate edits, or production data writes.

## Verification

Final focused admin: 31 tests pass. Final focused backend: 40 pass.
Full backend run: 3,953 passed, 0 failed, 16 skipped. Full admin run: 389 files,
3,093 tests passed. Subsequent narrowly targeted pack-override and parent-approval
regressions passed in the final focused runs. Scoped lint/whitespace checks pass;
359 pre-existing project type diagnostics remain, with none in new review files.
The live admin redirected to sign-in, so the protected modal was not visually
verified. No credentials were used and no real approval/decline was submitted. Full suites, scoped lint,
types and final limitations are recorded in RESUME-subproduct-review-pricing.md.

## Worked unit example

Recorded cost 1,000, tenant markup 25% → payout 1,250. A customer price of 1,500
gives the tenant 250 gross profit / 20% gross margin and the platform 250 gross
profit / 16.7% gross margin. A 20% platform target proposes 1,600 after rounding,
but leaves the tenant payout at 1,250. A 30% tenant target instead requires payout
at least 1,428.57; raising only the website price cannot achieve it.

## Workspace refinement

Continued design/functionality improvements (search, filters, price deltas, bulk
suggestions, reset and actionable blockers) are documented separately in
[subproduct-review-workspace.md](subproduct-review-workspace.md). Pricing and
Tenant revenue policy remain unchanged.

2026-10-17 revenue-model correction supersedes the fixed-payout assumption for
commission only: see `revenue-agreement-pricing.md`. Commission payout follows
final discounted merchandise; markup payout stays fixed. New commission price
overrides do not change contractual rates or supplier costs.

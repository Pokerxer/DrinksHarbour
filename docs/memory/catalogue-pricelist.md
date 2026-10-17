# Sales catalogue selected pricelist

2026-10-16 follow-up: user reported catalogue prices differed from the main sales
editor. The original client estimate fix was insufficient: Sales uses platform
base pricing plus the server pack/wholesale/bundle engine; catalogue used raw
retail plus POS client math.

Normal catalogue requests now opt into server pricing, passing explicit selected
pricelistId and quantities. sales-catalogue-pricing.js quotes each variant via
computeLinePricing with tenant-scoped batch records. Preserve salesPricing through
mapping; do not run POS rules on top of that quote. Added draft selections carry
enginePriced=true, preserving the price until existing document preview/save.
Cache keys include list/quantities; stale responses are ignored; keep expanded
cards mounted. Quantity-only repricing leaves controls active; scope/list/stock
refreshes still block until loaded. Missing quotes show retry
errors. Browsed candidates are independent quotes, not an artificial cart.
Cart-wide adjustments and manual overrides belong to the order.

Verified: 28 live read-only quote comparisons matched; 62 targeted frontend tests
and 3,893 backend tests passed (16 skips). Global TypeScript has existing errors;
no new catalogue errors. No database writes, release or manual service restart.

[Session handoff](../superpowers/specs/RESUME-catalogue-pricelist.md).

Quantity responsiveness follow-up: debounce quantity quotes by 250ms and cancel
superseded work; default quantity1 reuses its existing quote. Distinguish price
loading from interaction blocking so Add size → quantity edits are immediate.
Show Updating prices while authoritative pricing catches up. Regression covers
rapid clicks, slow responses, batching, late-response rejection and returning to
a prior quantity. See handoff for final verification counts.

Quantity follow-up verified:63 targeted frontend tests passed, final focused22
passed, full backend3,893 passed/16 skipped. Global TypeScript has existing
diagnostics; no catalogue/hook errors. No release or database mutation.

Populated warehouse query fix: useSalesCreateForm must expose warehouseIdStr as
its public warehouseId. Returning raw populated state let consumers serialize
[object Object] despite `as string` casts, causing WarehouseStock ObjectId500s.
Picker/catalogue/scanner/selector/autosave now consume the normalized ID. Initial
and asynchronously loaded populated order references, warehouse change and
clearing have hook regressions. No backend error suppression or scoping changes.

Warehouse fix verified with32 focused frontend tests plus the3 warehouse tests
(including the real picker/service URL path). Backend3,893 passed/16 skipped.
Global TypeScript retains existing diagnostics; none in changed warehouse files.

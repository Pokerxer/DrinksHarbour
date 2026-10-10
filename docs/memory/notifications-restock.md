# Restock functionality and logic

2026-10-09. Continues approved AI restock/vendor orders; no automatic purchases,
stock mutations, supplier messages or external AI calls. Local trained forecasting
remains dh-demand-ridge-v1, with explicit historical baseline/missing-history labels.

server/services/restock/replenishment.js computes supplier-horizon daily balances,
subtracts outgoing commitments and preserves shortages before later arrivals.
Timed supply excludes overdue, undated and post-horizon deliveries; midnight
arrivals belong to the new Lagos day. Show the pre-delivery gap separately because
this supplier cannot resolve it. Protect safety throughout the remaining horizon
and active minimum at delivery without double-counting lead-demand reserve.

supplier-plan.js retains exact matching tier terms for manual review when maximum
limits prevent the full quantity. Negative stock, unposted receipts and unconfirmed
purchases require review; existing transfer-first safeguards remain. Prefer usable
supplier offers within currency. Invalid packaging/tier terms are rejected and
observed lead times ignore future completed-purchase dates. publicPlan now redacts
stock/demand evidence in nested offers when the user lacks those permissions.

The restock folder separates results/selection rules from supplier inputs and
quantity evidence. Filters/counts/ranking follow chosen supplier and reviewed units,
with ready/manual/transfer/covered/excluded states. Preserve hidden selections and
block preparation on any invalid quantity. Exact forecast/warehouse links and
reset/exclude controls support review; saved purchase terms are revalidated.
Handoff: docs/superpowers/specs/RESUME-restock-functionality.md. Uncommitted/undeployed.

Verified: full backend 3,613 passed / five skipped, full dashboard 2,618 passed
across 286 files; focused backend 100 and final restock/vendor UI 17 passed.
Final scoped types, lint, formatting and whitespace passed. Suite runs were
sequential. Browser preview remains unavailable; no visual claim or deployment.

Compact card update (2026-10-09): restock-product-card/grid/modal.tsx now show
image/name/location/status and two key figures, with supplier editing, full
quantities and evidence in an accessible modal. RestockLine embedded mode omits
duplicate identity. Quantity/supplier choices remain in results; closing details
keeps edits. Resolve open products against all scoped rows so edits that remove
a product from the active filter do not unmount its editor. Filter/sort/page and
scope/plan changes close selection. /notifications/vendor-orders shares this UI.
No backend or forecasting changes were needed. Verification in the handoff.

Card/modal verification: full dashboard 286 files / 2,621 tests passed; fresh
backend 3,613 passed / five skipped. Focused restock/vendor UI 20 passed, scoped
types/lint/format/whitespace passed. Regression covers editing the last card on
a filtered page: use requested page in the grid key, so automatic pagination
clamping preserves the modal. Escape/close and focus return are tested. Browser
visual verification unavailable. Current work remains uncommitted/undeployed.

Restock detail accuracy/inputs (2026-10-09): unsupported forecasts retain known
warehouse balance after commitments, reserve and timed arrivals; missing demand
remains null. Invalid forecast dates cannot label arrivals timely. The modal
explains unavailable demand/cover with its original reason even when transfer
review also applies. Reviewed quantity updates ending balance and excess units.
Full-width supplier control exposes complete price/pack/MOQ/maximum terms; clear
selection removes quantities; pack steps obey limits; blank inputs stay invalid.
Use scoped !border to override the shared input reset. Posted net transfer-out
consumption is shown separately from customer sales. Verification in handoff.

Verified detail update: full dashboard 287 files / 2,626 passed; backend 3,615
passed / five skipped. Focused UI 25 passed, scoped types/lint/format/whitespace
passed. Browser kernel unavailable. Uncommitted and undeployed.

Order-unit correction: missed forecast sales before supplier delivery no longer
inflate the later purchase. Keep actual uncovered outbound commitments, and
protect safety/active delivery minimum through the post-arrival daily horizon.
Expose forecastAfterDeliveryUnits alongside full demand; only-before-delivery
demand yields zero later order plus earlier-supply review. Smaller reviewed
orders show the remaining calculated requirement. Pack rounding and incoming/
transfer review guards remain. See RESUME-order-unit-calculation.md.

Order-unit correction verified: full backend 3,619 passed / five skipped; full
dashboard 291 files / 2,646 passed. Focused backend 36 and initial focused UI
36 passed; final status regression is covered by the full suite. Scoped types,
lint, format and whitespace passed. Browser visual preview unavailable. Current
work remains uncommitted/undeployed.

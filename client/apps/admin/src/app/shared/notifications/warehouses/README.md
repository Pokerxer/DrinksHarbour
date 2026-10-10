# Warehouse notification view

This is the dedicated `/notifications/warehouses` view. The approved warehouse
forecast and notification-page specs remain authoritative. Read the handoff at
`docs/superpowers/specs/RESUME-notifications-warehouses.md`.

`warehouse-rules.ts` classifies and selects exact product/size/location entries.
Missing balances stay unknown; negative/zero balances are out of stock. Forecast
risk requires supported local evidence. Below-minimum filtering includes rows
that also have forecast risk. Default priority: depleted stock, urgent forecast,
other forecast risk, below minimum, then supported stock-cover days and combined sales/transfer demand.

`warehouse-page.tsx` loads the authorized full warehouse plan. Local warehouse
selection preserves URL product/size scope without refetching the same complete
plan. This keeps location summaries consistent. The `unassigned` URL bucket is
accepted only by this view and is removed from API queries; no fake warehouse ID.
Unassigned opens the unknown-stock view. Filter/search/sort changes reset paging;
25 rows per page are selected after complete-set sorting.

`warehouse-summary.tsx` counts entries, not summed stock across locations. Totals
cover the current product scope. Empty active warehouses remain visible with an
explicit no-records state. Forecast statistics require report access.

`warehouse-product-row.tsx` shows the product image/name/size/location, status and
available/minimum units. Its whole native button opens the detail modal.
`warehouse-product-details.tsx` holds trigger, minimum, recorded local sales, stock
cover, incoming quantities and detailed arrival/evidence limitations. Unknown
stock suppresses purchase preparation. Exact product/size/warehouse links lead
to existing forecast/restock pages; no stock mutation or automatic order here.
API permission flags control demand facts and purchasing actions.

`warehouse-transfer-panel.tsx` shows usual routes (three completed deliveries),
source surplus after commitments/demand/buffer, pending transfer follow-ups and
uncovered needs. Received returns reduce route evidence. Pending stock never
clears current depletion or gets an invented arrival date. Outgoing commitments
can raise source risk while physical stock remains visible. Only owner/admin
purchase access reveals transfer preparation/document links.

Prepare uses `purchases/use-warehouse-transfer-prefill.ts`: fresh full allocation,
then exact source stock/cost/pack, then editable existing transfer form. Save
validates the transient recommendation against a refreshed allocation. Source
allocation occurs before warehouse filtering so donors elsewhere remain usable.
See `docs/superpowers/specs/RESUME-warehouse-transfer-planning.md` for handoff.

Warehouse API flags separate stock actions from supplier evidence:
`canManageTransfers` enables owner/admin transfer documents and preparation;
`canReviewRestock` enables replenishment review links. `canPurchase` continues to
control supplier-plan data. Staff see permitted stock/transfer facts without
management links. Do not infer transfer permissions from canPurchase alone.

The transfer-follow-ups tab and attention counts include pending incoming and
outgoing documents even when physical stock is healthy/unknown. Warehouse cards
count affected stock entries, not distinct transfers. Source rows with missing
ledgers remain unknown but retain outgoing references and verification reasons.
`warehouse-transfer-status.tsx` renders shared direction/status/action guidance.
Stock-at-risk counts include outgoing commitments without claiming AI forecasts.

Card design: `warehouse-product-row.tsx` is a compact summary in a responsive grid.
The next action and full stock evidence live in `warehouse-product-details.tsx`. `warehouse-product-metrics.tsx` separates recorded sales,
stock cover and pending supply. `warehouse-transfer-links.ts` supplies the same
exact preparation URL for the primary action and detailed source panel.
Zero/negative known stock displays Depleted independently of forecast eligibility.
Complete empty sales evidence displays 0 recorded sales, not Unknown. Ambiguous
location/date evidence remains incomplete, showing assigned units plus the cause.
No zero-filled training history is invented. Missing forecasts show recorded-day
requirements and Review sales history. Supplier review stays secondary to safe
internal supply. Warehouse evidence details omit unsupported numeric demand.

`warehouse-minimum-policy.tsx` explains the automatic local minimum, its delivery
window and safety reserve, or the Learning/incomplete fallback. Demand permission
controls calculation details. Updated dates use Africa/Lagos. Inventory and
notification reads share the persisted effective minimum; configured fallback
remains separate. See `RESUME-automatic-stock-minimum.md` for eligibility.

Minimum cards distinguish Automatic estimate (7–27 recorded local days) from
established Automatic minimum. Short histories use an explicit Early sales baseline;
full trained forecasts continue to require their existing stronger evidence.
Learning fallback now needs seven days and one sale or posted transfer out, rather than four sale days.

## Compact cards and modal

`warehouse-product-grid.tsx` owns one selected line key. It resolves that key from
current visible data so refresh updates facts and permissions; removed entries
close the modal. Its page key changes on status/search/sort/paging; warehouse and
product scope already remount the page group. Details never stay open in another
scope. Full transfer/restock/forecast links retain exact product/size/location.

`warehouse-product-modal.tsx` uses the existing Headless UI modal primitive for
Escape/backdrop dismissal, focus trapping/restoration, scroll lock and labelled
dialog semantics. Header/close stay visible; the details body scrolls. Actions
and report facts remain permission-gated, including evidence details.
`warehouse-product-image.tsx` uses actual tenant override/catalogue imagery and
an icon fallback on missing/load failure; a new source can recover after failure.
The planning API now selects image fields and returns only the resolved image URL.

### Source warehouse demand from transfers — 2026-10-09

Source minima and forecasts use local sales + posted net transfer outflow.
Fastest stock movement sorting includes both; customer-sales totals stay separate.
`warehouse-demand-breakdown.tsx` shows customer sales, net transfers out and total
demand in the detail modal when report access permits. Returns are deducted;
document/ledger mirrors deduplicated, pending commitments remain separate.
Minimum explanations use the persisted demandBasis; transfer-only early policies
say Early demand baseline. See RESUME-transfer-out-demand.md for refresh and tests.

The main modal metric now shows Stock movement and its 30-day daily rate when
transfers contribute, using combined demand rather than customer-only sales.
The separate breakdown retains both sources. Missing combined demand stays
unknown for fastest-movement and priority sorting; only older responses without
the combined field may fall back to sales. Report permissions still hide all
demand metrics. Pending transfers are commitments, not historical movement.

Presentation update (2026-10-09): shared POS feature header, metric filter cards
and compact search/location/status/sort/reset toolbar. Summary metrics count the
selected location; location cards preserve all donor locations. Reset retains
location, clears search and restores attention/priority. Transfer logic and modal
permissions are unchanged. See RESUME-notifications-shared-design.md.

Custom timeframe: From/To control preserves location/product scope. Fastest stock
movement sorting uses selected-period customer sales plus posted net transfers
out. Details display period movement separately from current stock cover/minimums.
Default movement remains 30 days; missing period evidence remains unknown.

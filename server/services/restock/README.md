# Tenant demand and replenishment planning

Read the approved 2026-10-09 AI restock, warehouse priority and notifications
feature-page specifications in `docs/superpowers/specs/`.

Modules in this folder separate evidence reads from pure forecasting, supply,
risk and supplier calculations. No external AI provider, cross-tenant training,
automatic orders or emails. Ridge regression is the local trained model; a
baseline is explicitly labelled. All quantities are sellable units; packs only
round positive purchase quantities. Purchase cost is protected by purchasing
role/plan access and never enters report-only responses or stock-only notices.

Customer sales come from actual persisted order-line or posted fulfillment
sources. Source warehouse demand adds posted net transfers out via transfer-demand.js
and local-demand.js; returns reduce outflow, receipts suppress ledger mirrors, and
pending dispatch intent remains an outbound commitment. Missing source stays unknown. Posted supply is never counted twice.
Forecast refresh is separate from lightweight stock-only inbox synchronization.

Report summaries combine known tenant/variant sales without allocating missing
warehouse evidence. Summaries never enter warehouse alert or purchase groups.
Eligible supplier terms remain visible with a zero/manual-review quantity when
local forecasting is unavailable. A reviewed manual quantity must still satisfy
pack/quantity tiers and current supplier terms at purchase save.

The two seven-day validation blocks do not match delivery-plus-cover horizons.
`minimum.js` uses actual recent daily demand variability and two review days for
its automatic safety buffer; unsupported local histories retain configured policy.
See `docs/superpowers/specs/RESUME-ai-restock-vendor-orders.md` for live evidence,
verification totals and remaining data limitations.


Transfer planning is in `transfer-evidence.js` and `transfer-plan.js`. Tenant and
exact size references are validated by the reader. Active outbound commitments
reduce projected source balance; reserve source cover demand plus policy buffer.
Completed net receipts and direct paired movements identify usual source routes.
Incoming transfers avoid duplicate preparation without assumed timely arrivals.
`transfer-purchase.js` rechecks editable transfer preparation on creation. Read
`RESUME-warehouse-transfer-planning.md` for current verification and semantics.

`transfer-followups.js` decorates incoming/outgoing documents before balance
eligibility checks, preserving unknown-ledger follow-ups. Pending sources and
receiving destinations both get location entries even with missing stock records.
Warehouse action flags derive from JWT-authorized inventory access and tenant
owner/admin role; supplier data remains absent from risk/demand responses.

Automatic stock minimums are calculated separately for every tenant product,
size and warehouse. `minimum-lead.js` selects exact route/receipt delivery history;
`minimum-storage.js` saves eligible policies to existing scoped stock rows with an
optimistic timestamp guard. Daily demand refresh and owner/admin planning reads
update them; stock-only reads consume saved policies. Configured minima remain
separate fallbacks. Metadata expires after 48 hours and decreases are limited to
25% per Lagos day. Private demand inputs are excluded from raw inventory reads;
warehouse stock APIs expose only effective/configured minimum, source and date.
See `RESUME-automatic-stock-minimum.md` for formula, eligibility and verification.

Minimum eligibility differs from full forecast eligibility: seven completed local
days and one recorded sale or posted transfer out allow a labelled short-history baseline. Four positive
consumption days are no longer required for sparse products. At 28 days, use supported
historical/trained forecast demand; trained model validation remains unchanged.
Never allocate old warehouse-free online sales to a guessed location.
`insightReceiptRecovery.js` recovers missing legacy POS links only from a unique
explicit Sales reconciliation receipt reference, matching tenant/product/size and
represented quantities. It runs in memory; linked returns/deduplication still apply.
`node scripts/refresh-stock-minimums.js --tenant=slug` previews one approved tenant;
add --apply to save eligible automatic policy metadata only.

Warehouse card imagery is resolved by stockProductImage from tenant imagesOverride,
then central Product.images. Reader selects those fields; plan lines expose only
the selected URL as productImage. No extra client fetch or data mutation.

Transfer demand implementation and verified tenant refresh are documented in
`docs/superpowers/specs/RESUME-transfer-out-demand.md`. Minimum policy demandBasis
records sales/transfers/sales_and_transfers. Combined demand feeds minimum, stock
cover, reorder forecasts and donor reserves; financial/customer sales and tenant
summaries stay customer-sales-only. Receipt item indices survive variant filtering.

Sales without warehouse attribution never create a duplicate unknown stock line:
real stock snapshots own current stock-location entries. Unknown sales retain
local forecast/minimum limitations and tenant sales summary visibility. Actual
unassigned stock snapshots remain visible until explicitly assigned. Wyn City
assignment: RESUME-wyncity-notification-assignments.md and the audited manifest.

Performance tenant summaries expose selected productImage and salesDataStatus.
A complete empty customer-sales set returns units30/units7/dailySales zero;
uncertain fulfilled records remain null. Tenant summary zero/known totals do not
allocate warehouse-free sales to locations. Dedicated performance page uses
customer sales, including records with known quantity/date but missing warehouse.
See RESUME-notifications-performance.md and docs/memory/notifications-performance.md.

Custom timeframe sorting: `period.js` adds selected/preceding sales totals and
selected net transfer outflow without replacing live forecast/risk fields.
`reader.js` includes older/preceding evidence, cache keys include both dates and
`access.js` redacts period demand for users without reports. Custom-range reads
skip minimum persistence and alert generation. Date endpoints use inclusive
Lagos days, up to 366 completed days. See RESUME-notifications-timeframe.md.

Forecast validation (2026-10-09): model.js chooses a trailing mean or weekly
seasonal baseline by chronological validation. validation.js exposes empirical
fit grade/reason. Ridge must beat the chosen baseline and produce the full
forecast before it is labelled trained AI. At least 35 completed days support a
7-day held-out check; 42+ supports two checks. 28–34 days remains an unvalidated
baseline. Unknown/invalid history and short generated horizons keep null totals.
See RESUME-forecasts-functionality.md for page projection semantics and tests.

Supplier restock projections (2026-10-09): replenishment.js simulates daily balances
through supplier delivery + cover, using plan generation time to exclude overdue
arrivals and assigning midnight arrivals to the new Lagos day. The order protects
safety through the remaining horizon and an active minimum at delivery; it never
adds lead demand twice as a final minimum reserve. Maximum uncovered balances
after delivery preserve temporary shortages before later incoming supply. A
separate pre-delivery gap requires earlier delivery/transfer review. Calendar-day
arrivals assume availability before that day's modeled demand; confirm timings.

supplier-plan.js retains matching tiers with zero/manual-review quantity when a
full quantity exceeds their maximum. Prefer usable offers within tenant currency.
Negative stock, unposted receipts and purchases lacking a confirmed arrival require
review before suggesting another supplier order. Internal transfer review still
blocks duplicate automatic purchases. Invalid pack/tier terms are excluded;
observed lead times use completed past purchases only. publicPlan removes nested
projection evidence and automatic quantities if inventory/report access is absent.
Generic warehouse risk math remains separate. See RESUME-restock-functionality.md.

Restock detail accuracy: replenishment.js collects independently known balance,
reserve and timed-arrival facts before checking forecast eligibility. Unsupported
forecasts retain those facts and a manual-review reason; dependent demand, cover
and order quantities remain null. Invalid start dates cannot classify incoming
units as timely. Client details distinguish unavailable cover from a supported
projection that does not deplete within its horizon. No changed stock mutation.

Order units (2026-10-09): supplier projections separate unmet forecast sales
before delivery from the later order. Pre-delivery demand cannot create a
fictional backorder; actual uncovered outgoing commitments remain obligations.
Daily deficits after arrival protect safety and the active minimum at delivery,
then round once through supplier pack/MOQ terms. Demand existing only before this
supplier arrives produces zero later order and an earlier-supply warning. Full
horizon and after-delivery demand are exposed separately. Generic warehouse risk
and transfer planning remain unchanged. See RESUME-order-unit-calculation.md.

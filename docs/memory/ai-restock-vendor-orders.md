# Notifications demand and vendor order planning

2026-10-09: user approved and implementation delivered in the existing checkout.
Canonical handoff: `docs/superpowers/specs/RESUME-ai-restock-vendor-orders.md`.
Plan: `docs/superpowers/plans/2026-10-09-notifications-demand-planning.md`.
Three approved companion specs describe AI restock, warehouse risk, individual pages.

Nine notification routes: inbox, stock, warehouses, performance, forecasts,
restock, vendor-orders, products and expiry. Backend `server/services/restock/`
separates pure model/supply/risk/offers from bounded tenant readers and APIs.
Use exact tenant SubProduct+Size+Warehouse. Missing sales location stays unknown;
tenant summaries may forecast total demand but never allocate it to warehouses.
Local ridge `dh-demand-ridge-v1` is used only after chronological validation beats
seasonal naive. Insufficient history is honest; labelled baseline where available.
Purchases inform supply/lead time, never demand. Supplier quantity tiers, pack/MOQ,
compound discounts and vendor/currency/destination grouping are enforced.

Owner/admin Growth+ purchasing; inventory/report access separately. No
purchases:read permission exists. JWT tenant authority only, no client tenant pivot.
Supplier costs stay out of report responses and notifications. Preparing fills
an editable form; current terms are verified again at save. No automatic order,
email or external AI provider. Keep stock-only inbox synchronization lightweight.

Live preview: Wyn City 615 low-stock entries, 142 tenant-wide historical baselines,
two local baselines, 61 supplier matches; older warehouse evidence is largely
missing. No trained models/positive automatic order groups selected on current
data. Matching suppliers still display with zero suggested quantity/manual review.
14-day default cover; 7/30 alternatives. Configured buffer shown as policy because
seven-day validation does not match delivery-plus-cover horizons.

Final verification: backend 3,528 passed/five skipped/zero failed; admin 2,535
passed in 269 files on complete rerun; feature TypeScript and lint passed.
One initial existing inventory timeout passed isolated and in complete rerun.
Browser automation unavailable; API/component and live preview verified. No commits/pushes/deployment. Preserve
unrelated dirty changes and existing notification population/index fixes.

Warehouse page refinement completed: dedicated location summaries and attention-first
product list under `notifications/warehouses/`, without changing other insight
routes. See `docs/superpowers/specs/RESUME-notifications-warehouses.md`.
Warehouse refinement implemented: warehouse summaries, status/search/sort,
attention-first 25-row lists, incoming/evidence detail, exact restock links.
Unassigned bucket opens unknown balances and never reaches the API as an ID.
Zero/negative stocks remain urgent even with insufficient or zero demand;
zero demand does not manufacture order quantities. Twelve focused tests pass;
final suite results are recorded in the warehouse handoff.

Warehouse final verification: backend 3,531 passed/five skipped/zero failed;
dashboard 2,547 passed across 272 files; feature TypeScript and lint passed.
See RESUME-notifications-warehouses.md for exact behavior and browser limitation.

Transfer-aware warehouse extension active; see RESUME-warehouse-transfer-planning.md.
Dispatch does not debit source stock; receive does. Modern transferredQty is a
receivedQty alias, so pending calculations must use planned quantity when a
real dispatch/receipt marker exists. Never invent arrival dates from scheduledDate.


### Transfer-aware warehouse implementation completed — 2026-10-09

Usual routes require three distinct net-positive completed deliveries. Direct
paired warehouse movement groups are also supported; returns reduce receipts.
Current dispatch does not debit warehouse stock; transferredQty aliases receivedQty.
Reserve unreceived outbound quantity once, plus donor forecast demand and buffer.
Keep incoming undated goods out of on-hand/projected timely cover. Show approval,
dispatch, receipt and source shortage follow-ups. Allocate safe donor stock once
across priority destinations, before filtering the response by warehouse.
Prepare exact product/size/source/destination in the existing editable form using
fresh plan and stock/prices; save rechecks allocation. No automatic transfer/order.
Read `docs/superpowers/specs/RESUME-warehouse-transfer-planning.md` for final tests
and live data limitations. Wyn City: 14 usual-route entries; 8 suggestions/66 units,
minimum-policy/manual guidance where local sales evidence is insufficient.

Final verification: backend 3,545 passed/five skipped; admin 2,551 passed;
additional source-attention regression included in ten passing focused UI tests.
Feature TypeScript/ESLint passed. No remaining implementation work for this scope.

### Local missing warehouse-risk route repaired — 2026-10-09

The dashboard uses localhost:5001. A stale non-reloading API preview occupied
that port, so authenticated warehouse-risk requests fell through to 404 even
though current source registered the endpoint. Replaced the stale listener and
competing non-listening supervisor with a watched preview of the current app.
Authenticated own-product request now returns 200; eight route/access tests pass.
No API source change. See RESUME-warehouse-transfer-planning.md for runtime/log
paths and preview flags; preserve disabled schema auto-creation/indexing.

### Warehouse follow-up functionality — 2026-10-09

Do not gate warehouse transfer actions using supplier canPurchase visibility.
canManageTransfers/canReviewRestock derive from inventory plus owner/admin role;
risk/demand responses still redact supplier details. Pending incoming/outgoing
transfers remain actionable for healthy and unknown balances. Shared status cards
link approval/dispatch/receipt review; unknown source stock retains its outgoing
entry and verification prompt. See transfer handoff for verification totals.

Follow-up final checks: backend 3,548 passed/five skipped; dashboard 2,555 passed.
Feature TypeScript and ESLint passed. Live owner response returns 200, both
action flags true, supplier evidence absent. Changes remain uncommitted.

### Warehouse card data/design — 2026-10-09

Complete empty local sales reads mean 0 recorded sales, not an unknown total.
Unassigned sales or uncertain fulfillment history still mean incomplete evidence.
Expose salesDataStatus/recordedUnits30 only with reports permission; do not infer
training dates or substitute missing warehouse sales. Known zero stock has depleted
cover regardless of forecasting eligibility. Cards emphasize actual stock, cause
and safe transfer preparation; future forecasts show history requirements.
Caymus user example has 0 at Cloud Bay and 22 elsewhere, no dated sales rows;
minimum-policy transfer recommends 11 units. See transfer handoff for verification.

Card pass verified: backend 3,550 passed/five skipped; dashboard 2,557 passed.
Feature types/lint passed. Read-only Caymus check confirms 11 from Wyn City to
Cloud Bay, 0 recorded local sales, no supported forecast history. No data repair
or invented history; browser tool unavailable, no visual-browser claim.

### Automatic local stock minimums — 2026-10-09

Implemented sales-driven tenant/variant/location minima with lead-demand +
review/variability safety reserve. Require 28 local history days and four sale
days with reliable dates/location. Use usual transfer delivery history, then
fully received local purchase history, then labelled seven-day assumption.
Update on owner/admin planning refresh and daily demand job. Persist only existing
scoped stock rows; optimistic timestamp protects concurrent refreshes. Stored
configured minimum remains fallback; auto metadata is private, effective minimum
is shared by alerts, warehouse inventory views and donor reserve calculations.
Limit reductions to 25% per Lagos day, same-day non-compounding; expire after 48h.
Current read-only tenant preview: 0 eligible / 999 learning / 314 incomplete lines;
Caymus retains 10 because its dated local history is empty. Do not invent demand
to activate it. See automatic-minimum handoff for current checks and file map.

Automatic-minimum verification: backend 3,563 passed/five skipped; dashboard
2,559 passed across 276 files; 14 focused policy tests passed (includes one
receipt-history case added after full backend run). Scoped types/lint passed.
Work remains uncommitted; no stock/data repair or deployment performed.

### Fix minimum eligibility with existing records — 2026-10-09

The former 0-eligible outcome was a policy bug: all 23 real local histories failed
the four-sale-day gate; only four reached 28 days. Minima now accept seven local
days and a real sale, with early confidence/short_history_baseline under 28 days.
Sparse histories no longer need four positive days; full trained forecasts keep
their stronger requirements. Read-time exact reconciled receipt recovery fixes
two false uncertain products without editing old transactions. Tenant, product,
size, quantity, reference uniqueness and return/deduplication checks remain.

Applied explicit wyncity refresh: 23 policies saved and readback verified (19
early, four established); 978 learning and 312 incomplete remain fallbacks.
Caymus still has zero local history; don't invent demand. Script previews by
default and requires --tenant=slug, with --apply for policy-only writes.
Full backend 3,570 passed/five skipped; dashboard 2,560 passed/276 files. Focused
40 passed, types/lint passed. See RESUME-stock-minimum-history-fix.md. Uncommitted.

### Compact warehouse notification cards — 2026-10-09

Warehouse cards show actual image/name/size/location/status and available/minimum
units. Full details and exact transfer/restock/forecast actions moved to an
accessible modal using the existing core Headless UI primitive. Grid owns one
selected key resolved from current visible data; updates show refreshed facts
and permissions, filters/scopes/paging reset it, missing entries close it. Image
resolver prefers tenant override then catalogue, with missing/error fallback.
Detailed evidence is explicitly demand-gated. See RESUME-warehouse-card-modal.md.
Backend 3,571 passed/five skipped; dashboard 2,563 passed/276 files; scoped types
and lint passed. No added writes/deployment/commit; browser preview unavailable.


### Transfer-out demand for minimums — 2026-10-09

Source warehouses now use net customer sales + actual posted transfers out for
automatic minima, forecast cover, replenishment quantities and donor reserves.
Customer sales/revenue summaries remain separate. Receipt/completed documents
suppress movement mirrors; direct movement history is supported. Returns net
against matched parent product/size/location, once; draft/dispatch intent stays
commitment, unknown posted dates remain incomplete. Reader preserves receipt
item indices. Minimum demandBasis persists; detailed modal/report fields expose
customer sales, net transfers and total demand only with report permission.
Fastest stock movement sorting includes both; compact cards remain unchanged.
Wyncity: 38 saved/readback-verified policies (15 early/23 established), basis
15 transfers/19 mixed/four sales. Caymus Honor Flight transfer history now supports
13-day early minima: Wyn City 23, Cloud Bay 45. 963 learning/312 incomplete remain.
No physical stock/order/history mutation. See RESUME-transfer-out-demand.md for
verification and the implementation map. Focused backend 53 passed; dashboard
2,566 tests/276 files passed; scoped types/lint passed. Uncommitted/undeployed.

Final backend 3,583 passed/five skipped; final warehouse UI 28 passed. Repeated
final tenant apply verified all 38 after exact return-parent validation. Guidance
now names transfer demand history; fallback and financial sales remain separate.


### Wyn City notification assignments — 2026-10-09

Explicit user-authorized scoped transaction assigned 171 audited products to
Wyn City warehouse: filled 169 missing defaults, inserted 32 verified zero stock
rows, recorded 170 changed-product audits. Existing quantity/reservation/location
invariance and transaction readback verified. Fresh planning read has zero
unassigned entries (was 172); dry rerun requires zero writes. Missing-location
sales remain limitations/tenant summary evidence rather than duplicate unknown
stock cards. No historical transaction location guessed or changed. Real missing
stock snapshots still appear unassigned. Full backend 3,590 passed/five skipped;
focused 21 passed; script syntax passed. See RESUME-wyncity-notification-assignments.md
and docs/reports/wyncity-notification-assignments-2026-10-09.md. Uncommitted.

Product performance now has a dedicated view; see notifications-performance.md
and RESUME-notifications-performance.md for sales/trend rules and verification.

Restock functionality follow-up (2026-10-09): supplier daily quantity projections,
retained tiers/manual review, nested permission protection and chosen-supplier
filters/quantity controls are documented in notifications-restock.md and
RESUME-restock-functionality.md. Backend 3,613 passed/five skipped; dashboard
2,618 passed; scoped checks passed. Generic warehouse risk remains unchanged.

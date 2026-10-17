---
name: Admin product edit header design
description: Screenshot findings and proposed bounded header redesign.
type: project
---

## Request — 2026-10-16

User supplied the crowded product-edit header and requested a proper redesign.
Actual route: admin products/[slug]/edit. Header is inline in the large
shared/ecommerce/product/create-edit/index.tsx. Read-only findings: duplicate
record navigation, title competing with actions/metrics, tiny metric captions,
Purchased hardcoded to zero, Settings/More actions that only log or show coming-
soon toasts. Do not imply those actions or metrics are functional.

User-approved bounded design: first row title/status/back and
primary Save plus secondary New/AI; second row readable real metrics, website
preview, one record navigator and compact search-context chip. Responsive wrapping
with 44px mobile controls; one compact overflow for real secondary operations.
Remove duplicate nav and misleading placeholder controls/metrics from this header.
Preserve product form, save/validation, navigation query context and AI workflows.
Extract ProductEditHeader and focused navigation/metric pieces beside the form,
each under 200–300 lines. Use existing admin typography and neutral/brand tokens.
Tests should exercise action callbacks, nav boundaries and accessible labels.
Implemented locally. No deployment/commit requested. New components live
in create-edit/header/: ProductEditHeader, HeaderMetrics, RecordNavigation, types;
colocated header tests cover callbacks and bounds. Preserve form-owned handlers.

## Delivered

Top row separates wrapping product title/status from New, AI assist and primary
Save changes. All primary/record buttons use 44px targets and clear accessible
names. Second row shows real stock, full NGN reference price, tenant listing
count/link and sold units; no hardcoded Purchased value or coming-soon actions.
Exactly one navigator keeps existing search context and previous/next callbacks,
and disables boundaries or busy navigation. Website preview keeps the existing
destination and now uses noopener/noreferrer. No unrelated routing change.

The old timestamp is browser draft persistence, not platform save time: dirty
state shows Unsaved changes plus Draft saved on this device at… where available.
Only a successful clean form/save reports saved; errors remain visible. Existing
form validation, step navigation, AI generation and persistence handlers stay in
the parent. Removed the obsolete SmartButton/dropdown states and handlers along
with over 500 lines of inline header rendering. New files remain below 200 lines.

Verification: five focused component tests passed; scoped legacy-config ESLint
passed (ESLint 9 default initially rejected the repository's eslintrc format;
ESLINT_USE_FLAT_CONFIG=false uses the existing configuration). Full admin type
check reports 359 diagnostics outside changed header files. Full admin Vitest run
and its unrelated inventory/customer-returns failure are recorded in
/tmp/drinksharbour-product-edit-admin-tests.log; focused log:
/tmp/drinksharbour-product-edit-header-tests.log. Type/lint logs use the same
product-edit prefix. Browser inventory is empty and IAB is unavailable, so live
visual verification is blocked; no substitute browser automation was attempted.
Local self-review under the one-agent rule; CodeRabbit unavailable. No commit,
push, deployment, data mutation or dependency installation. Preserve other work.

Full admin result: 379 files passed/2 failed; 3047 tests passed/2 failed (3049
total; this run included the first four header tests, followed by a separate
5/5 focused run after adding draft-label coverage). Failures outside the changed
feature: customer-returns.test.tsx could not find Open POS receipt; inventory-
movements-browser.test.tsx sorting/reset test exceeded its 5000ms timeout.
Targeted recheck log: /tmp/drinksharbour-product-edit-inventory-recheck.log.
Both inventory files passed on isolated recheck (10/10 tests). Treat the broad-run
failures as intermittent, not unresolved deterministic regressions; retain both
results. Visual layout still unverified because the browser is unavailable.

## On-hand modal follow-up — 2026-10-16 (implemented locally)

User requested clickable On hand opening a full-width data modal. Add focused
files in create-edit/on-hand/: stock-report (typed normalization/filtering),
useProductOnHand (fresh/abortable product read), ProductOnHandModal and StockTable.
Use existing getProductById(id, token, true, signal) response, matching header
tenant-listing/size scope. Do not confuse this with warehouse balances or invent
reserved/available quantities absent from this response. Show missing quantities
as unknown; distinguish empty catalogue listings from lookup failures. Provide
tenant/SKU/size search, summary counts, refresh/retry, focus-safe full-width Dialog
and responsive table. Update header total only for a complete fresh report;
preserve unsaved form fields. Tests cover stock arithmetic, button wiring,
open/close, fresh data, errors/retry, search and late response cancellation.

The entire On hand metric now opens a viewport-width Headless UI Dialog with a
fixed title/footer, scrollable body, summary totals, tenant/SKU/size/status search
and a horizontally scrollable table. It includes every returned size (including
zero stock and inactive listing statuses); no hidden page/row cap. Read failures,
missing auth, no listings and no search matches have distinct states. Quantity
gaps are shown as — and listing/size-total disagreements are flagged. Full totals
follow the same aggregate-first rule as the header, never double count both levels,
and update the header only when known. Browser cache is bypassed by product reads.

Opening/reopening/refresh requests fresh data; product/session/attempt changes,
close/unmount and retries abort/discard old requests. Refresh immediately removes
stale modal data. Headless UI handles Escape/backdrop/close, focus trapping and
restoration; no form resets or stock writes. No schema/API endpoint/dependency
added. Source remains the existing product editor read; warehouse balances and
reserved/available stock are not fabricated from size stocks.

Initial focused verification: 23 tests passed (stock model, modal, header and
product-read recovery). Request cache regression failed before adding no-store.
Scoped legacy ESLint passed. Final suite/type results and logs:
/tmp/drinksharbour-on-hand-{focused,admin-tests,types,lint}.log. Browser visual
verification remains unavailable from this session; no deployment/commit/push.

Final on-hand verification: admin full run 3059 passed/1 failed (3060 tests,
382 files passed/1 failed). Failure is inventory-movements-browser sorting/reset
exceeding 5s, the same intermittent test noted earlier. Final targeted checks:
/tmp/drinksharbour-on-hand-final-checks.log (on-hand/header/read recovery plus
inventory recheck). Scoped lint passes; type check retains 359 diagnostics,
none in changed on-hand/header/product-read files. Three new type issues found
on the first check were corrected with runtime response narrowing and indexed
array iteration; final type log: /tmp/drinksharbour-on-hand-types-final.log.
Whitespace check passed. Browser visual inspection remains unverified.
Final targeted run passed all 27 tests: 23 feature/read/header tests and four
inventory-movement tests. The full-run timeout passed on recheck; retain both
results instead of claiming a completely green broad run.

## Reserved-stock follow-up — 2026-10-16 (implemented locally)

User requested reserved quantities in On hand modal. Size already stores stock,
reservedStock and availableStock, maintained by existing reservation/warehouse
rollups; this is a read-only tracking view, not new reservation writes.
The existing product read is PUBLIC and excludes reservations. Do not add private
fields there. Add GET /products/admin/:id/stock behind protect/authorized roles and
tenant resolution, scoped to JWT tenant (platform admins may read all or target a
resolved tenant). New focused product-stock service returns only stock identifiers,
tenant name, SKU/status and size quantities; no cost/supplier fields. Match Size
records to both listing and tenant, and linked IDs. Size-backed listings use size
balances; only sizeless listings use stored listing totals. Modal now reads this
protected endpoint and shows reserved/available totals and columns, null rather
than zero for unknown reservations, and warnings for inconsistent balances.
Refresh remains manual/current snapshot; actual order reservations unchanged.

Reserved/Available now appear in the stock table and five summary cards. Missing
reservation fields remain unknown, zero is preserved, and inconsistencies/holds
above on-hand trigger review guidance. Available is calculated per stock line
and then summed: an over-reserved size never consumes another size's units.
Regression reproduced the erroneous 8 total vs correct 10 across such sizes,
then passed after the per-line correction. Source fields store existing order
holds; creating/releasing holds is outside this read-only view.

Security: GET /api/products/admin/:id/stock inherits authenticated permitted-role
guards, resolves tenant context, uses JWT tenant authority and private,no-store.
SubProduct product/tenant filter, linked Size IDs and matching subproduct/tenant
pairs prevent cross-tenant references. Tenant names and stock fields only; cost,
supplier and contact data are excluded. Public product response is unchanged.
Client getProductStock uses existing no-store/abort/retry product read handling.
Deploy compatible backend/admin together; no schema migration is needed.

Verification so far: 29 focused admin tests pass, new endpoint service/auth tests
pass, full backend 3918 passed/0 failed/16 skipped (3934 total). Scoped lint passes.
Admin type check retains existing out-of-scope diagnostics; final logs:
/tmp/drinksharbour-reserved-{focused,server,admin-tests,types-final,lint}.log.
No browser visual verification or production data mutation/deployment.

The initial full admin run loaded the old netting implementation before its fix
(3065 passed/1 failed); preserve /tmp/drinksharbour-reserved-admin-tests-before-
netting-fix.log. Fresh full run is *admin-tests-final.log. The new reservation
regression passes in that run; an unrelated customer-returns link assertion
recurred and failed its isolated recheck in *inventory-recheck.log. Do not report a
fully green broad run if this remains in its log. Final type count remains 359,
with no errors in the new stock service method/modal/model files.
Final full admin totals: 3065 passed/1 failed (383 files: 382 passed/1 failed).
Isolated customer-returns recheck: 5 passed/1 failed, missing Open POS receipt link.
This failure persists outside the reservation feature scope. Focused 29 tests,
backend 3918 tests and scoped lint pass; 359 existing type diagnostics remain.

## Sold history follow-up · 2026-10-17

Sold now opens a full-width sales history and uses a private reconciled report for
its header count. Buyer names, dates, quantities/returns, search/date filters and
pagination are documented in [product-sold-history.md](product-sold-history.md).

## Website preview route · 2026-10-17

View website now opens the platform's `/product/<saved-catalogue-slug>` using
`NEXT_PUBLIC_PLATFORM_URL` (fallback `https://drinksharbour.com`). The edit route
parameter is a product ID despite its `[slug]` name; never use it as a storefront
slug. Parent retains the server-loaded slug keyed to record ID, refreshes it from
the successful save response and hides preview until a valid saved destination is
available. Unsaved slug edits do not change the public link. Helper lives in
`header/website-preview.ts`. Four URL regressions and five header tests pass;
scoped lint and diff checks pass. No server changes in this follow-up.

## Sub-Product review follow-up · 2026-10-17

The listing review is now a decomposed full-viewport dialog with local price
suggestions, adjustable existing-setting margin targets and improved action
errors/publication/ownership guards. Canonical details and verification:
[subproduct-review-pricing.md](subproduct-review-pricing.md).

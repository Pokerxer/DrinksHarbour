# Forecast logic and planning view

2026-10-09. `/notifications/forecasts` now uses the dedicated forecasts folder,
with 7/14/30/90-day horizons, fit/status filters, selected-horizon sorting and
daily warehouse shortfall simulation. Date ranges still rank recorded sales;
future estimates stay current. Tenant summaries exclude internal transfers and
never become warehouse order quantities. Warehouse forecasts include posted
net transfer outflow.

Projection subtracts outgoing commitments, includes dated incoming after
plan.generatedAt and before the horizon end, and reports maximum daily deficit
rather than just final balance. Future arrivals cannot hide earlier shortages;
overdue/undated arrivals do not hide current deficits. Unknown history/stock
stays unknown; permission flags gate stock and supplier actions.

Model validation now evaluates mean and weekly seasonal baselines on chronological
7-day blocks. Ridge (dh-demand-ridge-v1, local implementation) must improve the
chosen baseline by 5% and succeed at final prediction. Eligibility: 84 days,
14 positive demand days. Validation starts at 35 histories (seven held-out days),
42+ gives fourteen. Fit labels reflect recent WAPE/error, not forecast probabilities.
28–34 days supports an unvalidated baseline. Missing history has explicit guidance.
Forecast totals are null when the requested horizon exceeds generated daily data.

Details include baseline/model, local demand basis, empirical error/bias, history,
weekly future totals and limitations. Existing exact location/size links handle
transfer/supplier review; no automatic purchasing or stock movement.
Handoff/verification: docs/superpowers/specs/RESUME-forecasts-functionality.md.
Uncommitted and undeployed. Browser preview unavailable.

Verified: full dashboard 285 files / 2,605 tests; backend 3,600 passed / five
skipped; focused backend 87 passed; final forecast rules/interactions nine passed.
Scoped types, feature/service lint and whitespace passed. Overdue same-day
arrivals are excluded using plan.generatedAt across cards, sorting and filters.
Model validation changes also apply to existing warehouse/replenishment planning;
minimum regressions passed. UI evidence-only final text change requires no new
behavior tests. No browser visual-inspection claim.

Forecast card presentation update (2026-10-09): compact image/name/location/fit
buttons now open forecast-product-modal.tsx. forecast-product-grid.tsx owns the
selected row key and expanded forecast-product-details.tsx preserves projections,
validation, evidence/timeline and permission-aware exact action links. Evidence
is open initially. Shared Modal handles focus/Escape/backdrop; filters, sort,
horizon, paging and scope changes close selection. Refreshes use current data.
No backend/model changes were needed for this presentation update.

Card/modal verification: final forecast suite 11 passed; full backend 3,600
passed / five skipped; scoped types, lint, formatting and whitespace passed.
Full dashboard initial run: 2,602 passed / five failed across inventory movement
browser and receipts during the concurrent backend run. Both files passed on
isolated rerun (eight tests) after backend completion; no inventory changes.
See updated handoff for exact failure names and logs. Browser remains unavailable.

# Forecast page

The `/notifications/forecasts` route uses `ForecastPage`, not the legacy generic
insight compositor. API access remains the tenant-scoped `/api/reorder/demand`.

`forecast-rules.ts` selects supported horizon demand, computes daily balances,
and ranks demand, shortfall, fit or recorded sales. Shortfall is the largest
negative daily balance, before safety stock/pack rounding. Outgoing commitments
reduce availability. Only dated incoming after the plan's generation time and
before the horizon end count. An arrival at midnight belongs to that new day;
overdue/undated supply never conceals a current deficit.

Tenant summaries forecast customer sales only and never create local purchase
quantities. Warehouse forecasts include net posted transfer outflow. Known
warehouse inventory is required for a shortfall. Unknown demand remains unknown;
selecting 90 days never repeats a shorter forecast to fill missing days.

Custom past ranges rank recorded sales; future estimates remain current. Horizon,
search/status/sort changes reset paging. Scope changes remount local state.
Stock and purchase details/actions follow server permission flags. Exact
product/size/location links lead to existing warehouse and supplier review pages.

`ForecastEvidence` shows validation and model/baseline, demand basis, history,
limitations and weekly projected totals. Fit grades are empirical recent error,
not probabilities or guarantees. There are no automatic purchases/transfers.
See RESUME-forecasts-functionality.md and docs/memory/notifications-forecasts.md.

## Cards and detail modal

`ForecastProductCard` is a compact keyboard-operable button: shared product image
(and missing/broken-image fallback), name/size, location, fit, horizon demand and
permission-aware local shortfall. Keep model/evidence and action links out of
this button; never nest links inside it.

`ForecastProductGrid` selects by product key from the current visible rows.
`ForecastProductModal` uses the shared Modal primitive for focus trapping, return
focus, Escape/backdrop close, a named dialog and scrollable body. Expanded
`ForecastProductDetails` retains the exact selected horizon and plan.generatedAt,
current balance, commitments/incoming supply, validation, model, timeline and
location-aware actions. Forecast evidence starts expanded inside the modal.

Filter/sort/horizon/page changes remount the grid to close details; tenant/location
scope changes already remount results. Refreshed rows update open details and
removed rows clear selection. Report-only views hide stock figures and supply
judgements, and server purchase permission controls supplier links.

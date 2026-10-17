# Price checker management

The dashboard manages tenant-owned customer kiosks under
`/retail-tools/price-checker`. Customer scanning lives separately in
`src/components/price-checker` and `/kiosk/price-checker/[kioskSlug]`.

- `dashboard.tsx` owns presentation, search and status filters.
- `use-dashboard.ts` owns loads, confirmed writes, cancellation and feedback.
  Mount its consumer with a key derived from the authenticated token: account
  changes must reset data, filters and pending feedback. Ignore asynchronous
  completions after unmount.
- Apply returned server kiosk records after writes; delete only after the server
  confirms removal. Cancel pending list loads before writing. Refresh cannot run
  during a write, and must never undo a confirmed change with an older response.
- Load failures offer Retry loading. Copy and mutation failures give their own
  guidance; do not attach a list-refresh action to an unrelated error.
- `admin.css` defines the shared container. Keep `width: 100%` with inline-size
  containment: auto margins otherwise collapse it in the admin flex layout.
- `dashboard-responsive.css` adapts descendants to available content width.
  Card grids must fit containers narrower than their preferred column size.
  Preserve wrapping, 44px action targets, keyboard focus and reduced motion.

Enabled is configuration status, never proof that a device is connected. Retail
prices and tenant isolation remain authoritative on the backend; management
must not recompute selling prices or apply marketplace adjustments.

## Scan analytics

- `use-analytics.ts` separates edited filters from applied report scope. Pagination
  and refresh use the applied query. Presets apply immediately and reset page one.
  Key its consumer by authenticated token and kiosk URL parameter; abort obsolete
  requests so account/link changes cannot retain prior report data or filters.
- Report and kiosk-list requests are independent. List errors must be visible and
  retryable without discarding a successfully loaded report. Report errors must
  never present stale totals as the failed request's result.
- `analytics-summary.tsx` distinguishes selected-period totals from current
  calendar totals; both identify the applied kiosk. All times use Africa/Lagos.
- `analytics-hours.tsx` shows cumulative hourly activity for the entire period.
  Zero bars remain zero. No activity gets an explicit empty state.
- `analytics-tables.tsx` and `analytics-unknown.tsx` keep semantic tables and turn
  rows into labeled cards below 600px of content width. Retain leading-zero
  barcodes and wrap long names. Missing current price/quantity is Unavailable;
  actual zero remains zero. Current retail prices are not historical scan prices.
- The backend's single page applies to popular, unknown and low-stock lists;
  summary/hourly totals are not paginated. Empty later pages must not claim that
  the entire reporting period has no matching scans. Do not invent row totals
  or separate pagination flags that the endpoint does not supply.
- Page styling is split into analytics base, responsive and results CSS. Preserve
  available-width container queries and touch targets. Empty reports omit blank
  charts, redundant tables and pagination.

Verification from `client/apps/admin`:
`pnpm exec vitest run src/app/shared/price-checker --maxWorkers=2`.
Resume and release notes: `docs/superpowers/specs/RESUME-customer-price-checker.md`
at the repository root.

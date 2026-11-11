# Tenant marketplace sales (track / show / display)

Denormalised per-tenant gross marketplace sales. Added 2026-11-11.

## Source of truth

**Posted `JournalEntry` documents** with `entryType: 'sales_revenue'`,
`source: 'marketplace'`, `status: 'posted'` — the same rows the merchant
settlement statements pay out on (`services/merchantFulfillment/settlement/journals.js`).
Revenue per tenant = net credit of **account 4000** across those entries.
Storefront/POS/venue journals carry different `source` values and never count.
Refunds post under `source: 'merchant_refund'` and do NOT reduce the gross
figure — "total sales" is gross.

A marketplace sale journal is posted when an order's payment is captured
(`accounting.orders.captureOrderAccounting`, Order post-save hook):
`source` becomes `'marketplace'` unless `settlementOwner === 'tenant'`
(storefront) or `source === 'pos'`.

## Service

`server/services/marketplaceSales.service.js`:
- `MARKETPLACE_SALES_MATCH` — the canonical match filter.
- `salesRowsFor(tenantIds?)` — aggregate → `{ _id: tenantId, total, orders }`
  (orders = distinct `refDoc`, i.e. distinct paid marketplace orders).
- `recomputeMarketplaceSales({ tenantIds })` — always-from-scratch, idempotent,
  writes `Tenant.marketplaceSalesTotal` / `Tenant.marketplaceSalesOrders`
  via `bulkWrite`. With a subset, absent rows reset to 0/0 (never stale).

## Triggers

- **`JournalEntry` post-save hook** (models/JournalEntry.js): fires ONLY for
  `sales_revenue` + `source: 'marketplace'` postings (POS/storefront/refund
  postings skip — they cannot change the number). Best-effort try/catch: an
  analytics failure never fails the accounting posting.
- **`server/scripts/backfill-marketplace-sales.js`** — full reseed from
  journals. `node scripts/backfill-marketplace-sales.js` (dry run) /
  `--apply`. Safe to re-run anytime (idempotent).

## Public display

- `store.controller.js` exposes `marketplaceSalesTotal` +
  `marketplaceSalesOrders` in `PUBLIC_TENANT_FIELDS` / `toStoreCard`.
- Store page (`vendors/[slug]`): stats block shows the compact naira total
  (`formatNairaCompact`: ₦2.4m / ₦850k) + order count, only when > 0.
- Directory `StoreCard`: banner chip "N sales" bottom-left, only when > 0.

## Backfill (applied to live DB 2026-11-11)

`node scripts/backfill-marketplace-sales.js --apply` was run against the live DB:
Wyn City (`wyncity`) → ₦28,500 across 1 order. Safe to re-run anytime.

## Tenant dashboard display (built 2026-11-11)

- **Endpoint**: `GET /api/merchant-orders/sales-summary` (merchantOrder.routes,
  declared before `/:id`). Tenant roles read their own JWT tenant
  (`getTenantId`); platform roles may pass `?tenant=<slug>`; a platform user
  with no JWT tenant and no slug gets 400; unknown slug 404. Returns
  `{ tenant: { name, slug }, marketplaceSalesTotal, marketplaceSalesOrders }`.
- **UI**: `client/apps/admin/src/app/shared/merchant-orders/sales-summary.tsx`
  renders a 3-stat card (total, paid orders, store) at the top of the
  Merchant fulfillment workspace (`merchant-orders-view.tsx`). Strict
  `parseSummary` shape guard + catch: a stats read failure renders nothing and
  never blocks the workspace (this mattered — the view's vitest suite mocks
  `fetch` generically and a naive render broke 5 tests).
- Tests: `merchantSalesSummary.mongo.test.js` (1/1),
  `sales-summary.test.tsx` (3/3), full merchant-orders vitest suite 39/39,
  admin `tsc --noEmit` clean.

## Verification done 2026-11-11

- `__tests__/marketplaceSales.mongo.test.js`: 1/1 pass — correct sources,
  exclusions (storefront/POS/draft/refund journals), hook-driven updates,
  subset reset semantics, per-tenant update isolation.
- Affected suites all green: `storeReviews`, `platformBeverageGate`,
  `merchantSettlementStatement` (23 tests) — hook adds ~100ms per marketplace
  posting; mongo harness tests are otherwise 9–50s each in this environment.
- `npx tsc --noEmit` + eslint in platform app: clean.
- Backfill applied to the live DB + tenant dashboard display shipped — see
  "Backfill" and "Tenant dashboard display" sections above.

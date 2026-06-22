# Sales Module — Frontend Stage A (Transactional Core)

> Addendum to `docs/superpowers/specs/2026-06-21-sales-module-design.md` (parent
> spec, phase 5 section). The backend (phases 1-4) is merged into `main`
> (`72394657`). This spec scopes the **first** frontend slice — the
> transactional core that's fully backed by the 9 existing
> `/api/sales-orders` endpoints. Analytics and settings (which need new
> backend support) are **out of scope** here and become a separate Stage B
> plan after this ships.

## Goal

Build `shared/sales/*` + `(hydrogen)/sales/*` client UI mirroring the
`shared/purchases/*` conventions, covering: quotations/orders list, create
(with customer + pricelist auto-apply), quotation/order detail with
status-machine actions (incl. on-the-fly invoice render), fulfillment, and
returns. No new backend work.

## Route tree

```
(hydrogen)/sales/
  page.tsx                 → landing (mirrors purchases/page.tsx)
  quotations/page.tsx      → sales-quotations.tsx (list)
  orders/page.tsx          → sales-orders.tsx (list)
  create/page.tsx          → sales-create.tsx
  [id]/page.tsx            → fetch doc, branch on docType →
                              sales-quotation-detail.tsx | sales-order-detail.tsx
  fulfill/page.tsx         → orders awaiting fulfillment (mirrors purchases/receive)
  fulfill/[id]/page.tsx    → sales-fulfill-detail.tsx
  returns/page.tsx         → sales-returns.tsx (list)
  returns/create/page.tsx  → sales-return-create.tsx
  returns/[id]/page.tsx    → sales-return-detail.tsx
```

All route files are thin shells; real components live in `shared/sales/*`.
`sales-nav-header.tsx` mirrors `purchases-nav-header.tsx`'s dropdown-group tab
nav (groups: Quotations/Orders, Fulfillment, Returns).

## Components (`shared/sales/*`)

- `sales-nav-header.tsx`
- `sales-quotations.tsx`, `sales-orders.tsx` — list/filter/search/sort, status
  badges, table+grid views, mirroring `purchases-orders.tsx`.
- `sales-create.tsx` — `CustomerSearch` picker (new) + pricelist auto-apply
  (new `useSalesCustomerPricelist` hook) + line-items table (mirrors
  `purchases-create.tsx`'s `ProductSearch` + inline add/edit/remove); saves as
  quotation or order.
- `sales-quotation-detail.tsx` — status actions: Send / Accept / Reject /
  Convert.
- `sales-order-detail.tsx` — status actions: Confirm / Fulfill / Return /
  Invoice, gated by `orderStatus`; Outstanding column
  (`quantity - fulfilledQty - returnedQty`) per line.
- `sales-fulfill-detail.tsx` — additive fulfill form, modeled directly on
  `purchases-receipt-detail.tsx`.
- `sales-returns.tsx`, `sales-return-create.tsx`, `sales-return-detail.tsx` —
  mirror the `purchases-returns.tsx` family.
- `CustomerSearch` (new, shared/sales or a common location) — debounced
  search, modeled on `VendorSearch` (`purchases-create.tsx:116-302`).

## Customer picker + pricelist auto-apply

No new backend. Two existing primitives, wrapped in a new small client hook:

- `posApi.searchCustomers(token, q, limit)` → `GET /api/pos/customers?q=...`
  (already exists; `SalesOrder.customer` refs `POSCustomer`, so this is the
  correct search surface) — powers `CustomerSearch`.
- `posApi.getPricelists(token, undefined, customerId)` → already supports
  customer-only resolution (no shop) — returns `{ pricelists, resolvedId }`.
- `computeItemPriceWithPricelist(item, pricelist)` (pure function, exported
  from `point-of-sale/store/index.ts:269`) — applies all matching pricelist
  rules to a line's raw price using its live quantity.

New hook `useSalesCustomerPricelist(token, customerId)`: on customer change,
fetches the resolved pricelist via `getPricelists`, exposes it; `sales-create`
calls `computeItemPriceWithPricelist` per line whenever qty/customer/product
changes, to drive live discounted unit price. No jotai, no cart/shop atoms —
deliberately NOT reusing `usePOSCustomerPricelistSync` itself, since that hook
is hard-wired to POS's cart/shop state which doesn't exist here.

## Fulfillment & returns UX

`sales-fulfill-detail.tsx` (mirrors `purchases-receipt-detail.tsx`):
Product | SKU | Unit Price | Ordered | Outstanding | **Fulfilling Now** (qty
stepper, clamped `0 ≤ n ≤ outstanding`) | Line Total, plus a required
warehouse selector. Submits `POST /:id/fulfill { warehouseId, items }`.

**Partial-failure handling**: the endpoint returns HTTP 200 even when
`posting.failCount > 0` (some lines failed to post). Client treats this as a
partial-success state: green toast on full success; amber/warning toast
listing failed lines (from `posting.failures`) when `failCount > 0`. No
client-side rollback needed — the server only commits successful lines, so a
re-fetch of the order after submit reflects the true state.

`sales-returns.tsx` / `sales-return-create.tsx` / `sales-return-detail.tsx`
mirror the `purchases-returns.tsx` family with the same additive
`{ lineId, qty }` shape against `POST /:id/return`, surfacing
`restock.failures` the same way.

## Invoice (render-on-the-fly)

An "Invoice" button on `sales-order-detail.tsx` (visible once
`orderStatus` is `confirmed` or later) renders a printable invoice
client-side by feeding the already-loaded SalesOrder's line items, customer
snapshot, and totals into `shared/invoice/invoice-details.tsx`'s presentation
layer. No API call, no `Invoice` DB document, no use of the deferred
`POST /:id/invoice` endpoint.

## Status-machine gating (client mirrors server guards)

- Quotation editable while `draft`/`sent`; actions: Send (draft→sent), Accept
  (sent→accepted), Reject (→rejected), Convert (accepted→ creates new order).
- Order fulfillable while `confirmed`/`partially_fulfilled`; Confirm only from
  `draft`; Return available once any qty has been fulfilled.
- Buttons not valid for the current status are hidden, not just disabled —
  matches existing purchases convention.

## Out of scope (Stage B — separate plan)

- `sales-analytics.tsx` + `sales-settings.tsx` and their backend
  (`Tenant.salesSettings` + `GET/PATCH /api/sales-orders/settings` +
  `GET /api/sales-orders/analytics/summary` + `/analytics/by-customer`,
  mirroring the `purchaseSettings`/`getPurchaseAnalyticsSummary` patterns).
- The dedicated `POST /:id/invoice` endpoint / persisted `Invoice` doc for
  sales orders (still deferred from the backend follow-ups).

## Verification

- `cd client/apps/isomorphic && ./node_modules/.bin/tsc --noEmit` — no new
  errors beyond the existing 27 `TS2688` baseline.
- Manual flow: create quotation → convert → confirm → partial fulfill ×2 →
  return — confirm Outstanding column, status-gated buttons, and
  partial-failure toasts behave correctly.

## Branch / workspace

`feat/sales-frontend` off `main`, built in an isolated worktree
(`.claude/worktrees/sales-frontend`), via subagent-driven-development — same
pattern used for the backend build.

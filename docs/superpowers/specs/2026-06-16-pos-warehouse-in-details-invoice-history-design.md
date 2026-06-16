# POS Warehouse Info in Details, Invoice, History & Sales Analysis

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Surface the warehouse name on every POS order-facing view — history list rows, order detail panel, printed/previewed invoice, and the sales-analysis line table and group-by.

**Architecture:** `warehouse` is already stored as an ObjectId on each `items[]` entry in the Order document (set by `createPOSOrder` via `resolveShopWarehouse`). All items in a single POS sale share the same warehouse. The change populates that reference on the two server order-fetch queries, threads it through the item mapping, extends client types, and renders it in four UI surfaces. No schema changes required.

**Tech Stack:** Node/Express/Mongoose 9 (server), Next.js App Router + React (client), TypeScript.

---

## Affected files

**Server**
- Modify: `server/controllers/pos.controller.js` — `getAllPOSOrders` and `getPOSSessionOrders`

**Client**
- Modify: `client/apps/isomorphic/src/app/shared/point-of-sale/components/pos-order-detail.tsx`
- Modify: `client/apps/isomorphic/src/app/shared/point-of-sale/pos-history.tsx`
- Modify: `client/apps/isomorphic/src/app/shared/point-of-sale/pos-sell-orders.tsx`
- Modify: `client/apps/isomorphic/src/app/shared/point-of-sale/pos-sales-details.tsx`

---

## Design

### 1. Server — populate `items.warehouse`

Both `getAllPOSOrders` and `getPOSSessionOrders` build a Mongoose query chain and then map the raw docs to a plain response object. Each needs two additions:

**Query chain** — add after the existing `items.size` / `items.subproduct` populates:
```js
.populate('items.warehouse', 'name code')
```

**Items mapping** — add `warehouse` to each mapped item:
```js
warehouse: it.warehouse
  ? { _id: it.warehouse._id, name: it.warehouse.name, code: it.warehouse.code }
  : null,
```

Both endpoints return orders whose items now carry `warehouse: { _id, name, code } | null`.

### 2. Client types

A shared warehouse shape appears in several local `HistoryItem` interfaces across multiple files. Each needs:
```ts
warehouse?: { _id: string; name: string; code: string } | null;
```

A file-local helper derives the order-level warehouse (all items share one):
```ts
function getOrderWarehouse(order: { items?: { warehouse?: ... }[] }) {
  return order.items?.find(i => i.warehouse)?.warehouse ?? null;
}
```

### 3. History lists — `pos-history.tsx` and `pos-sell-orders.tsx`

Each order row already shows receipt number, date, cashier, total, and payment method. Add a warehouse chip immediately after the receipt number:

```tsx
{wh && (
  <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
    {wh.name}
  </span>
)}
```

`wh` = `getOrderWarehouse(order)`. Renders nothing when null (legacy orders).

### 4. Order Detail panel — Details tab (`pos-order-detail.tsx`)

The Details tab shows an info grid (Receipt #, Date, Cashier, Payment, etc.). Add one row:

```tsx
{wh && (
  <div className="flex justify-between text-sm">
    <span className="text-gray-500">Warehouse</span>
    <span className="font-medium">{wh.name} <span className="text-gray-400">({wh.code})</span></span>
  </div>
)}
```

`wh` = `getOrderWarehouse(order)` in the component scope.

### 5. Invoice — Invoice tab (`pos-order-detail.tsx`)

The `buildInvoiceHtml(order, ...)` function constructs an HTML string for both print and iframe preview. In the order-header table (where Receipt #, Date, Cashier appear), add:

```js
${wh ? `<tr><td style="color:#555">Warehouse</td><td>${wh.name} (${wh.code})</td></tr>` : ''}
```

`wh` is derived at the top of `buildInvoiceHtml` via the same `getOrderWarehouse` logic (or inline: `order.items?.find(i => i.warehouse)?.warehouse`).

### 6. Sales analysis — `pos-sales-details.tsx`

**`LineRow` interface** — add:
```ts
warehouse: string; // warehouse name, or '' for legacy orders
```

**`GroupByKey` union** — add `'warehouse'`:
```ts
type GroupByKey = 'product' | 'cashier' | 'payment_method' | 'date' | 'variant' | 'warehouse';
```

**`OrderItem` interface** (local to this file) — add:
```ts
warehouse?: { _id: string; name: string; code: string } | null;
```

**Line-row building** — when mapping order items to `LineRow`, include:
```ts
warehouse: item.warehouse?.name ?? '',
```

**Group-by label** — when `groupBy === 'warehouse'`, the group key is `row.warehouse || 'No warehouse'`.

**Line table** — add a "Warehouse" column header and cell alongside the existing columns. Hidden (column removed) when all rows have `warehouse === ''` (i.e. no warehouse data yet) — avoids a blank column on fresh installs without warehouse data.

**Group table** — when grouped by warehouse, the `key` column header reads "Warehouse".

---

## Error handling

- `items.warehouse` is `null` for all orders placed before this feature. Every render is null-safe (`wh &&`, `?? ''`, `?.name`). No fallback text needed — simply omit the element.
- If `Warehouse.findOne` returns `null` at order-creation time (no default warehouse configured), `items.warehouse` is `undefined` — treated identically to `null`.

## Testing

- Server: `node -e "require('./controllers/pos.controller'); console.log('OK')"` after each edit.
- Client: `npx tsc --noEmit 2>&1 | grep -v TS2688 | grep -E "(pos-order-detail|pos-history|pos-sell-orders|pos-sales-details)" || echo "OK: no new errors"` after each file edit.
- Manual: open POS history on an order that has a warehouse → confirm chip appears; open detail panel → confirm Warehouse row; print/preview invoice → confirm warehouse row in header; open sales details, switch to line view → confirm Warehouse column.

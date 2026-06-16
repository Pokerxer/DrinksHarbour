# POS Warehouse Info in Details, Invoice, History & Sales Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the warehouse name on POS order history rows, the order detail panel, the printed/previewed invoice, and the sales-analysis line table + group-by.

**Architecture:** `warehouse` is already an ObjectId on every `items[]` entry in Order documents (written by `createPOSOrder`). We populate that reference in the two server order-fetch functions, thread it through the item mapping, extend four client type definitions, and render a warehouse chip/row/cell in each UI surface. No schema change required.

**Tech Stack:** Node/Express/Mongoose 9 (server), Next.js App Router + React + TypeScript (client).

---

## File map

| File | Change |
|---|---|
| `server/controllers/pos.controller.js` | Add `items.warehouse` populate + mapping in `getAllPOSOrders` and `getPOSSessionOrders` |
| `client/.../point-of-sale/components/pos-order-detail.tsx` | `HistoryItem` type, `getOrderWarehouse` helper, Details tab info row, Invoice meta strip |
| `client/.../point-of-sale/pos-history.tsx` | `HistoryItem`/`HistoryOrder` types, warehouse chip on order rows |
| `client/.../point-of-sale/pos-sell-orders.tsx` | Same as `pos-history.tsx` |
| `client/.../point-of-sale/pos-sales-details.tsx` | `OrderItem`/`LineRow` types, `GroupByKey`, line-row builder, column, group-by label |

Paths under `client/` expand to `client/apps/isomorphic/src/app/shared/point-of-sale/`.

---

## Task 1: Populate `items.warehouse` in `getAllPOSOrders`

**Files:**
- Modify: `server/controllers/pos.controller.js:2651-2684`

- [ ] **Step 1: Add the populate call**

In `getAllPOSOrders` (starts line 2632), after the existing `.populate('items.subproduct', 'costPrice')` line (currently line 2652), insert:

```js
    .populate('items.warehouse', 'name code')
```

The chain becomes:
```js
    .populate('items.size', 'displayName costPrice')
    .populate('items.subproduct', 'costPrice')
    .populate('items.warehouse', 'name code')
    .populate({ path: 'refunds.refundedBy', select: 'firstName lastName posName', strictPopulate: false })
```

- [ ] **Step 2: Add `warehouse` to the items mapping**

In the same function, inside `.items: (o.items || []).map((it) => ({` (around line 2673), add `warehouse` after `brand`:

```js
    items: (o.items || []).map((it) => ({
      name:            it._name || it.product?.name || 'Product',
      variant:         it._variant || it.size?.displayName || '',
      quantity:        it.quantity,
      priceAtPurchase: it.priceAtPurchase,
      itemSubtotal:    it.itemSubtotal,
      discountAmount:  it.discountAmount || 0,
      sizeCostPrice:   it.size?.costPrice || it.subproduct?.costPrice || 0,
      category:        it.product?.category?.name    || '',
      subcategory:     it.product?.subCategory?.name || '',
      brand:           it.product?.brand?.name       || '',
      warehouse:       it.warehouse
        ? { _id: it.warehouse._id, name: it.warehouse.name, code: it.warehouse.code }
        : null,
    })),
```

- [ ] **Step 3: Smoke-check**

```bash
cd /Users/mac/Documents/drinksharbour/server
node -e "require('./controllers/pos.controller'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add controllers/pos.controller.js
git commit -m "feat(server): populate items.warehouse in getAllPOSOrders"
```

---

## Task 2: Populate `items.warehouse` in `getPOSSessionOrders`

**Files:**
- Modify: `server/controllers/pos.controller.js:2707-2736`

- [ ] **Step 1: Add the populate call**

In `getPOSSessionOrders` (starts line 2690), after `.populate('items.subproduct', 'costPrice')` (line 2708), insert:

```js
    .populate('items.warehouse', 'name code')
```

- [ ] **Step 2: Add `warehouse` to the items mapping**

In `.items: (o.items || []).map((it) => ({` (around line 2725), add after `brand`:

```js
    items: (o.items || []).map((it) => ({
      name:            it._name || it.product?.name || 'Product',
      variant:         it._variant || it.size?.displayName || '',
      quantity:        it.quantity,
      priceAtPurchase: it.priceAtPurchase,
      itemSubtotal:    it.itemSubtotal,
      discountAmount:  it.discountAmount || 0,
      sizeCostPrice:   it.size?.costPrice || it.subproduct?.costPrice || 0,
      category:        it.product?.category?.name    || '',
      subcategory:     it.product?.subCategory?.name || '',
      brand:           it.product?.brand?.name       || '',
      warehouse:       it.warehouse
        ? { _id: it.warehouse._id, name: it.warehouse.name, code: it.warehouse.code }
        : null,
    })),
```

- [ ] **Step 3: Smoke-check**

```bash
node -e "require('./controllers/pos.controller'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 4: Run full test suite**

```bash
node --test __tests__/ > /tmp/task2_tests.txt 2>&1; tail -8 /tmp/task2_tests.txt
```

Expected: `pass 20`, `fail 0`

- [ ] **Step 5: Commit**

```bash
git add controllers/pos.controller.js
git commit -m "feat(server): populate items.warehouse in getPOSSessionOrders"
```

---

## Task 3: Types + helper + Details tab + Invoice in `pos-order-detail.tsx`

**Files:**
- Modify: `client/apps/isomorphic/src/app/shared/point-of-sale/components/pos-order-detail.tsx`

- [ ] **Step 1: Add `warehouse` to `HistoryItem` and add `getOrderWarehouse` helper**

`HistoryItem` is at line 34. Replace it:

```ts
interface HistoryItem {
  name: string;
  variant?: string;
  quantity: number;
  priceAtPurchase: number;
  itemSubtotal: number;
  discountAmount?: number;
  bxgyRole?: 'buy' | 'get';
  warehouse?: { _id: string; name: string; code: string } | null;
}
```

Then, directly after the closing `}` of `HistoryItem` (before `interface DetailOrder`), add:

```ts
function getOrderWarehouse(order: { items?: HistoryItem[] }) {
  return order.items?.find((i) => i.warehouse)?.warehouse ?? null;
}
```

- [ ] **Step 2: Add warehouse info row to the Details tab**

In the Details tab section (starting at line 1237), inside the `<>` fragment, directly after the two status badge blocks (after the closing `)}` of the `isPartiallyRefunded` block, before `{/* Items list */}`), add:

```tsx
          {/* Warehouse info */}
          {(() => {
            const wh = getOrderWarehouse(order);
            return wh ? (
              <div className="shrink-0 flex items-center gap-2 border-b border-gray-100 px-4 py-2 text-xs text-gray-500">
                <span className="font-medium text-gray-700">Warehouse:</span>
                <span className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                  {wh.name}
                </span>
                <span className="text-gray-400">({wh.code})</span>
              </div>
            ) : null;
          })()}
```

- [ ] **Step 3: Add warehouse to the invoice meta strip**

In `buildInvoiceHTML` (line 888), the meta strip div starts around line 1028. The strip currently has four flex cells: Order Date, Cashier, Payment, Customer. The last cell (Customer) currently has `style="flex:1;padding:12px 16px"` (no `border-right`). Change the last cell to add `border-right:1px solid #e5e7eb` and then add a new fifth cell after it for Warehouse:

Replace the Customer cell and the closing `</div>` of the meta strip with:

```js
          <div style="flex:1;padding:12px 16px;border-right:1px solid #e5e7eb">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#b20202;margin-bottom:4px">Customer</div>
            <div style="font-size:13px;font-weight:600;color:#111">${_customerName}</div>
            ${_customerPhone ? `<div style="font-size:10px;color:#6b7280;margin-top:1px">${_customerPhone}</div>` : ''}
          </div>
          ${_warehouse ? `
          <div style="flex:1;padding:12px 16px">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#b20202;margin-bottom:4px">Warehouse</div>
            <div style="font-size:13px;font-weight:600;color:#111">${_warehouse.name}</div>
            <div style="font-size:10px;color:#6b7280;margin-top:1px">${_warehouse.code}</div>
          </div>` : ''}
        </div>
```

And at the top of `buildInvoiceHTML` (after `_storeName`/`_logoSrc` lines, around line 917), add:

```js
    const _warehouse = getOrderWarehouse(order);
```

- [ ] **Step 4: Type-check**

```bash
cd /Users/mac/Documents/drinksharbour/client/apps/isomorphic
npx tsc --noEmit 2>&1 | grep -v TS2688 | grep "pos-order-detail" || echo "OK: no new errors"
```

Expected: `OK: no new errors`

- [ ] **Step 5: Commit**

```bash
cd /Users/mac/Documents/drinksharbour
git add client/apps/isomorphic/src/app/shared/point-of-sale/components/pos-order-detail.tsx
git commit -m "feat(client): show warehouse in POS order detail panel and invoice"
```

---

## Task 4: Warehouse chip on history rows in `pos-history.tsx`

**Files:**
- Modify: `client/apps/isomorphic/src/app/shared/point-of-sale/pos-history.tsx`

- [ ] **Step 1: Add `warehouse` to `HistoryItem` and `HistoryOrder`**

`HistoryItem` is at line 41. Add `warehouse` field:

```ts
interface HistoryItem {
  name: string;
  variant?: string;
  quantity: number;
  priceAtPurchase: number;
  itemSubtotal: number;
  discountAmount?: number;
  warehouse?: { _id: string; name: string; code: string } | null;
}
```

`HistoryOrder` is at line 70. It has an `items?: HistoryItem[]` field — no change needed there since the type flows through `HistoryItem`.

- [ ] **Step 2: Add `getOrderWarehouse` helper**

After the `HistoryItem` interface closing `}`, add:

```ts
function getOrderWarehouse(order: { items?: HistoryItem[] }) {
  return order.items?.find((i) => i.warehouse)?.warehouse ?? null;
}
```

- [ ] **Step 3: Add warehouse chip to order rows**

Find the order row rendering (around line 652 — where `order.receiptNumber` is shown in a `<span>` or similar element). Add a warehouse chip immediately after the receipt number display:

```tsx
{(() => {
  const wh = getOrderWarehouse(order);
  return wh ? (
    <span className="ml-1.5 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
      {wh.name}
    </span>
  ) : null;
})()}
```

- [ ] **Step 4: Type-check**

```bash
cd /Users/mac/Documents/drinksharbour/client/apps/isomorphic
npx tsc --noEmit 2>&1 | grep -v TS2688 | grep "pos-history" || echo "OK: no new errors"
```

Expected: `OK: no new errors`

- [ ] **Step 5: Commit**

```bash
cd /Users/mac/Documents/drinksharbour
git add client/apps/isomorphic/src/app/shared/point-of-sale/pos-history.tsx
git commit -m "feat(client): show warehouse chip on POS history order rows"
```

---

## Task 5: Warehouse chip on sell-orders rows in `pos-sell-orders.tsx`

**Files:**
- Modify: `client/apps/isomorphic/src/app/shared/point-of-sale/pos-sell-orders.tsx`

- [ ] **Step 1: Find and update the order item type**

Search for the local `HistoryItem` or `OrderItem` interface in this file:

```bash
grep -n "interface.*Item\|interface.*Order\b" client/apps/isomorphic/src/app/shared/point-of-sale/pos-sell-orders.tsx | head -10
```

Add `warehouse?: { _id: string; name: string; code: string } | null;` to whichever interface holds the per-item fields (same pattern as Tasks 3 & 4).

- [ ] **Step 2: Add `getOrderWarehouse` helper**

After the item interface, add:

```ts
function getOrderWarehouse(order: { items?: Array<{ warehouse?: { _id: string; name: string; code: string } | null }> }) {
  return order.items?.find((i) => i.warehouse)?.warehouse ?? null;
}
```

- [ ] **Step 3: Add warehouse chip to order rows**

Find where the receipt number is rendered on each order row. Add a warehouse chip immediately after it:

```tsx
{(() => {
  const wh = getOrderWarehouse(order);
  return wh ? (
    <span className="ml-1.5 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
      {wh.name}
    </span>
  ) : null;
})()}
```

- [ ] **Step 4: Type-check**

```bash
cd /Users/mac/Documents/drinksharbour/client/apps/isomorphic
npx tsc --noEmit 2>&1 | grep -v TS2688 | grep "pos-sell-orders" || echo "OK: no new errors"
```

Expected: `OK: no new errors`

- [ ] **Step 5: Commit**

```bash
cd /Users/mac/Documents/drinksharbour
git add client/apps/isomorphic/src/app/shared/point-of-sale/pos-sell-orders.tsx
git commit -m "feat(client): show warehouse chip on POS sell-orders rows"
```

---

## Task 6: Warehouse column + group-by in `pos-sales-details.tsx`

**Files:**
- Modify: `client/apps/isomorphic/src/app/shared/point-of-sale/pos-sales-details.tsx`

- [ ] **Step 1: Update `OrderItem`, `LineRow`, and `GroupByKey`**

`OrderItem` (line 20). Add `warehouse` field:

```ts
interface OrderItem {
  name: string; variant?: string; quantity: number;
  priceAtPurchase: number; itemSubtotal: number;
  discountAmount?: number; sizeCostPrice?: number;
  category?: string; subcategory?: string; brand?: string;
  warehouse?: { _id: string; name: string; code: string } | null;
}
```

`LineRow` (line 37). Add `warehouse` field:

```ts
interface LineRow {
  orderId: string; orderNumber: string; receiptNumber: string;
  date: string; cashier: string; product: string; variant: string;
  category: string; subcategory: string; brand: string;
  qty: number; unitPrice: number; discount: number;
  subtotal: number; gross: number; costPrice: number; profit: number;
  paymentMethod: string; isVoided: boolean; warehouse: string;
}
```

`GroupByKey` (line 60). Add `'warehouse'`:

```ts
type GroupByKey = 'product' | 'cashier' | 'payment_method' | 'date' | 'variant' | 'warehouse';
```

`ToggleableCol` (line 63) — no change needed.

- [ ] **Step 2: Thread `warehouse` through the line-row builder**

Search for where `LineRow` objects are built (where `orderId`, `product`, `brand` etc. are set). Add:

```bash
grep -n "orderId\|brand.*name\|category.*name" client/apps/isomorphic/src/app/shared/point-of-sale/pos-sales-details.tsx | head -10
```

In that mapping block, add after `brand`:

```ts
warehouse: item.warehouse?.name ?? '',
```

- [ ] **Step 3: Add warehouse group-by label**

Find where the group-by key is computed for each row — the switch/if block that reads `groupBy` and produces a string key per row. It will look something like:

```ts
const key =
  groupBy === 'product'         ? row.product :
  groupBy === 'cashier'         ? row.cashier :
  groupBy === 'payment_method'  ? row.paymentMethod :
  groupBy === 'date'            ? row.date :
  groupBy === 'variant'         ? (row.variant || 'No variant') :
                                  row.product;
```

Add the warehouse case before the final fallback:

```ts
  groupBy === 'warehouse'       ? (row.warehouse || 'No warehouse') :
```

- [ ] **Step 4: Add warehouse option to the Group By selector**

Find the `<Select>` or options array that renders the group-by dropdown. It will contain options like `{ label: 'Product', value: 'product' }`. Add:

```ts
{ label: 'Warehouse', value: 'warehouse' },
```

- [ ] **Step 5: Add Warehouse column to the line table**

Find the line table's `<thead>` — it has column headers like `Date`, `Order #`, `Product`, `Brand`, etc. Add after `Brand`:

```tsx
<th className="whitespace-nowrap px-3 py-2 text-left font-semibold">
  Warehouse
</th>
```

And in the corresponding `<tbody>` row, add after the `brand` cell:

```tsx
<td className="whitespace-nowrap px-3 py-2 text-gray-600">
  {row.warehouse || <span className="text-gray-300">—</span>}
</td>
```

- [ ] **Step 6: Type-check**

```bash
cd /Users/mac/Documents/drinksharbour/client/apps/isomorphic
npx tsc --noEmit 2>&1 | grep -v TS2688 | grep "pos-sales-details" || echo "OK: no new errors"
```

Expected: `OK: no new errors`

- [ ] **Step 7: Commit**

```bash
cd /Users/mac/Documents/drinksharbour
git add client/apps/isomorphic/src/app/shared/point-of-sale/pos-sales-details.tsx
git commit -m "feat(client): warehouse column and group-by in POS sales analysis"
```

---

## Manual QA (after all tasks)

1. Open POS → History. An order placed with a bound shop should show a blue warehouse chip next to its receipt number. A legacy order (no warehouse) shows no chip.
2. Click that order to open the detail panel → Details tab. A "Warehouse: NAME (CODE)" info row appears above the items list.
3. Switch to the Invoice tab. The meta strip shows a fifth cell "Warehouse" with name and code. Print/preview both render it.
4. Open POS → Sales Details (admin view). Switch to Lines view — a Warehouse column appears. Group by Warehouse — rows cluster by warehouse name.

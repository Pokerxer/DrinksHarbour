# POS Warehouse History + Tenant-Name Invoices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the per-order warehouse across the remaining POS analytics screens (orders, order-analysis, session-report) and replace the hardcoded "DrinksHarbour" store name in every POS/purchase invoice and receipt with the tenant's real name.

**Architecture:** Pure client-side change. The server already populates `items.warehouse` on `getAllPOSOrders` and `getPOSSessionOrders`, and a POS order carries exactly one warehouse (stamped by `resolveShopWarehouse`), so every screen reuses the `getOrderWarehouse(order)` helper to render one chip / one bucket per order. Tenant name comes from `usePOSAuth().tenant` in POS-terminal screens and `useTenant()` (root `TenantProvider`) in admin screens; invoice/receipt builders accept the resolved name as an argument with a per-surface literal fallback.

**Tech Stack:** Next.js (React, TypeScript), jsPDF (PDF receipts), Tailwind classes, jotai-backed `usePOSAuth`, React-context `useTenant`.

---

## Testing approach (read first)

This repo has **no test runner for these UI files** (confirmed in the spec). The verification gate for every task is the TypeScript compiler plus targeted manual QA. The type-check command (run from `client/apps/isomorphic`):

```bash
npm run type:check
```

`type:check` is `tsc --noEmit` over the whole app, so it catches any type regression introduced by a task. Treat a clean `type:check` as the automated gate; the manual-QA notes in each task are the behavioral check.

**Reference — the established warehouse chip markup** (already shipped in `pos-history.tsx:771`), reuse verbatim for new chips:

```tsx
{wh ? (
  <span className="ml-1.5 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
    {wh.name}
  </span>
) : null}
```

**Reference — the helper** (already in `pos-history.tsx:59`), add a local copy where a screen lacks it:

```tsx
function getOrderWarehouse(order: { items?: { warehouse?: { _id: string; name: string; code: string } | null }[] }) {
  return order.items?.find((i) => i.warehouse)?.warehouse ?? null;
}
```

---

## Part A — Warehouse into the remaining POS screens

### Task A1: Warehouse chip on the POS orders list + detail panel

**Files:**
- Modify: `client/apps/isomorphic/src/app/shared/point-of-sale/pos-orders.tsx`

- [ ] **Step 1: Add `warehouse` to the `OrderItem` type**

`pos-orders.tsx:26-29` currently:

```tsx
interface OrderItem {
  name: string; variant?: string; quantity: number;
  priceAtPurchase: number; itemSubtotal: number; discountAmount?: number;
}
```

Change to:

```tsx
interface OrderItem {
  name: string; variant?: string; quantity: number;
  priceAtPurchase: number; itemSubtotal: number; discountAmount?: number;
  warehouse?: { _id: string; name: string; code: string } | null;
}
```

- [ ] **Step 2: Add the `getOrderWarehouse` helper**

Immediately after the `PosOrder` interface (ends at `pos-orders.tsx:52`), add:

```tsx
function getOrderWarehouse(order: { items?: OrderItem[] }) {
  return order.items?.find((i) => i.warehouse)?.warehouse ?? null;
}
```

- [ ] **Step 3: Render the chip on each order row**

In the row, the receipt-number cell is `pos-orders.tsx:771-773`:

```tsx
        <td className={`px-3 py-2.5 text-xs font-semibold ${isSel?'text-white':'text-gray-800'}`} onClick={()=>setSelected(isSel?null:order)}>
          {order.receiptNumber || order.orderNumber || '—'}
        </td>
```

Replace its body with the receipt number plus a chip:

```tsx
        <td className={`px-3 py-2.5 text-xs font-semibold ${isSel?'text-white':'text-gray-800'}`} onClick={()=>setSelected(isSel?null:order)}>
          {order.receiptNumber || order.orderNumber || '—'}
          {(() => {
            const wh = getOrderWarehouse(order);
            return wh ? (
              <span className={`ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${isSel ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-700'}`}>
                {wh.name}
              </span>
            ) : null;
          })()}
        </td>
```

- [ ] **Step 4: Show warehouse in the `OrderDetail` metadata block**

In `OrderDetail`, the metadata rows array is at `pos-orders.tsx:452-460`. Add a Warehouse entry after the `Session` line:

```tsx
              { label:'Session',  value:sessionLabel(order.session) },
              ...(getOrderWarehouse(order) ? [{ label:'Warehouse', value:getOrderWarehouse(order)!.name }] : []),
              { label:'Payment',  value:payLabel },
```

- [ ] **Step 5: Type-check**

Run (from `client/apps/isomorphic`): `npm run type:check`
Expected: PASS, no new errors referencing `pos-orders.tsx`.

- [ ] **Step 6: Manual QA**

Open `/point-of-sale/orders`. Confirm a blue warehouse chip shows next to the receipt number on rows that have a warehouse, and the detail slide-over shows a "Warehouse" row.

- [ ] **Step 7: Commit**

```bash
git add client/apps/isomorphic/src/app/shared/point-of-sale/pos-orders.tsx
git commit -m "feat(client): warehouse chip on POS orders list and detail panel"
```

---

### Task A2: Warehouse group-by dimension in POS order analysis

**Files:**
- Modify: `client/apps/isomorphic/src/app/shared/point-of-sale/pos-order-analysis.tsx`

Warehouse is an **order-level** dimension (every line in an order shares one warehouse), so it is added alongside `cashier` / `terminal` / `payment_method` and **must not** join `ITEM_DIMS`.

- [ ] **Step 1: Extend the `GroupByKey` type**

`pos-order-analysis.tsx:46-47`:

```tsx
type GroupByKey  = 'cashier' | 'payment_method' | 'product' | 'terminal'
                 | 'product_category' | 'subcategory' | 'brand'
```

Change to add `'warehouse'`:

```tsx
type GroupByKey  = 'cashier' | 'payment_method' | 'product' | 'terminal'
                 | 'product_category' | 'subcategory' | 'brand' | 'warehouse'
```

(If the type continues onto further union members on the next line, leave those intact — only append `| 'warehouse'`.)

- [ ] **Step 2: Add the picker entry**

`pos-order-analysis.tsx:82-90`, the `GROUP_BY_ITEMS` array. Add a Warehouse entry after `terminal`:

```tsx
  { key: 'terminal',         label: 'Point of Sale' },
  { key: 'warehouse',        label: 'Warehouse' },
```

- [ ] **Step 3: Add an order→warehouse helper near the top-level helpers**

Directly above `getOrderG1Key` (`pos-order-analysis.tsx:479`), add:

```tsx
function orderWarehouseName(o: PosOrder): string {
  return o.items?.find((i) => (i as any).warehouse)?.warehouse?.name ?? 'No warehouse';
}
```

(`PosOrder.items` here does not yet declare `warehouse`; the `as any` read avoids widening the shared type. If `PosOrder`'s item type is local to this file and easy to extend, prefer adding `warehouse?: { _id: string; name: string; code: string } | null` to it and dropping the `as any`.)

- [ ] **Step 4: Handle `warehouse` in the bucket resolver**

In the grouping block at `pos-order-analysis.tsx:349-366`, after the `terminal` branch (ends ~line 364) and before the date branches, add:

```tsx
    } else if (groupBy === 'warehouse') {
      key = orderWarehouseName(o);
```

(Insert it as an `else if` in the existing `if (groupBy === 'cashier') { … } else if … ` chain, matching the surrounding brace style.)

- [ ] **Step 5: Handle `warehouse` in `getOrderG1Key`**

In `getOrderG1Key` (`pos-order-analysis.tsx:480`), after the `terminal` block (ends ~line 484), add:

```tsx
  if (groupBy === 'warehouse') return orderWarehouseName(o);
```

- [ ] **Step 6: Type-check**

Run: `npm run type:check`
Expected: PASS, no new errors referencing `pos-order-analysis.tsx`.

- [ ] **Step 7: Manual QA**

Open `/point-of-sale/order-analysis`. In the group-by / pivot-dimension picker, select **Warehouse**. Confirm rows bucket by warehouse name (orders without a warehouse fall under "No warehouse") and measures aggregate correctly.

- [ ] **Step 8: Commit**

```bash
git add client/apps/isomorphic/src/app/shared/point-of-sale/pos-order-analysis.tsx
git commit -m "feat(client): warehouse group-by dimension in POS order analysis"
```

---

### Task A3: Warehouse chip in the POS session report

**Files:**
- Modify: `client/apps/isomorphic/src/app/shared/point-of-sale/pos-session-report.tsx`

- [ ] **Step 1: Add `warehouse` to the `SessionOrder` items type**

`pos-session-report.tsx:119-126`, the `items?:` array element type:

```tsx
  items?: {
    name: string;
    variant?: string;
    quantity: number;
    priceAtPurchase: number;
    itemSubtotal: number;
    discountAmount?: number;
  }[];
```

Add a `warehouse` field:

```tsx
  items?: {
    name: string;
    variant?: string;
    quantity: number;
    priceAtPurchase: number;
    itemSubtotal: number;
    discountAmount?: number;
    warehouse?: { _id: string; name: string; code: string } | null;
  }[];
```

- [ ] **Step 2: Add the `getOrderWarehouse` helper**

Add near the other top-level helpers (after the type block, before `PDF colours` at `pos-session-report.tsx:128`):

```tsx
function getOrderWarehouse(order: { items?: SessionOrder['items'] }) {
  return order.items?.find((i) => i.warehouse)?.warehouse ?? null;
}
```

- [ ] **Step 3: Render the chip on the order row**

The order row renders the receipt/header at the `OrderRow` component (`pos-session-report.tsx:814-815` shows the items-count region). Locate the row's primary line — the element showing the receipt number / order header (around `pos-session-report.tsx:810-820`) — and append, immediately after that label text:

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

(Place it inside the existing receipt/header element so it sits inline with the order identifier, matching the pos-history chip placement.)

- [ ] **Step 4: Type-check**

Run: `npm run type:check`
Expected: PASS, no new errors referencing `pos-session-report.tsx`.

- [ ] **Step 5: Manual QA**

Open `/point-of-sale/session-report`, select a session that has orders, and confirm each order row shows the warehouse chip inline with its identifier.

- [ ] **Step 6: Commit**

```bash
git add client/apps/isomorphic/src/app/shared/point-of-sale/pos-session-report.tsx
git commit -m "feat(client): warehouse chip on POS session report order rows"
```

---

### Task A4: Audit pos-sales-details for consistency

**Files:**
- Review only: `client/apps/isomorphic/src/app/shared/point-of-sale/pos-sales-details.tsx`

- [ ] **Step 1: Confirm the warehouse column + group-by are consistent**

Verify (no change expected):
- The "By Warehouse" group-by option exists (`pos-sales-details.tsx:1462`).
- The warehouse column renders with a "No warehouse" fallback (`pos-sales-details.tsx:3259`) and groups label as `r.warehouse || 'No warehouse'` (`:2148`, `:2315`).
- The item mapping reads `item.warehouse?.name ?? ''` (`:2040`).

If all present and the fallback wording ("No warehouse") matches what Task A2 used, no change. If a discrepancy is found (e.g. column missing the fallback), align it to `'No warehouse'`.

- [ ] **Step 2: Record the audit result**

No commit if nothing changed. If a fix was needed:

```bash
git add client/apps/isomorphic/src/app/shared/point-of-sale/pos-sales-details.tsx
git commit -m "fix(client): align warehouse fallback wording in POS sales details"
```

---

## Part B — Tenant name in invoices & receipts

### Task B1: Thread `companyName` through `purchaseInvoice.ts` builders

**Files:**
- Modify: `client/apps/isomorphic/src/utils/purchaseInvoice.ts`

- [ ] **Step 1: Remove the module constant and parameterise `headerBand` / `footerRow`**

`purchaseInvoice.ts:5`: delete `const COMPANY = 'DrinksHarbour';`.

`purchaseInvoice.ts:29` — change `headerBand` to accept a company arg and use it:

```tsx
function headerBand(left: string, right: string, company: string) {
  return `<div style="background:linear-gradient(135deg,#b20202 0%,#8a0101 100%);color:#fff;padding:16px 22px;border-radius:6px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center">
    <div>
      <div style="font-size:18px;font-weight:700;letter-spacing:0.5px">${company}</div>
      <div style="font-size:11px;opacity:0.8;margin-top:2px">Purchase Department</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:14px;font-weight:600">${left}</div>
      <div style="font-size:11px;opacity:0.8;margin-top:2px">${right}</div>
    </div>
  </div>`;
}
```

`purchaseInvoice.ts:42` — change `footerRow`:

```tsx
function footerRow(company: string) {
  return `<div style="margin-top:24px;padding-top:10px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:10px;color:#9ca3af">
    <span>${company} — Confidential</span>
    <span>Generated ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
  </div>`;
}
```

- [ ] **Step 2: Add `companyName` to `buildBillInvoice` + its caller-facing print wrapper**

`purchaseInvoice.ts:61` — signature:

```tsx
export function buildBillInvoice(bill: VendorBill, companyName: string): string {
```

Within the body, replace `${headerBand(bill.billNumber, ...)}` (`:92`) with `${headerBand(bill.billNumber, \`Status: ${statusUpper}\`, companyName)}`, replace the "Bill To" company value at `:101` (`${COMPANY}`) with `${companyName}`, and replace `${footerRow()}` (`:148`) with `${footerRow(companyName)}`.

`purchaseInvoice.ts:153` — wrapper:

```tsx
export function printBillInvoice(bill: VendorBill, companyName: string): void {
  openPrint(buildBillInvoice(bill, companyName));
}
```

- [ ] **Step 3: Add `companyName` to `buildPOInvoice` + wrapper**

`purchaseInvoice.ts:157`:

```tsx
export function buildPOInvoice(po: PurchaseOrder, companyName: string): string {
```

In the body: `${headerBand(po.poNumber, ...)}` (`:185`) → add `, companyName` as the third arg; the "Ship To" value `${COMPANY}` (`:194`) → `${companyName}`; `${footerRow()}` (`:246`) → `${footerRow(companyName)}`.

`purchaseInvoice.ts:251`:

```tsx
export function printPOInvoice(po: PurchaseOrder, companyName: string): void {
  openPrint(buildPOInvoice(po, companyName));
}
```

- [ ] **Step 4: Add `companyName` to `buildTransferInvoice` + wrapper**

The transfer invoice uses `headerBand` (`:294`) and `footerRow()` (`:354`) but has **no** `${COMPANY}` body cell (it uses From/To warehouses). Update only the two calls.

`purchaseInvoice.ts:264`:

```tsx
export function buildTransferInvoice(transfer: StockTransfer, companyName: string): string {
```

`:294` `${headerBand(transfer.transferNumber, \`Status: ${transfer.status.toUpperCase()}\`)}` → append `, companyName`. `:354` `${footerRow()}` → `${footerRow(companyName)}`.

`purchaseInvoice.ts:359`:

```tsx
export function printTransferInvoice(transfer: StockTransfer, companyName: string): void {
  openPrint(buildTransferInvoice(transfer, companyName));
}
```

- [ ] **Step 5: Type-check (expect caller errors next)**

Run: `npm run type:check`
Expected: FAIL only at the 3 call sites (`purchases-bill-detail.tsx`, `purchases-po-detail.tsx`, `stock-transfer-detail.tsx`) — "Expected 2 arguments, but got 1". These are fixed in Task B2.

- [ ] **Step 6: Commit**

```bash
git add client/apps/isomorphic/src/utils/purchaseInvoice.ts
git commit -m "refactor(client): thread companyName through purchase invoice builders"
```

---

### Task B2: Pass tenant name from the three purchase invoice callers

**Files:**
- Modify: `client/apps/isomorphic/src/app/shared/purchases/purchases-bill-detail.tsx`
- Modify: `client/apps/isomorphic/src/app/shared/purchases/purchases-po-detail.tsx`
- Modify: `client/apps/isomorphic/src/app/shared/purchases/stock-transfer-detail.tsx`

For **each** of the three files, apply the same pattern:

- [ ] **Step 1: Import and read the tenant**

Add the import (next to the other `@/` imports):

```tsx
import { useTenant } from '@/context/TenantContext';
```

Inside the component body (near the top, alongside the other hooks), add:

```tsx
  const { tenant } = useTenant();
```

- [ ] **Step 2: Pass the resolved name into the print call**

- `purchases-bill-detail.tsx:221`: `onClick={() => bill && printBillInvoice(bill)}` → `onClick={() => bill && printBillInvoice(bill, tenant?.name || 'DrinksHarbour')}`
- `purchases-po-detail.tsx:184`: `onClick={() => printPOInvoice(po)}` → `onClick={() => printPOInvoice(po, tenant?.name || 'DrinksHarbour')}`
- `stock-transfer-detail.tsx:164`: `onClick={() => printTransferInvoice(transfer)}` → `onClick={() => printTransferInvoice(transfer, tenant?.name || 'DrinksHarbour')}`

- [ ] **Step 3: Type-check**

Run: `npm run type:check`
Expected: PASS (the Task B1 caller errors are now resolved, no new errors).

- [ ] **Step 4: Manual QA**

From a vendor bill detail, a PO detail, and a stock-transfer detail, click Print. Confirm the header band, footer, and (bill/PO) the "Bill To"/"Ship To" cell show the tenant's real name. Temporarily simulate a missing tenant if feasible and confirm the literal "DrinksHarbour" fallback renders.

- [ ] **Step 5: Commit**

```bash
git add client/apps/isomorphic/src/app/shared/purchases/purchases-bill-detail.tsx \
        client/apps/isomorphic/src/app/shared/purchases/purchases-po-detail.tsx \
        client/apps/isomorphic/src/app/shared/purchases/stock-transfer-detail.tsx
git commit -m "feat(client): use tenant name in purchase bill, PO and transfer invoices"
```

---

### Task B3: Tenant name in the pos-sales-details PDF

**Files:**
- Modify: `client/apps/isomorphic/src/app/shared/point-of-sale/pos-sales-details.tsx`

- [ ] **Step 1: Add a `storeName` param to the three PDF helpers**

`pos-sales-details.tsx:749` — `drawPdf1Header` signature, add `storeName`:

```tsx
function drawPdf1Header(
  doc: jsPDF,
  title: string,
  rowCount: string,
  meta: PdfMeta,
  pageW: number,
  storeName: string
): number {
```

and replace `doc.text('DrinksHarbour', 12, 9.5);` (`:761`) with `doc.text(storeName, 12, 9.5);`.

`pos-sales-details.tsx:877` — `drawPdfMiniHeader`:

```tsx
function drawPdfMiniHeader(doc: jsPDF, title: string, pageW: number, storeName: string) {
```

replace `doc.text('DrinksHarbour  ·  ' + title, 12, 5.5);` (`:883`) with `doc.text(storeName + '  ·  ' + title, 12, 5.5);`.

`pos-sales-details.tsx:891` — `addPdfPageFooters`:

```tsx
function addPdfPageFooters(doc: jsPDF, subtitle: string, storeName: string) {
```

replace `doc.text('DrinksHarbour  ·  Confidential', 12, pageH - 4.5);` (`:903`) with `doc.text(storeName + '  ·  Confidential', 12, pageH - 4.5);`.

- [ ] **Step 2: Thread `storeName` from the export functions to the helper calls**

`exportLinePdf` (`pos-sales-details.tsx:1027`) and `exportGroupedPdf` (`:1178`) call these helpers. Add a `storeName: string` parameter to whichever functions invoke `drawPdf1Header` / `drawPdfMiniHeader` / `addPdfPageFooters`, and pass `storeName` through at each call site. Trace from `:1027` and `:1178`: every call to the three helpers must receive `storeName` as its new final argument. (Search the file for `drawPdf1Header(`, `drawPdfMiniHeader(`, `addPdfPageFooters(` and append `storeName` to each.)

- [ ] **Step 3: Resolve the tenant in the component and pass it into the exporters**

Add the import:

```tsx
import { useTenant } from '@/context/TenantContext';
```

In `POSSalesDetails` (component starts `pos-sales-details.tsx:1843`), after the `token` memo, add:

```tsx
  const { tenant } = useTenant();
  const storeName = tenant?.name || 'DrinksHarbour';
```

At each place the component invokes `exportLinePdf(...)` / `exportGroupedPdf(...)`, pass `storeName` as the new argument (matching the parameter added in Step 2).

- [ ] **Step 4: Type-check**

Run: `npm run type:check`
Expected: PASS. If any `drawPdf*`/`exportLinePdf`/`exportGroupedPdf` call still passes too few args, fix the missed call site.

- [ ] **Step 5: Manual QA**

Open `/point-of-sale/sales-details`, export both a line-level PDF and a grouped PDF. Confirm the page header, mini-header, and footer all show the tenant's real name instead of "DrinksHarbour".

- [ ] **Step 6: Commit**

```bash
git add client/apps/isomorphic/src/app/shared/point-of-sale/pos-sales-details.tsx
git commit -m "feat(client): use tenant name in POS sales details PDF"
```

---

### Task B4: Tenant name in the pos-session-report PDFs and HTML

**Files:**
- Modify: `client/apps/isomorphic/src/app/shared/point-of-sale/pos-session-report.tsx`

There are 6 hardcoded sites: `:153`, `:355` (`buildSessionReportPdf`), `:383`, `:514` (`buildZReportPdf`), `:587`, `:667` (HTML builder).

- [ ] **Step 1: Add `storeName` to the PDF builders**

`pos-session-report.tsx:141`:

```tsx
function buildSessionReportPdf(session: POSSession, orders: SessionOrder[], storeName: string) {
```

Replace `doc.text('DrinksHarbour', M, 9.5);` (`:153`) with `doc.text(storeName, M, 9.5);` and `doc.text('DrinksHarbour  ·  Confidential', M, pageH - 4.5);` (`:355`) with `doc.text(storeName + '  ·  Confidential', M, pageH - 4.5);`.

`pos-session-report.tsx:368`:

```tsx
function buildZReportPdf(session: POSSession, orders: SessionOrder[], storeName: string) {
```

Replace `doc.text('DrinksHarbour', M, 9.5);` (`:383`) with `doc.text(storeName, M, 9.5);` and `doc.text('DrinksHarbour  ·  Confidential', M, pageH - 4.5);` (`:514`) with `doc.text(storeName + '  ·  Confidential', M, pageH - 4.5);`.

- [ ] **Step 2: Thread `storeName` through `printSessionReport` and the HTML builder**

`printSessionReport` (`pos-session-report.tsx:527`) calls the PDF builders. Add a `storeName: string` parameter and pass it into `buildSessionReportPdf(...)` / `buildZReportPdf(...)`.

For the HTML report builder (the function containing `:587` and `:667`), add a `storeName: string` parameter and replace:
- `:587` `DrinksHarbour · ${(session.terminalType || 'retail').toUpperCase()}` → `${storeName} · ${(session.terminalType || 'retail').toUpperCase()}`
- `:667` `<span>DrinksHarbour · Confidential</span>` → `<span>${storeName} · Confidential</span>`

Pass `storeName` from `printSessionReport` into the HTML builder too if it is invoked there.

- [ ] **Step 3: Resolve the tenant in the component and pass it down**

Add the import:

```tsx
import { useTenant } from '@/context/TenantContext';
```

In `POSSessionReport` (`pos-session-report.tsx:1296`), after the `token` memo (`:1298`), add:

```tsx
  const { tenant } = useTenant();
  const storeName = tenant?.name || 'DrinksHarbour';
```

At every call to `printSessionReport(...)` / `buildSessionReportPdf(...)` / `buildZReportPdf(...)` / the HTML builder within the component (including the `ZReportTab` at `:997` if it triggers a build — pass `storeName` in as a prop if needed), pass `storeName` as the new final argument.

- [ ] **Step 4: Type-check**

Run: `npm run type:check`
Expected: PASS. Fix any call site that still omits `storeName`.

- [ ] **Step 5: Manual QA**

Open `/point-of-sale/session-report`, print the Session Report PDF, the Z-Report PDF, and the HTML report. Confirm all show the tenant's real name in header/footer.

- [ ] **Step 6: Commit**

```bash
git add client/apps/isomorphic/src/app/shared/point-of-sale/pos-session-report.tsx
git commit -m "feat(client): use tenant name in POS session report PDFs and HTML"
```

---

### Task B5: Tenant name in the pos-history HTML refund receipt

**Files:**
- Modify: `client/apps/isomorphic/src/app/shared/point-of-sale/pos-history.tsx`

- [ ] **Step 1: Expose the tenant in the receipt-printing scope**

The return-receipt HTML is written near `pos-history.tsx:222-227`. Identify the enclosing component/handler and ensure it has the tenant. `pos-history.tsx:401` already does `const { token: posToken } = usePOSAuth();` — in the component that owns the receipt-print logic, extend that destructure to include `tenant`:

```tsx
  const { token: posToken, tenant } = usePOSAuth();
```

If the receipt is written from a different component that does not call `usePOSAuth`, add `const { tenant } = usePOSAuth();` at the top of that component.

- [ ] **Step 2: Replace the hardcoded store name**

`pos-history.tsx:227`:

```tsx
        <strong style="font-size:14px;letter-spacing:2px">DRINKS HARBOUR</strong><br>
```

→

```tsx
        <strong style="font-size:14px;letter-spacing:2px">${(tenant?.name || 'DRINKS HARBOUR').toUpperCase()}</strong><br>
```

(The surrounding string is already a template literal — confirm the `${...}` interpolates. If that block is a plain string, convert the literal to a backtick template.)

- [ ] **Step 3: Type-check**

Run: `npm run type:check`
Expected: PASS.

- [ ] **Step 4: Manual QA**

Open `/point-of-sale/history`, open an order with a refund, print the return receipt, and confirm the header shows the tenant's uppercased name.

- [ ] **Step 5: Commit**

```bash
git add client/apps/isomorphic/src/app/shared/point-of-sale/pos-history.tsx
git commit -m "feat(client): use tenant name in POS history return receipt"
```

---

### Task B6: Tenant name in the pos-sell-orders HTML refund receipt

**Files:**
- Modify: `client/apps/isomorphic/src/app/shared/point-of-sale/pos-sell-orders.tsx`

- [ ] **Step 1: Expose the tenant in the receipt scope**

The receipt is written from `handlePrint` (`pos-sell-orders.tsx:257`), inside a component. Find that component's `usePOSAuth()` call and add `tenant`:

```tsx
  const { token, terminal, tenant } = usePOSAuth();
```

If `handlePrint`'s component has no `usePOSAuth()` call, add `const { tenant } = usePOSAuth();` to it.

- [ ] **Step 2: Replace the hardcoded store name**

`pos-sell-orders.tsx:286`:

```tsx
        <strong style="font-size:14px;letter-spacing:2px">DRINKS HARBOUR</strong><br>
```

→

```tsx
        <strong style="font-size:14px;letter-spacing:2px">${(tenant?.name || 'DRINKS HARBOUR').toUpperCase()}</strong><br>
```

(The receipt body is built with `win.document.write(\`…\`)`, so the `${...}` interpolation is valid inside that template literal.)

- [ ] **Step 3: Type-check**

Run: `npm run type:check`
Expected: PASS.

- [ ] **Step 4: Manual QA**

Open `/point-of-sale/sell-orders`, print a return receipt, and confirm the header shows the tenant's uppercased name.

- [ ] **Step 5: Commit**

```bash
git add client/apps/isomorphic/src/app/shared/point-of-sale/pos-sell-orders.tsx
git commit -m "feat(client): use tenant name in POS sell-orders return receipt"
```

---

## Final verification

- [ ] **Whole-app type-check**

Run (from `client/apps/isomorphic`): `npm run type:check`
Expected: PASS with no errors in any touched file.

- [ ] **Full manual QA sweep**

1. `/point-of-sale/orders` — warehouse chip on rows + detail panel (Task A1).
2. `/point-of-sale/order-analysis` — "Warehouse" group-by buckets correctly (Task A2).
3. `/point-of-sale/session-report` — warehouse chip on order rows; Session + Z + HTML reports show tenant name (Tasks A3, B4).
4. `/point-of-sale/sales-details` — warehouse column intact; line + grouped PDFs show tenant name (Tasks A4, B3).
5. POS receipts — history + sell-orders return receipts show tenant name (Tasks B5, B6).
6. Purchases — vendor bill, PO, and stock-transfer invoices show tenant name with "DrinksHarbour" fallback (Tasks B1, B2).

- [ ] **Confirm no chrome regressed**

Spot-check that dashboard / order-detail / warehouses-list branding text still reads the literal "Drinks Harbour" (intentionally out of scope).

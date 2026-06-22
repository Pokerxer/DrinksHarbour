# Sales Frontend Stage A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/sales` module's transactional-core frontend (quotations, orders, create, fulfillment, returns) consuming the 9 already-merged `/api/sales-orders` backend endpoints — no new backend work.

**Architecture:** Mirror `shared/purchases/*` + `(hydrogen)/purchases/*` conventions exactly: thin Next.js route shells in `(hydrogen)/sales/*` that render real components living in `shared/sales/*`. A new lightweight client service (`salesOrder.service.ts`) wraps the 9 endpoints. Customer/pricelist auto-apply reuses two existing POS primitives (`posApi.getPricelists`, `computeItemPriceWithPricelist`) via a new small hook — not the POS cart-coupled hook itself.

**Tech Stack:** Next.js App Router, React, TypeScript (strict, no new `any`), Tailwind CSS, `react-hot-toast`, `next-auth` session token, `react-icons/pi`.

## Global Constraints

- No new backend endpoints or models in this plan — every network call must hit one of the 9 existing `/api/sales-orders` routes (or the already-existing `/api/pos/customers`, `/api/pos/pricelists`, `/api/warehouses` routes).
- Money is NGN-integer; reuse `fmtCur`/`fmtPrice` from `shared/purchases/purchases-analytics-helpers.ts` / `shared/purchases/types.ts` — do not write a new formatter.
- Per AGENTS.md: keep individual files under ~200–300 lines; decompose into focused components rather than one large file.
- Client typecheck must stay clean: `cd client/apps/isomorphic && ./node_modules/.bin/tsc --noEmit` must show no new errors beyond the existing 27 `TS2688` baseline (run this once before Task 1 to confirm the baseline count, and after every task).
- No automated test runner exists for this frontend (no jest/vitest configured) — verification is `tsc --noEmit` + manual browser exercise via a running dev server, consistent with how every existing `purchases-*.tsx` component was verified.
- Tailwind utility convention to match throughout: brand red `#b20202` / `#9a0101` hover, `rounded-lg`/`rounded-xl` borders in `border-gray-200`, `text-sm`, toast via `react-hot-toast`.
- Every new list/detail component reads the session token via `useSession()` exactly like `purchases-returns.tsx`/`purchases-receipt-detail.tsx`: `const { data: session } = useSession(); const token = (session?.user as { token?: string })?.token ?? '';`.

## Reference contracts (verified against the merged backend — do not re-derive)

**`server/models/SalesOrder.js`** line item shape (each gets a Mongo `_id`):
```
{ _id, product, subproduct, size, sku, name, quantity, unitPrice, discount, lineTotal, fulfilledQty, postedQty, returnedQty }
```
`lineTotal = max(0, unitPrice - discount) * quantity`. `discount` is a **per-unit flat amount**, not a percentage.

**Outstanding** (`server/services/salesFulfill.helpers.js:outstanding`): `quantity - fulfilledQty - returnedQty`, floored at 0.

**Endpoints** (all under `/api/sales-orders`, `Authorization: Bearer <token>`, responses `{ success, data, ... }`):

| Method | Path | Body | Response extras |
|---|---|---|---|
| GET | `/?docType&status&customer` | — | `data: SalesOrder[]` (no pagination — server returns the full matching set) |
| POST | `/` | `{ docType, customer?, customerSnapshot?, pricelist?, appliedPricelist?, items:[{product?,subproduct?,size?,sku?,name?,quantity,unitPrice,discount?}], validUntil?, notes?, terms? }` | — |
| GET | `/:id` | — | — |
| PUT | `/:id` | `{ items?, notes?, terms?, validUntil? }` — 409 if `canEdit` guard fails (quotation: draft/sent only; order: draft only) | — |
| DELETE | `/:id` | — | cancels (409 if `canCancel` guard fails) |
| POST | `/:id/send` | — | quotation draft→sent (409 otherwise) |
| POST | `/:id/accept` | — | sent→accepted (409 otherwise) |
| POST | `/:id/reject` | — | draft/sent→rejected (409 otherwise) |
| POST | `/:id/convert` | — | 201, `data` is the **new order** doc (409 if already converted/rejected/expired) |
| POST | `/:id/confirm` | `{ paymentMethod (required), amountTendered?, splitPayments? }` | 400 if no paymentMethod; 409 if not draft order; 400 if `paymentMethod:'wallet'` and no saved customer |
| POST | `/:id/fulfill` | `{ warehouseId (required), items:[{lineId,qty}] }` | `posting: { successCount, failCount, failures:[{lineId,name,reason}], postedLineIds }` — **HTTP 200 even when `failCount>0`** |
| POST | `/:id/return` | `{ warehouseId (required), items:[{lineId,qty}] }` | `restock: { successCount, failures:[{lineId,reason}] }` — **HTTP 200 even with failures** |

`paymentMethod` accepted values (from `SALES_PAYMENT_METHODS`): `card`, `bank_transfer`, `mobile_money`, `cash`, `pos_terminal`, `wallet`, `invoice`, `other`.

**Customer/pricelist primitives (existing, reused as-is — do not modify):**
- `posApi.searchCustomers(token, q, limit)` → `GET /api/pos/customers?q=&limit=` → `{ customers: POSCustomer[] }` (`client/apps/isomorphic/src/app/shared/point-of-sale/api.ts:417`).
- `posApi.getPricelists(token, shopId?, customerId?)` → `GET /api/pos/pricelists` → `{ pricelists: any[]; resolvedId: string|null }` (`.../api.ts:119`); call with `shopId` omitted for customer-only resolution.
- `computeItemPriceWithPricelist(item: POSCartItem, pricelist): number` — pure function (`.../point-of-sale/store/index.ts:269`) reading only `item.subProductId`, `item.quantity`, `item.price`, `item.costPrice`.
- `POSCustomer` type: `{ _id, firstName, lastName, email?, phone?, loyaltyPoints, walletBalance, pricelist?: string|null, pricelistName?: string }` (`.../point-of-sale/types.ts:16`).

**SubProduct selling-price fields** (verified against `server/models/SubProduct.js` / `server/models/Size.js` — note this is the SELLING price, distinct from the cost-price fields the purchases module reads): sizeless subproduct → `baseSellingPrice` + `costPrice`; sized variant → `Size.sellingPrice` + `Size.costPrice`. `subproductService.getSubProducts(token, {search, limit})` → `res.data.subProducts[]` (raw Mongoose-shaped docs, no remapping).

**Warehouse**: `warehouseService.getWarehouses(token, {isActive:true})` → `{ data: Warehouse[] }`, `Warehouse: { _id, name, code, isActive, isDefault, ... }`.

---

## File structure (new files this plan creates)

```
client/apps/isomorphic/src/
  services/salesOrder.service.ts                          # Task 1
  app/shared/sales/
    sales-helpers.ts                                       # Task 2
    sales-nav-header.tsx                                   # Task 2
    sales-quotations.tsx                                    # Task 2
    sales-orders.tsx                                        # Task 2
    customer-search.tsx                                     # Task 3
    use-sales-customer-pricelist.ts                         # Task 3
    product-line-search.tsx                                 # Task 3
    sales-create.tsx                                         # Task 3
    sales-detail.tsx                                         # Task 4 (fetch+branch router)
    sales-quotation-detail.tsx                               # Task 4
    sales-order-detail.tsx                                   # Task 5
    sales-invoice-view.tsx                                   # Task 5
    sales-fulfill.tsx                                        # Task 6
    sales-fulfill-detail.tsx                                 # Task 6
    sales-returns.tsx                                        # Task 7
    sales-return-create.tsx                                  # Task 7
    sales-return-detail.tsx                                  # Task 7
  app/(hydrogen)/sales/
    page.tsx                                                 # Task 2 (redirects to /sales/orders)
    quotations/page.tsx                                      # Task 2
    orders/page.tsx                                          # Task 2
    create/page.tsx                                          # Task 3
    [id]/page.tsx                                            # Task 4
    fulfill/page.tsx                                         # Task 6
    fulfill/[id]/page.tsx                                    # Task 6
    returns/page.tsx                                         # Task 7
    returns/create/page.tsx                                  # Task 7
    returns/[id]/page.tsx                                    # Task 7

Modified:
  client/apps/isomorphic/src/config/routes.ts                # Task 2 (full sales route group, additive)
  client/apps/isomorphic/src/layouts/hydrogen/tenant-menu-items.tsx  # Task 2 (Sales sidebar section, additive)
```

---

### Task 1: Client service layer (`salesOrder.service.ts`)

**Files:**
- Create: `client/apps/isomorphic/src/services/salesOrder.service.ts`

**Interfaces:**
- Produces: `SalesOrder`, `SalesLineItem`, `CreateSalesOrderInput`, `SalesOrderLineInput`, `FulfillPosting`, `ReturnRestock`, `SalesOrderResponse`, `SalesOrderListResponse`, `FulfillResponse`, `ReturnResponse`, and the `salesOrderService` object with methods: `list`, `create`, `get`, `update`, `cancel`, `send`, `accept`, `reject`, `convert`, `confirm`, `fulfill`, `return`. Every later task imports from this file only — no task re-implements a fetch call.

- [ ] **Step 1: Confirm the current TS baseline**

Run: `cd /Users/mac/Documents/drinksharbour/client/apps/isomorphic && ./node_modules/.bin/tsc --noEmit 2>&1 | tail -5`
Expected: a count of pre-existing `TS2688` errors (per the spec, 27). Record this number — every later task's verification compares against it.

- [ ] **Step 2: Write the service file**

```typescript
// client/apps/isomorphic/src/services/salesOrder.service.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface SalesLineItem {
  _id: string;
  product?: string;
  subproduct?: string;
  size?: string;
  sku?: string;
  name?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
  fulfilledQty: number;
  postedQty: number;
  returnedQty: number;
}

export interface SalesOrderCustomerSnapshot {
  name?: string;
  phone?: string;
  email?: string;
  customerId?: string;
}

export interface SalesOrderFulfillment {
  _id: string;
  warehouseId: string;
  items: { lineId: string; qty: number }[];
  status: string;
  at: string;
  by?: string;
}

export type QuoteStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'converted';

export type OrderStatus =
  | 'draft'
  | 'confirmed'
  | 'partially_fulfilled'
  | 'fulfilled'
  | 'cancelled';

export interface SalesOrder {
  _id: string;
  tenant?: string;
  soNumber: string;
  docType: 'quotation' | 'order';
  customer?: string;
  customerSnapshot?: SalesOrderCustomerSnapshot;
  pricelist?: string | null;
  appliedPricelist?: { pricelistId?: string; pricelistName?: string };
  currency: string;
  items: SalesLineItem[];
  subtotal: number;
  discountTotal: number;
  total: number;
  quoteStatus?: QuoteStatus;
  validUntil?: string;
  orderStatus?: OrderStatus;
  paymentMethod?: string;
  paymentStatus?: 'unpaid' | 'paid';
  amountPaid?: number;
  loyaltyEarned?: number;
  fulfillments: SalesOrderFulfillment[];
  convertedFrom?: string;
  convertedTo?: string;
  relatedSales?: string[];
  notes?: string;
  terms?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SalesOrderLineInput {
  product?: string;
  subproduct?: string;
  size?: string;
  sku?: string;
  name?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
}

export interface CreateSalesOrderInput {
  docType: 'quotation' | 'order';
  customer?: string;
  customerSnapshot?: SalesOrderCustomerSnapshot;
  pricelist?: string;
  appliedPricelist?: { pricelistId?: string; pricelistName?: string };
  items: SalesOrderLineInput[];
  validUntil?: string;
  notes?: string;
  terms?: string;
}

export interface UpdateSalesOrderInput {
  items?: SalesOrderLineInput[];
  notes?: string;
  terms?: string;
  validUntil?: string;
}

export interface FulfillPosting {
  successCount: number;
  failCount: number;
  failures: { lineId: string; name?: string; reason: string }[];
  postedLineIds: string[];
}

export interface ReturnRestock {
  successCount: number;
  failures: { lineId: string; reason: string }[];
}

export interface SalesOrderResponse {
  success: boolean;
  data: SalesOrder;
  message?: string;
}

export interface SalesOrderListResponse {
  success: boolean;
  data: SalesOrder[];
  message?: string;
}

export interface FulfillResponse {
  success: boolean;
  data: SalesOrder;
  posting: FulfillPosting;
  message?: string;
}

export interface ReturnResponse {
  success: boolean;
  data: SalesOrder;
  restock: ReturnRestock;
  message?: string;
}

async function parseErrorOrThrow(response: Response, fallback: string) {
  if (response.ok) return;
  let message = fallback;
  try {
    const body = await response.json();
    message = body.message || fallback;
  } catch {
    // non-JSON error body — keep fallback
  }
  throw new Error(message);
}

function authHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export const salesOrderService = {
  async list(
    token: string,
    params: { docType?: 'quotation' | 'order'; status?: string; customer?: string } = {}
  ): Promise<SalesOrderListResponse> {
    const qs = new URLSearchParams();
    if (params.docType) qs.set('docType', params.docType);
    if (params.status) qs.set('status', params.status);
    if (params.customer) qs.set('customer', params.customer);
    const url = `${API_URL}/api/sales-orders${qs.toString() ? `?${qs}` : ''}`;
    const response = await fetch(url, { headers: authHeaders(token) });
    await parseErrorOrThrow(response, 'Failed to load sales orders');
    return response.json();
  },

  async create(
    input: CreateSalesOrderInput,
    token: string
  ): Promise<SalesOrderResponse> {
    const response = await fetch(`${API_URL}/api/sales-orders`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(input),
    });
    await parseErrorOrThrow(response, 'Failed to create sales order');
    return response.json();
  },

  async get(id: string, token: string): Promise<SalesOrderResponse> {
    const response = await fetch(`${API_URL}/api/sales-orders/${id}`, {
      headers: authHeaders(token),
    });
    await parseErrorOrThrow(response, 'Failed to load sales order');
    return response.json();
  },

  async update(
    id: string,
    patch: UpdateSalesOrderInput,
    token: string
  ): Promise<SalesOrderResponse> {
    const response = await fetch(`${API_URL}/api/sales-orders/${id}`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(patch),
    });
    await parseErrorOrThrow(response, 'Failed to update sales order');
    return response.json();
  },

  async cancel(id: string, token: string): Promise<SalesOrderResponse> {
    const response = await fetch(`${API_URL}/api/sales-orders/${id}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
    await parseErrorOrThrow(response, 'Failed to cancel sales order');
    return response.json();
  },

  async send(id: string, token: string): Promise<SalesOrderResponse> {
    const response = await fetch(`${API_URL}/api/sales-orders/${id}/send`, {
      method: 'POST',
      headers: authHeaders(token),
    });
    await parseErrorOrThrow(response, 'Failed to send quotation');
    return response.json();
  },

  async accept(id: string, token: string): Promise<SalesOrderResponse> {
    const response = await fetch(`${API_URL}/api/sales-orders/${id}/accept`, {
      method: 'POST',
      headers: authHeaders(token),
    });
    await parseErrorOrThrow(response, 'Failed to accept quotation');
    return response.json();
  },

  async reject(id: string, token: string): Promise<SalesOrderResponse> {
    const response = await fetch(`${API_URL}/api/sales-orders/${id}/reject`, {
      method: 'POST',
      headers: authHeaders(token),
    });
    await parseErrorOrThrow(response, 'Failed to reject quotation');
    return response.json();
  },

  async convert(id: string, token: string): Promise<SalesOrderResponse> {
    const response = await fetch(`${API_URL}/api/sales-orders/${id}/convert`, {
      method: 'POST',
      headers: authHeaders(token),
    });
    await parseErrorOrThrow(response, 'Failed to convert quotation');
    return response.json();
  },

  async confirm(
    id: string,
    body: { paymentMethod: string; amountTendered?: number; splitPayments?: unknown[] },
    token: string
  ): Promise<SalesOrderResponse> {
    const response = await fetch(`${API_URL}/api/sales-orders/${id}/confirm`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
    await parseErrorOrThrow(response, 'Failed to confirm order');
    return response.json();
  },

  async fulfill(
    id: string,
    body: { warehouseId: string; items: { lineId: string; qty: number }[] },
    token: string
  ): Promise<FulfillResponse> {
    const response = await fetch(`${API_URL}/api/sales-orders/${id}/fulfill`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
    await parseErrorOrThrow(response, 'Failed to fulfill order');
    return response.json();
  },

  async return(
    id: string,
    body: { warehouseId: string; items: { lineId: string; qty: number }[] },
    token: string
  ): Promise<ReturnResponse> {
    const response = await fetch(`${API_URL}/api/sales-orders/${id}/return`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
    await parseErrorOrThrow(response, 'Failed to return order items');
    return response.json();
  },
};
```

- [ ] **Step 3: Typecheck**

Run: `cd /Users/mac/Documents/drinksharbour/client/apps/isomorphic && ./node_modules/.bin/tsc --noEmit 2>&1 | grep -v "TS2688" | head -30`
Expected: no output (no new non-TS2688 errors). This file isn't imported anywhere yet, so it can't introduce consumer-side errors — this step just confirms the file itself is syntactically/type valid.

- [ ] **Step 4: Commit**

```bash
cd /Users/mac/Documents/drinksharbour
git add client/apps/isomorphic/src/services/salesOrder.service.ts
git commit -m "feat(sales): client service layer for /api/sales-orders"
```

---

### Task 2: Routing skeleton + sidebar nav + Quotations/Orders lists

**Files:**
- Modify: `client/apps/isomorphic/src/config/routes.ts`
- Modify: `client/apps/isomorphic/src/layouts/hydrogen/tenant-menu-items.tsx`
- Create: `client/apps/isomorphic/src/app/shared/sales/sales-helpers.ts`
- Create: `client/apps/isomorphic/src/app/shared/sales/sales-nav-header.tsx`
- Create: `client/apps/isomorphic/src/app/shared/sales/sales-quotations.tsx`
- Create: `client/apps/isomorphic/src/app/shared/sales/sales-orders.tsx`
- Create: `client/apps/isomorphic/src/app/(hydrogen)/sales/page.tsx`
- Create: `client/apps/isomorphic/src/app/(hydrogen)/sales/quotations/page.tsx`
- Create: `client/apps/isomorphic/src/app/(hydrogen)/sales/orders/page.tsx`

**Interfaces:**
- Consumes: `salesOrderService.list` from Task 1; `SalesOrder`, `QuoteStatus`, `OrderStatus` types from Task 1.
- Produces: `routes.eCommerce.sales`, `.createSale`, `.salesQuotations`, `.salesOrders`, `.salesDetails(id)`, `.salesFulfillList`, `.salesFulfillDetails(id)`, `.salesReturns`, `.createSalesReturn`, `.salesReturnDetails(id)` (all route keys added now even though some target pages don't exist until later tasks — Next.js Link components to not-yet-built routes 404 harmlessly until those tasks land, same as any other incrementally-built module). `outstanding(line)`, `quoteStatusLabel(status)`, `orderStatusLabel(status)`, `QUOTE_STATUS_BADGE`, `ORDER_STATUS_BADGE` from `sales-helpers.ts` — every later task imports these rather than redefining.

- [ ] **Step 1: Add the sales route group to `routes.ts`**

Open `client/apps/isomorphic/src/config/routes.ts` and add these keys inside the existing `eCommerce` object (after the `stockTransfers`/`editStockTransfer` block, i.e. right before its closing — find the line `editStockTransfer: (id: string) => \`/purchases/transfers/${id}/edit\`,` and insert after it):

```typescript
    // Sales (quotations -> orders -> fulfillment -> returns)
    sales: '/sales',
    createSale: '/sales/create',
    salesQuotations: '/sales/quotations',
    salesOrders: '/sales/orders',
    salesDetails: (id: string) => `/sales/${id}`,
    salesFulfillList: '/sales/fulfill',
    salesFulfillDetails: (id: string) => `/sales/fulfill/${id}`,
    salesReturns: '/sales/returns',
    createSalesReturn: '/sales/returns/create',
    salesReturnDetails: (id: string) => `/sales/returns/${id}`,
```

- [ ] **Step 2: Add the Sales sidebar section to `tenant-menu-items.tsx`**

Open `client/apps/isomorphic/src/layouts/hydrogen/tenant-menu-items.tsx`. Find the existing `// ─── Purchases ──────────────────────────────────────────────` section (it ends right before `// ─── Logistics ──────────────────────────────────────────────`). Insert a new section between them:

```typescript
  // ─── Sales ──────────────────────────────────────────────────
  { label: 'Sales' },
  {
    name: 'Quotations & Orders',
    href: '#',
    icon: <PiFileTextDuotone />,
    dropdownItems: [
      { name: 'Quotations', href: routes.eCommerce.salesQuotations },
      { name: 'Orders', href: routes.eCommerce.salesOrders },
      { name: 'New Sale', href: routes.eCommerce.createSale },
    ],
  },
  {
    name: 'Fulfillment',
    href: routes.eCommerce.salesFulfillList,
    icon: <PiTrayArrowDownDuotone />,
  },
  {
    name: 'Sales Returns',
    href: routes.eCommerce.salesReturns,
    icon: <PiArrowUUpLeftDuotone />,
  },

```

`PiFileTextDuotone`, `PiTrayArrowDownDuotone`, and `PiArrowUUpLeftDuotone` are already imported in this file (used by the Purchases section above) — if any is missing from the import block at the top, add it to the existing `react-icons/pi` import statement.

- [ ] **Step 3: Verify routes/menu typecheck**

Run: `cd /Users/mac/Documents/drinksharbour/client/apps/isomorphic && ./node_modules/.bin/tsc --noEmit 2>&1 | grep -v "TS2688"`
Expected: no output.

- [ ] **Step 4: Write `sales-helpers.ts`**

```typescript
// client/apps/isomorphic/src/app/shared/sales/sales-helpers.ts
import type { SalesLineItem, QuoteStatus, OrderStatus } from '@/services/salesOrder.service';

/** Units still owed on a line: ordered minus shipped minus returned, floored at 0. Mirrors server/services/salesFulfill.helpers.js:outstanding. */
export function outstanding(line: SalesLineItem): number {
  return Math.max(0, (line.quantity || 0) - (line.fulfilledQty || 0) - (line.returnedQty || 0));
}

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  rejected: 'Rejected',
  expired: 'Expired',
  converted: 'Converted',
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  partially_fulfilled: 'Partially Fulfilled',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
};

export function quoteStatusLabel(status?: string): string {
  return (status && QUOTE_STATUS_LABELS[status as QuoteStatus]) || status || '—';
}

export function orderStatusLabel(status?: string): string {
  return (status && ORDER_STATUS_LABELS[status as OrderStatus]) || status || '—';
}

export const QUOTE_STATUS_BADGE: Record<QuoteStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-amber-100 text-amber-700',
  converted: 'bg-violet-100 text-violet-700',
};

export const ORDER_STATUS_BADGE: Record<OrderStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  confirmed: 'bg-blue-100 text-blue-700',
  partially_fulfilled: 'bg-amber-100 text-amber-700',
  fulfilled: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
};
```

- [ ] **Step 5: Write `sales-nav-header.tsx`**

```typescript
// client/apps/isomorphic/src/app/shared/sales/sales-nav-header.tsx
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  PiCaretDown,
  PiFileTextDuotone,
  PiShoppingCartDuotone,
  PiPlusCircleDuotone,
  PiTrayArrowDownDuotone,
  PiArrowUUpLeftDuotone,
} from 'react-icons/pi';
import { routes } from '@/config/routes';
import { LauncherButton } from '@/layouts/hydrogen/app-launcher';
import NavDropdownPanel, { type NavSubItem } from '@/app/shared/nav-dropdown-panel';

type NavItem = { label: string; icon: React.ReactNode; items: NavSubItem[] };

const navItems: NavItem[] = [
  {
    label: 'Quotations & Orders',
    icon: <PiFileTextDuotone />,
    items: [
      { label: 'Quotations', href: routes.eCommerce.salesQuotations, icon: <PiFileTextDuotone />, desc: 'Draft & sent quotes' },
      { label: 'Orders', href: routes.eCommerce.salesOrders, icon: <PiShoppingCartDuotone />, desc: 'Confirmed & fulfilling' },
      { label: 'New Sale', href: routes.eCommerce.createSale, icon: <PiPlusCircleDuotone />, desc: 'Create quotation or order' },
    ],
  },
  {
    label: 'Fulfillment',
    icon: <PiTrayArrowDownDuotone />,
    items: [
      { label: 'Awaiting Fulfillment', href: routes.eCommerce.salesFulfillList, icon: <PiTrayArrowDownDuotone />, desc: 'Ship outstanding orders' },
    ],
  },
  {
    label: 'Returns',
    icon: <PiArrowUUpLeftDuotone />,
    items: [
      { label: 'All Returns', href: routes.eCommerce.salesReturns, icon: <PiArrowUUpLeftDuotone />, desc: 'Restocked / reversed' },
      { label: 'New Return', href: routes.eCommerce.createSalesReturn, icon: <PiPlusCircleDuotone />, desc: 'Return fulfilled units' },
    ],
  },
];

export default function SalesNavHeader() {
  const pathname = usePathname();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  const close = useCallback(() => setOpenMenu(null), []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) close();
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [close]);

  useEffect(() => {
    close();
  }, [pathname, close]);

  return (
    <nav ref={navRef} className="relative mb-0 flex items-center border-b border-gray-200 bg-white">
      <LauncherButton className="me-1 ms-3 shadow-none" />

      <Link
        href={routes.eCommerce.salesOrders}
        className="flex shrink-0 items-center gap-2.5 border-r border-gray-200 py-2 pl-4 pr-5"
      >
        <Image src="/logo-short.svg" alt="DrinksHarbour" width={30} height={30} className="rounded-full" />
        <span className="text-sm font-semibold text-gray-900">Sales</span>
      </Link>

      <div className="flex items-center pl-2">
        {navItems.map((item) => {
          const isDropdownActive = item.items.some(
            (s) => s.href !== '#' && pathname.startsWith(s.href.split('?')[0])
          );
          const isOpen = openMenu === item.label;
          const activeCls =
            'font-semibold after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-[#b20202]';

          return (
            <div key={item.label} className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(isOpen ? null : item.label)}
                className={`relative flex items-center gap-1.5 px-4 py-3 text-sm transition-colors ${
                  isDropdownActive || isOpen
                    ? `${activeCls} text-[#b20202]`
                    : 'font-normal text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="[&>svg]:h-[18px] [&>svg]:w-[18px]">{item.icon}</span>
                {item.label}
                <PiCaretDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>

              {isOpen && (
                <NavDropdownPanel items={item.items} pathname={pathname} onNavigate={close} columns={1} />
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 6: Write `sales-quotations.tsx`**

```typescript
// client/apps/isomorphic/src/app/shared/sales/sales-quotations.tsx
'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { PiArrowClockwise, PiEye, PiPlus, PiMagnifyingGlass, PiFileText } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { salesOrderService, type SalesOrder, type QuoteStatus } from '@/services/salesOrder.service';
import { QUOTE_STATUS_BADGE, quoteStatusLabel } from './sales-helpers';
import { fmtCur } from '../purchases/purchases-analytics-helpers';

type StatusFilter = 'all' | QuoteStatus;

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'converted', label: 'Converted' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'expired', label: 'Expired' },
];

function RowSkeleton() {
  return (
    <tr className="animate-pulse border-b border-gray-100">
      <td className="px-4 py-3"><div className="h-4 w-24 rounded bg-gray-100" /></td>
      <td className="px-4 py-3"><div className="h-4 w-32 rounded bg-gray-100" /></td>
      <td className="px-4 py-3"><div className="h-5 w-16 rounded-full bg-gray-100" /></td>
      <td className="px-4 py-3"><div className="ml-auto h-4 w-16 rounded bg-gray-100" /></td>
      <td className="px-4 py-3"><div className="h-4 w-16 rounded bg-gray-100" /></td>
      <td className="px-4 py-3"><div className="ml-auto h-4 w-8 rounded bg-gray-100" /></td>
    </tr>
  );
}

export default function SalesQuotations() {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [quotations, setQuotations] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await salesOrderService.list(token, { docType: 'quotation' });
      setQuotations(res.data ?? []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load quotations');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    return quotations.filter((q) => {
      if (statusFilter !== 'all' && q.quoteStatus !== statusFilter) return false;
      if (search.trim()) {
        const needle = search.trim().toLowerCase();
        const haystack = `${q.soNumber} ${q.customerSnapshot?.name ?? ''}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [quotations, statusFilter, search]);

  const tabsWithCounts = useMemo(
    () =>
      STATUS_TABS.map((tab) => ({
        ...tab,
        count:
          tab.key === 'all'
            ? quotations.length
            : quotations.filter((q) => q.quoteStatus === tab.key).length,
      })),
    [quotations]
  );

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Quotations</h1>
          <p className="text-sm text-gray-500">Draft, send, and convert customer quotes</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => load()}
            className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
          >
            <PiArrowClockwise className="h-4 w-4" />
          </button>
          <Link
            href={routes.eCommerce.createSale}
            className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101]"
          >
            <PiPlus className="h-4 w-4" /> New Sale
          </Link>
        </div>
      </div>

      <div className="mb-4 border-b border-gray-200">
        <div className="flex overflow-x-auto">
          {tabsWithCounts.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`relative flex shrink-0 items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                statusFilter === tab.key
                  ? 'text-[#b20202] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[#b20202]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {!loading && (
                <span
                  className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-semibold ${
                    statusFilter === tab.key ? 'bg-[#b20202]/10 text-[#b20202]' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <PiMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by quote# or customer…"
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20"
          />
        </div>
        {!loading && (
          <p className="shrink-0 text-sm text-gray-400">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Quote #</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Total</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Created</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-20 text-center text-sm text-gray-400">
                  <PiFileText className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                  No quotations found
                </td>
              </tr>
            ) : (
              filtered.map((q) => (
                <tr
                  key={q._id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => router.push(routes.eCommerce.salesDetails(q._id))}
                >
                  <td className="px-4 py-3 font-mono font-medium text-gray-900">{q.soNumber}</td>
                  <td className="px-4 py-3 text-gray-700">{q.customerSnapshot?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${QUOTE_STATUS_BADGE[q.quoteStatus as QuoteStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                      {quoteStatusLabel(q.quoteStatus)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{fmtCur(q.total, q.currency)}</td>
                  <td className="px-4 py-3 text-gray-600">{q.createdAt ? new Date(q.createdAt).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={routes.eCommerce.salesDetails(q._id)}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                    >
                      <PiEye className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Write `sales-orders.tsx`**

Same structure as `sales-quotations.tsx` (Step 6), with these substitutions: component name `SalesOrders`; fetch `salesOrderService.list(token, { docType: 'order' })`; status type `OrderStatus`; tabs `[{key:'all',label:'All'},{key:'draft',label:'Draft'},{key:'confirmed',label:'Confirmed'},{key:'partially_fulfilled',label:'Partially Fulfilled'},{key:'fulfilled',label:'Fulfilled'},{key:'cancelled',label:'Cancelled'}]`; filter on `o.orderStatus`; badge map `ORDER_STATUS_BADGE` / `orderStatusLabel`; header copy `"Orders"` / `"Confirmed orders through fulfillment"`; empty-state icon `PiShoppingCartDuotone`; search placeholder `"Search by order# or customer…"`. Write the full file analogous to Step 6 with these substitutions applied throughout (component name, imports `OrderStatus`/`ORDER_STATUS_BADGE`/`orderStatusLabel`, tab list, and the two label/copy strings) — do not leave any `QuoteStatus`/quote-labeled identifier in this file.

- [ ] **Step 8: Write the three route shells**

```typescript
// client/apps/isomorphic/src/app/(hydrogen)/sales/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { routes } from '@/config/routes';

export default function SalesPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(routes.eCommerce.salesOrders);
  }, [router]);
  return null;
}
```

```typescript
// client/apps/isomorphic/src/app/(hydrogen)/sales/quotations/page.tsx
'use client';

import { Suspense } from 'react';
import SalesNavHeader from '@/app/shared/sales/sales-nav-header';
import SalesQuotations from '@/app/shared/sales/sales-quotations';

export default function SalesQuotationsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SalesNavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Suspense>
          <SalesQuotations />
        </Suspense>
      </main>
    </div>
  );
}
```

```typescript
// client/apps/isomorphic/src/app/(hydrogen)/sales/orders/page.tsx
'use client';

import { Suspense } from 'react';
import SalesNavHeader from '@/app/shared/sales/sales-nav-header';
import SalesOrders from '@/app/shared/sales/sales-orders';

export default function SalesOrdersPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SalesNavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Suspense>
          <SalesOrders />
        </Suspense>
      </main>
    </div>
  );
}
```

- [ ] **Step 9: Typecheck**

Run: `cd /Users/mac/Documents/drinksharbour/client/apps/isomorphic && ./node_modules/.bin/tsc --noEmit 2>&1 | grep -v "TS2688"`
Expected: no output.

- [ ] **Step 10: Manual browser verification**

Start the app (server + client dev servers per the project's existing `npm run dev` scripts — `server/` and `client/apps/isomorphic/`), log in as a seeded tenant owner (see `server/scripts/seed.js` for credentials), and in the browser:
1. Confirm a new "Sales" section appears in the left sidebar with "Quotations & Orders" (expand to see Quotations / Orders / New Sale), "Fulfillment", and "Sales Returns".
2. Click "Orders" — confirm it lands on `/sales/orders`, shows the nav header tabs, and renders an empty-state table (no sales orders exist yet).
3. Click the "Quotations" tab in the nav header — confirm it navigates to `/sales/quotations` and the active-tab underline moves.
4. Confirm "New Sale" and "Awaiting Fulfillment" / "All Returns" links are visible (they'll 404 until Tasks 3/6/7 land — that's expected at this point).

- [ ] **Step 11: Commit**

```bash
cd /Users/mac/Documents/drinksharbour
git add client/apps/isomorphic/src/config/routes.ts \
        client/apps/isomorphic/src/layouts/hydrogen/tenant-menu-items.tsx \
        client/apps/isomorphic/src/app/shared/sales/sales-helpers.ts \
        client/apps/isomorphic/src/app/shared/sales/sales-nav-header.tsx \
        client/apps/isomorphic/src/app/shared/sales/sales-quotations.tsx \
        client/apps/isomorphic/src/app/shared/sales/sales-orders.tsx \
        client/apps/isomorphic/src/app/\(hydrogen\)/sales/page.tsx \
        client/apps/isomorphic/src/app/\(hydrogen\)/sales/quotations/page.tsx \
        client/apps/isomorphic/src/app/\(hydrogen\)/sales/orders/page.tsx
git commit -m "feat(sales): routing skeleton, sidebar nav, quotations/orders lists"
```

---

### Task 3: Customer search + pricelist auto-apply + Create page

**Files:**
- Create: `client/apps/isomorphic/src/app/shared/sales/customer-search.tsx`
- Create: `client/apps/isomorphic/src/app/shared/sales/use-sales-customer-pricelist.ts`
- Create: `client/apps/isomorphic/src/app/shared/sales/product-line-search.tsx`
- Create: `client/apps/isomorphic/src/app/shared/sales/sales-create.tsx`
- Create: `client/apps/isomorphic/src/app/(hydrogen)/sales/create/page.tsx`

**Interfaces:**
- Consumes: `salesOrderService.create` (Task 1); `routes.eCommerce.*` (Task 2); `posApi.searchCustomers`/`posApi.getPricelists` (existing, `@/app/shared/point-of-sale/api`); `computeItemPriceWithPricelist` + `POSCartItem` (existing, `@/app/shared/point-of-sale/store` / `@/app/shared/point-of-sale/types`); `POSCustomer` type (existing, `@/app/shared/point-of-sale/types`); `subproductService.getSubProducts` (existing, `@/services/subproduct.service`).
- Produces: `CustomerSearch` component (`{ token, selected: POSCustomer|null, onSelect, onClear }`); `useSalesCustomerPricelist(token, customerId)` hook returning `{ pricelists, resolvedId, selected, loading }`; `ProductLineSearch` component (`{ token, query, onSelect(info) }` where `info: { name, sku, subProductId, productId?, sellingPrice, costPrice, sizeId?, sizeName? }`).

- [ ] **Step 1: Write `customer-search.tsx`**

Modeled directly on `VendorSearch` in `shared/purchases/purchases-create.tsx:116-302`, swapping the vendor API for `posApi.searchCustomers` and vendor fields for `POSCustomer` fields.

```typescript
// client/apps/isomorphic/src/app/shared/sales/customer-search.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { PiMagnifyingGlass, PiX, PiUser, PiPlus } from 'react-icons/pi';
import { posApi } from '@/app/shared/point-of-sale/api';
import type { POSCustomer } from '@/app/shared/point-of-sale/types';
import { routes } from '@/config/routes';

const INPUT_CLS =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20';

function customerName(c: POSCustomer) {
  return `${c.firstName} ${c.lastName}`.trim();
}

function initials(c: POSCustomer) {
  return `${c.firstName?.[0] ?? ''}${c.lastName?.[0] ?? ''}`.toUpperCase();
}

export default function CustomerSearch({
  token,
  selected,
  onSelect,
  onClear,
}: {
  token: string;
  selected: POSCustomer | null;
  onSelect: (c: POSCustomer) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState('');
  const [initial, setInitial] = useState<POSCustomer[]>([]);
  const [results, setResults] = useState<POSCustomer[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function ensureInitial() {
    if (initialLoaded || !token) return;
    setLoading(true);
    try {
      const res = await posApi.searchCustomers(token, '', 8);
      setInitial(res.customers ?? []);
      setResults(res.customers ?? []);
      setInitialLoaded(true);
    } catch {
      setInitial([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    if (query.trim().length < 2) {
      setResults(initial);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await posApi.searchCustomers(token, query.trim(), 8);
        setResults(res.customers ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, token, initial]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (selected) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#b20202]/10 text-sm font-bold text-[#b20202]">
          {initials(selected)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">{customerName(selected)}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
            {selected.email && <span className="text-xs text-gray-500">{selected.email}</span>}
            {selected.phone && <span className="text-xs text-gray-500">{selected.phone}</span>}
            {selected.pricelistName && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                {selected.pricelistName}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
          title="Change customer"
        >
          <PiX className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <PiMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(false);
          }}
          onFocus={() => {
            ensureInitial();
            setOpen(true);
          }}
          placeholder="Search customers… (optional)"
          className={`pl-9 pr-9 ${INPUT_CLS}`}
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">…</span>
        )}
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          {results.length === 0 && !loading ? (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-400">
              <PiUser className="h-4 w-4" />
              {query.trim().length >= 2 ? `No customers match "${query}"` : 'No customers yet'}
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto">
              {results.map((c) => (
                <button
                  key={c._id}
                  type="button"
                  onMouseDown={() => {
                    onSelect(c);
                    setQuery('');
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#b20202]/10 text-xs font-bold text-[#b20202]">
                    {initials(c)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{customerName(c)}</p>
                    <div className="flex items-center gap-2">
                      {c.email && <span className="truncate text-xs text-gray-400">{c.email}</span>}
                      {c.pricelistName && (
                        <span className="shrink-0 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
                          {c.pricelistName}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          <div className="border-t border-gray-100">
            <a
              href={routes.contacts.list}
              target="_blank"
              rel="noreferrer"
              onMouseDown={(e) => e.stopPropagation()}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-[#b20202] hover:bg-gray-50"
            >
              <PiPlus className="h-4 w-4" />
              Add new customer
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write `use-sales-customer-pricelist.ts`**

```typescript
// client/apps/isomorphic/src/app/shared/sales/use-sales-customer-pricelist.ts
'use client';

import { useEffect, useState } from 'react';
import { posApi } from '@/app/shared/point-of-sale/api';

export interface SalesPricelistState {
  pricelists: any[];
  resolvedId: string | null;
  selected: any | null;
  loading: boolean;
}

/**
 * Resolves the pricelist a customer auto-qualifies for, with NO shop/cart
 * dependency (unlike usePOSCustomerPricelistSync, which is wired to POS's
 * jotai cart atoms). Re-fetches whenever the customer changes.
 */
export function useSalesCustomerPricelist(token: string, customerId: string): SalesPricelistState {
  const [state, setState] = useState<SalesPricelistState>({
    pricelists: [],
    resolvedId: null,
    selected: null,
    loading: false,
  });

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setState((s) => ({ ...s, loading: true }));
      try {
        const res = await posApi.getPricelists(token, undefined, customerId || undefined);
        if (cancelled) return;
        const pricelists = res.pricelists || [];
        const resolvedId = res.resolvedId ?? null;
        const selected = resolvedId ? pricelists.find((p: any) => p._id === resolvedId) ?? null : null;
        setState({ pricelists, resolvedId, selected, loading: false });
      } catch {
        if (!cancelled) setState({ pricelists: [], resolvedId: null, selected: null, loading: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, customerId]);

  return state;
}
```

- [ ] **Step 3: Write `product-line-search.tsx`**

Modeled on `ProductSearch` in `shared/purchases/purchases-create.tsx:306-607`, but reading the SubProduct/Size **selling**-price fields (`baseSellingPrice` / `Size.sellingPrice`) instead of the cost-price fields the purchases module reads, and returning an object instead of positional args.

```typescript
// client/apps/isomorphic/src/app/shared/sales/product-line-search.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { PiMagnifyingGlass, PiCaretRight, PiPlus } from 'react-icons/pi';
import { subproductService } from '@/services/subproduct.service';
import { routes } from '@/config/routes';

export interface ProductLineSelection {
  name: string;
  sku: string;
  subProductId: string;
  productId?: string;
  sellingPrice: number;
  costPrice: number;
  sizeId?: string;
  sizeName?: string;
}

interface SizeOption {
  size: string;
  displayName?: string;
  sku?: string;
  sellingPrice: number;
  costPrice: number;
  availableStock?: number;
}

interface ProductOption {
  _id: string;
  productId?: string;
  name: string;
  sku: string;
  sellingPrice: number;
  costPrice: number;
  sellWithoutSizeVariants: boolean;
  sizes: SizeOption[];
}

function mapProducts(raw: any[]): ProductOption[] {
  return raw.map((sp: any) => ({
    _id: sp._id,
    productId: sp.product?._id ?? sp.product,
    name: sp.product?.name ?? sp.name ?? '',
    sku: sp.sku ?? '',
    sellingPrice: sp.baseSellingPrice ?? 0,
    costPrice: sp.costPrice ?? 0,
    sellWithoutSizeVariants: sp.sellWithoutSizeVariants ?? false,
    sizes: (sp.sizes ?? []).map((s: any) => ({
      size: String(s._id ?? s.size ?? ''),
      displayName: s.displayName ?? s.size ?? '',
      sku: s.sku ?? sp.sku ?? '',
      sellingPrice: s.sellingPrice ?? 0,
      costPrice: s.costPrice ?? sp.costPrice ?? 0,
      availableStock: s.availableStock ?? s.stock ?? 0,
    })),
  }));
}

export default function ProductLineSearch({
  token,
  query,
  onSelect,
}: {
  token: string;
  query: string;
  onSelect: (info: ProductLineSelection) => void;
}) {
  const [text, setText] = useState(query);
  const [initial, setInitial] = useState<ProductOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setText(query);
  }, [query]);

  async function ensureInitial() {
    if (initialLoaded || !token) return;
    setLoading(true);
    try {
      const res = await subproductService.getSubProducts(token, { limit: 50 });
      const list = mapProducts(res?.data?.subProducts ?? []);
      setInitial(list);
      setProducts(list);
      setInitialLoaded(true);
    } catch {
      setInitial([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    if (text.trim().length < 2) {
      setProducts(initial);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await subproductService.getSubProducts(token, { search: text.trim(), limit: 50 });
        setProducts(mapProducts(res?.data?.subProducts ?? []));
        setExpandedId(null);
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [text, token, initial]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function pickSizeless(p: ProductOption) {
    onSelect({
      name: p.name,
      sku: p.sku,
      subProductId: p._id,
      productId: p.productId,
      sellingPrice: p.sellingPrice,
      costPrice: p.costPrice,
    });
    setText(p.name);
    setOpen(false);
  }

  function pickSize(p: ProductOption, s: SizeOption) {
    const displaySize = s.displayName ?? s.size;
    onSelect({
      name: `${p.name} – ${displaySize}`,
      sku: s.sku ?? p.sku,
      subProductId: p._id,
      productId: p.productId,
      sellingPrice: s.sellingPrice,
      costPrice: s.costPrice,
      sizeId: s.size,
      sizeName: displaySize,
    });
    setText(`${p.name} – ${displaySize}`);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <PiMagnifyingGlass className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setExpandedId(null);
          }}
          onFocus={() => {
            ensureInitial();
            setOpen(true);
          }}
          placeholder="Search product…"
          className="w-full rounded-lg border border-gray-200 py-1.5 pl-8 pr-3 text-xs text-gray-900 placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-1 focus:ring-[#b20202]/20"
        />
        {loading && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-pulse text-[10px] text-gray-400">…</span>
        )}
      </div>

      {open && (
        <div className="absolute left-0 z-30 mt-1 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          {products.length === 0 && !loading ? (
            <div className="px-3 py-3 text-xs text-gray-400">
              {text.trim().length >= 2 ? `No products match "${text}"` : 'No products in your catalogue yet'}
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {products.map((p) => {
                const hasSizes = !p.sellWithoutSizeVariants && p.sizes.length > 0;
                const isExpanded = expandedId === p._id;
                return (
                  <div key={p._id}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        if (hasSizes) setExpandedId(isExpanded ? null : p._id);
                        else pickSizeless(p);
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-gray-50 ${isExpanded ? 'bg-gray-50' : ''}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-gray-900">{p.name}</p>
                        <div className="mt-0.5 flex items-center gap-2">
                          {p.sku && <span className="font-mono text-[10px] text-gray-400">{p.sku}</span>}
                          {hasSizes && (
                            <span className="text-[10px] text-gray-400">
                              {p.sizes.length} size{p.sizes.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      {hasSizes ? (
                        <PiCaretRight className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      ) : (
                        p.sellingPrice > 0 && <span className="shrink-0 text-xs font-medium text-gray-600">{p.sellingPrice.toFixed(2)}</span>
                      )}
                    </button>

                    {hasSizes && isExpanded && (
                      <div className="border-t border-gray-100 bg-gray-50/60 pb-1 pl-4 pt-1">
                        {p.sizes.map((s) => (
                          <button
                            key={s.size}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              pickSize(p, s);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-gray-800">{s.displayName ?? s.size}</p>
                              <div className="mt-0.5 flex items-center gap-2">
                                {s.sku && <span className="font-mono text-[10px] text-gray-400">{s.sku}</span>}
                                {(s.availableStock ?? 0) > 0 ? (
                                  <span className="text-[10px] text-emerald-600">{s.availableStock} in stock</span>
                                ) : (
                                  <span className="text-[10px] text-gray-400">Out of stock</span>
                                )}
                              </div>
                            </div>
                            {s.sellingPrice > 0 && (
                              <span className="shrink-0 text-xs font-semibold text-gray-700">{s.sellingPrice.toFixed(2)}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className="border-t border-gray-100">
            <a
              href={routes.eCommerce.createSubProduct}
              target="_blank"
              rel="noreferrer"
              onMouseDown={(e) => e.stopPropagation()}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-xs font-medium text-[#b20202] hover:bg-gray-50"
            >
              <PiPlus className="h-3.5 w-3.5" />
              Create new product
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write `sales-create.tsx`**

```typescript
// client/apps/isomorphic/src/app/shared/sales/sales-create.tsx
'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { PiArrowLeft, PiCheck, PiFloppyDisk, PiPlus, PiTrash } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { salesOrderService } from '@/services/salesOrder.service';
import type { POSCustomer } from '@/app/shared/point-of-sale/types';
import type { POSCartItem } from '@/app/shared/point-of-sale/types';
import { computeItemPriceWithPricelist } from '@/app/shared/point-of-sale/store';
import { fmtCur } from '../purchases/purchases-analytics-helpers';
import CustomerSearch from './customer-search';
import ProductLineSearch, { type ProductLineSelection } from './product-line-search';
import { useSalesCustomerPricelist } from './use-sales-customer-pricelist';

const INPUT_CLS =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20';

interface DraftLine {
  key: string;
  subProductId: string;
  product?: string;
  name: string;
  sku: string;
  sizeId?: string;
  sizeName?: string;
  quantity: number;
  baseUnitPrice: number;
  discount: number;
  costPrice: number;
}

function blankLine(): DraftLine {
  return {
    key: Math.random().toString(36).slice(2),
    subProductId: '',
    name: '',
    sku: '',
    quantity: 1,
    baseUnitPrice: 0,
    discount: 0,
    costPrice: 0,
  };
}

/** Live unit price after pricelist rules, via the shared pure pricing function. */
function liveUnitPrice(line: DraftLine, pricelist: any): number {
  if (!line.subProductId || !pricelist) return line.baseUnitPrice;
  const pricingItem: POSCartItem = {
    subProductId: line.subProductId,
    productId: line.product ?? line.subProductId,
    sizeId: line.sizeId,
    name: line.name,
    variant: line.sizeName ?? '',
    sku: line.sku,
    price: line.baseUnitPrice,
    quantity: line.quantity,
    discount: 0,
    stock: 0,
    costPrice: line.costPrice,
  };
  return computeItemPriceWithPricelist(pricingItem, pricelist);
}

function lineTotalOf(unitPrice: number, discount: number, quantity: number) {
  return Math.max(0, unitPrice - discount) * quantity;
}

export default function SalesCreate() {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [customer, setCustomer] = useState<POSCustomer | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([blankLine()]);
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [saving, setSaving] = useState(false);

  const { selected: pricelist, resolvedId } = useSalesCustomerPricelist(token, customer?._id ?? '');

  const updateLine = useCallback((key: string, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }, []);

  const addLine = useCallback(() => setLines((p) => [...p, blankLine()]), []);
  const removeLine = useCallback((key: string) => setLines((p) => p.filter((l) => l.key !== key)), []);

  const priced = useMemo(
    () =>
      lines.map((l) => {
        const unitPrice = liveUnitPrice(l, pricelist);
        return { ...l, unitPrice, lineTotal: lineTotalOf(unitPrice, l.discount, l.quantity) };
      }),
    [lines, pricelist]
  );

  const grandTotal = priced.reduce((s, l) => s + l.lineTotal, 0);
  const hasLines = lines.some((l) => l.subProductId);

  async function handleSave(asOrder: boolean) {
    const filled = priced.filter((l) => l.subProductId);
    if (filled.length === 0) {
      toast.error('Add at least one product line');
      return;
    }
    const badQty = filled.find((l) => !(l.quantity > 0));
    if (badQty) {
      toast.error(`Quantity for "${badQty.name}" must be at least 1`);
      return;
    }
    setSaving(true);
    try {
      const res = await salesOrderService.create(
        {
          docType: asOrder ? 'order' : 'quotation',
          customer: customer?._id,
          customerSnapshot: customer
            ? { name: `${customer.firstName} ${customer.lastName}`.trim(), phone: customer.phone, email: customer.email, customerId: customer._id }
            : undefined,
          pricelist: resolvedId ?? undefined,
          appliedPricelist: pricelist ? { pricelistId: pricelist._id, pricelistName: pricelist.name } : undefined,
          items: filled.map((l) => ({
            product: l.product,
            subproduct: l.subProductId,
            size: l.sizeId,
            sku: l.sku,
            name: l.name,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discount: l.discount,
          })),
          validUntil: validUntil || undefined,
          notes: notes || undefined,
          terms: terms || undefined,
        },
        token
      );
      toast.success(asOrder ? 'Order created' : 'Quotation saved');
      router.push(routes.eCommerce.salesDetails(res.data._id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pb-24">
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
        <Link href={routes.eCommerce.salesOrders} className="flex items-center gap-1 hover:text-gray-700">
          <PiArrowLeft className="h-4 w-4" /> Sales
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">New Sale</span>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">New Sale</h1>
          <p className="mt-0.5 text-sm text-gray-500">Save as a quotation or create the order directly.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={saving || !hasLines}
            className="flex items-center gap-2 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
          >
            <PiCheck className="h-4 w-4" />
            {saving ? 'Saving…' : 'Create Order'}
          </button>
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={saving || !hasLines}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <PiFloppyDisk className="h-4 w-4" />
            Save as Quotation
          </button>
          <Link href={routes.eCommerce.salesOrders} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </Link>
        </div>
      </div>

      <div className="space-y-5">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-800">Customer</h2>
          <CustomerSearch token={token} selected={customer} onSelect={setCustomer} onClear={() => setCustomer(null)} />
          {pricelist && (
            <p className="mt-2 text-xs text-emerald-600">
              Pricelist &quot;{pricelist.name}&quot; auto-applied from this customer.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-800">Validity &amp; Notes</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">Valid Until (quotations)</label>
              <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={INPUT_CLS} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-gray-600">Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={INPUT_CLS} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-gray-600">Terms</label>
              <textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={2} className={INPUT_CLS} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">Line Items</h2>
            <button type="button" onClick={addLine} className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
              <PiPlus className="h-3.5 w-3.5" /> Add Line
            </button>
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Product</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Qty</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Unit Price</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Discount</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Line Total</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {priced.map((line) => (
                  <tr key={line.key}>
                    <td className="px-3 py-2">
                      <ProductLineSearch
                        token={token}
                        query={line.name}
                        onSelect={(info: ProductLineSelection) =>
                          updateLine(line.key, {
                            subProductId: info.subProductId,
                            product: info.productId,
                            name: info.name,
                            sku: info.sku,
                            sizeId: info.sizeId,
                            sizeName: info.sizeName,
                            baseUnitPrice: info.sellingPrice,
                            costPrice: info.costPrice,
                          })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) => updateLine(line.key, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                        className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-right text-sm"
                      />
                    </td>
                    <td className="px-3 py-2 text-right text-sm font-medium text-gray-900">{fmtCur(line.unitPrice, 'NGN')}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        value={line.discount}
                        onChange={(e) => updateLine(line.key, { discount: Math.max(0, Number(e.target.value) || 0) })}
                        className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-right text-sm"
                      />
                    </td>
                    <td className="px-3 py-2 text-right text-sm font-semibold text-gray-900">{fmtCur(line.lineTotal, 'NGN')}</td>
                    <td className="px-3 py-2 text-right">
                      <button type="button" onClick={() => removeLine(line.key)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600">
                        <PiTrash className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-end">
            <div className="w-full max-w-xs text-sm">
              <div className="flex items-center justify-between border-t border-gray-100 pt-3 text-base font-semibold text-gray-900">
                <span>Total</span>
                <span>{fmtCur(grandTotal, 'NGN')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Write the route shell**

```typescript
// client/apps/isomorphic/src/app/(hydrogen)/sales/create/page.tsx
'use client';

import SalesNavHeader from '@/app/shared/sales/sales-nav-header';
import SalesCreate from '@/app/shared/sales/sales-create';

export default function SalesCreatePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SalesNavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <SalesCreate />
      </main>
    </div>
  );
}
```

- [ ] **Step 6: Typecheck**

Run: `cd /Users/mac/Documents/drinksharbour/client/apps/isomorphic && ./node_modules/.bin/tsc --noEmit 2>&1 | grep -v "TS2688"`
Expected: no output. If `POSCartItem`'s required-field list has changed since this plan was written, this is where a mismatch would surface — adjust `liveUnitPrice`'s `pricingItem` literal to satisfy whatever fields are currently required, without changing `computeItemPriceWithPricelist` itself.

- [ ] **Step 7: Manual browser verification**

In the browser: go to Sales → New Sale. Search and pick a customer that has an assigned pricelist (check `POSCustomer.pricelist` in an existing tenant, or assign one via the Pricelists/Customers admin UI first if none exists), confirm the green "Pricelist auto-applied" note appears and that adding a product line shows a unit price reflecting the pricelist's rule (compare against the product's plain `baseSellingPrice`/`Size.sellingPrice` to confirm the discount actually applied). Add 2+ lines, adjust qty/discount, confirm the line total and grand total recompute live. Click "Save as Quotation" — confirm redirect to `/sales/<id>` (detail page doesn't exist until Task 4, so a 404 here is expected for now, but the create POST itself must succeed — verify via the toast and by reloading `/sales/quotations` afterwards to see the new row, OR by calling `GET /api/sales-orders/<id>` directly with curl/Postman using the session token).

- [ ] **Step 8: Commit**

```bash
cd /Users/mac/Documents/drinksharbour
git add client/apps/isomorphic/src/app/shared/sales/customer-search.tsx \
        client/apps/isomorphic/src/app/shared/sales/use-sales-customer-pricelist.ts \
        client/apps/isomorphic/src/app/shared/sales/product-line-search.tsx \
        client/apps/isomorphic/src/app/shared/sales/sales-create.tsx \
        client/apps/isomorphic/src/app/\(hydrogen\)/sales/create/page.tsx
git commit -m "feat(sales): create page with customer search + pricelist auto-apply"
```

---

### Task 4: Detail router + Quotation detail + status actions

**Files:**
- Create: `client/apps/isomorphic/src/app/shared/sales/sales-detail.tsx`
- Create: `client/apps/isomorphic/src/app/shared/sales/sales-quotation-detail.tsx`
- Create: `client/apps/isomorphic/src/app/(hydrogen)/sales/[id]/page.tsx`

**Interfaces:**
- Consumes: `salesOrderService.get/send/accept/reject/convert` (Task 1); `outstanding`/`quoteStatusLabel`/`QUOTE_STATUS_BADGE` (Task 2).
- Produces: `SalesDetail({ id })` — fetches the doc once, shows a loading skeleton, and renders `SalesQuotationDetail` or (once Task 5 lands) `SalesOrderDetail` based on `docType`. `SalesQuotationDetail({ so, onChanged })` where `onChanged()` triggers `SalesDetail` to re-fetch.

- [ ] **Step 1: Write `sales-detail.tsx`**

This file references `SalesOrderDetail` from `./sales-order-detail`, which does not exist until Task 5. To keep this task's typecheck clean on its own, write a temporary inline placeholder for the order branch now; Task 5's Step 1 replaces it with the real import (this is the one deliberate exception to "no placeholders" in this plan — it's a one-task-wide stepping stone between two tasks that both touch the same router file, not a vague/incomplete deliverable).

```typescript
// client/apps/isomorphic/src/app/shared/sales/sales-detail.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { salesOrderService, type SalesOrder } from '@/services/salesOrder.service';
import SalesQuotationDetail from './sales-quotation-detail';

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-64 animate-pulse rounded bg-gray-100" />
      <div className="h-48 animate-pulse rounded-xl border border-gray-200 bg-white" />
    </div>
  );
}

export default function SalesDetail({ id }: { id: string }) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [so, setSo] = useState<SalesOrder | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await salesOrderService.get(id, token);
      setSo(res.data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <DetailSkeleton />;
  if (!so) return <div className="py-20 text-center text-sm text-gray-500">Not found</div>;

  if (so.docType === 'quotation') {
    return <SalesQuotationDetail so={so} onChanged={load} />;
  }
  // docType === 'order' — replaced with the real SalesOrderDetail import in Task 5.
  return <div className="py-20 text-center text-sm text-gray-500">Order detail view not yet available</div>;
}
```

- [ ] **Step 2: Write `sales-quotation-detail.tsx`**

```typescript
// client/apps/isomorphic/src/app/shared/sales/sales-quotation-detail.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { PiArrowLeft, PiPaperPlaneTilt, PiCheck, PiX, PiArrowsClockwise } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { salesOrderService, type SalesOrder } from '@/services/salesOrder.service';
import { QUOTE_STATUS_BADGE, quoteStatusLabel } from './sales-helpers';
import { fmtCur } from '../purchases/purchases-analytics-helpers';

export default function SalesQuotationDetail({
  so,
  onChanged,
}: {
  so: SalesOrder;
  onChanged: () => void;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<{ data: SalesOrder }>, successMsg: string, redirectToResult = false) {
    setBusy(true);
    try {
      const res = await action();
      toast.success(successMsg);
      if (redirectToResult) router.push(routes.eCommerce.salesDetails(res.data._id));
      else onChanged();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  const status = so.quoteStatus ?? 'draft';

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
        <Link href={routes.eCommerce.salesQuotations} className="flex items-center gap-1 hover:text-gray-700">
          <PiArrowLeft className="h-4 w-4" /> Quotations
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">{so.soNumber}</span>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-900">{so.soNumber}</h1>
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${QUOTE_STATUS_BADGE[status]}`}>
            {quoteStatusLabel(status)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {status === 'draft' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => salesOrderService.send(so._id, token), 'Quotation sent')}
              className="flex items-center gap-2 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
            >
              <PiPaperPlaneTilt className="h-4 w-4" /> Send
            </button>
          )}
          {status === 'sent' && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => salesOrderService.accept(so._id, token), 'Quotation accepted')}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <PiCheck className="h-4 w-4" /> Accept
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => salesOrderService.reject(so._id, token), 'Quotation rejected')}
                className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <PiX className="h-4 w-4" /> Reject
              </button>
            </>
          )}
          {status === 'accepted' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => salesOrderService.convert(so._id, token), 'Converted to order', true)}
              className="flex items-center gap-2 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
            >
              <PiArrowsClockwise className="h-4 w-4" /> Convert to Order
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Product</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Qty</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Unit Price</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Discount</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {so.items.map((item) => (
                  <tr key={item._id}>
                    <td className="px-4 py-3 text-gray-900">
                      {item.name}
                      {item.sku && <span className="ml-2 font-mono text-xs text-gray-400">{item.sku}</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{item.quantity}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmtCur(item.unitPrice, so.currency)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmtCur(item.discount, so.currency)}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{fmtCur(item.lineTotal, so.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(so.notes || so.terms) && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 text-sm">
              {so.notes && (
                <div className="mb-3">
                  <p className="mb-1 text-xs font-semibold text-gray-500">Notes</p>
                  <p className="text-gray-700">{so.notes}</p>
                </div>
              )}
              {so.terms && (
                <div>
                  <p className="mb-1 text-xs font-semibold text-gray-500">Terms</p>
                  <p className="text-gray-700">{so.terms}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="rounded-xl border border-gray-200 bg-white p-5 text-sm">
            <p className="mb-1 text-xs font-semibold text-gray-500">Customer</p>
            <p className="mb-3 text-gray-900">{so.customerSnapshot?.name ?? 'Walk-in / none'}</p>
            {so.validUntil && (
              <>
                <p className="mb-1 text-xs font-semibold text-gray-500">Valid Until</p>
                <p className="mb-3 text-gray-900">{new Date(so.validUntil).toLocaleDateString()}</p>
              </>
            )}
            <div className="flex items-center justify-between border-t border-gray-100 pt-3 text-base font-semibold text-gray-900">
              <span>Total</span>
              <span>{fmtCur(so.total, so.currency)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write the route shell**

```typescript
// client/apps/isomorphic/src/app/(hydrogen)/sales/[id]/page.tsx
'use client';

import { use } from 'react';
import SalesNavHeader from '@/app/shared/sales/sales-nav-header';
import SalesDetail from '@/app/shared/sales/sales-detail';

export default function SalesDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <div className="min-h-screen bg-gray-50">
      <SalesNavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <SalesDetail id={id} />
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `cd /Users/mac/Documents/drinksharbour/client/apps/isomorphic && ./node_modules/.bin/tsc --noEmit 2>&1 | grep -v "TS2688"`
Expected: no output.

- [ ] **Step 5: Manual browser verification**

Open the quotation created in Task 3's verification (via `/sales/quotations` → click its row, or navigate directly to `/sales/<id>`). Confirm the line items table, customer, and total render correctly. Click "Send" — confirm status badge flips to "Sent" and the button row now shows Accept/Reject. Click "Accept" — confirm status flips to "Accepted" and a "Convert to Order" button appears. Click "Convert to Order" — confirm it redirects to the new order's `/sales/<newId>` (which currently shows the Task 4 placeholder "Order detail view not yet available" — expected until Task 5).

- [ ] **Step 6: Commit**

```bash
cd /Users/mac/Documents/drinksharbour
git add client/apps/isomorphic/src/app/shared/sales/sales-detail.tsx \
        client/apps/isomorphic/src/app/shared/sales/sales-quotation-detail.tsx \
        client/apps/isomorphic/src/app/\(hydrogen\)/sales/\[id\]/page.tsx
git commit -m "feat(sales): quotation detail page with send/accept/reject/convert"
```

---

### Task 5: Order detail — Confirm, Fulfill/Return links, Invoice render

**Files:**
- Create: `client/apps/isomorphic/src/app/shared/sales/sales-order-detail.tsx`
- Create: `client/apps/isomorphic/src/app/shared/sales/sales-invoice-view.tsx`
- Modify: `client/apps/isomorphic/src/app/shared/sales/sales-detail.tsx` (replace the Task 4 placeholder with the real import)

**Interfaces:**
- Consumes: `salesOrderService.confirm` (Task 1); `outstanding`/`ORDER_STATUS_BADGE`/`orderStatusLabel` (Task 2); `routes.eCommerce.salesFulfillDetails`/`createSalesReturn` (Task 2, consumed once Tasks 6/7 build their targets).
- Produces: `SalesOrderDetail({ so, onChanged })`; `SalesInvoiceView({ so })` — a self-contained printable view, no props beyond the order itself.

**Note on "Invoice" reuse:** `shared/invoice/invoice-details.tsx` (referenced by the original spec as something to reuse) turned out, on inspection, to be a `@ts-nocheck` demo component in this admin template with 100%-hardcoded dummy data and no props — it isn't actually parameterizable. `SalesInvoiceView` below is a new component **modeled on its visual layout** (rizzui `Title`/`Text`/`Badge`, From/Bill-To/items/totals structure) but driven entirely by real `SalesOrder` data, per the approved design's "render-on-the-fly" decision.

- [ ] **Step 1: Write `sales-invoice-view.tsx`**

```typescript
// client/apps/isomorphic/src/app/shared/sales/sales-invoice-view.tsx
'use client';

import { Badge, Title, Text } from 'rizzui';
import { PiPrinter } from 'react-icons/pi';
import type { SalesOrder } from '@/services/salesOrder.service';
import { fmtCur } from '../purchases/purchases-analytics-helpers';

export default function SalesInvoiceView({ so }: { so: SalesOrder }) {
  const paid = so.paymentStatus === 'paid';

  return (
    <div className="w-full rounded-xl border border-gray-200 bg-white p-5 text-sm sm:p-6">
      <div className="mb-4 flex items-center justify-end print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <PiPrinter className="h-4 w-4" /> Print
        </button>
      </div>

      <div className="mb-10 flex flex-col-reverse items-start justify-between md:flex-row">
        <Title as="h4">Sales Invoice</Title>
        <div className="mb-4 md:mb-0">
          <Badge variant="flat" color={paid ? 'success' : 'warning'} rounded="md" className="mb-2">
            {paid ? 'Paid' : 'Unpaid'}
          </Badge>
          <Title as="h6">{so.soNumber}</Title>
          <Text className="mt-0.5 text-gray-500">Order Number</Text>
        </div>
      </div>

      <div className="mb-10 grid gap-4 sm:grid-cols-2">
        <div>
          <Title as="h6" className="mb-2 font-semibold">Bill To</Title>
          <Text className="mb-1 font-semibold uppercase">{so.customerSnapshot?.name ?? 'Walk-in'}</Text>
          {so.customerSnapshot?.phone && <Text className="mb-1">{so.customerSnapshot.phone}</Text>}
          {so.customerSnapshot?.email && <Text>{so.customerSnapshot.email}</Text>}
        </div>
        <div className="sm:text-right">
          <Title as="h6" className="mb-2 font-semibold">Order Date</Title>
          <Text>{so.createdAt ? new Date(so.createdAt).toLocaleDateString() : '—'}</Text>
          {so.paymentMethod && (
            <>
              <Title as="h6" className="mb-1 mt-3 font-semibold">Payment Method</Title>
              <Text className="capitalize">{so.paymentMethod.replace('_', ' ')}</Text>
            </>
          )}
        </div>
      </div>

      <div className="mb-8 overflow-hidden rounded-lg border border-gray-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Item</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Qty</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Unit Price</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {so.items.map((item) => (
              <tr key={item._id}>
                <td className="px-3 py-2 text-gray-900">{item.name}</td>
                <td className="px-3 py-2 text-right text-gray-700">{item.quantity}</td>
                <td className="px-3 py-2 text-right text-gray-700">{fmtCur(item.unitPrice, so.currency)}</td>
                <td className="px-3 py-2 text-right font-medium text-gray-900">{fmtCur(item.lineTotal, so.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <div className="w-full max-w-sm">
          <Text className="flex items-center justify-between border-b border-gray-100 py-2">
            Subtotal: <Text as="span" className="font-semibold">{fmtCur(so.subtotal, so.currency)}</Text>
          </Text>
          <Text className="flex items-center justify-between border-b border-gray-100 py-2">
            Discount: <Text as="span" className="font-semibold">{fmtCur(so.discountTotal, so.currency)}</Text>
          </Text>
          <Text className="flex items-center justify-between pt-3 text-base font-semibold text-gray-900">
            Total: <span>{fmtCur(so.total, so.currency)}</span>
          </Text>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `sales-order-detail.tsx`**

```typescript
// client/apps/isomorphic/src/app/shared/sales/sales-order-detail.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { PiArrowLeft, PiCreditCard, PiTrayArrowDown, PiArrowUUpLeft, PiReceipt, PiX } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { salesOrderService, type SalesOrder } from '@/services/salesOrder.service';
import { ORDER_STATUS_BADGE, orderStatusLabel, outstanding } from './sales-helpers';
import { fmtCur } from '../purchases/purchases-analytics-helpers';
import SalesInvoiceView from './sales-invoice-view';

const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'pos_terminal', label: 'POS Terminal' },
  { value: 'wallet', label: 'Customer Wallet' },
  { value: 'invoice', label: 'Invoice (bill later)' },
  { value: 'other', label: 'Other' },
];

function ConfirmPaymentModal({
  open,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: (paymentMethod: string, amountTendered?: number) => void;
}) {
  const [method, setMethod] = useState('cash');
  const [tendered, setTendered] = useState('');

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <p className="font-semibold text-gray-900">Confirm &amp; Capture Payment</p>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <PiX className="h-4 w-4" />
          </button>
        </div>
        <label className="mb-1.5 block text-xs font-medium text-gray-600">Payment Method</label>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="mb-4 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none"
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        {method === 'cash' && (
          <>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">Amount Tendered (optional)</label>
            <input
              type="number"
              min={0}
              value={tendered}
              onChange={(e) => setTendered(e.target.value)}
              className="mb-4 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none"
            />
          </>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onConfirm(method, tendered ? Number(tendered) : undefined)}
            className="rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
          >
            {busy ? 'Confirming…' : 'Confirm Order'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SalesOrderDetail({
  so,
  onChanged,
}: {
  so: SalesOrder;
  onChanged: () => void;
}) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [busy, setBusy] = useState(false);

  const status = so.orderStatus ?? 'draft';
  const canConfirm = status === 'draft';
  const canFulfill = status === 'confirmed' || status === 'partially_fulfilled';
  const canReturn = status === 'partially_fulfilled' || status === 'fulfilled';
  const canInvoice = status !== 'draft' && status !== 'cancelled';

  async function handleConfirm(paymentMethod: string, amountTendered?: number) {
    setBusy(true);
    try {
      await salesOrderService.confirm(so._id, { paymentMethod, amountTendered }, token);
      toast.success('Order confirmed and payment captured');
      setConfirmOpen(false);
      onChanged();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to confirm order');
    } finally {
      setBusy(false);
    }
  }

  if (showInvoice) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setShowInvoice(false)}
          className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 print:hidden"
        >
          <PiArrowLeft className="h-4 w-4" /> Back to order
        </button>
        <SalesInvoiceView so={so} />
      </div>
    );
  }

  return (
    <div>
      <ConfirmPaymentModal open={confirmOpen} busy={busy} onClose={() => setConfirmOpen(false)} onConfirm={handleConfirm} />

      <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
        <Link href={routes.eCommerce.salesOrders} className="flex items-center gap-1 hover:text-gray-700">
          <PiArrowLeft className="h-4 w-4" /> Orders
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">{so.soNumber}</span>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-900">{so.soNumber}</h1>
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${ORDER_STATUS_BADGE[status]}`}>
            {orderStatusLabel(status)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {canConfirm && (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101]"
            >
              <PiCreditCard className="h-4 w-4" /> Confirm Order
            </button>
          )}
          {canFulfill && (
            <Link
              href={routes.eCommerce.salesFulfillDetails(so._id)}
              className="flex items-center gap-2 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101]"
            >
              <PiTrayArrowDown className="h-4 w-4" /> Fulfill
            </Link>
          )}
          {canReturn && (
            <Link
              href={`${routes.eCommerce.createSalesReturn}?orderId=${so._id}`}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <PiArrowUUpLeft className="h-4 w-4" /> Return
            </Link>
          )}
          {canInvoice && (
            <button
              type="button"
              onClick={() => setShowInvoice(true)}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <PiReceipt className="h-4 w-4" /> Invoice
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Product</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Ordered</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Outstanding</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Unit Price</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {so.items.map((item) => {
                  const out = outstanding(item);
                  return (
                    <tr key={item._id}>
                      <td className="px-4 py-3 text-gray-900">
                        {item.name}
                        {item.sku && <span className="ml-2 font-mono text-xs text-gray-400">{item.sku}</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">{item.quantity}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={out > 0 ? 'font-medium text-amber-600' : 'text-emerald-600'}>{out}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">{fmtCur(item.unitPrice, so.currency)}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{fmtCur(item.lineTotal, so.currency)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-xl border border-gray-200 bg-white p-5 text-sm">
            <p className="mb-1 text-xs font-semibold text-gray-500">Customer</p>
            <p className="mb-3 text-gray-900">{so.customerSnapshot?.name ?? 'Walk-in / none'}</p>
            <p className="mb-1 text-xs font-semibold text-gray-500">Payment</p>
            <p className="mb-3 text-gray-900">
              {so.paymentStatus === 'paid' ? `Paid via ${so.paymentMethod ?? '—'}` : 'Unpaid'}
            </p>
            <div className="flex items-center justify-between border-t border-gray-100 pt-3 text-base font-semibold text-gray-900">
              <span>Total</span>
              <span>{fmtCur(so.total, so.currency)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update `sales-detail.tsx` to use the real order detail component**

```typescript
import SalesOrderDetail from './sales-order-detail';
```
old_string in `sales-detail.tsx`:
```typescript
import SalesQuotationDetail from './sales-quotation-detail';
```
new_string:
```typescript
import SalesQuotationDetail from './sales-quotation-detail';
import SalesOrderDetail from './sales-order-detail';
```

old_string:
```typescript
  if (so.docType === 'quotation') {
    return <SalesQuotationDetail so={so} onChanged={load} />;
  }
  // docType === 'order' — replaced with the real SalesOrderDetail import in Task 5.
  return <div className="py-20 text-center text-sm text-gray-500">Order detail view not yet available</div>;
```
new_string:
```typescript
  if (so.docType === 'quotation') {
    return <SalesQuotationDetail so={so} onChanged={load} />;
  }
  return <SalesOrderDetail so={so} onChanged={load} />;
```

- [ ] **Step 4: Typecheck**

Run: `cd /Users/mac/Documents/drinksharbour/client/apps/isomorphic && ./node_modules/.bin/tsc --noEmit 2>&1 | grep -v "TS2688"`
Expected: no output. If `rizzui`'s `Badge`/`Title`/`Text` prop types differ from what's used here (e.g. `color="warning"` not a valid variant), adjust to whatever values `shared/invoice/invoice-details.tsx` itself uses successfully (it already imports the same three components).

- [ ] **Step 5: Manual browser verification**

Open the order created by converting the quotation in Task 4 (`/sales/<orderId>`). Confirm it now renders the real order detail (not the placeholder) with an Outstanding column equal to `quantity` for every line (nothing fulfilled yet) and a "Confirm Order" button. Click it, pick "Cash", confirm — toast success, status badge flips to "Confirmed", the button row now shows "Fulfill" (and no "Return" yet, since nothing's been fulfilled). Click "Invoice" — confirm the printable view renders with the real soNumber/customer/items/total and "Paid via cash"; click "Back to order" to return.

- [ ] **Step 6: Commit**

```bash
cd /Users/mac/Documents/drinksharbour
git add client/apps/isomorphic/src/app/shared/sales/sales-order-detail.tsx \
        client/apps/isomorphic/src/app/shared/sales/sales-invoice-view.tsx \
        client/apps/isomorphic/src/app/shared/sales/sales-detail.tsx
git commit -m "feat(sales): order detail with confirm/payment capture + on-the-fly invoice"
```

---

### Task 6: Fulfillment — awaiting-list + additive fulfill form with partial-failure surfacing

**Files:**
- Create: `client/apps/isomorphic/src/app/shared/sales/sales-fulfill.tsx`
- Create: `client/apps/isomorphic/src/app/shared/sales/sales-fulfill-detail.tsx`
- Create: `client/apps/isomorphic/src/app/(hydrogen)/sales/fulfill/page.tsx`
- Create: `client/apps/isomorphic/src/app/(hydrogen)/sales/fulfill/[id]/page.tsx`

**Interfaces:**
- Consumes: `salesOrderService.list/get/fulfill` (Task 1); `outstanding`/`ORDER_STATUS_BADGE`/`orderStatusLabel` (Task 2); `warehouseService.getWarehouses` + `Warehouse` (existing, `@/services/warehouse.service`).
- Produces: `SalesFulfill()` (awaiting-fulfillment list); `SalesFulfillDetail({ id })` (additive fulfill form).

- [ ] **Step 1: Write `sales-fulfill.tsx`** (list of orders with outstanding units)

```typescript
// client/apps/isomorphic/src/app/shared/sales/sales-fulfill.tsx
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { PiArrowClockwise, PiTrayArrowDown, PiTruck } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { salesOrderService, type SalesOrder } from '@/services/salesOrder.service';
import { ORDER_STATUS_BADGE, orderStatusLabel, outstanding } from './sales-helpers';
import { fmtCur } from '../purchases/purchases-analytics-helpers';

function outstandingUnits(so: SalesOrder): number {
  return so.items.reduce((s, it) => s + outstanding(it), 0);
}

export default function SalesFulfill() {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      // Fetch confirmed + partially_fulfilled separately (the list endpoint filters by a single status).
      const [confirmed, partial] = await Promise.all([
        salesOrderService.list(token, { docType: 'order', status: 'confirmed' }),
        salesOrderService.list(token, { docType: 'order', status: 'partially_fulfilled' }),
      ]);
      setOrders([...(confirmed.data ?? []), ...(partial.data ?? [])]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const awaiting = useMemo(() => orders.filter((o) => outstandingUnits(o) > 0), [orders]);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Awaiting Fulfillment</h1>
          <p className="text-sm text-gray-500">Confirmed orders with units still to ship</p>
        </div>
        <button type="button" onClick={() => load()} className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50">
          <PiArrowClockwise className="h-4 w-4" />
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Order #</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Outstanding Units</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="animate-pulse border-b border-gray-100">
                  <td className="px-4 py-3"><div className="h-4 w-24 rounded bg-gray-100" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-32 rounded bg-gray-100" /></td>
                  <td className="px-4 py-3"><div className="h-5 w-16 rounded-full bg-gray-100" /></td>
                  <td className="px-4 py-3"><div className="ml-auto h-4 w-10 rounded bg-gray-100" /></td>
                  <td className="px-4 py-3"><div className="ml-auto h-4 w-16 rounded bg-gray-100" /></td>
                </tr>
              ))
            ) : awaiting.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-20 text-center text-sm text-gray-400">
                  <PiTruck className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                  Nothing awaiting fulfillment
                </td>
              </tr>
            ) : (
              awaiting.map((o) => (
                <tr
                  key={o._id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => router.push(routes.eCommerce.salesFulfillDetails(o._id))}
                >
                  <td className="px-4 py-3 font-mono font-medium text-gray-900">{o.soNumber}</td>
                  <td className="px-4 py-3 text-gray-700">{o.customerSnapshot?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${ORDER_STATUS_BADGE[o.orderStatus ?? 'confirmed']}`}>
                      {orderStatusLabel(o.orderStatus)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-amber-600">{outstandingUnits(o)}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{fmtCur(o.total, o.currency)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `sales-fulfill-detail.tsx`** (additive fulfill form, modeled on `purchases-receipt-detail.tsx`)

```typescript
// client/apps/isomorphic/src/app/shared/sales/sales-fulfill-detail.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { PiArrowLeft, PiMinus, PiPlus, PiTruck } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { salesOrderService, type SalesOrder } from '@/services/salesOrder.service';
import { warehouseService, type Warehouse } from '@/services/warehouse.service';
import { outstanding } from './sales-helpers';
import { fmtCur } from '../purchases/purchases-analytics-helpers';

export default function SalesFulfillDetail({ id }: { id: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [so, setSo] = useState<SalesOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await salesOrderService.get(id, token);
      setSo(res.data);
      // Default each line to its full outstanding qty.
      const init: Record<string, number> = {};
      res.data.items.forEach((it) => {
        init[it._id] = outstanding(it);
      });
      setQtys(init);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await warehouseService.getWarehouses(token, { isActive: true });
        if (cancelled) return;
        const list: Warehouse[] = res.data ?? [];
        setWarehouses(list);
        const preferred = list.find((w) => w.isDefault) ?? list[0];
        if (preferred) setWarehouseId((cur) => cur || preferred._id);
      } catch {
        if (!cancelled) {
          setWarehouses([]);
          toast.error('Failed to load warehouses');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  function adjustQty(lineId: string, max: number, delta: number) {
    setQtys((prev) => {
      const next = (prev[lineId] ?? 0) + delta;
      return { ...prev, [lineId]: Math.min(Math.max(0, next), max) };
    });
  }

  const totalShipping = useMemo(
    () => Object.values(qtys).reduce((s, q) => s + (q || 0), 0),
    [qtys]
  );

  async function handleFulfill() {
    if (!so) return;
    if (!warehouseId) {
      toast.error('Select a source warehouse');
      return;
    }
    const items = so.items
      .map((it) => ({ lineId: it._id, qty: qtys[it._id] ?? 0 }))
      .filter((l) => l.qty > 0);
    if (items.length === 0) {
      toast.error('Enter at least one unit to fulfill');
      return;
    }
    setSubmitting(true);
    try {
      const res = await salesOrderService.fulfill(so._id, { warehouseId, items }, token);
      const { failCount, failures, successCount } = res.posting;
      if (failCount > 0) {
        // Partial success: HTTP 200 but some lines failed to post stock.
        const names = failures.map((f) => f.name || f.lineId).join(', ');
        toast(
          `Fulfilled ${successCount} line(s); ${failCount} failed: ${names}`,
          { icon: '⚠️', duration: 6000 }
        );
      } else {
        toast.success(`Fulfilled ${successCount} line(s)`);
      }
      router.push(routes.eCommerce.salesDetails(so._id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Fulfillment failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="h-64 animate-pulse rounded-xl border border-gray-200 bg-white" />;
  if (!so) return <div className="py-20 text-center text-sm text-gray-500">Not found</div>;

  return (
    <div className="pb-24">
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
        <Link href={routes.eCommerce.salesFulfillList} className="flex items-center gap-1 hover:text-gray-700">
          <PiArrowLeft className="h-4 w-4" /> Fulfillment
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">{so.soNumber}</span>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Fulfill {so.soNumber}</h1>
        <div className="flex items-center gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Ship From</label>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none"
            >
              <option value="">Select warehouse…</option>
              {warehouses.map((w) => (
                <option key={w._id} value={w._id}>{w.name}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={submitting || totalShipping === 0}
            onClick={handleFulfill}
            className="mt-5 flex items-center gap-2 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
          >
            <PiTruck className="h-4 w-4" />
            {submitting ? 'Fulfilling…' : `Fulfill ${totalShipping} unit(s)`}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Product</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Ordered</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Outstanding</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Fulfilling Now</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Line Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {so.items.map((item) => {
              const out = outstanding(item);
              const now = qtys[item._id] ?? 0;
              const rowCls = out === 0 ? 'bg-green-50' : now === out && now > 0 ? 'bg-emerald-50/60' : now > 0 ? 'bg-amber-50/40' : '';
              return (
                <tr key={item._id} className={rowCls}>
                  <td className="px-4 py-3 text-gray-900">
                    {item.name}
                    {item.sku && <span className="ml-2 font-mono text-xs text-gray-400">{item.sku}</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{item.quantity}</td>
                  <td className="px-4 py-3 text-right font-medium text-amber-600">{out}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        disabled={out === 0}
                        onClick={() => adjustQty(item._id, out, -1)}
                        className="rounded border border-gray-200 p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                      >
                        <PiMinus className="h-3 w-3" />
                      </button>
                      <input
                        type="number"
                        min={0}
                        max={out}
                        value={now}
                        disabled={out === 0}
                        onChange={(e) => {
                          const v = Math.min(Math.max(0, Number(e.target.value) || 0), out);
                          setQtys((prev) => ({ ...prev, [item._id]: v }));
                        }}
                        className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-center text-sm disabled:bg-gray-50"
                      />
                      <button
                        type="button"
                        disabled={out === 0}
                        onClick={() => adjustQty(item._id, out, 1)}
                        className="rounded border border-gray-200 p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                      >
                        <PiPlus className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{fmtCur(item.lineTotal, so.currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write the two route shells**

```typescript
// client/apps/isomorphic/src/app/(hydrogen)/sales/fulfill/page.tsx
'use client';

import SalesNavHeader from '@/app/shared/sales/sales-nav-header';
import SalesFulfill from '@/app/shared/sales/sales-fulfill';

export default function SalesFulfillPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SalesNavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <SalesFulfill />
      </main>
    </div>
  );
}
```

```typescript
// client/apps/isomorphic/src/app/(hydrogen)/sales/fulfill/[id]/page.tsx
'use client';

import { use } from 'react';
import SalesNavHeader from '@/app/shared/sales/sales-nav-header';
import SalesFulfillDetail from '@/app/shared/sales/sales-fulfill-detail';

export default function SalesFulfillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <div className="min-h-screen bg-gray-50">
      <SalesNavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <SalesFulfillDetail id={id} />
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `cd /Users/mac/Documents/drinksharbour/client/apps/isomorphic && ./node_modules/.bin/tsc --noEmit 2>&1 | grep -v "TS2688"`
Expected: no output.

- [ ] **Step 5: Manual browser verification (partial fulfillment ×2)**

Go to Sales → Awaiting Fulfillment. Confirm the order confirmed in Task 5 appears with its outstanding-units count. Click it → fulfill form. Reduce one line to a partial qty (e.g. order had 10, fulfill 6), pick the source warehouse, click Fulfill. Confirm: toast success, redirect to the order detail, status now "Partially Fulfilled", Outstanding column shows the remainder (4), and a "Return" button now appears alongside "Fulfill". Go back to Fulfill, ship the remaining 4 — confirm status flips to "Fulfilled" and Outstanding shows 0 for all lines. (To exercise the partial-FAILURE path: fulfill a line whose subproduct/size has insufficient or no warehouse stock so `adjustStock` throws — confirm the amber ⚠️ toast lists the failed line and that line stays outstanding while successful lines advance.)

- [ ] **Step 6: Commit**

```bash
cd /Users/mac/Documents/drinksharbour
git add client/apps/isomorphic/src/app/shared/sales/sales-fulfill.tsx \
        client/apps/isomorphic/src/app/shared/sales/sales-fulfill-detail.tsx \
        client/apps/isomorphic/src/app/\(hydrogen\)/sales/fulfill/page.tsx \
        client/apps/isomorphic/src/app/\(hydrogen\)/sales/fulfill/\[id\]/page.tsx
git commit -m "feat(sales): fulfillment list + additive fulfill form with partial-failure surfacing"
```

---

### Task 7: Returns — list + create (order picker) + detail

**Files:**
- Create: `client/apps/isomorphic/src/app/shared/sales/sales-returns.tsx`
- Create: `client/apps/isomorphic/src/app/shared/sales/sales-return-create.tsx`
- Create: `client/apps/isomorphic/src/app/shared/sales/sales-return-detail.tsx`
- Create: `client/apps/isomorphic/src/app/(hydrogen)/sales/returns/page.tsx`
- Create: `client/apps/isomorphic/src/app/(hydrogen)/sales/returns/create/page.tsx`
- Create: `client/apps/isomorphic/src/app/(hydrogen)/sales/returns/[id]/page.tsx`

**Interfaces:**
- Consumes: `salesOrderService.list/get/return` (Task 1); `outstanding`/`ORDER_STATUS_BADGE`/`orderStatusLabel` (Task 2); `warehouseService.getWarehouses`/`Warehouse` (existing).

**Data-model note:** there is no separate "sales return" document in the backend — a return is an action on a `SalesOrder` (`POST /:id/return`) that advances each line's `returnedQty` and appends nothing queryable as a standalone return. So:
- `sales-returns.tsx` lists **orders that have any returned units** (`returnedQty > 0` on a line), derived from the order list — it is a returns *register*, not a separate collection.
- `sales-return-detail.tsx` is just the order's return summary (reuses the order id; route `/sales/returns/<orderId>`).
- `sales-return-create.tsx` reads `?orderId=` (the deep-link from the order detail's Return button) or lets the user pick a fulfilled/partially-fulfilled order, then posts the return.

- [ ] **Step 1: Write `sales-return-create.tsx`** (the core — order picker + return form)

```typescript
// client/apps/isomorphic/src/app/shared/sales/sales-return-create.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { PiArrowLeft, PiArrowUUpLeft, PiMinus, PiPlus } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { salesOrderService, type SalesOrder, type SalesLineItem } from '@/services/salesOrder.service';
import { warehouseService, type Warehouse } from '@/services/warehouse.service';
import { fmtCur } from '../purchases/purchases-analytics-helpers';

/** Units still returnable on a line: shipped minus already-returned. */
function returnable(line: SalesLineItem): number {
  return Math.max(0, (line.fulfilledQty || 0) - (line.returnedQty || 0));
}

export default function SalesReturnCreate() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderIdParam = searchParams.get('orderId') ?? '';
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [orderId, setOrderId] = useState(orderIdParam);
  const [orderOptions, setOrderOptions] = useState<SalesOrder[]>([]);
  const [so, setSo] = useState<SalesOrder | null>(null);
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load selectable orders (fulfilled / partially_fulfilled) when no order is pre-selected.
  useEffect(() => {
    if (!token || orderIdParam) return;
    (async () => {
      try {
        const [fulfilled, partial] = await Promise.all([
          salesOrderService.list(token, { docType: 'order', status: 'fulfilled' }),
          salesOrderService.list(token, { docType: 'order', status: 'partially_fulfilled' }),
        ]);
        setOrderOptions([...(fulfilled.data ?? []), ...(partial.data ?? [])]);
      } catch {
        setOrderOptions([]);
      }
    })();
  }, [token, orderIdParam]);

  const loadOrder = useCallback(async (oid: string) => {
    if (!token || !oid) return;
    try {
      const res = await salesOrderService.get(oid, token);
      setSo(res.data);
      const init: Record<string, number> = {};
      res.data.items.forEach((it) => {
        init[it._id] = 0;
      });
      setQtys(init);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load order');
    }
  }, [token]);

  useEffect(() => {
    if (orderId) loadOrder(orderId);
  }, [orderId, loadOrder]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await warehouseService.getWarehouses(token, { isActive: true });
        if (cancelled) return;
        const list: Warehouse[] = res.data ?? [];
        setWarehouses(list);
        const preferred = list.find((w) => w.isDefault) ?? list[0];
        if (preferred) setWarehouseId((cur) => cur || preferred._id);
      } catch {
        if (!cancelled) setWarehouses([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const totalReturning = useMemo(
    () => Object.values(qtys).reduce((s, q) => s + (q || 0), 0),
    [qtys]
  );

  function adjustQty(lineId: string, max: number, delta: number) {
    setQtys((prev) => {
      const next = (prev[lineId] ?? 0) + delta;
      return { ...prev, [lineId]: Math.min(Math.max(0, next), max) };
    });
  }

  async function handleReturn() {
    if (!so) return;
    if (!warehouseId) {
      toast.error('Select a restock warehouse');
      return;
    }
    const items = so.items
      .map((it) => ({ lineId: it._id, qty: qtys[it._id] ?? 0 }))
      .filter((l) => l.qty > 0);
    if (items.length === 0) {
      toast.error('Enter at least one unit to return');
      return;
    }
    setSubmitting(true);
    try {
      const res = await salesOrderService.return(so._id, { warehouseId, items }, token);
      const { failures, successCount } = res.restock;
      if (failures.length > 0) {
        toast(`Restocked ${successCount} line(s); ${failures.length} failed`, { icon: '⚠️', duration: 6000 });
      } else {
        toast.success(`Returned ${successCount} line(s)`);
      }
      router.push(routes.eCommerce.salesReturnDetails(so._id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Return failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pb-24">
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
        <Link href={routes.eCommerce.salesReturns} className="flex items-center gap-1 hover:text-gray-700">
          <PiArrowLeft className="h-4 w-4" /> Returns
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">New Return</span>
      </div>

      <h1 className="mb-5 text-xl font-semibold text-gray-900">New Sales Return</h1>

      {!orderIdParam && (
        <div className="mb-5 rounded-xl border border-gray-200 bg-white p-5">
          <label className="mb-1.5 block text-xs font-medium text-gray-600">Order to return from</label>
          <select
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none"
          >
            <option value="">Select a fulfilled order…</option>
            {orderOptions.map((o) => (
              <option key={o._id} value={o._id}>
                {o.soNumber} — {o.customerSnapshot?.name ?? 'Walk-in'}
              </option>
            ))}
          </select>
        </div>
      )}

      {so && (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-600">
              Returning from <span className="font-mono font-medium text-gray-900">{so.soNumber}</span>
            </p>
            <div className="flex items-center gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Restock To</label>
                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none"
                >
                  <option value="">Select warehouse…</option>
                  {warehouses.map((w) => (
                    <option key={w._id} value={w._id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                disabled={submitting || totalReturning === 0}
                onClick={handleReturn}
                className="mt-5 flex items-center gap-2 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
              >
                <PiArrowUUpLeft className="h-4 w-4" />
                {submitting ? 'Returning…' : `Return ${totalReturning} unit(s)`}
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Product</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Fulfilled</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Already Returned</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Returnable</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Returning Now</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {so.items.map((item) => {
                  const max = returnable(item);
                  const now = qtys[item._id] ?? 0;
                  return (
                    <tr key={item._id} className={now > 0 ? 'bg-amber-50/40' : ''}>
                      <td className="px-4 py-3 text-gray-900">
                        {item.name}
                        {item.sku && <span className="ml-2 font-mono text-xs text-gray-400">{item.sku}</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">{item.fulfilledQty}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{item.returnedQty}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-700">{max}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button type="button" disabled={max === 0} onClick={() => adjustQty(item._id, max, -1)} className="rounded border border-gray-200 p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30">
                            <PiMinus className="h-3 w-3" />
                          </button>
                          <input
                            type="number"
                            min={0}
                            max={max}
                            value={now}
                            disabled={max === 0}
                            onChange={(e) => {
                              const v = Math.min(Math.max(0, Number(e.target.value) || 0), max);
                              setQtys((prev) => ({ ...prev, [item._id]: v }));
                            }}
                            className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-center text-sm disabled:bg-gray-50"
                          />
                          <button type="button" disabled={max === 0} onClick={() => adjustQty(item._id, max, 1)} className="rounded border border-gray-200 p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30">
                            <PiPlus className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write `sales-returns.tsx`** (returns register — orders with returned units)

```typescript
// client/apps/isomorphic/src/app/shared/sales/sales-returns.tsx
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { PiArrowClockwise, PiArrowUUpLeft, PiPlus } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { salesOrderService, type SalesOrder } from '@/services/salesOrder.service';
import { fmtCur } from '../purchases/purchases-analytics-helpers';

function returnedUnits(so: SalesOrder): number {
  return so.items.reduce((s, it) => s + (it.returnedQty || 0), 0);
}

export default function SalesReturns() {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      // Returns can exist on partially_fulfilled or fulfilled orders.
      const [fulfilled, partial] = await Promise.all([
        salesOrderService.list(token, { docType: 'order', status: 'fulfilled' }),
        salesOrderService.list(token, { docType: 'order', status: 'partially_fulfilled' }),
      ]);
      setOrders([...(fulfilled.data ?? []), ...(partial.data ?? [])]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load returns');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const withReturns = useMemo(() => orders.filter((o) => returnedUnits(o) > 0), [orders]);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Sales Returns</h1>
          <p className="text-sm text-gray-500">Orders with restocked / reversed units</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => load()} className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50">
            <PiArrowClockwise className="h-4 w-4" />
          </button>
          <Link
            href={routes.eCommerce.createSalesReturn}
            className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101]"
          >
            <PiPlus className="h-4 w-4" /> New Return
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Order #</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Customer</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Returned Units</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Order Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="animate-pulse border-b border-gray-100">
                  <td className="px-4 py-3"><div className="h-4 w-24 rounded bg-gray-100" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-32 rounded bg-gray-100" /></td>
                  <td className="px-4 py-3"><div className="ml-auto h-4 w-10 rounded bg-gray-100" /></td>
                  <td className="px-4 py-3"><div className="ml-auto h-4 w-16 rounded bg-gray-100" /></td>
                </tr>
              ))
            ) : withReturns.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-20 text-center text-sm text-gray-400">
                  <PiArrowUUpLeft className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                  No sales returns yet
                </td>
              </tr>
            ) : (
              withReturns.map((o) => (
                <tr
                  key={o._id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => router.push(routes.eCommerce.salesReturnDetails(o._id))}
                >
                  <td className="px-4 py-3 font-mono font-medium text-gray-900">{o.soNumber}</td>
                  <td className="px-4 py-3 text-gray-700">{o.customerSnapshot?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-700">{returnedUnits(o)}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{fmtCur(o.total, o.currency)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write `sales-return-detail.tsx`** (per-order return summary)

```typescript
// client/apps/isomorphic/src/app/shared/sales/sales-return-detail.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { PiArrowLeft } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { salesOrderService, type SalesOrder } from '@/services/salesOrder.service';
import { fmtCur } from '../purchases/purchases-analytics-helpers';

export default function SalesReturnDetail({ id }: { id: string }) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [so, setSo] = useState<SalesOrder | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await salesOrderService.get(id, token);
      setSo(res.data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <div className="h-64 animate-pulse rounded-xl border border-gray-200 bg-white" />;
  if (!so) return <div className="py-20 text-center text-sm text-gray-500">Not found</div>;

  const returnedLines = so.items.filter((it) => (it.returnedQty || 0) > 0);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
        <Link href={routes.eCommerce.salesReturns} className="flex items-center gap-1 hover:text-gray-700">
          <PiArrowLeft className="h-4 w-4" /> Returns
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">{so.soNumber}</span>
      </div>

      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Return — {so.soNumber}</h1>
        <Link href={routes.eCommerce.salesDetails(so._id)} className="text-sm text-[#b20202] hover:underline">
          View order
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Product</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Fulfilled</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Returned</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Unit Price</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Refund Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {returnedLines.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-16 text-center text-sm text-gray-400">No returned units on this order</td>
              </tr>
            ) : (
              returnedLines.map((item) => {
                const unit = Math.max(0, item.unitPrice - item.discount);
                return (
                  <tr key={item._id}>
                    <td className="px-4 py-3 text-gray-900">
                      {item.name}
                      {item.sku && <span className="ml-2 font-mono text-xs text-gray-400">{item.sku}</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{item.fulfilledQty}</td>
                    <td className="px-4 py-3 text-right font-medium text-amber-600">{item.returnedQty}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmtCur(item.unitPrice, so.currency)}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{fmtCur(unit * (item.returnedQty || 0), so.currency)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write the three route shells**

```typescript
// client/apps/isomorphic/src/app/(hydrogen)/sales/returns/page.tsx
'use client';

import SalesNavHeader from '@/app/shared/sales/sales-nav-header';
import SalesReturns from '@/app/shared/sales/sales-returns';

export default function SalesReturnsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SalesNavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <SalesReturns />
      </main>
    </div>
  );
}
```

```typescript
// client/apps/isomorphic/src/app/(hydrogen)/sales/returns/create/page.tsx
'use client';

import { Suspense } from 'react';
import SalesNavHeader from '@/app/shared/sales/sales-nav-header';
import SalesReturnCreate from '@/app/shared/sales/sales-return-create';

export default function SalesReturnCreatePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SalesNavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Suspense>
          <SalesReturnCreate />
        </Suspense>
      </main>
    </div>
  );
}
```

```typescript
// client/apps/isomorphic/src/app/(hydrogen)/sales/returns/[id]/page.tsx
'use client';

import { use } from 'react';
import SalesNavHeader from '@/app/shared/sales/sales-nav-header';
import SalesReturnDetail from '@/app/shared/sales/sales-return-detail';

export default function SalesReturnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <div className="min-h-screen bg-gray-50">
      <SalesNavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <SalesReturnDetail id={id} />
      </main>
    </div>
  );
}
```

Note: `sales-return-create.tsx` uses `useSearchParams()`, which is why its route shell wraps the component in `<Suspense>` (Next.js App Router requirement).

- [ ] **Step 5: Typecheck**

Run: `cd /Users/mac/Documents/drinksharbour/client/apps/isomorphic && ./node_modules/.bin/tsc --noEmit 2>&1 | grep -v "TS2688"`
Expected: no output.

- [ ] **Step 6: Manual browser verification (full flow)**

From the fulfilled (or partially-fulfilled) order detail in Task 6, click "Return". Confirm it deep-links to `/sales/returns/create?orderId=<id>` with the order pre-loaded and the order picker hidden. Set a return qty on a line (≤ returnable), pick a restock warehouse, click Return — confirm toast success and redirect to `/sales/returns/<id>` showing the returned line + refund value. Go to Sales → Sales Returns and confirm the order appears in the register with its returned-units count. Also test the no-param path: navigate to `/sales/returns/create` directly, confirm the order dropdown lists fulfilled/partially-fulfilled orders and selecting one loads its lines.

- [ ] **Step 7: Full end-to-end acceptance run**

Drive the entire spec acceptance flow in one pass against a fresh customer/products: create quotation → send → accept → convert → confirm (cash) → partial fulfill ×2 → return. Verify at each step: Outstanding column math, status-gated buttons appearing/disappearing correctly, and the partial-failure toast path. Then run the final typecheck:

Run: `cd /Users/mac/Documents/drinksharbour/client/apps/isomorphic && ./node_modules/.bin/tsc --noEmit 2>&1 | grep -c "TS2688"`
Expected: the same baseline count recorded in Task 1 Step 1 (per spec, 27).
Run: `cd /Users/mac/Documents/drinksharbour/client/apps/isomorphic && ./node_modules/.bin/tsc --noEmit 2>&1 | grep -v "TS2688"`
Expected: no output (no non-baseline errors).

- [ ] **Step 8: Commit**

```bash
cd /Users/mac/Documents/drinksharbour
git add client/apps/isomorphic/src/app/shared/sales/sales-returns.tsx \
        client/apps/isomorphic/src/app/shared/sales/sales-return-create.tsx \
        client/apps/isomorphic/src/app/shared/sales/sales-return-detail.tsx \
        client/apps/isomorphic/src/app/\(hydrogen\)/sales/returns/page.tsx \
        client/apps/isomorphic/src/app/\(hydrogen\)/sales/returns/create/page.tsx \
        client/apps/isomorphic/src/app/\(hydrogen\)/sales/returns/\[id\]/page.tsx
git commit -m "feat(sales): returns register + create (restock + ledger reversal) + detail"
```

---

## Self-Review

**Spec coverage** (against `docs/superpowers/specs/2026-06-22-sales-frontend-stage-a-design.md`):
- Route tree (page/quotations/orders/create/[id]/fulfill{,/[id]}/returns{,/create,/[id]}) → Tasks 2,3,4,6,7. ✓
- `sales-nav-header.tsx` → Task 2. ✓
- `sales-quotations.tsx` / `sales-orders.tsx` lists → Task 2. ✓
- `sales-create.tsx` with customer picker + pricelist auto-apply → Task 3 (`CustomerSearch` + `useSalesCustomerPricelist` + `computeItemPriceWithPricelist`). ✓
- `sales-quotation-detail.tsx` (send/accept/reject/convert) → Task 4. ✓
- `sales-order-detail.tsx` (confirm/fulfill/return/invoice + Outstanding column) → Task 5. ✓
- On-the-fly invoice render → Task 5 (`SalesInvoiceView`). ✓
- `sales-fulfill-detail.tsx` additive form + partial-failure surfacing → Task 6. ✓
- Returns (list/create/detail) → Task 7. ✓
- Verification (`tsc --noEmit`, baseline 27 TS2688, manual flow) → every task + Task 7 Step 7. ✓
- Out of scope (analytics/settings, dedicated invoice endpoint) → correctly excluded. ✓

**Placeholder scan:** The only intentional stepping-stone is the Task 4 → Task 5 `sales-detail.tsx` order branch, explicitly flagged and resolved within Task 5 Step 3. No `TBD`/`add error handling`/`similar to`-style gaps. ✓

**Type consistency:** `salesOrderService` method names (`list/create/get/update/cancel/send/accept/reject/convert/confirm/fulfill/return`) are defined in Task 1 and used verbatim thereafter. `outstanding`, `ORDER_STATUS_BADGE`, `QUOTE_STATUS_BADGE`, `orderStatusLabel`, `quoteStatusLabel` defined in Task 2's `sales-helpers.ts` and imported consistently. `ProductLineSelection` shape produced in Task 3 matches its consumer in `sales-create.tsx`. `SalesOrder`/`SalesLineItem` field names (`fulfilledQty`, `returnedQty`, `unitPrice`, `discount`, `lineTotal`, `orderStatus`, `quoteStatus`) match the verified backend model. ✓

**Risk note for executors:** Two external-surface assumptions to confirm at execution time (both have explicit fallback instructions in their tasks): (a) `POSCartItem`'s currently-required fields (Task 3 Step 6) — adjust the `pricingItem` literal if the type has gained required fields; (b) `rizzui` `Badge`/`Title`/`Text` prop unions (Task 5 Step 4) — match `shared/invoice/invoice-details.tsx`'s usage.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-22-sales-frontend-stage-a.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?

# Purchases Module — Design Spec
**Date:** 2026-05-29  
**Status:** Approved

---

## Overview

A full Odoo-parity purchase management module for DrinksHarbour tenants. Tenants can create RFQs and purchase orders, receive goods, manage vendor bills, returns, agreements, pricelists, UOM conversions, and exchange rates — all within a standalone app that mirrors the Point of Sale module's design and navigation pattern.

---

## Architecture

### Approach
Option B — shared component library under `app/shared/purchases/`. Each Next.js page file is thin (imports one shared component + exports metadata). All logic, state, and UI live in the shared folder.

### Route Structure
All routes under `(hydrogen)/ecommerce/purchases/`:

```
purchases/
├── page.tsx                          ← Orders list / dashboard
├── create/page.tsx                   ← Create RFQ / Purchase Order
├── [id]/page.tsx                     ← PO detail
├── [id]/edit/page.tsx                ← Edit PO
├── receive/page.tsx                  ← Receive queue (confirmed POs)
├── receipt/[id]/page.tsx             ← Individual receive screen
├── validate/page.tsx                 ← Validate receipt
├── bills/page.tsx                    ← Vendor Bills list
├── bills/create/page.tsx             ← Create vendor bill
├── bills/[id]/page.tsx               ← Bill detail
├── returns/page.tsx                  ← Vendor Returns list
├── analytics/page.tsx                ← Analytics dashboard
├── agreements/page.tsx               ← Blanket Orders list
├── agreements/create/page.tsx        ← Create agreement
├── agreements/[id]/page.tsx          ← Agreement detail
├── pricelists/page.tsx               ← Vendor pricelists
├── pricelists/create/page.tsx        ← Create pricelist
├── uom-conversions/page.tsx          ← UOM conversions
├── exchange-rates/page.tsx           ← Exchange rates
└── settings/page.tsx                 ← Purchase settings
```

### Shared Components
All under `src/app/shared/purchases/`:

```
shared/purchases/
├── purchases-nav-header.tsx          ← Nav header (mirrors POSNavHeader)
├── purchases-orders.tsx              ← Orders list + stats cards
├── purchases-create.tsx              ← Create/Edit PO form
├── purchases-po-detail.tsx           ← PO detail view
├── purchases-receive-queue.tsx       ← Receive queue
├── purchases-receive-detail.tsx      ← Individual receive screen
├── purchases-bills.tsx               ← Bills list
├── purchases-bill-detail.tsx         ← Bill detail
├── purchases-returns.tsx             ← Returns list
├── purchases-analytics.tsx           ← Analytics dashboard
├── purchases-agreements.tsx          ← Agreements list + detail
├── purchases-pricelists.tsx          ← Pricelists
├── purchases-uom-conversions.tsx     ← UOM conversions
├── purchases-exchange-rates.tsx      ← Exchange rates
├── purchases-settings.tsx            ← Settings cards
├── api.ts                            ← Thin API wrapper over existing services
└── types.ts                          ← Shared types
```

---

## Nav Header

`PurchasesNavHeader` mirrors `POSNavHeader` exactly in structure:

- **Left:** DrinksHarbour logo + "Purchases" module name
- **No shop selector** — purchases do not need a shop context
- **Active route:** underlined with `#b20202` bottom border (same as POS)

### Nav Dropdowns

| Orders | Billing | Reporting | Configuration |
|--------|---------|-----------|---------------|
| All Orders | Vendor Bills | Analytics | Vendors |
| New Order | Vendor Returns | | Agreements |
| Receive Products | | | Pricelists |
| | | | UOM Conversions |
| | | | Exchange Rates |
| | | | Settings |

---

## Status Flows

### PO Status (Odoo-exact)
```
Draft (RFQ) → Sent (RFQ Sent) → Purchase Order (Confirmed) → Locked (Done)
                                          ↓
                                      Cancelled
```

### Receipt Status
```
Ready → In Progress → Done (Validated)
```

### Bill Status
```
Draft → Posted → Paid → Cancelled
```

### Status Badge Colors
| Status | Color |
|--------|-------|
| draft | gray |
| sent | blue |
| purchase | green |
| done | purple |
| cancel | red |
| ready | amber |
| posted | green |
| paid | emerald |

---

## Page Designs

### Orders List (`/ecommerce/purchases/`)
- 4 stat cards: Total Orders, To Receive, To Bill, Total Spent (₦)
- Status filter tabs: All · RFQ · Purchase Orders · To Receive · To Bill · Cancelled
- Table columns: PO# | Vendor | Order Date | Expected Arrival | Items | Total | Status | Actions
- "New Order" button top-right → `/purchases/create`

### Create / Edit PO
- Header row: auto-generated PO number, status badge, Save Draft / Confirm Order / Cancel buttons
- Fields: Vendor (searchable from vendor list), Vendor Reference, Order Date, Expected Arrival, Currency, Purchase Agreement (optional link)
- Line items table: Product search, Description, Qty, UOM, Unit Price, Taxes, Subtotal — Add Line / Remove
- Totals block bottom-right: Untaxed, Taxes, Total
- Notes textarea

### PO Detail (`/purchases/[id]`)
- Workflow status bar across top: RFQ → Confirmed → Received → Billed
- Smart buttons row (Odoo style): `Receipts [N]` · `Bills [N]`
- PO header card: vendor info, dates, reference
- Line items table (read-only with received qty column)
- Primary action button changes by status:
  - Draft → Confirm Order
  - Confirmed → Receive Products
  - Received → Create Bill
  - Billed/Done → (locked)

### Receive Detail (`/purchases/receipt/[id]`) — Odoo exact pattern
- Header: "Receive Products — PO#XXX · Vendor Name"
- Table: Product | Ordered Qty | Already Received | **To Receive** (editable) | UOM
- Back link to PO detail
- "Validate" button (red) → PATCH status, updates inventory, redirects to PO with success toast

### Receive Queue (`/purchases/receive`)
- Cards of confirmed POs with outstanding receive quantities
- Each card: PO#, Vendor, Expected Arrival, Items count, "Receive" button → `/purchases/receipt/[id]`
- Empty state when all deliveries done

### Vendor Bills (`/purchases/bills`)
- Stat cards: Total Bills, Draft, Posted, Overdue
- Table: Bill#, Vendor, Bill Date, Due Date, PO Reference, Total, Status
- Bills only creatable from a received PO (enforces received-quantities policy — no bill without validated receipt)

### Analytics (`/purchases/analytics`)
- 4 KPI cards: Total Spend, Avg Order Value, Orders This Month, Top Vendor
- Bar chart: spend over time
- Pie chart: spend by vendor
- Data wired to `purchaseAnalytics.service.ts`

### Agreements, Pricelists, UOM Conversions, Exchange Rates
- Each: table list + "New" button + detail/create form
- Same card pattern as POS settings pages

### Settings (`/purchases/settings`)
- Cards: Default Currency, Bill Control Policy (locked to "received quantities"), Default Vendor Lead Time, Purchase Lock days

---

## Auth

- All pages use `useSession()` from next-auth to extract `session.user.token`
- No separate login — standard admin session auth
- Token passed to all API calls

---

## API Layer

### Existing Services (re-used)
- `purchaseOrderService.ts` — orders CRUD, approve, lock, receive status
- `vendorBillService.ts` — bills CRUD
- `vendorReturn.service.ts` — returns
- `purchaseAgreement.service.ts` — agreements
- `purchaseAnalytics.service.ts` — analytics

### Existing Services (also available)
- `vendor.service.ts` — vendor contacts CRUD (already exists)
- `vendorPricelist.service.ts` — vendor pricelists CRUD (already exists)

### `shared/purchases/api.ts`
Thin re-export wrapper — consolidates all service calls into one import point for shared components.

---

## Design Language

Identical to POS settings (`pos-settings/page.tsx`):

| Token | Value |
|-------|-------|
| Page bg | `bg-gray-50 min-h-screen` |
| Card | `rounded-2xl border border-gray-200 bg-white shadow-sm` |
| Brand color | `#b20202` |
| Focus ring | `ring-[#b20202]/20 border-[#b20202]` |
| Skeleton | `animate-pulse rounded-lg bg-gray-100` |
| Icon set | Phosphor (`pi` prefix from `react-icons/pi`) |
| Toasts | `react-hot-toast` |
| Table rows | `hover:bg-gray-50 border-b border-gray-100` |
| Toggle | Same inline Toggle component as POS settings |
| Card component | Same Card/Row/Field/Footer component pattern as POS settings |

---

## Build Order

1. `types.ts` + `api.ts` (foundation)
2. `vendorService.ts` (new service)
3. `purchases-nav-header.tsx` (nav — needed by all pages)
4. `purchases-orders.tsx` + `purchases/page.tsx` (entry point)
5. `purchases-create.tsx` + create/page.tsx + [id]/edit/page.tsx
6. `purchases-po-detail.tsx` + [id]/page.tsx
7. `purchases-receive-queue.tsx` + receive/page.tsx
8. `purchases-receive-detail.tsx` + receipt/[id]/page.tsx
9. `purchases-bills.tsx` + `purchases-bill-detail.tsx` + bills pages
10. `purchases-returns.tsx` + returns/page.tsx
11. `purchases-analytics.tsx` + analytics/page.tsx
12. Agreements, pricelists, UOM, exchange rates pages
13. `purchases-settings.tsx` + settings/page.tsx

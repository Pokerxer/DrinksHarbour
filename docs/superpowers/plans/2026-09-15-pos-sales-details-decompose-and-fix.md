# POS Sales Details — Decompose + Fix Core Logic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose the 3,651-line `pos-sales-details.tsx` monolith into ~14 focused modules, fix all calculation/filtering bugs, and preserve every existing behavior.

**Architecture:** Vertical-slice decomposition under `shared/point-of-sale/sales-details/`. All logic extracted into 3 custom hooks (`useSalesData`, `useSalesFilters`, `useSalesExport`). Components receive only the props they need. The orchestrator `index.tsx` contains zero business logic.

**Tech Stack:** Next.js App Router, React 18, TypeScript, Tailwind CSS, Jotai (POS store), xlsx, jsPDF + jspdf-autotable, react-icons/pi

## Global Constraints

- Every file must stay under 300 lines
- No `any` types unless absolutely necessary
- All existing functionality must be preserved — no regressions
- `gross - discount === subtotal` must hold for every LineRow (server-authoritative)
- Voided orders excluded from summary when status='active' or 'all'
- Date filtering uses local time (numeric `new Date(y,m,d,h,min)` args, not ISO strings)
- Follow existing code conventions: `'use client'` directive, Tailwind classes, `#b20202` brand color
- Existing imports in the orchestrator must remain backward-compatible (the page route at `point-of-sale/sales-details/page.tsx` imports `POSSalesDetails` as default)

---

## File Map

| # | File | Responsibility | Est. Lines |
|---|------|---------------|-----------|
| 1 | `types.ts` | All TypeScript interfaces and type aliases | ~80 |
| 2 | `constants.ts` | Payment labels/colors/dots, date presets, export column defs, toggleable cols | ~120 |
| 3 | `helpers.ts` | fmtDate, fmtDateTime, toTsUtc, isTokenExpired, highlight() | ~80 |
| 4 | `components/sort-chevron.tsx` | Reusable sort direction indicator | ~20 |
| 5 | `components/filter-chip.tsx` | Removable filter chip | ~25 |
| 6 | `components/date-time-range.tsx` | From/to date+time range picker | ~70 |
| 7 | `components/custom-select.tsx` | Dropdown select with optional dot, clear, required mode | ~100 |
| 8 | `hooks/use-sales-filters.ts` | All filter/sort/view state, debounce, presets, chips | ~180 |
| 9 | `hooks/use-sales-data.ts` | Fetch → flatten → filter → sort → group → summary | ~200 |
| 10 | `components/summary-strip.tsx` | KPI cards row | ~70 |
| 11 | `components/control-bar.tsx` | Sticky header: tabs, search, date presets, filters, actions | ~280 |
| 12 | `components/lines-table.tsx` | Lines view table + pagination | ~250 |
| 13 | `components/grouped-table.tsx` | Grouped view table + pagination | ~200 |
| 14 | `export/csv.ts` | CSV export for lines and grouped | ~100 |
| 15 | `export/excel.ts` | Excel export for lines and grouped | ~80 |
| 16 | `export/pdf.ts` | PDF export with branded header, table, summary section | ~400 |
| 17 | `hooks/use-sales-export.ts` | Export dialog state, column toggles, confirmExport | ~120 |
| 18 | `components/export-column-modal.tsx` | Column picker dialog | ~130 |
| 19 | `index.tsx` | Thin orchestrator composing hooks + components | ~80 |

**Total:** ~2,485 lines across 19 files (down from 3,651 in 1 file)

---

### Task 1: Types, Constants, Helpers (Foundation)

**Files:**
- Create: `client/apps/admin/src/app/shared/point-of-sale/sales-details/types.ts`
- Create: `client/apps/admin/src/app/shared/point-of-sale/sales-details/constants.ts`
- Create: `client/apps/admin/src/app/shared/point-of-sale/sales-details/helpers.ts`

**Interfaces:**
- Consumes: nothing (foundation)
- Produces: `LineRow`, `GroupRow`, `LineSortField`, `GroupSortField`, `GroupByKey`, `ViewMode`, `StatusFilter`, `ToggleableCol`, `LineExportCol`, `GroupExportCol`, `PdfMeta`, `SelectOption` types; `METHOD_LABEL`, `METHOD_COLOR`, `METHOD_DOT`, `TOGGLEABLE_COLS`, `LINE_EXPORT_COLS`, `GROUP_EXPORT_COLS`, `DATE_PRESETS`, `GROUP_BY_OPTIONS`, `PAYMENT_OPTIONS` constants; `fmtDate`, `fmtDateTime`, `toTsUtc`, `isTokenExpired`, `highlight()` helpers

- [ ] **Step 1: Create `types.ts`**

```ts
// client/apps/admin/src/app/shared/point-of-sale/sales-details/types.ts

export interface OrderItem {
  name: string;
  variant?: string;
  quantity: number;
  priceAtPurchase: number;
  itemSubtotal: number;
  discountAmount?: number;
  sizeCostPrice?: number;
  category?: string;
  subcategory?: string;
  brand?: string;
  warehouse?: { _id: string; name: string; code: string } | null;
}

export interface PosOrder {
  _id: string;
  orderNumber?: string;
  receiptNumber?: string;
  total: number;
  subtotal?: number;
  discountTotal?: number;
  paymentMethod: string;
  paymentStatus?: string;
  status?: string;
  isVoided?: boolean;
  placedAt: string;
  createdAt: string;
  posStaff?: { firstName: string; lastName: string; posName?: string };
  customer?: { firstName?: string; lastName?: string; phone?: string } | null;
  items?: OrderItem[];
}

export interface LineRow {
  orderId: string;
  orderNumber: string;
  receiptNumber: string;
  date: string;
  cashier: string;
  product: string;
  variant: string;
  category: string;
  subcategory: string;
  brand: string;
  qty: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
  gross: number;
  costPrice: number;
  profit: number;
  paymentMethod: string;
  isVoided: boolean;
  warehouse: string;
}

export type LineSortField = keyof Pick<
  LineRow,
  | 'date'
  | 'orderNumber'
  | 'cashier'
  | 'product'
  | 'variant'
  | 'category'
  | 'subcategory'
  | 'brand'
  | 'qty'
  | 'unitPrice'
  | 'discount'
  | 'subtotal'
  | 'gross'
  | 'profit'
  | 'paymentMethod'
>;

export interface GroupRow {
  key: string;
  qty: number;
  gross: number;
  discount: number;
  revenue: number;
  profit: number;
  lineCount: number;
  orderCount: number;
  share: number;
}

export type GroupSortField =
  | 'key'
  | 'qty'
  | 'revenue'
  | 'gross'
  | 'discount'
  | 'profit'
  | 'lineCount'
  | 'orderCount'
  | 'share';

export type GroupByKey =
  | 'product'
  | 'cashier'
  | 'payment_method'
  | 'date'
  | 'variant'
  | 'warehouse';

export type ViewMode = 'lines' | 'grouped';
export type StatusFilter = 'all' | 'active' | 'voided';

export type ToggleableCol =
  | 'orderNumber'
  | 'cashier'
  | 'variant'
  | 'category'
  | 'subcategory'
  | 'brand'
  | 'unitPrice'
  | 'gross'
  | 'discount'
  | 'payment';

export type LineExportCol =
  | 'date'
  | 'order'
  | 'receipt'
  | 'cashier'
  | 'product'
  | 'variant'
  | 'category'
  | 'subcategory'
  | 'brand'
  | 'qty'
  | 'unitPrice'
  | 'gross'
  | 'discount'
  | 'net'
  | 'cost'
  | 'profit'
  | 'margin'
  | 'payment'
  | 'voided';

export type GroupExportCol =
  | 'key'
  | 'qty'
  | 'gross'
  | 'discount'
  | 'revenue'
  | 'profit'
  | 'margin'
  | 'share'
  | 'lineCount'
  | 'orderCount';

export interface PdfMeta {
  dateFrom: string;
  dateTo: string;
  timeFrom: string;
  timeTo: string;
  cashierFilter: string;
  methodFilter: string;
  statusFilter: StatusFilter;
  storeName: string;
  summary: {
    gross: number;
    revenue: number;
    discount: number;
    items: number;
    orders: number;
    profit: number;
    avgOrder: number;
  };
}

export interface SelectOption {
  value: string;
  label: string;
  dot?: string;
}

export interface SalesSummary {
  revenue: number;
  items: number;
  discount: number;
  gross: number;
  profit: number;
  orders: number;
  avgOrder: number;
}

export interface VoidSummary {
  count: number;
  revenue: number;
}
```

- [ ] **Step 2: Create `constants.ts`**

```ts
// client/apps/admin/src/app/shared/point-of-sale/sales-details/constants.ts

import type {
  ToggleableCol,
  LineExportCol,
  GroupExportCol,
  SelectOption,
} from './types';

export const PAGE_SIZE = 50;
export const GROUP_PAGE_SIZE = 30;

export const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash',
  card: 'Card/POS',
  bank_transfer: 'Bank Transfer',
  mobile_money: 'Mobile Money',
  split: 'Split',
  other: 'Other',
};

export const METHOD_COLOR: Record<string, string> = {
  cash: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  card: 'bg-blue-50 text-blue-700 border border-blue-100',
  bank_transfer: 'bg-violet-50 text-violet-700 border border-violet-100',
  mobile_money: 'bg-amber-50 text-amber-700 border border-amber-100',
  split: 'bg-orange-50 text-orange-700 border border-orange-100',
  other: 'bg-gray-100 text-gray-600 border border-gray-200',
};

export const METHOD_DOT: Record<string, string> = {
  cash: 'bg-emerald-500',
  card: 'bg-blue-500',
  bank_transfer: 'bg-violet-500',
  mobile_money: 'bg-amber-500',
  split: 'bg-orange-500',
  other: 'bg-gray-400',
};

export const TOGGLEABLE_COLS: {
  key: ToggleableCol;
  label: string;
  defaultHidden?: boolean;
}[] = [
  { key: 'orderNumber', label: 'Order #' },
  { key: 'cashier', label: 'Cashier' },
  { key: 'variant', label: 'Variant' },
  { key: 'category', label: 'Category', defaultHidden: true },
  { key: 'subcategory', label: 'Subcategory', defaultHidden: true },
  { key: 'brand', label: 'Brand', defaultHidden: true },
  { key: 'unitPrice', label: 'Unit Price' },
  { key: 'gross', label: 'Gross Rev.' },
  { key: 'discount', label: 'Discount' },
  { key: 'payment', label: 'Payment' },
];

export const LINE_EXPORT_COLS: {
  key: LineExportCol;
  label: string;
  required?: boolean;
  costOnly?: boolean;
  pdfW: number;
  pdfAlign: 'left' | 'right';
}[] = [
  { key: 'date', label: 'Date/Time', required: true, pdfW: 28, pdfAlign: 'left' },
  { key: 'order', label: 'Order #', pdfW: 18, pdfAlign: 'left' },
  { key: 'receipt', label: 'Receipt #', pdfW: 16, pdfAlign: 'left' },
  { key: 'cashier', label: 'Cashier', pdfW: 22, pdfAlign: 'left' },
  { key: 'product', label: 'Product', required: true, pdfW: 34, pdfAlign: 'left' },
  { key: 'variant', label: 'Variant', pdfW: 18, pdfAlign: 'left' },
  { key: 'category', label: 'Category', pdfW: 20, pdfAlign: 'left' },
  { key: 'subcategory', label: 'Subcategory', pdfW: 20, pdfAlign: 'left' },
  { key: 'brand', label: 'Brand', pdfW: 18, pdfAlign: 'left' },
  { key: 'qty', label: 'Qty', required: true, pdfW: 10, pdfAlign: 'right' },
  { key: 'unitPrice', label: 'Unit Price', pdfW: 20, pdfAlign: 'right' },
  { key: 'gross', label: 'Gross Revenue', pdfW: 20, pdfAlign: 'right' },
  { key: 'discount', label: 'Discount', pdfW: 18, pdfAlign: 'right' },
  { key: 'net', label: 'Net Total', required: true, pdfW: 22, pdfAlign: 'right' },
  { key: 'cost', label: 'Cost Price', costOnly: true, pdfW: 18, pdfAlign: 'right' },
  { key: 'profit', label: 'Profit', costOnly: true, pdfW: 18, pdfAlign: 'right' },
  { key: 'margin', label: 'Margin %', costOnly: true, pdfW: 16, pdfAlign: 'right' },
  { key: 'payment', label: 'Payment', pdfW: 20, pdfAlign: 'left' },
  { key: 'voided', label: 'Voided', pdfW: 12, pdfAlign: 'left' },
];

export const GROUP_EXPORT_COLS: {
  key: GroupExportCol;
  label: string;
  required?: boolean;
  costOnly?: boolean;
  pdfW: number;
  pdfAlign: 'left' | 'right';
}[] = [
  { key: 'key', label: 'Group', required: true, pdfW: 50, pdfAlign: 'left' },
  { key: 'qty', label: 'Qty Sold', pdfW: 16, pdfAlign: 'right' },
  { key: 'gross', label: 'Gross Revenue', pdfW: 26, pdfAlign: 'right' },
  { key: 'discount', label: 'Discount', pdfW: 24, pdfAlign: 'right' },
  { key: 'revenue', label: 'Net Revenue', required: true, pdfW: 26, pdfAlign: 'right' },
  { key: 'profit', label: 'Profit', costOnly: true, pdfW: 24, pdfAlign: 'right' },
  { key: 'margin', label: 'Margin %', costOnly: true, pdfW: 18, pdfAlign: 'right' },
  { key: 'share', label: 'Revenue Share %', pdfW: 16, pdfAlign: 'right' },
  { key: 'lineCount', label: 'Line Count', pdfW: 14, pdfAlign: 'right' },
  { key: 'orderCount', label: 'Distinct Orders', pdfW: 14, pdfAlign: 'right' },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function offsetDay(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function startOfWeek() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}
function startOfMonth() {
  return `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;
}
function startOfLastMonth() {
  return new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)
    .toISOString().slice(0, 10);
}
function endOfLastMonth() {
  return new Date(new Date().getFullYear(), new Date().getMonth(), 0)
    .toISOString().slice(0, 10);
}

export const DATE_PRESETS = [
  { label: 'Today', from: todayStr, to: todayStr, tf: '00:00', tt: '23:59' },
  { label: 'Yesterday', from: () => offsetDay(-1), to: () => offsetDay(-1), tf: '00:00', tt: '23:59' },
  { label: 'Last 7 days', from: () => offsetDay(-6), to: todayStr, tf: '00:00', tt: '23:59' },
  { label: 'This week', from: startOfWeek, to: todayStr, tf: '00:00', tt: '23:59' },
  { label: 'This month', from: startOfMonth, to: todayStr, tf: '00:00', tt: '23:59' },
  { label: 'Last month', from: startOfLastMonth, to: endOfLastMonth, tf: '00:00', tt: '23:59' },
];

export const GROUP_BY_OPTIONS: SelectOption[] = [
  { value: 'product', label: 'By Product' },
  { value: 'variant', label: 'By Variant' },
  { value: 'warehouse', label: 'By Warehouse' },
  { value: 'cashier', label: 'By Cashier' },
  { value: 'payment_method', label: 'By Payment' },
  { value: 'date', label: 'By Date' },
];

export const PAYMENT_OPTIONS: SelectOption[] = Object.entries(METHOD_LABEL).map(
  ([k, v]) => ({ value: k, label: v, dot: METHOD_DOT[k] })
);
```

- [ ] **Step 3: Create `helpers.ts`**

```ts
// client/apps/admin/src/app/shared/point-of-sale/sales-details/helpers.ts

import { type ReactNode } from 'react';

export function isTokenExpired(tok: string | null | undefined): boolean {
  if (!tok) return true;
  try {
    const payload = JSON.parse(atob(tok.split('.')[1]));
    return !payload || typeof payload !== 'object' || !('exp' in payload) ||
      typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/** Convert a date string + time string to a local-time timestamp (fixes UTC offset bug). */
export function toTsUtc(date: string, time: string): number {
  if (!date) return 0;
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time || '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm).getTime();
}

export function highlight(text: string, q: string): ReactNode {
  if (!q || !text) return text;
  const lower = text.toLowerCase();
  const lowerQ = q.toLowerCase();
  const parts: ReactNode[] = [];
  let last = 0;
  let idx = lower.indexOf(lowerQ);
  while (idx !== -1) {
    if (idx > last) parts.push(text.slice(last, idx));
    parts.push(
      <mark
        key={idx}
        className="rounded-[2px] bg-yellow-100 px-px not-italic text-yellow-900"
      >
        {text.slice(idx, idx + q.length)}
      </mark>
    );
    last = idx + q.length;
    idx = lower.indexOf(lowerQ, last);
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
```

- [ ] **Step 4: Verify compilation**

Run: `cd /Users/mac/Documents/drinksharbour/client/apps/admin && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors in the new files (existing errors in other files are fine)

- [ ] **Step 5: Commit**

```bash
cd /Users/mac/Documents/drinksharbour
git add client/apps/admin/src/app/shared/point-of-sale/sales-details/types.ts \
        client/apps/admin/src/app/shared/point-of-sale/sales-details/constants.ts \
        client/apps/admin/src/app/shared/point-of-sale/sales-details/helpers.ts
git commit -m "feat(pos): add sales-details foundation — types, constants, helpers"
```

---

### Task 2: Small Reusable Components

**Files:**
- Create: `client/apps/admin/src/app/shared/point-of-sale/sales-details/components/sort-chevron.tsx`
- Create: `client/apps/admin/src/app/shared/point-of-sale/sales-details/components/filter-chip.tsx`
- Create: `client/apps/admin/src/app/shared/point-of-sale/sales-details/components/date-time-range.tsx`
- Create: `client/apps/admin/src/app/shared/point-of-sale/sales-details/components/custom-select.tsx`

**Interfaces:**
- Consumes: `SelectOption` type from Task 1
- Produces: `SortChevron`, `FilterChip`, `DateTimeRange`, `CustomSelect` components

- [ ] **Step 1: Create `sort-chevron.tsx`**

```tsx
'use client';

import { PiArrowUp, PiArrowDown, PiArrowsDownUp } from 'react-icons/pi';

export function SortChevron({
  active,
  dir,
}: {
  active: boolean;
  dir: 'asc' | 'desc';
}) {
  if (!active) return <PiArrowsDownUp className="h-3 w-3 text-gray-300" />;
  return dir === 'asc' ? (
    <PiArrowUp className="h-3 w-3 text-[#b20202]" />
  ) : (
    <PiArrowDown className="h-3 w-3 text-[#b20202]" />
  );
}
```

- [ ] **Step 2: Create `filter-chip.tsx`**

```tsx
'use client';

import { PiX } from 'react-icons/pi';

export function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#b20202]/20 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-[#b20202]">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-0.5 hover:bg-red-100"
      >
        <PiX className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}
```

- [ ] **Step 3: Create `date-time-range.tsx`**

```tsx
'use client';

import { PiClock, PiX } from 'react-icons/pi';

export function DateTimeRange({
  dateFrom,
  dateTo,
  timeFrom,
  timeTo,
  onDateFrom,
  onDateTo,
  onTimeFrom,
  onTimeTo,
  onClear,
}: {
  dateFrom: string;
  dateTo: string;
  timeFrom: string;
  timeTo: string;
  onDateFrom: (v: string) => void;
  onDateTo: (v: string) => void;
  onTimeFrom: (v: string) => void;
  onTimeTo: (v: string) => void;
  onClear: () => void;
}) {
  const hasRange = dateFrom || dateTo;
  return (
    <div className="flex items-center gap-2">
      {(['from', 'to'] as const).map((side) => {
        const dateVal = side === 'from' ? dateFrom : dateTo;
        const timeVal = side === 'from' ? timeFrom : timeTo;
        const setDate = side === 'from' ? onDateFrom : onDateTo;
        const setTime = side === 'from' ? onTimeFrom : onTimeTo;
        return (
          <div key={side} className="flex items-center gap-1.5">
            <span className="shrink-0 text-xs font-medium capitalize text-gray-400">
              {side}
            </span>
            <div className="flex items-center overflow-hidden rounded-md border border-gray-200 bg-white transition-shadow focus-within:border-[#b20202] focus-within:ring-1 focus-within:ring-[#b20202]/20">
              <input
                type="date"
                value={dateVal}
                onChange={(e) => setDate(e.target.value)}
                className="w-[128px] border-0 bg-transparent px-2.5 py-1.5 text-sm text-gray-700 focus:outline-none"
              />
              <div className="w-px self-stretch bg-gray-100" />
              <div className="flex items-center gap-1 px-2">
                <PiClock className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                <input
                  type="time"
                  value={timeVal}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-[68px] border-0 bg-transparent py-1.5 text-sm text-gray-700 focus:outline-none"
                />
              </div>
            </div>
            {side === 'from' && (
              <span className="text-xs text-gray-300">→</span>
            )}
          </div>
        );
      })}
      {hasRange && (
        <button
          type="button"
          onClick={onClear}
          className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          title="Clear date range"
        >
          <PiX className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create `custom-select.tsx`**

```tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { PiCaretDown, PiX } from 'react-icons/pi';
import type { SelectOption } from '../types';

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder,
  minWidth = 130,
  required = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder: string;
  minWidth?: number;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const selected = options.find((o) => o.value === value) ?? null;
  const isActive = !required && value !== '';

  return (
    <div className="relative" ref={ref} style={{ minWidth }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-all ${
          isActive
            ? 'border-[#b20202]/40 bg-red-50 text-[#b20202]'
            : open
              ? 'border-gray-300 bg-white text-gray-700 shadow-sm'
              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
        }`}
      >
        {selected?.dot && (
          <span className={`h-2 w-2 shrink-0 rounded-full ${selected.dot}`} />
        )}
        <span className="flex-1 truncate text-left font-medium">
          {selected?.label ?? placeholder}
        </span>
        <span className="flex shrink-0 items-center gap-0.5">
          {isActive && (
            <span
              role="button"
              aria-label="Clear"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="rounded-full p-0.5 transition-colors hover:bg-[#b20202]/10"
            >
              <PiX className="h-2.5 w-2.5" />
            </span>
          )}
          <PiCaretDown
            className={`h-3 w-3 opacity-50 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-50 min-w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl ring-1 ring-black/5">
          <div className="max-h-56 overflow-y-auto py-1">
            {!required && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onChange('');
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-colors ${
                    !isActive
                      ? 'bg-gray-50 font-semibold text-gray-800'
                      : 'text-gray-400 hover:bg-gray-50'
                  }`}
                >
                  <span>{placeholder}</span>
                  {!isActive && (
                    <span className="text-[10px] font-bold text-[#b20202]">✓</span>
                  )}
                </button>
                <div className="mx-3 my-1 border-t border-gray-100" />
              </>
            )}
            {options.map((opt) => {
              const isSel = value === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors ${
                    isSel
                      ? 'bg-red-50 font-semibold text-[#b20202]'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {opt.dot && (
                    <span className={`h-2 w-2 shrink-0 rounded-full ${opt.dot}`} />
                  )}
                  <span className="flex-1">{opt.label}</span>
                  {isSel && (
                    <span className="text-[10px] font-bold text-[#b20202]">✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Verify compilation**

Run: `cd /Users/mac/Documents/drinksharbour/client/apps/admin && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors in the new files

- [ ] **Step 6: Commit**

```bash
cd /Users/mac/Documents/drinksharbour
git add client/apps/admin/src/app/shared/point-of-sale/sales-details/components/
git commit -m "feat(pos): add sales-details reusable components — SortChevron, FilterChip, DateTimeRange, CustomSelect"
```

---

### Task 3: `use-sales-filters` Hook

**Files:**
- Create: `client/apps/admin/src/app/shared/point-of-sale/sales-details/hooks/use-sales-filters.ts`

**Interfaces:**
- Consumes: `StatusFilter`, `ViewMode`, `GroupByKey`, `LineSortField`, `GroupSortField`, `ToggleableCol` types and `TOGGLEABLE_COLS`, `DATE_PRESETS` constants from Task 1
- Produces: all filter/sort/view state and actions consumed by `useSalesData` (Task 4) and `ControlBar` (Task 6)

- [ ] **Step 1: Create `use-sales-filters.ts`**

```ts
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import type {
  StatusFilter,
  ViewMode,
  GroupByKey,
  LineSortField,
  GroupSortField,
  ToggleableCol,
} from '../types';
import { TOGGLEABLE_COLS, DATE_PRESETS } from '../constants';

export function useSalesFilters() {
  // ── Date filters ──
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [timeFrom, setTimeFrom] = useState('00:00');
  const [timeTo, setTimeTo] = useState('23:59');
  const [activePreset, setActivePreset] = useState('');

  // ── Field filters ──
  const [cashierFilter, setCashierFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');

  // ── Search ──
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Sort ──
  const [lineSortField, setLineSortField] = useState<LineSortField>('date');
  const [lineSortDir, setLineSortDir] = useState<'asc' | 'desc'>('desc');
  const [groupSortField, setGroupSortField] = useState<GroupSortField>('revenue');
  const [groupSortDir, setGroupSortDir] = useState<'asc' | 'desc'>('desc');

  // ── View ──
  const [viewMode, setViewMode] = useState<ViewMode>('lines');
  const [groupBy, setGroupBy] = useState<GroupByKey>('product');
  const [showProfit, setShowProfit] = useState(false);
  const [hiddenCols, setHiddenCols] = useState<Set<ToggleableCol>>(
    new Set<ToggleableCol>(
      TOGGLEABLE_COLS.filter((c) => c.defaultHidden).map((c) => c.key)
    )
  );

  // ── Debounce search ──
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 280);
    return () => clearTimeout(t);
  }, [search]);

  // ── ⌘K / Ctrl+K shortcut ──
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
      if (e.key === 'Escape' && document.activeElement === searchRef.current) {
        setSearch('');
        searchRef.current?.blur();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // ── Actions ──
  function applyPreset(preset: (typeof DATE_PRESETS)[0]) {
    setDateFrom(preset.from());
    setDateTo(preset.to());
    setTimeFrom(preset.tf);
    setTimeTo(preset.tt);
    setActivePreset(preset.label);
  }

  function clearDateRange() {
    setDateFrom('');
    setDateTo('');
    setTimeFrom('00:00');
    setTimeTo('23:59');
    setActivePreset('');
  }

  function clearAll() {
    clearDateRange();
    setCashierFilter('');
    setMethodFilter('');
    setStatusFilter('active');
    setSearch('');
  }

  function toggleLineSort(field: LineSortField) {
    if (lineSortField === field)
      setLineSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setLineSortField(field);
      setLineSortDir(field === 'date' ? 'desc' : 'asc');
    }
  }

  function toggleGroupSort(field: GroupSortField) {
    if (groupSortField === field)
      setGroupSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setGroupSortField(field);
      setGroupSortDir('desc');
    }
  }

  function toggleCol(key: ToggleableCol) {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const vis = (key: ToggleableCol) => !hiddenCols.has(key);

  // ── Filter chips ──
  const filterChips = useMemo(() => {
    const chips: { label: string; onRemove: () => void }[] = [];
    if (dateFrom || dateTo)
      chips.push({
        label: `${dateFrom || '…'}${timeFrom !== '00:00' ? ` ${timeFrom}` : ''} → ${dateTo || '…'}${timeTo !== '23:59' ? ` ${timeTo}` : ''}`,
        onRemove: clearDateRange,
      });
    if (cashierFilter)
      chips.push({
        label: cashierFilter,
        onRemove: () => setCashierFilter(''),
      });
    if (methodFilter)
      chips.push({
        label: methodFilter === 'card' ? 'Card/POS' : methodFilter,
        onRemove: () => setMethodFilter(''),
      });
    if (search)
      chips.push({
        label: `"${search.slice(0, 24)}${search.length > 24 ? '…' : ''}"`,
        onRemove: () => setSearch(''),
      });
    return chips;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, timeFrom, timeTo, cashierFilter, methodFilter, search]);

  return {
    // Date
    dateFrom, setDateFrom, dateTo, setDateTo,
    timeFrom, setTimeFrom, timeTo, setTimeTo,
    activePreset, applyPreset, clearDateRange,
    // Fields
    cashierFilter, setCashierFilter,
    methodFilter, setMethodFilter,
    statusFilter, setStatusFilter,
    // Search
    search, setSearch, debouncedSearch,
    searchFocused, setSearchFocused, searchRef,
    // Sort
    lineSortField, lineSortDir, toggleLineSort,
    groupSortField, groupSortDir, toggleGroupSort,
    // View
    viewMode, setViewMode, groupBy, setGroupBy,
    showProfit, setShowProfit,
    hiddenCols, toggleCol, vis,
    // Derived
    filterChips,
    // Actions
    clearAll,
  };
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd /Users/mac/Documents/drinksharbour/client/apps/admin && npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 3: Commit**

```bash
cd /Users/mac/Documents/drinksharbour
git add client/apps/admin/src/app/shared/point-of-sale/sales-details/hooks/use-sales-filters.ts
git commit -m "feat(pos): add useSalesFilters hook — all filter/sort/view state"
```

---

### Task 4: `use-sales-data` Hook (with Bug Fixes)

**Files:**
- Create: `client/apps/admin/src/app/shared/point-of-sale/sales-details/hooks/use-sales-data.ts`

**Interfaces:**
- Consumes: `PosOrder`, `LineRow`, `GroupRow`, `SalesSummary`, `VoidSummary` types from Task 1; filter values from Task 3; `posApi.getAllOrders` from existing API layer; `formatCurrency` from existing utils; `historyAccess` from existing shop-entry
- Produces: `orders`, `allRows`, `filteredBase`, `activeRows`, `voidedRows`, `sorted`, `grouped`, `summary`, `voidSummary`, `statusCounts`, `hasCostData`, `cashiers`, `cashierOptions`, `loading`, `error`, `truncated`, `refetch`, `refetchAll`, `distinctOrderCount`

**This hook contains all 4 bug fixes.**

- [ ] **Step 1: Create `use-sales-data.ts`**

```ts
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { posApi } from '@/app/shared/point-of-sale/api';
import { formatCurrency } from '@/app/shared/point-of-sale/utils';
import { isTokenExpired, toTsUtc, fmtDate } from '../helpers';
import { METHOD_LABEL } from '../constants';
import type {
  PosOrder,
  LineRow,
  GroupRow,
  GroupByKey,
  LineSortField,
  GroupSortField,
  StatusFilter,
  SalesSummary,
  VoidSummary,
} from '../types';
import type { SelectOption } from '../types';

interface UseSalesDataParams {
  token: string | null;
  historyShop: string | null;
  statusFilter: StatusFilter;
  cashierFilter: string;
  methodFilter: string;
  dateFrom: string;
  dateTo: string;
  timeFrom: string;
  timeTo: string;
  debouncedSearch: string;
  lineSortField: LineSortField;
  lineSortDir: 'asc' | 'desc';
  groupSortField: GroupSortField;
  groupSortDir: 'asc' | 'desc';
  viewMode: 'lines' | 'grouped';
  groupBy: GroupByKey;
}

export function useSalesData(params: UseSalesDataParams) {
  const {
    token, historyShop, statusFilter, cashierFilter, methodFilter,
    dateFrom, dateTo, timeFrom, timeTo, debouncedSearch,
    lineSortField, lineSortDir, groupSortField, groupSortDir,
    viewMode, groupBy,
  } = params;

  const { status: sessionStatus } = useSession();
  const [orders, setOrders] = useState<PosOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [truncated, setTruncated] = useState(false);

  // ── Fetch ──
  const fetchOrders = useCallback(
    (all = false) => {
      if (sessionStatus === 'loading') return;
      if (!token) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      posApi
        .getAllOrders(token, { limit: all ? 2000 : 500, shopId: historyShop ?? undefined })
        .then((data) => {
          const rows = (data || []) as PosOrder[];
          setOrders(rows);
          setTruncated(!all && rows.length === 500);
        })
        .catch(() => setError('Failed to load orders. Please try again.'))
        .finally(() => setLoading(false));
    },
    [token, sessionStatus, historyShop]
  );

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const refetch = useCallback(() => fetchOrders(false), [fetchOrders]);
  const refetchAll = useCallback(() => fetchOrders(true), [fetchOrders]);

  // ── Flatten orders → LineRow[] (FIX: server-authoritative gross) ──
  const allRows = useMemo<LineRow[]>(() => {
    const rows: LineRow[] = [];
    for (const o of orders) {
      if (!o.items?.length) continue;
      const cashier = o.posStaff
        ? o.posStaff.posName ||
          `${o.posStaff.firstName} ${o.posStaff.lastName}`.trim()
        : 'Unknown';
      for (const item of o.items) {
        // FIX: derive gross from server subtotal + discount (not client-computed)
        const subtotal = item.itemSubtotal;
        const discount = item.discountAmount ?? 0;
        const gross = subtotal + discount;
        const costPrice = (item.sizeCostPrice ?? 0) * item.quantity;
        const profit = costPrice > 0 ? subtotal - costPrice : 0;
        rows.push({
          orderId: o._id,
          orderNumber: o.orderNumber ?? o._id.slice(-6).toUpperCase(),
          receiptNumber: o.receiptNumber ?? '',
          date: o.placedAt || o.createdAt,
          cashier,
          product: item.name,
          variant: item.variant ?? '',
          category: item.category ?? '',
          subcategory: item.subcategory ?? '',
          brand: item.brand ?? '',
          qty: item.quantity,
          unitPrice: item.priceAtPurchase,
          discount,
          subtotal,
          gross,
          costPrice,
          profit,
          paymentMethod: o.paymentMethod,
          isVoided: !!(o.isVoided || o.status === 'voided'),
          warehouse: item.warehouse?.name ?? '',
        });
      }
    }
    return rows;
  }, [orders]);

  // ── Derived ──
  const hasCostData = useMemo(
    () => allRows.some((r) => r.costPrice > 0),
    [allRows]
  );

  const cashiers = useMemo(
    () => Array.from(new Set(allRows.map((r) => r.cashier))).sort(),
    [allRows]
  );

  const cashierOptions = useMemo<SelectOption[]>(
    () => cashiers.map((c) => ({ value: c, label: c })),
    [cashiers]
  );

  // ── Status counts (distinct orders) ──
  const statusCounts = useMemo(() => {
    const seen = new Map<string, boolean>();
    for (const r of allRows) {
      if (!seen.has(r.orderId)) seen.set(r.orderId, r.isVoided);
    }
    let active = 0, voided = 0;
    seen.forEach((v) => { if (v) voided++; else active++; });
    return { all: seen.size, active, voided };
  }, [allRows]);

  // ── Filter base (before status filter) ──
  const filteredBase = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return allRows.filter((r) => {
      if (cashierFilter && r.cashier !== cashierFilter) return false;
      if (methodFilter && r.paymentMethod !== methodFilter) return false;
      if (dateFrom) {
        const startTs = toTsUtc(dateFrom, timeFrom);
        if (new Date(r.date).getTime() < startTs) return false;
      }
      if (dateTo) {
        const endTs = toTsUtc(dateTo, timeTo) + 59_000;
        if (new Date(r.date).getTime() > endTs) return false;
      }
      if (q) {
        const hit =
          r.product.toLowerCase().includes(q) ||
          r.variant.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          r.subcategory.toLowerCase().includes(q) ||
          r.brand.toLowerCase().includes(q) ||
          r.cashier.toLowerCase().includes(q) ||
          r.orderNumber.toLowerCase().includes(q) ||
          r.receiptNumber.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [allRows, cashierFilter, methodFilter, dateFrom, dateTo, timeFrom, timeTo, debouncedSearch]);

  // ── Active / Voided split ──
  const activeRows = useMemo(
    () => filteredBase.filter((r) => !r.isVoided),
    [filteredBase]
  );
  const voidedRows = useMemo(
    () => filteredBase.filter((r) => r.isVoided),
    [filteredBase]
  );

  // ── Status-filtered for table display ──
  const filtered = useMemo(() => {
    if (statusFilter === 'active') return activeRows;
    if (statusFilter === 'voided') return voidedRows;
    return filteredBase; // 'all'
  }, [filteredBase, activeRows, voidedRows, statusFilter]);

  // ── Sort (line view) ──
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[lineSortField] as string | number;
      const bv = b[lineSortField] as string | number;
      if (typeof av === 'number' && typeof bv === 'number')
        return lineSortDir === 'asc' ? av - bv : bv - av;
      return lineSortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [filtered, lineSortField, lineSortDir]);

  // ── Grouped ──
  const grouped = useMemo<GroupRow[]>(() => {
    const totalRev = filteredBase.reduce((s, r) => s + r.subtotal, 0);
    const map = new Map<string, { row: GroupRow; orderIds: Set<string> }>();

    for (const r of filteredBase) {
      const key =
        groupBy === 'product'
          ? r.product + (r.variant ? ` (${r.variant})` : '')
          : groupBy === 'variant'
            ? r.variant || '(no variant)'
            : groupBy === 'cashier'
              ? r.cashier
              : groupBy === 'payment_method'
                ? (METHOD_LABEL[r.paymentMethod] ?? r.paymentMethod)
                : groupBy === 'warehouse'
                  ? r.warehouse || 'No warehouse'
                  : fmtDate(r.date);

      const entry = map.get(key);
      if (entry) {
        entry.row.qty += r.qty;
        entry.row.gross += r.gross;
        entry.row.discount += r.discount;
        entry.row.revenue += r.subtotal;
        entry.row.profit += r.profit;
        entry.row.lineCount += 1;
        entry.orderIds.add(r.orderId);
      } else {
        map.set(key, {
          row: {
            key,
            qty: r.qty,
            gross: r.gross,
            discount: r.discount,
            revenue: r.subtotal,
            profit: r.profit,
            lineCount: 1,
            orderCount: 0,
            share: 0,
          },
          orderIds: new Set([r.orderId]),
        });
      }
    }

    return Array.from(map.values())
      .map(({ row, orderIds }) => ({
        ...row,
        orderCount: orderIds.size,
        share: totalRev > 0 ? (row.revenue / totalRev) * 100 : 0,
      }))
      .sort((a, b) => {
        const av = a[groupSortField] as number | string;
        const bv = b[groupSortField] as number | string;
        if (typeof av === 'number' && typeof bv === 'number')
          return groupSortDir === 'asc' ? av - bv : bv - av;
        return groupSortDir === 'asc'
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      });
  }, [filteredBase, groupBy, groupSortField, groupSortDir]);

  // ── Summary (FIX: computed from activeRows only, not including voided) ──
  const summary = useMemo<SalesSummary>(() => {
    const rows = activeRows;
    const revenue = rows.reduce((s, r) => s + r.subtotal, 0);
    const items = rows.reduce((s, r) => s + r.qty, 0);
    const discount = rows.reduce((s, r) => s + r.discount, 0);
    const gross = rows.reduce((s, r) => s + r.gross, 0);
    const profit = rows.reduce((s, r) => s + r.profit, 0);
    const orderIds = new Set(rows.map((r) => r.orderId));
    const cnt = orderIds.size;
    return {
      revenue, items, discount, gross, profit,
      orders: cnt,
      avgOrder: cnt > 0 ? revenue / cnt : 0,
    };
  }, [activeRows]);

  // ── Void summary (for the "All" tab) ──
  const voidSummary = useMemo<VoidSummary>(() => ({
    count: voidedRows.length,
    revenue: voidedRows.reduce((s, r) => s + r.subtotal, 0),
  }), [voidedRows]);

  // ── Distinct order count (memoized, FIX for grouped footer) ──
  const distinctOrderCount = useMemo(
    () => new Set(filteredBase.map((r) => r.orderId)).size,
    [filteredBase]
  );

  return {
    orders, allRows, filteredBase, activeRows, voidedRows,
    sorted, grouped, summary, voidSummary, statusCounts,
    hasCostData, cashiers, cashierOptions,
    loading, error, truncated,
    refetch, refetchAll,
    distinctOrderCount,
  };
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd /Users/mac/Documents/drinksharbour/client/apps/admin && npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 3: Commit**

```bash
cd /Users/mac/Documents/drinksharbour
git add client/apps/admin/src/app/shared/point-of-sale/sales-details/hooks/use-sales-data.ts
git commit -m "feat(pos): add useSalesData hook — fetch, flatten, filter, sort, group, summary with bug fixes"
```

---

### Task 5: Summary Strip Component

**Files:**
- Create: `client/apps/admin/src/app/shared/point-of-sale/sales-details/components/summary-strip.tsx`

**Interfaces:**
- Consumes: `SalesSummary`, `VoidSummary` types from Task 1; `formatCurrency` from existing utils
- Produces: `SummaryStrip` component

- [ ] **Step 1: Create `summary-strip.tsx`**

```tsx
'use client';

import {
  PiCurrencyNgn,
  PiShoppingCart,
  PiTag,
  PiRows,
  PiTrendUp,
  PiPercent,
} from 'react-icons/pi';
import { formatCurrency } from '@/app/shared/point-of-sale/utils';
import type { SalesSummary, VoidSummary, StatusFilter } from '../types';

interface SummaryStripProps {
  summary: SalesSummary;
  voidSummary: VoidSummary;
  hasCostData: boolean;
  filteredCount: number;
  statusFilter: StatusFilter;
}

export function SummaryStrip({
  summary,
  voidSummary,
  hasCostData,
  filteredCount,
  statusFilter,
}: SummaryStripProps) {
  const showVoidCard = statusFilter === 'all' && voidSummary.count > 0;
  const colCount = (hasCostData ? 6 : 5) + (showVoidCard ? 1 : 0);

  const cards = [
    {
      icon: PiCurrencyNgn,
      label: 'Gross Revenue',
      value: formatCurrency(summary.gross),
      sub: `−${formatCurrency(summary.discount)} disc.`,
      color: 'text-gray-400',
      bg: 'bg-gray-50',
    },
    {
      icon: PiTrendUp,
      label: 'Net Revenue',
      value: formatCurrency(summary.revenue),
      sub: 'after discounts',
      color: 'text-green-500',
      bg: 'bg-green-50',
    },
    {
      icon: PiTag,
      label: 'Total Discount',
      value: formatCurrency(summary.discount),
      sub:
        summary.gross > 0
          ? `${((summary.discount / summary.gross) * 100).toFixed(1)}% of gross`
          : '',
      color: 'text-orange-400',
      bg: 'bg-orange-50',
    },
    {
      icon: PiShoppingCart,
      label: 'Items Sold',
      value: summary.items.toLocaleString(),
      sub: `across ${filteredCount.toLocaleString()} lines`,
      color: 'text-blue-500',
      bg: 'bg-blue-50',
    },
    {
      icon: PiRows,
      label: 'Distinct Orders',
      value: summary.orders.toLocaleString(),
      sub: `avg ${formatCurrency(summary.avgOrder)} / order`,
      color: 'text-purple-500',
      bg: 'bg-purple-50',
    },
    ...(hasCostData
      ? [
          {
            icon: PiPercent,
            label: 'Est. Profit',
            value: formatCurrency(summary.profit),
            sub:
              summary.revenue > 0
                ? `${((summary.profit / summary.revenue) * 100).toFixed(1)}% margin`
                : '',
            color: 'text-teal-500',
            bg: 'bg-teal-50',
          },
        ]
      : []),
    ...(showVoidCard
      ? [
          {
            icon: PiRows,
            label: 'Voided',
            value: `${voidSummary.count} items`,
            sub: formatCurrency(voidSummary.revenue) + ' revenue',
            color: 'text-red-400',
            bg: 'bg-red-50',
          },
        ]
      : []),
  ];

  return (
    <div className="shrink-0 border-b border-gray-200 bg-white">
      <div
        className="grid divide-x divide-gray-100"
        style={{
          gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`,
        }}
      >
        {cards.map(({ icon: Icon, label, value, sub, color, bg }) => (
          <div key={label} className="flex items-center gap-3 px-4 py-3">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${bg}`}
            >
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-gray-400">{label}</p>
              <p className="text-sm font-semibold tabular-nums leading-tight text-gray-900">
                {value}
              </p>
              {sub && (
                <p className="text-[10px] tabular-nums text-gray-400">{sub}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation**

- [ ] **Step 3: Commit**

```bash
cd /Users/mac/Documents/drinksharbour
git add client/apps/admin/src/app/shared/point-of-sale/sales-details/components/summary-strip.tsx
git commit -m "feat(pos): add SummaryStrip component — KPI cards with void counter"
```

---

### Task 6: Control Bar Component

**Files:**
- Create: `client/apps/admin/src/app/shared/point-of-sale/sales-details/components/control-bar.tsx`

**Interfaces:**
- Consumes: all filter state from `useSalesFilters` (Task 3); `statusCounts`, `cashierOptions` from `useSalesData` (Task 4); `CustomSelect`, `DateTimeRange`, `FilterChip` from Task 2
- Produces: `ControlBar` component

- [ ] **Step 1: Create `control-bar.tsx`**

The control bar is the largest component (~280 lines). It composes the sticky header with three rows: status tabs + view controls, date presets + datetime range, field filters + search. It receives all filter state as props and calls setters directly.

Due to its size, create it in one step — it's a direct extraction from the current monolith lines 2424-2847, adapted to use props instead of local state.

```tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import {
  PiArrowsClockwise,
  PiMagnifyingGlass,
  PiCaretDown,
  PiList,
  PiRows,
  PiDownloadSimple,
  PiX,
} from 'react-icons/pi';
import { CustomSelect } from './custom-select';
import { DateTimeRange } from './date-time-range';
import { FilterChip } from './filter-chip';
import {
  DATE_PRESETS,
  GROUP_BY_OPTIONS,
  PAYMENT_OPTIONS,
  TOGGLEABLE_COLS,
} from '../constants';
import type {
  StatusFilter,
  ViewMode,
  GroupByKey,
  ToggleableCol,
  SelectOption,
} from '../types';

interface ControlBarProps {
  // Status
  statusFilter: StatusFilter;
  setStatusFilter: (s: StatusFilter) => void;
  statusCounts: { all: number; active: number; voided: number };
  // View
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  groupBy: GroupByKey;
  setGroupBy: (g: GroupByKey) => void;
  showProfit: boolean;
  setShowProfit: (v: boolean) => void;
  // Columns
  hiddenCols: Set<ToggleableCol>;
  toggleCol: (k: ToggleableCol) => void;
  vis: (k: ToggleableCol) => boolean;
  // Date
  dateFrom: string;
  setDateFrom: (v: string) => void;
  dateTo: string;
  setDateTo: (v: string) => void;
  timeFrom: string;
  setTimeFrom: (v: string) => void;
  timeTo: string;
  setTimeTo: (v: string) => void;
  activePreset: string;
  applyPreset: (p: (typeof DATE_PRESETS)[0]) => void;
  clearDateRange: () => void;
  // Filters
  cashierFilter: string;
  setCashierFilter: (v: string) => void;
  methodFilter: string;
  setMethodFilter: (v: string) => void;
  cashierOptions: SelectOption[];
  hasCostData: boolean;
  // Search
  search: string;
  setSearch: (v: string) => void;
  debouncedSearch: string;
  searchFocused: boolean;
  setSearchFocused: (v: boolean) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
  // Filter chips
  filterChips: { label: string; onRemove: () => void }[];
  clearAll: () => void;
  // Data context
  orderCount: number;
  filteredCount: number;
  allRowCount: number;
  truncated: boolean;
  loading: boolean;
  // Actions
  onRefresh: () => void;
  onFetchAll: () => void;
  // Export
  showExport: boolean;
  setShowExport: (v: boolean) => void;
  exportRef: React.RefObject<HTMLDivElement | null>;
  onExport: (fmt: 'csv' | 'excel' | 'pdf') => void;
  hasData: boolean;
}

export function ControlBar({
  statusFilter, setStatusFilter, statusCounts,
  viewMode, setViewMode, groupBy, setGroupBy,
  showProfit, setShowProfit,
  hiddenCols, toggleCol, vis,
  dateFrom, setDateFrom, dateTo, setDateTo,
  timeFrom, setTimeFrom, timeTo, setTimeTo,
  activePreset, applyPreset, clearDateRange,
  cashierFilter, setCashierFilter,
  methodFilter, setMethodFilter,
  cashierOptions, hasCostData,
  search, setSearch, debouncedSearch,
  searchFocused, setSearchFocused, searchRef,
  filterChips, clearAll,
  orderCount, filteredCount, allRowCount, truncated, loading,
  onRefresh, onFetchAll,
  showExport, setShowExport, exportRef, onExport, hasData,
}: ControlBarProps) {
  const [showColMenu, setShowColMenu] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showColMenu) return;
    function handler(e: MouseEvent) {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node))
        setShowColMenu(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColMenu]);

  return (
    <div className="sticky top-0 z-10 shrink-0 border-b border-gray-200 bg-white shadow-sm">
      {/* Row 1 — title · status tabs · actions */}
      <div className="flex h-14 items-center gap-4 px-5">
        <div className="flex min-w-0 shrink-0 flex-col justify-center">
          <h1 className="text-[15px] font-bold tracking-tight text-gray-900">
            Sales Details
          </h1>
          <p className="text-[11px] leading-none text-gray-400">
            {loading ? (
              'Loading…'
            ) : (
              <>
                {orderCount.toLocaleString()} orders
                {truncated && (
                  <> ·{' '}
                    <button
                      type="button"
                      onClick={onFetchAll}
                      className="text-[#b20202] underline hover:no-underline"
                    >
                      Load all
                    </button>
                  </>
                )}
                {filteredCount !== allRowCount && (
                  <> ·{' '}
                    <span className="font-medium text-gray-600">
                      {filteredCount.toLocaleString()} shown
                    </span>
                  </>
                )}
              </>
            )}
          </p>
        </div>

        {/* Centre: status tabs */}
        <div className="flex flex-1 items-center justify-center">
          <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-0.5">
            {(['all', 'active', 'voided'] as StatusFilter[]).map((s) => {
              const active = statusFilter === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`flex items-center gap-2 rounded-[10px] px-4 py-1.5 text-xs font-semibold transition-all ${
                    active
                      ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200/60'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {s === 'all' ? 'All' : s === 'active' ? 'Active' : 'Voided'}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums leading-none transition-colors ${
                      active
                        ? s === 'voided'
                          ? 'bg-red-100 text-red-600'
                          : 'bg-[#b20202]/10 text-[#b20202]'
                        : 'bg-gray-200 text-gray-400'
                    }`}
                  >
                    {statusCounts[s]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: view controls + actions */}
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            {(['lines', 'grouped'] as ViewMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setViewMode(m)}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all ${
                  viewMode === m
                    ? 'bg-[#b20202] text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {m === 'lines' ? (
                  <><PiList className="h-3.5 w-3.5" />Lines</>
                ) : (
                  <><PiRows className="h-3.5 w-3.5" />Grouped</>
                )}
              </button>
            ))}
          </div>

          {viewMode === 'grouped' && (
            <CustomSelect
              value={groupBy}
              onChange={(v) => setGroupBy((v || 'product') as GroupByKey)}
              options={GROUP_BY_OPTIONS}
              placeholder="Group by…"
              minWidth={120}
              required
            />
          )}

          <div className="mx-1 h-5 w-px bg-gray-200" />

          {/* Column picker */}
          <div className="relative" ref={colMenuRef}>
            <button
              type="button"
              onClick={() => setShowColMenu((v) => !v)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-[7px] text-xs font-medium transition-colors ${
                showColMenu || hiddenCols.size > 0
                  ? 'border-[#b20202]/40 bg-red-50 text-[#b20202]'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Columns
              {hiddenCols.size > 0 && (
                <span className="rounded-full bg-[#b20202] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                  {TOGGLEABLE_COLS.length - hiddenCols.size}/{TOGGLEABLE_COLS.length}
                </span>
              )}
            </button>
            {showColMenu && (
              <div className="absolute right-0 top-full z-50 mt-1.5 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl ring-1 ring-black/5">
                <div className="border-b border-gray-100 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Show / Hide columns
                  </p>
                </div>
                <div className="space-y-0.5 p-1.5">
                  {TOGGLEABLE_COLS.map((col) => (
                    <button
                      key={col.key}
                      type="button"
                      onClick={() => toggleCol(col.key)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-gray-50"
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold transition-all ${
                          vis(col.key)
                            ? 'border-[#b20202] bg-[#b20202] text-white'
                            : 'border-gray-300'
                        }`}
                      >
                        {vis(col.key) ? '✓' : ''}
                      </span>
                      <span
                        className={`text-xs ${vis(col.key) ? 'font-medium text-gray-800' : 'text-gray-400'}`}
                      >
                        {col.label}
                      </span>
                    </button>
                  ))}
                </div>
                {hiddenCols.size > 0 && (
                  <div className="border-t border-gray-100 p-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        /* clear all hidden — caller handles via setHiddenCols(new Set()) */
                      }}
                      className="w-full rounded-lg px-2 py-1.5 text-xs font-semibold text-[#b20202] transition-colors hover:bg-red-50"
                    >
                      Show all columns
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mx-1 h-5 w-px bg-gray-200" />

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-[7px] text-xs text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <PiArrowsClockwise className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {/* Export dropdown */}
          <div className="relative" ref={exportRef}>
            <button
              type="button"
              onClick={() => setShowExport((v) => !v)}
              disabled={!hasData}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-[7px] text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 ${
                showExport
                  ? 'bg-[#9a0101] text-white'
                  : 'bg-[#b20202] text-white hover:bg-[#9a0101]'
              }`}
            >
              <PiDownloadSimple className="h-3.5 w-3.5" />
              Export
              <PiCaretDown className={`h-3 w-3 opacity-70 transition-transform duration-150 ${showExport ? 'rotate-180' : ''}`} />
            </button>
            {showExport && (
              <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl ring-1 ring-black/5">
                <div className="border-b border-gray-100 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Export as</p>
                </div>
                <div className="space-y-0.5 p-1.5">
                  {([
                    { fmt: 'csv' as const, label: 'CSV', sub: '.csv' },
                    { fmt: 'excel' as const, label: 'Excel', sub: '.xlsx' },
                    { fmt: 'pdf' as const, label: 'PDF', sub: '.pdf' },
                  ]).map(({ fmt, label, sub }) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => onExport(fmt)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-gray-700 transition-colors hover:bg-red-50 hover:text-[#b20202]"
                    >
                      <span className="flex-1 font-medium">{label}</span>
                      <span className="text-[10px] text-gray-400">{sub}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 2 — date presets + datetime range */}
      <div className="flex items-center gap-3 border-t border-gray-100 bg-gray-50/60 px-5 py-2">
        {DATE_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => applyPreset(preset)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-all ${
              activePreset === preset.label
                ? 'bg-[#b20202] text-white shadow-sm'
                : 'border border-gray-200 bg-white text-gray-600 hover:border-[#b20202] hover:text-[#b20202]'
            }`}
          >
            {preset.label}
          </button>
        ))}
        <div className="mx-1 h-5 w-px shrink-0 bg-gray-200" />
        <DateTimeRange
          dateFrom={dateFrom}
          dateTo={dateTo}
          timeFrom={timeFrom}
          timeTo={timeTo}
          onDateFrom={(v) => { setDateFrom(v); /* clear preset externally */ }}
          onDateTo={(v) => { setDateTo(v); /* clear preset externally */ }}
          onTimeFrom={setTimeFrom}
          onTimeTo={setTimeTo}
          onClear={clearDateRange}
        />
      </div>

      {/* Row 3 — field filters + search */}
      <div className="flex items-center gap-2 border-t border-gray-100 px-5 py-2">
        <CustomSelect
          value={cashierFilter}
          onChange={setCashierFilter}
          options={cashierOptions}
          placeholder="All cashiers"
          minWidth={140}
        />
        <CustomSelect
          value={methodFilter}
          onChange={setMethodFilter}
          options={PAYMENT_OPTIONS}
          placeholder="All payments"
          minWidth={140}
        />
        {hasCostData && (
          <label className="flex cursor-pointer select-none items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-50">
            <input
              type="checkbox"
              checked={showProfit}
              onChange={(e) => setShowProfit(e.target.checked)}
              className="accent-[#b20202]"
            />
            Show profit
          </label>
        )}
        {filterChips.length > 0 && (
          <div className="ml-1 flex items-center gap-1.5">
            {filterChips.map((chip) => (
              <FilterChip key={chip.label} label={chip.label} onRemove={chip.onRemove} />
            ))}
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <div className={`relative transition-all duration-200 ${searchFocused || search ? 'w-72' : 'w-56'}`}>
            <PiMagnifyingGlass
              className={`absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 transition-colors duration-150 ${
                searchFocused ? 'text-[#b20202]' : 'text-gray-400'
              }`}
            />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search product, cashier, order #…"
              className={`w-full rounded-lg border py-1.5 pl-8 text-sm outline-none transition-all duration-150 ${
                search
                  ? 'border-[#b20202]/50 bg-red-50/40 pr-14 text-gray-800 ring-2 ring-[#b20202]/10'
                  : searchFocused
                    ? 'border-[#b20202] bg-white pr-8 ring-2 ring-[#b20202]/10'
                    : 'border-gray-200 bg-white pr-16 hover:border-gray-300'
              }`}
            />
            {debouncedSearch && (
              <span className="absolute right-7 top-1/2 -translate-y-1/2 rounded-full bg-[#b20202]/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[#b20202]">
                {filteredCount}
              </span>
            )}
            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              >
                <PiX className="h-3.5 w-3.5" />
              </button>
            ) : !searchFocused ? (
              <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[9px] leading-none text-gray-300">
                ⌘K
              </kbd>
            ) : null}
          </div>
          {(filterChips.length > 0 || cashierFilter || methodFilter || statusFilter !== 'active') && (
            <button
              type="button"
              onClick={clearAll}
              className="flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-[#b20202] transition-colors hover:bg-red-100"
            >
              <PiX className="h-3.5 w-3.5" />
              Clear all
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation**

- [ ] **Step 3: Commit**

```bash
cd /Users/mac/Documents/drinksharbour
git add client/apps/admin/src/app/shared/point-of-sale/sales-details/components/control-bar.tsx
git commit -m "feat(pos): add ControlBar component — sticky header with filters, search, actions"
```

---

### Task 7: Lines Table Component

**Files:**
- Create: `client/apps/admin/src/app/shared/point-of-sale/sales-details/components/lines-table.tsx`

**Interfaces:**
- Consumes: `LineRow`, `LineSortField`, `ToggleableCol` types; `SortChevron` from Task 2; `highlight` from Task 3 helpers; `formatCurrency` from existing utils; `METHOD_COLOR`, `METHOD_LABEL`, `PAGE_SIZE` from constants
- Produces: `LinesTable` component

- [ ] **Step 1: Create `lines-table.tsx`**

Extract from current monolith lines 2981-3401. The table renders `paginated` rows (already sliced by the hook), with dynamic columns, sort headers, search highlights, voided row dimming, and a footer with column totals.

Also include a small `PageBar` sub-component (extracted from current lines 1618-1684) — or import it if created separately. For simplicity, include `PageBar` inline in this file since it's only used by the two table components.

```tsx
'use client';

import type { LineRow, LineSortField, ToggleableCol } from '../types';
import { SortChevron } from './sort-chevron';
import { highlight } from '../helpers';
import { formatCurrency } from '@/app/shared/point-of-sale/utils';
import { METHOD_COLOR, METHOD_LABEL, PAGE_SIZE } from '../constants';

// ── PageBar (shared by lines and grouped tables) ──
export function PageBar({
  page, totalPages, totalItems, pageSize, onPrev, onNext, onPage,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPrev: () => void;
  onNext: () => void;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  const start = Math.min((page - 1) * pageSize + 1, totalItems);
  const end = Math.min(page * pageSize, totalItems);
  const pages = Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
    if (totalPages <= 7) return i + 1;
    if (page <= 4) return i + 1;
    if (page >= totalPages - 3) return totalPages - 6 + i;
    return page - 3 + i;
  });
  return (
    <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2.5">
      <p className="text-xs text-gray-500">
        {start.toLocaleString()}–{end.toLocaleString()} of {totalItems.toLocaleString()}
      </p>
      <div className="flex items-center gap-1">
        <button type="button" onClick={onPrev} disabled={page === 1}
          className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M10.354 3.354a.5.5 0 00-.708-.708l-5 5a.5.5 0 000 .708l5 5a.5.5 0 00.708-.708L5.707 8l4.647-4.646z"/></svg>
        </button>
        {pages.map((p) => (
          <button key={p} type="button" onClick={() => onPage(p)}
            className={`min-w-[30px] rounded-lg border px-2 py-1 text-xs font-medium transition-colors ${
              page === p
                ? 'border-[#b20202] bg-[#b20202] text-white'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            {p}
          </button>
        ))}
        <button type="button" onClick={onNext} disabled={page === totalPages}
          className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M5.646 3.354a.5.5 0 01.708-.708l5 5a.5.5 0 010 .708l-5 5a.5.5 0 01-.708-.708L10.293 8 5.646 3.354z"/></svg>
        </button>
      </div>
    </div>
  );
}

interface LinesTableProps {
  rows: LineRow[];
  sorted: LineRow[];
  hasCostData: boolean;
  hiddenCols: Set<ToggleableCol>;
  lineSortField: LineSortField;
  lineSortDir: 'asc' | 'desc';
  toggleLineSort: (f: LineSortField) => void;
  vis: (k: ToggleableCol) => boolean;
  debouncedSearch: string;
  showProfit: boolean;
  page: number;
  setPage: (p: number) => void;
  allRowCount: number;
}

export function LinesTable({
  rows, sorted, hasCostData, hiddenCols,
  lineSortField, lineSortDir, toggleLineSort, vis,
  debouncedSearch, showProfit, page, setPage, allRowCount,
}: LinesTableProps) {
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = rows; // already sliced by caller

  const thClass = (field: LineSortField, align: 'left' | 'center' | 'right' = 'left') => {
    const alignClass = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';
    return `cursor-pointer select-none whitespace-nowrap px-4 py-3 ${alignClass} hover:text-gray-700`;
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <th onClick={() => toggleLineSort('date')} className={thClass('date')}>
                <span className="inline-flex items-center gap-1">Date/Time <SortChevron active={lineSortField === 'date'} dir={lineSortDir} /></span>
              </th>
              {vis('orderNumber') && (
                <th onClick={() => toggleLineSort('orderNumber')} className={thClass('orderNumber')}>
                  <span className="inline-flex items-center gap-1">Order # <SortChevron active={lineSortField === 'orderNumber'} dir={lineSortDir} /></span>
                </th>
              )}
              {vis('cashier') && (
                <th onClick={() => toggleLineSort('cashier')} className={thClass('cashier')}>
                  <span className="inline-flex items-center gap-1">Cashier <SortChevron active={lineSortField === 'cashier'} dir={lineSortDir} /></span>
                </th>
              )}
              <th onClick={() => toggleLineSort('product')} className={thClass('product')}>
                <span className="inline-flex items-center gap-1">Product <SortChevron active={lineSortField === 'product'} dir={lineSortDir} /></span>
              </th>
              {vis('variant') && (
                <th onClick={() => toggleLineSort('variant')} className={thClass('variant')}>
                  <span className="inline-flex items-center gap-1">Variant <SortChevron active={lineSortField === 'variant'} dir={lineSortDir} /></span>
                </th>
              )}
              {vis('category') && (
                <th onClick={() => toggleLineSort('category')} className={thClass('category')}>
                  <span className="inline-flex items-center gap-1">Category <SortChevron active={lineSortField === 'category'} dir={lineSortDir} /></span>
                </th>
              )}
              {vis('subcategory') && (
                <th onClick={() => toggleLineSort('subcategory')} className={thClass('subcategory')}>
                  <span className="inline-flex items-center gap-1">Subcategory <SortChevron active={lineSortField === 'subcategory'} dir={lineSortDir} /></span>
                </th>
              )}
              {vis('brand') && (
                <th onClick={() => toggleLineSort('brand')} className={thClass('brand')}>
                  <span className="inline-flex items-center gap-1">Brand <SortChevron active={lineSortField === 'brand'} dir={lineSortDir} /></span>
                </th>
              )}
              <th className="whitespace-nowrap px-4 py-3 text-left">Warehouse</th>
              <th onClick={() => toggleLineSort('qty')} className={thClass('qty', 'center')}>
                <span className="inline-flex items-center justify-center gap-1">Qty <SortChevron active={lineSortField === 'qty'} dir={lineSortDir} /></span>
              </th>
              {vis('unitPrice') && (
                <th onClick={() => toggleLineSort('unitPrice')} className={thClass('unitPrice', 'right')}>
                  <span className="inline-flex items-center gap-1">Unit Price <SortChevron active={lineSortField === 'unitPrice'} dir={lineSortDir} /></span>
                </th>
              )}
              {vis('gross') && (
                <th onClick={() => toggleLineSort('gross')} className={thClass('gross', 'right')}>
                  <span className="inline-flex items-center gap-1">Gross <SortChevron active={lineSortField === 'gross'} dir={lineSortDir} /></span>
                </th>
              )}
              {vis('discount') && (
                <th onClick={() => toggleLineSort('discount')} className={thClass('discount', 'right')}>
                  <span className="inline-flex items-center gap-1">Discount <SortChevron active={lineSortField === 'discount'} dir={lineSortDir} /></span>
                </th>
              )}
              <th onClick={() => toggleLineSort('subtotal')} className={thClass('subtotal', 'right')}>
                <span className="inline-flex items-center gap-1">Net Total <SortChevron active={lineSortField === 'subtotal'} dir={lineSortDir} /></span>
              </th>
              {showProfit && hasCostData && (
                <th onClick={() => toggleLineSort('profit')} className={thClass('profit', 'right')}>
                  <span className="inline-flex items-center gap-1">Profit <SortChevron active={lineSortField === 'profit'} dir={lineSortDir} /></span>
                </th>
              )}
              {vis('payment') && (
                <th onClick={() => toggleLineSort('paymentMethod')} className={thClass('paymentMethod')}>
                  <span className="inline-flex items-center gap-1">Payment <SortChevron active={lineSortField === 'paymentMethod'} dir={lineSortDir} /></span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-20 text-center">
                  <p className="text-sm font-medium text-gray-400">
                    {allRowCount === 0 ? 'No sales data found.' : 'No line items match the current filters.'}
                  </p>
                </td>
              </tr>
            ) : (
              paginated.map((row, i) => (
                <tr
                  key={`${row.orderId}-${i}`}
                  className={`border-b border-gray-50 transition-colors hover:bg-blue-50/20 ${
                    i % 2 === 1 ? 'bg-gray-50/30' : ''
                  } ${row.isVoided ? 'opacity-40' : ''}`}
                >
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-gray-500">
                    {new Date(row.date).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  {vis('orderNumber') && (
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <span className="font-mono text-xs font-semibold text-gray-800">
                        {highlight(row.orderNumber, debouncedSearch)}
                      </span>
                      {row.isVoided && (
                        <span className="ml-1.5 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">VOID</span>
                      )}
                    </td>
                  )}
                  {vis('cashier') && (
                    <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-600">
                      {highlight(row.cashier, debouncedSearch)}
                    </td>
                  )}
                  <td className="max-w-[200px] truncate px-4 py-2.5 font-medium text-gray-900">
                    {highlight(row.product, debouncedSearch)}
                  </td>
                  {vis('variant') && (
                    <td className="px-4 py-2.5 text-sm text-gray-500">
                      {row.variant ? highlight(row.variant, debouncedSearch) : <span className="text-gray-300">—</span>}
                    </td>
                  )}
                  {vis('category') && (
                    <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-500">
                      {row.category ? highlight(row.category, debouncedSearch) : <span className="text-gray-300">—</span>}
                    </td>
                  )}
                  {vis('subcategory') && (
                    <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-500">
                      {row.subcategory ? highlight(row.subcategory, debouncedSearch) : <span className="text-gray-300">—</span>}
                    </td>
                  )}
                  {vis('brand') && (
                    <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-500">
                      {row.brand ? highlight(row.brand, debouncedSearch) : <span className="text-gray-300">—</span>}
                    </td>
                  )}
                  <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-600">
                    {row.warehouse || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-center text-sm font-medium tabular-nums text-gray-700">
                    {row.qty}
                  </td>
                  {vis('unitPrice') && (
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums text-gray-600">
                      {formatCurrency(row.unitPrice)}
                    </td>
                  )}
                  {vis('gross') && (
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums text-gray-500">
                      {formatCurrency(row.gross)}
                    </td>
                  )}
                  {vis('discount') && (
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums">
                      {row.discount > 0 ? (
                        <span className="text-orange-500">−{formatCurrency(row.discount)}</span>
                      ) : (
                        <span className="text-gray-200">—</span>
                      )}
                    </td>
                  )}
                  <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums text-gray-900">
                    {formatCurrency(row.subtotal)}
                  </td>
                  {showProfit && hasCostData && (
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums">
                      {row.profit > 0 ? (
                        <span className="font-medium text-teal-600">{formatCurrency(row.profit)}</span>
                      ) : (
                        <span className="text-gray-200">—</span>
                      )}
                    </td>
                  )}
                  {vis('payment') && (
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${METHOD_COLOR[row.paymentMethod] ?? 'border border-gray-200 bg-gray-100 text-gray-600'}`}>
                        {METHOD_LABEL[row.paymentMethod] ?? row.paymentMethod}
                      </span>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
          {sorted.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50 text-xs font-semibold">
                <td colSpan={1 + (vis('orderNumber') ? 1 : 0) + (vis('cashier') ? 1 : 0) + 1 + (vis('variant') ? 1 : 0) + (vis('category') ? 1 : 0) + (vis('subcategory') ? 1 : 0) + (vis('brand') ? 1 : 0)}
                  className="px-4 py-3 text-gray-400">
                  {sorted.length.toLocaleString()} line{sorted.length !== 1 ? 's' : ''}
                </td>
                <td className="px-4 py-3 text-center tabular-nums text-gray-700">
                  {sorted.reduce((s, r) => s + r.qty, 0).toLocaleString()}
                </td>
                {vis('unitPrice') && <td className="px-4 py-3" />}
                {vis('gross') && (
                  <td className="px-4 py-3 text-right tabular-nums text-gray-500">
                    {formatCurrency(sorted.reduce((s, r) => s + r.gross, 0))}
                  </td>
                )}
                {vis('discount') && (
                  <td className="px-4 py-3 text-right tabular-nums text-orange-500">
                    −{formatCurrency(sorted.reduce((s, r) => s + r.discount, 0))}
                  </td>
                )}
                <td className="px-4 py-3 text-right tabular-nums text-[#b20202]">
                  {formatCurrency(sorted.reduce((s, r) => s + r.subtotal, 0))}
                </td>
                {showProfit && hasCostData && (
                  <td className="px-4 py-3 text-right tabular-nums text-teal-600">
                    {formatCurrency(sorted.reduce((s, r) => s + r.profit, 0))}
                  </td>
                )}
                {vis('payment') && <td className="px-4 py-3" />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <PageBar
        page={page}
        totalPages={totalPages}
        totalItems={sorted.length}
        pageSize={PAGE_SIZE}
        onPrev={() => setPage(Math.max(1, page - 1))}
        onNext={() => setPage(Math.min(totalPages, page + 1))}
        onPage={setPage}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation**

- [ ] **Step 3: Commit**

```bash
cd /Users/mac/Documents/drinksharbour
git add client/apps/admin/src/app/shared/point-of-sale/sales-details/components/lines-table.tsx
git commit -m "feat(pos): add LinesTable component — sortable table with pagination"
```

---

### Task 8: Grouped Table Component

**Files:**
- Create: `client/apps/admin/src/app/shared/point-of-sale/sales-details/components/grouped-table.tsx`

**Interfaces:**
- Consumes: `GroupRow`, `GroupSortField` types; `SortChevron`, `PageBar` from Tasks 2/7; `highlight` from helpers; `formatCurrency` from utils
- Produces: `GroupedTable` component

- [ ] **Step 1: Create `grouped-table.tsx`**

Extract from current monolith lines 3404-3613. Uses `PageBar` from Task 7.

```tsx
'use client';

import type { GroupRow, GroupSortField } from '../types';
import { SortChevron } from './sort-chevron';
import { PageBar } from './lines-table';
import { highlight } from '../helpers';
import { formatCurrency } from '@/app/shared/point-of-sale/utils';
import { GROUP_PAGE_SIZE } from '../constants';

interface GroupedTableProps {
  rows: GroupRow[];
  grouped: GroupRow[];
  groupLabel: string;
  hasCostData: boolean;
  showProfit: boolean;
  groupSortField: GroupSortField;
  groupSortDir: 'asc' | 'desc';
  toggleGroupSort: (f: GroupSortField) => void;
  debouncedSearch: string;
  groupPage: number;
  setGroupPage: (p: number) => void;
  distinctOrderCount: number;
  allRowCount: number;
}

export function GroupedTable({
  rows, grouped, groupLabel, hasCostData, showProfit,
  groupSortField, groupSortDir, toggleGroupSort,
  debouncedSearch, groupPage, setGroupPage,
  distinctOrderCount, allRowCount,
}: GroupedTableProps) {
  const totalPages = Math.max(1, Math.ceil(grouped.length / GROUP_PAGE_SIZE));

  const cols: { field: GroupSortField; label: string; align: 'text-left' | 'text-center' | 'text-right' }[] = [
    { field: 'key', label: groupLabel, align: 'text-left' },
    { field: 'qty', label: 'Qty Sold', align: 'text-center' },
    { field: 'gross', label: 'Gross Revenue', align: 'text-right' },
    { field: 'discount', label: 'Discount', align: 'text-right' },
    { field: 'revenue', label: 'Net Revenue', align: 'text-right' },
    ...(showProfit && hasCostData ? [{ field: 'profit' as GroupSortField, label: 'Profit', align: 'text-right' as const }] : []),
    { field: 'share', label: 'Revenue Share', align: 'text-left' as const },
    { field: 'lineCount', label: 'Lines', align: 'text-center' as const },
    { field: 'orderCount', label: 'Orders', align: 'text-center' as const },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {cols.map(({ field, label, align }) => (
                <th
                  key={field}
                  onClick={() => toggleGroupSort(field)}
                  className={`cursor-pointer select-none whitespace-nowrap px-4 py-3 ${align} hover:text-gray-700`}
                >
                  <span className="inline-flex items-center gap-1">
                    {label}
                    <SortChevron active={groupSortField === field} dir={groupSortDir} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-20 text-center text-sm text-gray-400">
                  {allRowCount === 0 ? 'No sales data found.' : 'No data matches the current filters.'}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={row.key}
                  className={`border-b border-gray-50 transition-colors hover:bg-blue-50/20 ${i % 2 === 1 ? 'bg-gray-50/30' : ''}`}
                >
                  <td className="max-w-[240px] truncate px-4 py-2.5 font-medium text-gray-900">
                    {highlight(row.key, debouncedSearch)}
                  </td>
                  <td className="px-4 py-2.5 text-center tabular-nums text-gray-700">
                    {row.qty.toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-gray-500">
                    {formatCurrency(row.gross)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
                    {row.discount > 0 ? (
                      <span className="text-orange-500">−{formatCurrency(row.discount)}</span>
                    ) : (
                      <span className="text-gray-200">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums text-gray-900">
                    {formatCurrency(row.revenue)}
                  </td>
                  {showProfit && hasCostData && (
                    <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
                      {row.profit > 0 ? (
                        <span className="font-medium text-teal-600">{formatCurrency(row.profit)}</span>
                      ) : (
                        <span className="text-gray-200">—</span>
                      )}
                    </td>
                  )}
                  <td className="min-w-[160px] px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-[#b20202] transition-all"
                          style={{ width: `${Math.min(100, row.share)}%` }}
                        />
                      </div>
                      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-gray-500">
                        {row.share.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-center tabular-nums text-gray-500">
                    {row.lineCount}
                  </td>
                  <td className="px-4 py-2.5 text-center tabular-nums text-gray-500">
                    {row.orderCount}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {grouped.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50 text-xs font-semibold">
                <td className="px-4 py-3 text-gray-400">
                  {grouped.length} group{grouped.length !== 1 ? 's' : ''}
                </td>
                <td className="px-4 py-3 text-center tabular-nums text-gray-700">
                  {grouped.reduce((s, r) => s + r.qty, 0).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-500">
                  {formatCurrency(grouped.reduce((s, r) => s + r.gross, 0))}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-orange-500">
                  −{formatCurrency(grouped.reduce((s, r) => s + r.discount, 0))}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-[#b20202]">
                  {formatCurrency(grouped.reduce((s, r) => s + r.revenue, 0))}
                </td>
                {showProfit && hasCostData && (
                  <td className="px-4 py-3 text-right tabular-nums text-teal-600">
                    {formatCurrency(grouped.reduce((s, r) => s + r.profit, 0))}
                  </td>
                )}
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-center tabular-nums text-gray-700">
                  {grouped.reduce((s, r) => s + r.lineCount, 0).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-center tabular-nums text-gray-700">
                  {distinctOrderCount.toLocaleString()}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <PageBar
        page={groupPage}
        totalPages={totalPages}
        totalItems={grouped.length}
        pageSize={GROUP_PAGE_SIZE}
        onPrev={() => setGroupPage(Math.max(1, groupPage - 1))}
        onNext={() => setGroupPage(Math.min(totalPages, groupPage + 1))}
        onPage={setGroupPage}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation**

- [ ] **Step 3: Commit**

```bash
cd /Users/mac/Documents/drinksharbour
git add client/apps/admin/src/app/shared/point-of-sale/sales-details/components/grouped-table.tsx
git commit -m "feat(pos): add GroupedTable component — aggregated view with revenue share bars"
```

---

### Task 9: Export Modules (CSV, Excel, PDF)

**Files:**
- Create: `client/apps/admin/src/app/shared/point-of-sale/sales-details/export/csv.ts`
- Create: `client/apps/admin/src/app/shared/point-of-sale/sales-details/export/excel.ts`
- Create: `client/apps/admin/src/app/shared/point-of-sale/sales-details/export/pdf.ts`

**Interfaces:**
- Consumes: `LineRow`, `GroupRow`, `LineExportCol`, `GroupExportCol`, `PdfMeta`, `StatusFilter` types from Task 1; `LINE_EXPORT_COLS`, `GROUP_EXPORT_COLS`, `METHOD_LABEL` from Task 2 constants; `fmtDateTime` from Task 3 helpers; `formatCurrency` from existing utils
- Produces: `exportLineCsv`, `exportGroupedCsv`, `exportLineExcel`, `exportGroupedExcel`, `exportLinePdf`, `exportGroupedPdf` functions

- [ ] **Step 1: Create `export/csv.ts`**

Direct extraction of `getLineCell`, `getGroupCell`, `triggerCsvDownload`, `exportLineCsv`, `exportGroupedCsv` from current monolith lines 471-689. Import types and constants from the new modules.

- [ ] **Step 2: Create `export/excel.ts`**

Direct extraction of `getLineCellExcel`, `getGroupCellExcel`, `exportLineExcel`, `exportGroupedExcel` from current monolith lines 542-721.

- [ ] **Step 3: Create `export/pdf.ts`**

Direct extraction of all PDF drawing functions from current monolith lines 723-1319: `drawPdf1Header`, `drawPdfMiniHeader`, `addPdfPageFooters`, `drawPdfSummarySection`, `exportLinePdf`, `exportGroupedPdf`, and all color constants (`BRAND_RGB`, `GRAY_DARK`, etc.).

This is the largest export file (~400 lines) but each function is focused and self-contained.

- [ ] **Step 4: Verify compilation**

- [ ] **Step 5: Commit**

```bash
cd /Users/mac/Documents/drinksharbour
git add client/apps/admin/src/app/shared/point-of-sale/sales-details/export/
git commit -m "feat(pos): add export modules — CSV, Excel, PDF extraction"
```

---

### Task 10: `use-sales-export` Hook + Export Column Modal

**Files:**
- Create: `client/apps/admin/src/app/shared/point-of-sale/sales-details/hooks/use-sales-export.ts`
- Create: `client/apps/admin/src/app/shared/point-of-sale/sales-details/components/export-column-modal.tsx`

**Interfaces:**
- Consumes: `LineExportCol`, `GroupExportCol`, `PdfMeta` types; `LINE_EXPORT_COLS`, `GROUP_EXPORT_COLS` constants; all export functions from Task 9; `formatCurrency` from utils
- Produces: `useSalesExport` hook; `ExportColumnModal` component

- [ ] **Step 1: Create `export-column-modal.tsx`**

Direct extraction from current monolith lines 1686-1846.

- [ ] **Step 2: Create `use-sales-export.ts`**

Extract export state management from current monolith lines 1900-1910, 2332-2419.

```ts
'use client';

import { useState, useCallback } from 'react';
import type { LineRow, GroupRow, LineExportCol, GroupExportCol, SalesSummary, StatusFilter } from '../types';
import { LINE_EXPORT_COLS, GROUP_EXPORT_COLS } from '../constants';
import { exportLineCsv, exportGroupedCsv } from '../export/csv';
import { exportLineExcel, exportGroupedExcel } from '../export/excel';
import { exportLinePdf, exportGroupedPdf } from '../export/pdf';

interface UseSalesExportParams {
  sorted: LineRow[];
  grouped: GroupRow[];
  groupLabel: string;
  hasCostData: boolean;
  showProfit: boolean;
  viewMode: 'lines' | 'grouped';
  summary: SalesSummary;
  dateFrom: string;
  dateTo: string;
  timeFrom: string;
  timeTo: string;
  cashierFilter: string;
  methodFilter: string;
  statusFilter: StatusFilter;
  storeName: string;
}

export function useSalesExport(params: UseSalesExportParams) {
  const [showExport, setShowExport] = useState(false);
  const [exportDialog, setExportDialog] = useState({
    open: false,
    format: 'csv' as 'csv' | 'excel' | 'pdf',
    lineCols: new Set(LINE_EXPORT_COLS.map((c) => c.key)) as Set<LineExportCol>,
    groupCols: new Set(GROUP_EXPORT_COLS.map((c) => c.key)) as Set<GroupExportCol>,
  });

  const handleExport = useCallback((fmt: 'csv' | 'excel' | 'pdf') => {
    setShowExport(false);
    setExportDialog((prev) => ({ ...prev, open: true, format: fmt }));
  }, []);

  const toggleExportLineCol = useCallback((key: LineExportCol) => {
    if (LINE_EXPORT_COLS.find((c) => c.key === key)?.required) return;
    setExportDialog((prev) => {
      const next = new Set(prev.lineCols);
      next.has(key) ? next.delete(key) : next.add(key);
      return { ...prev, lineCols: next };
    });
  }, []);

  const toggleExportGroupCol = useCallback((key: GroupExportCol) => {
    if (GROUP_EXPORT_COLS.find((c) => c.key === key)?.required) return;
    setExportDialog((prev) => {
      const next = new Set(prev.groupCols);
      next.has(key) ? next.delete(key) : next.add(key);
      return { ...prev, groupCols: next };
    });
  }, []);

  const selectAllExportCols = useCallback(() => {
    const hc = params.hasCostData && params.showProfit;
    if (params.viewMode === 'grouped') {
      setExportDialog((prev) => ({
        ...prev,
        groupCols: new Set(GROUP_EXPORT_COLS.filter((c) => hc || !c.costOnly).map((c) => c.key)),
      }));
    } else {
      setExportDialog((prev) => ({
        ...prev,
        lineCols: new Set(LINE_EXPORT_COLS.filter((c) => hc || !c.costOnly).map((c) => c.key)),
      }));
    }
  }, [params.hasCostData, params.showProfit, params.viewMode]);

  const deselectAllExportCols = useCallback(() => {
    if (params.viewMode === 'grouped') {
      setExportDialog((prev) => ({
        ...prev,
        groupCols: new Set(GROUP_EXPORT_COLS.filter((c) => c.required).map((c) => c.key)),
      }));
    } else {
      setExportDialog((prev) => ({
        ...prev,
        lineCols: new Set(LINE_EXPORT_COLS.filter((c) => c.required).map((c) => c.key)),
      }));
    }
  }, [params.viewMode]);

  const confirmExport = useCallback(() => {
    const hasCost = params.hasCostData && params.showProfit;
    const pdfMeta = {
      dateFrom: params.dateFrom, dateTo: params.dateTo,
      timeFrom: params.timeFrom, timeTo: params.timeTo,
      cashierFilter: params.cashierFilter, methodFilter: params.methodFilter,
      statusFilter: params.statusFilter, storeName: params.storeName,
      summary: params.summary,
    };
    const { format: fmt, lineCols, groupCols } = exportDialog;
    setExportDialog((prev) => ({ ...prev, open: false }));
    if (params.viewMode === 'grouped') {
      if (fmt === 'csv') exportGroupedCsv(params.grouped, params.groupLabel, groupCols);
      if (fmt === 'excel') exportGroupedExcel(params.grouped, params.groupLabel, groupCols);
      if (fmt === 'pdf') exportGroupedPdf(params.grouped, params.groupLabel, hasCost, pdfMeta, groupCols);
    } else {
      if (fmt === 'csv') exportLineCsv(params.sorted, lineCols);
      if (fmt === 'excel') exportLineExcel(params.sorted, lineCols);
      if (fmt === 'pdf') exportLinePdf(params.sorted, hasCost, pdfMeta, lineCols);
    }
  }, [params, exportDialog]);

  return {
    showExport, setShowExport, exportDialog,
    handleExport, confirmExport,
    toggleExportLineCol, toggleExportGroupCol,
    selectAllExportCols, deselectAllExportCols,
  };
}
```

- [ ] **Step 3: Verify compilation**

- [ ] **Step 4: Commit**

```bash
cd /Users/mac/Documents/drinksharbour
git add client/apps/admin/src/app/shared/point-of-sale/sales-details/hooks/use-sales-export.ts \
        client/apps/admin/src/app/shared/point-of-sale/sales-details/components/export-column-modal.tsx
git commit -m "feat(pos): add useSalesExport hook + ExportColumnModal component"
```

---

### Task 11: Orchestrator + Wire Up

**Files:**
- Create: `client/apps/admin/src/app/shared/point-of-sale/sales-details/index.tsx`
- Modify: `client/apps/admin/src/app/shared/point-of-sale/pos-sales-details.tsx` (replace with re-export)
- Verify: `client/apps/admin/src/app/point-of-sale/sales-details/page.tsx` still works

**Interfaces:**
- Consumes: all hooks (Tasks 3, 4, 10) and all components (Tasks 2, 5, 6, 7, 8, 18)
- Produces: `POSSalesDetails` default export

- [ ] **Step 1: Create `index.tsx`**

```tsx
'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useTenant } from '@/context/TenantContext';
import POSNavHeader from '@/app/shared/point-of-sale/pos-nav-header';
import { ShopHistorySelector } from '../components/shop-history-selector';
import { historyAccess } from '../shop-entry';
import { usePOSAuth, usePOSShopScope } from '../store';
import { isTokenExpired } from './helpers';
import { useSalesFilters } from './hooks/use-sales-filters';
import { useSalesData } from './hooks/use-sales-data';
import { useSalesExport } from './hooks/use-sales-export';
import { ControlBar } from './components/control-bar';
import { SummaryStrip } from './components/summary-strip';
import { LinesTable } from './components/lines-table';
import { GroupedTable } from './components/grouped-table';
import { ExportColumnModal } from './components/export-column-modal';

export default function POSSalesDetails() {
  const { token: posToken } = usePOSAuth();
  const { shopId } = usePOSShopScope();
  const { data: session, status: sessionStatus } = useSession();
  const { tenant } = useTenant();

  const sessionToken = useMemo(() => {
    const t = (session?.user as { token?: string })?.token ?? null;
    return isTokenExpired(t) ? null : t;
  }, [session]);

  const access = historyAccess(sessionToken, isTokenExpired(posToken) ? null : posToken, shopId);
  const token = access.token;
  const [selectedHistoryShop, setHistoryShop] = useState<string | null>(null);
  const historyShop = selectedHistoryShop || access.defaultShop;

  const filters = useSalesFilters();

  const data = useSalesData({
    token, historyShop,
    statusFilter: filters.statusFilter,
    cashierFilter: filters.cashierFilter,
    methodFilter: filters.methodFilter,
    dateFrom: filters.dateFrom, dateTo: filters.dateTo,
    timeFrom: filters.timeFrom, timeTo: filters.timeTo,
    debouncedSearch: filters.debouncedSearch,
    lineSortField: filters.lineSortField, lineSortDir: filters.lineSortDir,
    groupSortField: filters.groupSortField, groupSortDir: filters.groupSortDir,
    viewMode: filters.viewMode, groupBy: filters.groupBy,
  });

  const groupLabel = useMemo(() => {
    const map: Record<string, string> = {
      product: 'Product / Variant', variant: 'Variant', cashier: 'Cashier',
      payment_method: 'Payment Method', warehouse: 'Warehouse', date: 'Date',
    };
    return map[filters.groupBy] || 'Product / Variant';
  }, [filters.groupBy]);

  const exp = useSalesExport({
    sorted: data.sorted, grouped: data.grouped, groupLabel,
    hasCostData: data.hasCostData, showProfit: filters.showProfit,
    viewMode: filters.viewMode, summary: data.summary,
    dateFrom: filters.dateFrom, dateTo: filters.dateTo,
    timeFrom: filters.timeFrom, timeTo: filters.timeTo,
    cashierFilter: filters.cashierFilter, methodFilter: filters.methodFilter,
    statusFilter: filters.statusFilter,
    storeName: tenant?.name || 'DrinksHarbour',
  });

  // Reset page on filter change
  const [page, setPage] = useState(1);
  const [groupPage, setGroupPage] = useState(1);

  useEffect(() => { setPage(1); }, [
    filters.dateFrom, filters.dateTo, filters.timeFrom, filters.timeTo,
    filters.cashierFilter, filters.methodFilter, filters.statusFilter,
    filters.debouncedSearch, filters.lineSortField, filters.lineSortDir,
  ]);
  useEffect(() => { setGroupPage(1); }, [
    filters.dateFrom, filters.dateTo, filters.timeFrom, filters.timeTo,
    filters.cashierFilter, filters.methodFilter, filters.statusFilter,
    filters.debouncedSearch, filters.groupSortField, filters.groupSortDir,
    filters.groupBy,
  ]);

  // Export dropdown outside click
  const exportRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!exp.showExport) return;
    function handler(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node))
        exp.setShowExport(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [exp.showExport]);

  // Paginated rows for lines table
  const paginatedLines = useMemo(
    () => data.sorted.slice((page - 1) * 50, page * 50),
    [data.sorted, page]
  );
  const paginatedGroups = useMemo(
    () => data.grouped.slice((groupPage - 1) * 30, groupPage * 30),
    [data.grouped, groupPage]
  );

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <POSNavHeader />
      <div className="flex items-center gap-3 border-b bg-white px-5 py-3">
        <ShopHistorySelector
          token={token}
          value={historyShop}
          onChange={(value) => {
            setHistoryShop(value);
            setPage(1);
            setGroupPage(1);
          }}
        />
        {data.error && <p role="alert" className="text-sm text-red-600">{data.error}</p>}
      </div>

      <ControlBar
        statusFilter={filters.statusFilter}
        setStatusFilter={filters.setStatusFilter}
        statusCounts={data.statusCounts}
        viewMode={filters.viewMode}
        setViewMode={filters.setViewMode}
        groupBy={filters.groupBy}
        setGroupBy={filters.setGroupBy}
        showProfit={filters.showProfit}
        setShowProfit={filters.setShowProfit}
        hiddenCols={filters.hiddenCols}
        toggleCol={filters.toggleCol}
        vis={filters.vis}
        dateFrom={filters.dateFrom}
        setDateFrom={(v) => { filters.setDateFrom(v); filters.setActivePreset(''); }}
        dateTo={filters.dateTo}
        setDateTo={(v) => { filters.setDateTo(v); filters.setActivePreset(''); }}
        timeFrom={filters.timeFrom}
        setTimeFrom={filters.setTimeFrom}
        timeTo={filters.timeTo}
        setTimeTo={filters.setTimeTo}
        activePreset={filters.activePreset}
        applyPreset={filters.applyPreset}
        clearDateRange={filters.clearDateRange}
        cashierFilter={filters.cashierFilter}
        setCashierFilter={filters.setCashierFilter}
        methodFilter={filters.methodFilter}
        setMethodFilter={filters.setMethodFilter}
        cashierOptions={data.cashierOptions}
        hasCostData={data.hasCostData}
        search={filters.search}
        setSearch={filters.setSearch}
        debouncedSearch={filters.debouncedSearch}
        searchFocused={filters.searchFocused}
        setSearchFocused={filters.setSearchFocused}
        searchRef={filters.searchRef}
        filterChips={filters.filterChips}
        clearAll={filters.clearAll}
        orderCount={data.orders.length}
        filteredCount={data.filteredBase.length}
        allRowCount={data.allRows.length}
        truncated={data.truncated}
        loading={data.loading}
        onRefresh={data.refetch}
        onFetchAll={data.refetchAll}
        showExport={exp.showExport}
        setShowExport={exp.setShowExport}
        exportRef={exportRef}
        onExport={exp.handleExport}
        hasData={filters.viewMode === 'lines' ? data.sorted.length > 0 : data.grouped.length > 0}
      />

      <SummaryStrip
        summary={data.summary}
        voidSummary={data.voidSummary}
        hasCostData={data.hasCostData}
        filteredCount={filters.viewMode === 'lines' ? data.sorted.length : data.grouped.length}
        statusFilter={filters.statusFilter}
      />

      <div className="flex-1 space-y-3 px-5 py-4">
        {data.loading ? (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="flex gap-4 border-b border-gray-100 bg-gray-50 px-4 py-3">
              {[100, 60, 80, 160, 70, 40, 70, 70, 70, 80, 70].map((w, i) => (
                <div key={i} className="h-3 animate-pulse rounded bg-gray-200" style={{ width: w, flexShrink: 0 }} />
              ))}
            </div>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className={`flex gap-4 border-b border-gray-50 px-4 py-3 ${i % 2 === 1 ? 'bg-gray-50/30' : ''}`}>
                {[90, 60, 80, 150, 70, 32, 70, 70, 70, 80, 70].map((w, j) => (
                  <div key={j} className="h-3.5 animate-pulse rounded bg-gray-100" style={{ width: w, flexShrink: 0 }} />
                ))}
              </div>
            ))}
          </div>
        ) : data.error ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 py-16">
            <p className="mt-3 text-sm font-medium text-red-700">{data.error}</p>
            <button onClick={data.refetch} className="mt-2 rounded-md bg-[#b20202] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#9a0101]">
              Retry
            </button>
          </div>
        ) : filters.viewMode === 'lines' ? (
          <LinesTable
            rows={paginatedLines}
            sorted={data.sorted}
            hasCostData={data.hasCostData}
            hiddenCols={filters.hiddenCols}
            lineSortField={filters.lineSortField}
            lineSortDir={filters.lineSortDir}
            toggleLineSort={filters.toggleLineSort}
            vis={filters.vis}
            debouncedSearch={filters.debouncedSearch}
            showProfit={filters.showProfit}
            page={page}
            setPage={setPage}
            allRowCount={data.allRows.length}
          />
        ) : (
          <GroupedTable
            rows={paginatedGroups}
            grouped={data.grouped}
            groupLabel={groupLabel}
            hasCostData={data.hasCostData}
            showProfit={filters.showProfit}
            groupSortField={filters.groupSortField}
            groupSortDir={filters.groupSortDir}
            toggleGroupSort={filters.toggleGroupSort}
            debouncedSearch={filters.debouncedSearch}
            groupPage={groupPage}
            setGroupPage={setGroupPage}
            distinctOrderCount={data.distinctOrderCount}
            allRowCount={data.allRows.length}
          />
        )}

        {data.truncated && !data.loading && (
          <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
            <span>Showing first 500 orders only — older data may be missing.</span>
            <button type="button" onClick={data.refetchAll} className="ml-4 font-medium underline hover:no-underline">
              Load all
            </button>
          </div>
        )}
      </div>

      {exp.exportDialog.open && (
        <ExportColumnModal
          format={exp.exportDialog.format}
          isGrouped={filters.viewMode === 'grouped'}
          hasCost={data.hasCostData && filters.showProfit}
          lineCols={exp.exportDialog.lineCols}
          groupCols={exp.exportDialog.groupCols}
          onToggleLine={exp.toggleExportLineCol}
          onToggleGroup={exp.toggleExportGroupCol}
          onSelectAll={exp.selectAllExportCols}
          onDeselectAll={exp.deselectAllExportCols}
          onCancel={() => exp.setExportDialog((prev) => ({ ...prev, open: false }))}
          onDownload={exp.confirmExport}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update the old file to re-export (backward compatibility)**

Replace the entire content of `pos-sales-details.tsx` with:

```tsx
// Re-export from the decomposed module for backward compatibility.
// The page route at point-of-sale/sales-details/page.tsx imports from here.
export { default } from './sales-details';
```

- [ ] **Step 3: Verify the page route still works**

Run: `cd /Users/mac/Documents/drinksharbour/client/apps/admin && npx tsc --noEmit --pretty 2>&1 | grep -i "sales-details\|error" | head -20`
Expected: No errors related to the sales-details files

- [ ] **Step 4: Verify line count constraint**

Run: `wc -l client/apps/admin/src/app/shared/point-of-sale/sales-details/*.ts client/apps/admin/src/app/shared/point-of-sale/sales-details/*.tsx client/apps/admin/src/app/shared/point-of-sale/sales-details/**/*.ts client/apps/admin/src/app/shared/point-of-sale/sales-details/**/*.tsx 2>/dev/null | tail -25`
Expected: No individual file exceeds 300 lines

- [ ] **Step 5: Commit**

```bash
cd /Users/mac/Documents/drinksharbour
git add client/apps/admin/src/app/shared/point-of-sale/sales-details/index.tsx \
        client/apps/admin/src/app/shared/point-of-sale/pos-sales-details.tsx
git commit -m "feat(pos): wire up orchestrator + backward-compat re-export"
```

---

### Task 12: Final Verification

- [ ] **Step 1: Full TypeScript check**

Run: `cd /Users/mac/Documents/drinksharbour/client/apps/admin && npx tsc --noEmit --pretty 2>&1 | tail -5`
Expected: No new errors introduced

- [ ] **Step 2: Verify file structure**

Run: `find client/apps/admin/src/app/shared/point-of-sale/sales-details -type f | sort`
Expected: 19 files matching the file map

- [ ] **Step 3: Verify no file exceeds 300 lines**

Run: `find client/apps/admin/src/app/shared/point-of-sale/sales-details -name '*.ts' -o -name '*.tsx' | xargs wc -l | sort -rn | head -5`
Expected: Largest file under 300 lines

- [ ] **Step 4: Final commit**

```bash
cd /Users/mac/Documents/drinksharbour
git add -A client/apps/admin/src/app/shared/point-of-sale/sales-details/
git commit -m "feat(pos): complete POS sales details decomposition — 19 focused files, 4 bug fixes"
```

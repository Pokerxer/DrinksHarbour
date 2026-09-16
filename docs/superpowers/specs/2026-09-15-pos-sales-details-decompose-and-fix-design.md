# POS Sales Details — Decompose + Fix Core Logic

**Date:** 2026-09-15  
**Status:** Implemented 2026-09-16 — see [RESUME — sales-details decomposition](./RESUME-sales-details-decomposition.md)  
**Scope:** Sub-project 1 of 4 — decompose the 3,651-line monolith, fix all calculation/filtering bugs  
**Sub-projects (future):** Order drill-down, Real-time updates, Analytics features

---

## Problem

`pos-sales-details.tsx` is a 3,651-line monolithic client component containing all UI, filtering, sorting, grouping, export logic, PDF drawing, and helper functions in a single file. It has multiple calculation bugs:

1. **`gross` vs `subtotal` divergence** — client computes `gross = priceAtPurchase * quantity` but uses server-provided `itemSubtotal` for revenue. If the server applies tax, rounding, or pricelist adjustments, these diverge, causing summary mismatch.
2. **Voided orders inflate summary when status='all'** — the summary strip shows total revenue including voided orders with no indication of what was voided.
3. **Date filtering timezone edge case** — `toTs()` creates Date from ISO string which interprets as UTC, but the UI expects local time (Nigeria UTC+1). Midnight boundaries can be off by an hour.
4. **Grouped footer not memoized** — `new Set(filtered.map(r => r.orderId)).size` recalculates on every render.
5. **Gross revenue display inconsistency** — summary shows "Gross Revenue" but the value can differ from `sum(unitPrice * qty)` in the table due to the client/server computation gap.

---

## Approach

**Vertical Slice decomposition** — split by concern into ~14 focused files under `shared/point-of-sale/sales-details/`. Each file stays under 300 lines. All logic extracted into custom hooks; components receive only the props they need.

---

## File Structure

```
shared/point-of-sale/sales-details/
├── index.tsx                  ← thin orchestrator (~80 lines)
├── types.ts                   ← LineRow, GroupRow, ViewMode, SortField types
├── constants.ts               ← payment labels/colors, date presets, export col defs, toggleable cols
├── helpers.ts                 ← fmtDate, fmtDateTime, toTsUtc, isTokenExpired, highlight()
├── hooks/
│   ├── use-sales-data.ts      ← fetch → flatten → filter → sort → group → summary
│   ├── use-sales-filters.ts   ← all filter state, debounce, preset logic, chips
│   └── use-sales-export.ts    ← export dialog state, column toggles, confirmExport
├── export/
│   ├── csv.ts                 ← exportLineCsv, exportGroupedCsv, cell renderers
│   ├── excel.ts               ← exportLineExcel, exportGroupedExcel
│   └── pdf.ts                 ← all jsPDF drawing, exportLinePdf, exportGroupedPdf
├── components/
│   ├── control-bar.tsx        ← sticky header: status tabs, view toggle, column picker, search, date presets, filters
│   ├── summary-strip.tsx      ← KPI cards row
│   ├── lines-table.tsx        ← lines view: thead, tbody, tfoot, pagination
│   ├── grouped-table.tsx      ← grouped view: thead, tbody, tfoot, pagination
│   ├── export-column-modal.tsx ← column picker dialog
│   ├── sort-chevron.tsx       ← reusable sort indicator
│   ├── filter-chip.tsx        ← removable filter chip
│   ├── date-time-range.tsx    ← from/to date+time picker
│   └── custom-select.tsx      ← reusable dropdown select
```

---

## Bug Fixes

### Fix 1 — Server-authoritative gross computation

**Before (buggy):**
```ts
const gross = item.priceAtPurchase * item.quantity;  // client-computed
const subtotal = item.itemSubtotal;                   // server-computed
```

**After:**
```ts
const subtotal = item.itemSubtotal;       // server-authoritative net
const discount = item.discountAmount ?? 0;
const gross = subtotal + discount;        // derive gross from server values
const profit = costPrice > 0 ? subtotal - costPrice : 0;
```

This ensures `gross - discount === subtotal` always holds, matching the server's calculation.

### Fix 2 — Void handling in summary

Split the data pipeline so voided orders are excluded from core revenue calculations:

```
allRows → filter(date, cashier, method, search) → filteredBase
filteredBase → filter(status === 'voided' exclusion) → filtered (for table display)
filteredBase → exclude voided → summary computations
```

- Summary strip **always** shows active revenue by default
- When `statusFilter === 'all'`, a secondary "Voided" counter card appears showing voided count + revenue
- When `statusFilter === 'voided'`, summary shows only voided data
- Grouped aggregation uses `filteredBase` but voided rows are visually dimmed and excluded from share calculations

### Fix 3 — Date filtering timezone consistency

**Before:**
```ts
function toTs(date: string, time: string): number {
  return new Date(`${date}T${time || '00:00'}:00`).getTime();  // ISO parsing = UTC
}
```

**After:**
```ts
function toTsUtc(date: string, time: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time || '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm).getTime();  // numeric args = local time
}
```

Using `new Date(y, m, d, h, min)` creates a local-time Date object, avoiding ISO string parsing ambiguity.

### Fix 4 — Memoize grouped footer order count

**Before (recalculates on every render):**
```tsx
{new Set(filtered.map(r => r.orderId)).size.toLocaleString()}
```

**After (extracted to memo in use-sales-data):**
```ts
const distinctOrderCount = useMemo(
  () => new Set(filteredBase.map(r => r.orderId)).size,
  [filteredBase]
);
```

---

## Hook Designs

### `use-sales-data.ts`

```ts
function useSalesData(token, historyShop, filters) {
  // 1. Fetch: posApi.getAllOrders → PosOrder[]
  // 2. Flatten: orders → LineRow[] (server-authoritative gross)
  // 3. Filter base: date, cashier, method, search (no status filter)
  // 4. Status split: activeRows, voidedRows from filteredBase
  // 5. Sort: lineSort or groupSort depending on viewMode
  // 6. Group: by product/variant/cashier/payment/date/warehouse
  // 7. Summary: computed from activeRows only

  return {
    orders, allRows, filteredBase, activeRows, voidedRows,
    sorted, grouped, summary, voidSummary, statusCounts,
    hasCostData, cashiers, cashierOptions,
    loading, error, truncated,
    refetch, refetchAll,
    distinctOrderCount,
  }
}
```

### `use-sales-filters.ts`

```ts
function useSalesFilters() {
  // All filter state + setters
  // Sort state + toggle functions
  // View state (viewMode, groupBy, showProfit, hiddenCols)
  // Derived: filterChips, vis()

  return {
    dateFrom, dateTo, timeFrom, timeTo, activePreset,
    cashierFilter, methodFilter, statusFilter, search, debouncedSearch,
    setDateFrom, setDateTo, setTimeFrom, setTimeTo,
    setCashierFilter, setMethodFilter, setStatusFilter, setSearch,
    applyPreset, clearDateRange, clearAll,
    lineSortField, lineSortDir, toggleLineSort,
    groupSortField, groupSortDir, toggleGroupSort,
    viewMode, setViewMode, groupBy, setGroupBy,
    showProfit, setShowProfit, hiddenCols, toggleCol, vis,
    filterChips,
  }
}
```

### `use-sales-export.ts`

```ts
function useSalesExport({ sorted, grouped, summary, ... }) {
  return {
    showExport, setShowExport, exportDialog,
    handleExport, confirmExport,
    toggleExportLineCol, toggleExportGroupCol,
    selectAllExportCols, deselectAllExportCols,
  }
}
```

---

## Component Designs

### `control-bar.tsx` (~250 lines)

Three-row sticky header:
- **Row 1:** Title + context (order count, truncation notice), status tabs (All/Active/Voided with counts), view toggle (Lines/Grouped), group-by selector, column picker button, refresh button, export dropdown
- **Row 2:** Date presets (Today, Yesterday, Last 7 days, This week, This month, Last month) + DateTimeRange picker
- **Row 3:** Cashier filter, Payment filter, Profit toggle, active filter chips, search input with ⌘K shortcut + clear all

### `summary-strip.tsx` (~60 lines)

Grid of 5-6 KPI cards: Gross Revenue, Net Revenue, Total Discount, Items Sold, Distinct Orders, Est. Profit (conditional). When `statusFilter === 'all'` and voided orders exist, adds a muted "Voided" card showing count + revenue.

### `lines-table.tsx` (~250 lines)

Full table with dynamic columns controlled by `hiddenCols`. Sortable headers with `SortChevron`. Search highlights via `highlight()`. Voided rows dimmed with VOID badge. Footer with column totals from `sorted`. Pagination via `PageBar`.

### `grouped-table.tsx` (~200 lines)

Table with revenue share bar chart in each row. Footer with memoized distinct order count. Pagination.

### `export-column-modal.tsx` (~120 lines)

Column picker dialog — extracted as-is from current inline component.

### Small reusable components (~20-40 lines each)

- `sort-chevron.tsx` — `SortChevron({ active, dir })`
- `filter-chip.tsx` — `FilterChip({ label, onRemove })`
- `date-time-range.tsx` — `DateTimeRange` with from/to date+time inputs
- `custom-select.tsx` — `CustomSelect` with dropdown, clear, optional dot indicators

---

## Orchestrator (`index.tsx`)

~80 lines. Calls hooks, composes components. No business logic.

```tsx
export default function POSSalesDetails() {
  const { token, shopId, ... } = useAuth();
  const filters = useSalesFilters();
  const data = useSalesData(token, historyShop, filters);
  const exp = useSalesExport(data);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <POSNavHeader />
      <ShopHistorySelector ... />
      <ControlBar filters={filters} ... />
      <SummaryStrip summary={data.summary} ... />
      {data.loading ? <Skeleton /> : data.error ? <ErrorState /> :
        filters.viewMode === 'lines'
          ? <LinesTable rows={data.sorted} ... />
          : <GroupedTable rows={data.grouped} ... />
      }
      {exp.exportDialog.open && <ExportColumnModal ... />}
    </div>
  );
}
```

---

## What This Does NOT Cover (Future Sub-projects)

- **Sub-project 2:** Order drill-down (click order → detail modal with receipt, items, refund history)
- **Sub-project 3:** Real-time updates (WebSocket integration for live order feed)
- **Sub-project 4:** Analytics features (refund analytics, cashier performance, trend charts)

---

## Acceptance Criteria

1. All existing functionality preserved — no regressions in filtering, sorting, grouping, export, pagination
2. Summary totals match table footer totals exactly
3. `gross - discount === subtotal` holds for every line row
4. Voided orders excluded from summary when status='active' or 'all' (shown separately)
5. Date filtering uses local time consistently (no UTC offset issues)
6. No file exceeds 300 lines
7. The orchestrator `index.tsx` contains zero business logic
8. All hooks are independently testable
9. Export (CSV/Excel/PDF) produces identical output to current implementation

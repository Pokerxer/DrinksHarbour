# Purchases Analytics — Pivot Table View (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the Odoo-style hierarchical Pivot table view from `pos-order-analysis.tsx`
(`/point-of-sale/order-analysis`) onto `/purchases/analytics`, completing Phase 2 of the
purchases-analytics redesign (Phase 1 — bar/line/pie/table charts, filters, group-by,
sort, saved searches, drill drawer — is already implemented, uncommitted).

**Architecture:** Mirrors the existing Phase 1 split:
- `purchases-analytics-helpers.ts` gains a `ViewMode` type, `HierPivotResult` interface,
  and `computeHierarchicalPivot(...)` — a pure function reusing the existing
  `getPOG1Key`/`resolveItemDimKey`/`aggregateMeasure`/`formatG1Label`/`ITEM_DIMS`.
- `purchases-analytics-charts.tsx` gains `PivotDimDropdown`, `PivotView`,
  `exportPivotCSV`, `exportPivotExcel` — a near-direct port of the reference UI,
  adapted to receive state via props (parent owns the `useState`s).
- `purchases-analytics.tsx` gains `viewMode`/`pivotRowDims`/`pivotColDims`/
  `pivotHeatMap`/`pivotShowOrders`/`pivotRowSearch`/`expandedRows`/`expandedCols`
  state, a `pivotData` memo, a Graph/Pivot toggle next to the chart-type switch, and
  conditionally renders `PivotView` (wired to the existing `setDrillData`/
  `PODrillDrawer`) instead of the chart card when `viewMode === 'pivot'`.

**Tech Stack:** Next.js / React / TypeScript, Tailwind, react-icons/pi. No test
framework exists for this app (`pnpm run type:check` → `tsc --noEmit` is the
correctness gate, plus manual dev-server verification per the Phase 1 spec's
"Verification" section).

---

## Reference Implementation

All reference code lives in
`client/apps/isomorphic/src/app/shared/point-of-sale/pos-order-analysis.tsx`:

| Reference symbol | Lines | Purchases equivalent already exists? |
|---|---|---|
| `ITEM_DIMS` | 596 | ✅ `ITEM_DIMS` (helpers.ts:162) |
| `getOrderDimKey` | 598-611 | ✅ `getPOG1Key` (helpers.ts:279-315) |
| `getItemDimKey` | 613-620 | ✅ `resolveItemDimKey` (helpers.ts:258-276) |
| `fmtDimKey` | 622-628 | ✅ `formatG1Label` (helpers.ts:318-340) |
| `applyMeasure` | 630-670 | ✅ `aggregateMeasure` (helpers.ts:446-488) — **different shape**, see Task 1 note |
| `interface HierPivotResult` | 757-769 | ❌ to add |
| `computeHierarchicalPivot` | 771-894 | ❌ to add (Task 1) |
| `PivotDimDropdown` | 1422-1467 | ❌ to add (Task 2) |
| `exportPivotCSV` | 1469-1526 | ❌ to add (Task 2) |
| `exportPivotExcel` | 1528-1601 | ❌ to add (Task 2) |
| Pivot toolbar + table JSX | 4020-4404 | ❌ to add (Task 3, as `PivotView`) |
| `viewMode`/pivot state decls | 2907-2918 | ❌ to add (Task 4) |
| `pivotData` memo | 3200-3260 (approx) | ❌ to add (Task 4) |
| View toggle buttons | 3971-3987 | ❌ to add (Task 4) |

---

## Task 1: Pivot computation in `purchases-analytics-helpers.ts`

**Files:**
- Modify: `client/apps/isomorphic/src/app/shared/purchases/purchases-analytics-helpers.ts`

### Critical adaptation note

The reference `applyMeasure(orderList, items, measure, isItemGroup)` branches on
`isItemGroup`: when `false`, it reads **order-level** fields (`o.total`, `o.subtotal`)
and ignores `items` entirely. Our `aggregateMeasure(orderList, items, measure, toBase)`
has **no such branch** — every measure (`total_cost`, `untaxed_total`, etc.) is computed
by summing over `items: {item, currency}[]`. This matches how `computeGroupData`
populates buckets: for non-item-group dims it pushes **every item of every order** in
the bucket into `items`, not just one "representative" item.

So `computeHierarchicalPivot`'s cache must populate `items` with **all items of the
order** (with their currency) whenever the atom represents a whole order (i.e. when
`item === null`, used for non-item-dim grouping), and with **just that one item** when
the atom represents a single product line (item-dim grouping). Getting this wrong
silently zeroes out `total_cost`/`untaxed_total`/etc. for any pivot that doesn't group
by product/category/subcategory/brand.

- [ ] **Step 1: Add `ViewMode` type**

Add directly below the existing `export type ChartType = 'bar' | 'line' | 'pie' | 'table';`
(currently line 31):

```ts
export type ViewMode = 'graph' | 'pivot';
```

- [ ] **Step 2: Append `HierPivotResult` + `computeHierarchicalPivot` at end of file**

Append after `computeMultiSeries` (end of file, after the closing `}` that is currently
line 646):

```ts
// ── Hierarchical pivot (Odoo-style) ─────────────────────────────────────────────

export interface HierPivotResult {
  rowVals0: string[];
  colVals0: string[];
  subRowValsMap: Record<string, string[]>;
  subColValsMap: Record<string, string[]>;
  getValue: (rowPath: string[], colPath: string[]) => number;
  getOrderCount: (rowPath: string[], colPath: string[]) => number;
  getOrders: (rowPath: string[], colPath: string[]) => PurchaseOrder[];
  rowTotals: Record<string, number>;
  colTotals: Record<string, number>;
  grandTotal: number;
  maxCellVal: number;
}

export function computeHierarchicalPivot(
  orders: PurchaseOrder[],
  rowDims: GroupByKey[],
  colDims: GroupByKey[],
  measure: Measure,
  prodMeta: Record<string, ProdMeta>,
  toBase: (amount: number, currency: string) => number
): HierPivotResult | null {
  if (rowDims.length === 0) return null;

  interface CacheEntry {
    ords: Map<string, PurchaseOrder>;
    items: { item: POItem; currency: string }[];
  }
  const cache = new Map<string, CacheEntry>();
  const numCache = new Map<string, number>();

  const cacheKey = (rPath: string[], cPath: string[]) =>
    rPath.join('\x00') + '\x01' + cPath.join('\x00');

  const addToCache = (
    rPath: string[],
    cPath: string[],
    ordId: string,
    order: PurchaseOrder,
    items: { item: POItem; currency: string }[]
  ) => {
    const k = cacheKey(rPath, cPath);
    let e = cache.get(k);
    if (!e) { e = { ords: new Map(), items: [] }; cache.set(k, e); }
    e.ords.set(ordId, order);
    e.items.push(...items);
  };

  const isItemGroup = rowDims.some((d) => ITEM_DIMS.has(d)) || colDims.some((d) => ITEM_DIMS.has(d));

  const rValSets: Set<string>[] = rowDims.map(() => new Set<string>());
  const cValSets: Set<string>[] = colDims.map(() => new Set<string>());
  const subRVals = new Map<string, Set<string>>();
  const subCVals = new Map<string, Set<string>>();

  orders.forEach((o) => {
    const currency = o.currency || BASE_CURRENCY;
    const allItems = o.items || [];

    const processAtom = (item: POItem | null) => {
      const rKeys = rowDims.map((d) =>
        ITEM_DIMS.has(d) && item ? resolveItemDimKey(item, d, prodMeta) : getPOG1Key(o, d, prodMeta)
      );
      const cKeys = colDims.map((d) =>
        ITEM_DIMS.has(d) && item ? resolveItemDimKey(item, d, prodMeta) : getPOG1Key(o, d, prodMeta)
      );

      rKeys.forEach((k, i) => rValSets[i]?.add(k));
      cKeys.forEach((k, i) => cValSets[i]?.add(k));
      if (rKeys.length >= 2) {
        if (!subRVals.has(rKeys[0])) subRVals.set(rKeys[0], new Set());
        subRVals.get(rKeys[0])!.add(rKeys[1]);
      }
      if (cKeys.length >= 2) {
        if (!subCVals.has(cKeys[0])) subCVals.set(cKeys[0], new Set());
        subCVals.get(cKeys[0])!.add(cKeys[1]);
      }

      const atomItems: { item: POItem; currency: string }[] = item
        ? [{ item, currency }]
        : allItems.map((i) => ({ item: i, currency }));

      for (let ri = 0; ri <= rKeys.length; ri++) {
        for (let ci = 0; ci <= cKeys.length; ci++) {
          addToCache(rKeys.slice(0, ri), cKeys.slice(0, ci), o._id, o, atomItems);
        }
      }
    };

    if (isItemGroup) {
      if (allItems.length > 0) allItems.forEach((item) => processAtom(item));
      else processAtom(null);
    } else {
      processAtom(null);
    }
  });

  const getVal = (rowPath: string[], colPath: string[]): number => {
    const k = cacheKey(rowPath, colPath);
    if (numCache.has(k)) return numCache.get(k)!;
    const e = cache.get(k);
    if (!e) { numCache.set(k, 0); return 0; }
    const val = aggregateMeasure(Array.from(e.ords.values()), e.items, measure, toBase);
    numCache.set(k, val);
    return val;
  };

  const getOrderCount = (rowPath: string[], colPath: string[]): number =>
    cache.get(cacheKey(rowPath, colPath))?.ords.size ?? 0;

  const getOrders = (rowPath: string[], colPath: string[]): PurchaseOrder[] =>
    Array.from(cache.get(cacheKey(rowPath, colPath))?.ords.values() ?? []);

  const isDateDim = (d: GroupByKey) => d.startsWith('order_');

  const rowVals0 = Array.from(rValSets[0] ?? []);
  const colVals0 = Array.from(cValSets[0] ?? []);
  const rowTotals: Record<string, number> = {};
  const colTotals: Record<string, number> = {};
  rowVals0.forEach((k) => { rowTotals[k] = getVal([k], []); });
  colVals0.forEach((k) => { colTotals[k] = getVal([], [k]); });

  if (isDateDim(rowDims[0])) rowVals0.sort((a, b) => a.localeCompare(b));
  else rowVals0.sort((a, b) => rowTotals[b] - rowTotals[a]);
  if (colDims[0]) {
    if (isDateDim(colDims[0])) colVals0.sort((a, b) => a.localeCompare(b));
    else colVals0.sort((a, b) => colTotals[b] - colTotals[a]);
  }

  const subRowValsMap: Record<string, string[]> = {};
  rowVals0.forEach((rk) => {
    const vals = Array.from(subRVals.get(rk) ?? []);
    if (rowDims[1] && isDateDim(rowDims[1])) vals.sort((a, b) => a.localeCompare(b));
    else vals.sort((a, b) => getVal([rk, b], []) - getVal([rk, a], []));
    subRowValsMap[rk] = vals;
  });
  const subColValsMap: Record<string, string[]> = {};
  colVals0.forEach((ck) => {
    const vals = Array.from(subCVals.get(ck) ?? []);
    if (colDims[1] && isDateDim(colDims[1])) vals.sort((a, b) => a.localeCompare(b));
    else vals.sort((a, b) => getVal([], [ck, b]) - getVal([], [ck, a]));
    subColValsMap[ck] = vals;
  });

  const grandTotal = getVal([], []);
  let maxCellVal = 0;
  rowVals0.forEach((rk) => colVals0.forEach((ck) => { maxCellVal = Math.max(maxCellVal, getVal([rk], [ck])); }));
  if (colVals0.length === 0) rowVals0.forEach((rk) => { maxCellVal = Math.max(maxCellVal, rowTotals[rk]); });

  return {
    rowVals0, colVals0, subRowValsMap, subColValsMap,
    getValue: getVal, getOrderCount, getOrders,
    rowTotals, colTotals, grandTotal, maxCellVal,
  };
}
```

- [ ] **Step 3: Type-check**

Run: `cd client/apps/isomorphic && pnpm run type:check`
Expected: no new errors (the file should compile cleanly — `PurchaseOrder`, `POItem`,
`BASE_CURRENCY`, `ITEM_DIMS`, `resolveItemDimKey`, `getPOG1Key`, `aggregateMeasure` are
all already imported/defined earlier in this file).

- [ ] **Step 4: Commit**

```bash
git add client/apps/isomorphic/src/app/shared/purchases/purchases-analytics-helpers.ts
git commit -m "feat(purchases): add hierarchical pivot computation to analytics helpers"
```

---

## Task 2: Pivot dropdown + export functions in `purchases-analytics-charts.tsx`

**Files:**
- Modify: `client/apps/isomorphic/src/app/shared/purchases/purchases-analytics-charts.tsx`

- [ ] **Step 1: Update imports (top of file)**

Replace (current lines 1-29):

```tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import {
  Bar,
  BarChart,
  Line,
  ComposedChart,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { PiCaretDown, PiCheck, PiWarning } from 'react-icons/pi';
import type { PurchaseOrder } from '@/services/purchaseOrder.service';
import {
  PALETTE,
  fmtAxisVal,
  fmtMeasureVal,
  type GroupRow,
  type GroupRow2,
  type Measure,
  type ChartType,
} from './purchases-analytics-helpers';
```

with:

```tsx
'use client';

import { useEffect, useState, useRef, Fragment, type Dispatch, type SetStateAction } from 'react';
import {
  Bar,
  BarChart,
  Line,
  ComposedChart,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  PiCaretDown,
  PiCheck,
  PiWarning,
  PiX,
  PiMagnifyingGlass,
  PiShoppingCart,
  PiFloppyDisk,
  PiTable,
} from 'react-icons/pi';
import type { PurchaseOrder } from '@/services/purchaseOrder.service';
import {
  PALETTE,
  fmtAxisVal,
  fmtMeasureVal,
  formatG1Label,
  ALL_GROUP_ITEMS,
  type GroupRow,
  type GroupRow2,
  type Measure,
  type ChartType,
  type GroupByKey,
  type HierPivotResult,
} from './purchases-analytics-helpers';
```

- [ ] **Step 2: Append `PivotDimDropdown` at end of file**

Append after the closing `}` of `StackedChart` (currently the last line, 930):

```tsx

// ── Pivot UI ──────────────────────────────────────────────────────────────────

function PivotDimDropdown({
  onAdd,
  existing,
  otherDims,
  title,
}: {
  onAdd: (k: GroupByKey) => void;
  existing: GroupByKey[];
  otherDims: GroupByKey[];
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-6 w-6 items-center justify-center rounded border border-dashed border-gray-300 text-gray-400 transition-colors hover:border-[#b20202] hover:text-[#b20202]"
        title={title}
      >
        +
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-xl">
          <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Group by</p>
          {ALL_GROUP_ITEMS.map((g) => {
            const inThis = existing.includes(g.key);
            const inOther = otherDims.includes(g.key);
            const disabled = inThis || inOther;
            return (
              <button
                key={g.key}
                type="button"
                disabled={disabled}
                onClick={() => { onAdd(g.key); setOpen(false); }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors ${
                  disabled ? 'cursor-not-allowed text-gray-300' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {inThis ? (
                  <PiCheck className="h-3.5 w-3.5 shrink-0 text-gray-300" />
                ) : inOther ? (
                  <span className="w-3.5 shrink-0 text-[9px] text-gray-300">↔</span>
                ) : (
                  <span className="w-3.5" />
                )}
                {g.label}
                {inOther && <span className="ml-auto text-[9px] text-gray-300">other axis</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Append `exportPivotCSV` and `exportPivotExcel`**

Append immediately after `PivotDimDropdown`:

```tsx

function exportPivotCSV(
  p: HierPivotResult,
  rowDims: GroupByKey[],
  colDims: GroupByKey[],
  measure: Measure,
  expandedRows: Set<string>,
  expandedCols: Set<string>
) {
  const rowHeader = rowDims.map((d) => ALL_GROUP_ITEMS.find((g) => g.key === d)?.label ?? d).join(' › ');
  const headers: string[] = [rowHeader, 'Total'];

  const visCols: { path: string[]; label: string }[] = [];
  if (colDims.length > 0) {
    p.colVals0.forEach((ck) => {
      if (colDims.length >= 2 && expandedCols.has(ck)) {
        (p.subColValsMap[ck] ?? []).forEach((sk) => {
          visCols.push({ path: [ck, sk], label: `${formatG1Label(ck, colDims[0])} / ${formatG1Label(sk, colDims[1])}` });
        });
      } else {
        visCols.push({ path: [ck], label: formatG1Label(ck, colDims[0]) });
      }
    });
    visCols.forEach((c) => headers.push(c.label));
  }

  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const numVal = (rowPath: string[], colPath: string[]) => fmtMeasureVal(p.getValue(rowPath, colPath), measure);

  const csvRows: string[][] = [headers];

  const gtRow = ['Total', numVal([], [])];
  visCols.forEach((c) => gtRow.push(numVal([], c.path)));
  csvRows.push(gtRow);

  p.rowVals0.forEach((rk) => {
    const row = [formatG1Label(rk, rowDims[0]), numVal([rk], [])];
    visCols.forEach((c) => row.push(numVal([rk], c.path)));
    csvRows.push(row);

    if (rowDims.length >= 2 && expandedRows.has(rk)) {
      (p.subRowValsMap[rk] ?? []).forEach((srk) => {
        const sub = [`  ${formatG1Label(rk, rowDims[0])} / ${formatG1Label(srk, rowDims[1])}`, numVal([rk, srk], [])];
        visCols.forEach((c) => sub.push(numVal([rk, srk], c.path)));
        csvRows.push(sub);
      });
    }
  });

  const content = csvRows.map((r) => r.map(esc).join(',')).join('\n');
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pivot-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportPivotExcel(
  p: HierPivotResult,
  rowDims: GroupByKey[],
  colDims: GroupByKey[],
  measure: Measure,
  expandedRows: Set<string>,
  expandedCols: Set<string>
) {
  const rowHeader = rowDims.map((d) => ALL_GROUP_ITEMS.find((g) => g.key === d)?.label ?? d).join(' › ');

  const visCols: { path: string[]; label: string }[] = [];
  if (colDims.length > 0) {
    p.colVals0.forEach((ck) => {
      if (colDims.length >= 2 && expandedCols.has(ck)) {
        (p.subColValsMap[ck] ?? []).forEach((sk) => {
          visCols.push({ path: [ck, sk], label: `${formatG1Label(ck, colDims[0])} / ${formatG1Label(sk, colDims[1])}` });
        });
      } else {
        visCols.push({ path: [ck], label: formatG1Label(ck, colDims[0]) });
      }
    });
  }

  const x = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const numVal = (rp: string[], cp: string[]) => p.getValue(rp, cp);

  const strCell = (v: string, bold = false) =>
    `<Cell${bold ? ' ss:StyleID="bold"' : ''}><Data ss:Type="String">${x(v)}</Data></Cell>`;
  const numCell = (v: number, bold = false) =>
    v === 0
      ? `<Cell${bold ? ' ss:StyleID="bold"' : ''}><Data ss:Type="String">—</Data></Cell>`
      : `<Cell${bold ? ' ss:StyleID="bold"' : ''}><Data ss:Type="Number">${v.toFixed(2)}</Data></Cell>`;

  const rows: string[] = [];

  const hdrCells = [strCell(rowHeader, true), strCell('Total', true), ...visCols.map((c) => strCell(c.label, true))].join('');
  rows.push(`<Row>${hdrCells}</Row>`);

  const gtCells = [strCell('Total', true), numCell(p.grandTotal, true), ...visCols.map((c) => numCell(numVal([], c.path), true))].join('');
  rows.push(`<Row>${gtCells}</Row>`);

  p.rowVals0.forEach((rk) => {
    const rowCells = [strCell(formatG1Label(rk, rowDims[0])), numCell(p.rowTotals[rk]), ...visCols.map((c) => numCell(numVal([rk], c.path)))].join('');
    rows.push(`<Row>${rowCells}</Row>`);
    if (rowDims.length >= 2 && expandedRows.has(rk)) {
      (p.subRowValsMap[rk] ?? []).forEach((srk) => {
        const subCells = [
          strCell(`  ${formatG1Label(rk, rowDims[0])} / ${formatG1Label(srk, rowDims[1])}`),
          numCell(numVal([rk, srk], [])),
          ...visCols.map((c) => numCell(numVal([rk, srk], c.path))),
        ].join('');
        rows.push(`<Row>${subCells}</Row>`);
      });
    }
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="bold"><Font ss:Bold="1"/></Style>
  </Styles>
  <Worksheet ss:Name="Pivot">
    <Table>${rows.join('')}</Table>
  </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pivot-${new Date().toISOString().slice(0, 10)}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Type-check**

Run: `cd client/apps/isomorphic && pnpm run type:check`
Expected: no new errors. `PivotView` (Task 3) references `PivotDimDropdown`,
`exportPivotCSV`, `exportPivotExcel` — if Task 3 hasn't been done yet in the same
pass, expect "unused function" lint warnings only (not type errors), since these
are plain function declarations.

- [ ] **Step 5: Commit**

```bash
git add client/apps/isomorphic/src/app/shared/purchases/purchases-analytics-charts.tsx
git commit -m "feat(purchases): add pivot dropdown and CSV/Excel export helpers"
```

---

## Task 3: `PivotView` component in `purchases-analytics-charts.tsx`

**Files:**
- Modify: `client/apps/isomorphic/src/app/shared/purchases/purchases-analytics-charts.tsx`

This is a near-direct port of the reference pivot table JSX
(`pos-order-analysis.tsx:4096-4404`), converted from an inline IIFE into an exported
component. Rename map applied throughout:

| Reference | Port |
|---|---|
| `fmtDimKey(k, dim)` | `formatG1Label(k, dim)` |
| `setDrillData({ orders, title })` | `onCellClick(orders, title)` |
| `'cashier'` (flip-button fallback) | `'vendor'` |
| local `useState`s (`pivotRowDims`, `expandedRows`, …) | props + setter props |
| `pivotAddRowOpen`/`pivotAddColOpen`/refs | removed — `PivotDimDropdown` manages its own open state |

- [ ] **Step 1: Append `PivotView` at end of file**

Append after `exportPivotExcel` (end of Task 2's additions):

```tsx

export function PivotView({
  pivotData,
  pivotRowDims,
  pivotColDims,
  measure,
  pivotHeatMap,
  pivotShowOrders,
  pivotRowSearch,
  expandedRows,
  expandedCols,
  setPivotRowDims,
  setPivotColDims,
  setPivotHeatMap,
  setPivotShowOrders,
  setPivotRowSearch,
  setExpandedRows,
  setExpandedCols,
  onCellClick,
}: {
  pivotData: HierPivotResult | null;
  pivotRowDims: GroupByKey[];
  pivotColDims: GroupByKey[];
  measure: Measure;
  pivotHeatMap: boolean;
  pivotShowOrders: boolean;
  pivotRowSearch: string;
  expandedRows: Set<string>;
  expandedCols: Set<string>;
  setPivotRowDims: Dispatch<SetStateAction<GroupByKey[]>>;
  setPivotColDims: Dispatch<SetStateAction<GroupByKey[]>>;
  setPivotHeatMap: Dispatch<SetStateAction<boolean>>;
  setPivotShowOrders: Dispatch<SetStateAction<boolean>>;
  setPivotRowSearch: Dispatch<SetStateAction<string>>;
  setExpandedRows: Dispatch<SetStateAction<Set<string>>>;
  setExpandedCols: Dispatch<SetStateAction<Set<string>>>;
  onCellClick: (orders: PurchaseOrder[], title: string) => void;
}) {
  const p = pivotData;

  const toggleRow = (key: string) =>
    setExpandedRows((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const toggleCol = (key: string) =>
    setExpandedCols((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const canExpandRow = pivotRowDims.length >= 2;
  const canExpandCol = pivotColDims.length >= 2;

  const searchQ = pivotRowSearch.trim().toLowerCase();
  const visibleRows = p
    ? (searchQ ? p.rowVals0.filter((rk) => formatG1Label(rk, pivotRowDims[0]).toLowerCase().includes(searchQ)) : p.rowVals0)
    : [];

  const visibleCols: { colPath: string[]; label: string; isSubCol: boolean }[] = [];
  if (p) {
    p.colVals0.forEach((ck) => {
      if (canExpandCol && expandedCols.has(ck)) {
        (p.subColValsMap[ck] ?? []).forEach((sk) => {
          visibleCols.push({ colPath: [ck, sk], label: formatG1Label(sk, pivotColDims[1]), isSubCol: true });
        });
      } else {
        visibleCols.push({ colPath: [ck], label: formatG1Label(ck, pivotColDims[0]), isSubCol: false });
      }
    });
  }

  const cellVal = (rowPath: string[], colPath: string[]) => (p ? p.getValue(rowPath, colPath) : 0);
  const ordCount = (rowPath: string[], colPath: string[]) => (p ? p.getOrderCount(rowPath, colPath) : 0);

  const heatStyle = (val: number) => {
    if (!pivotHeatMap || !p || val <= 0) return {};
    const share = p.maxCellVal > 0 ? val / p.maxCellVal : 0;
    return { backgroundColor: `rgba(178,2,2,${Math.max(0.04, share * 0.26)})` };
  };

  const buildCellTitle = (rPath: string[], cPath: string[]): string => {
    const rLabel = rPath.length === 0 ? 'All' : rPath.map((k, i) => formatG1Label(k, pivotRowDims[i])).join(' › ');
    const cLabel = cPath.length === 0 ? 'Total' : cPath.map((k, i) => formatG1Label(k, pivotColDims[i])).join(' › ');
    if (rPath.length === 0 && cPath.length === 0) return 'Grand Total';
    if (cPath.length === 0) return rLabel;
    if (rPath.length === 0) return cLabel;
    return `${rLabel} × ${cLabel}`;
  };

  const DataCell = ({ rowPath, colPath, isTotal = false }: { rowPath: string[]; colPath: string[]; isTotal?: boolean }) => {
    const val = cellVal(rowPath, colPath);
    const pct = p && p.grandTotal > 0 ? (val / p.grandTotal) * 100 : 0;
    const share = p && p.maxCellVal > 0 ? val / p.maxCellVal : 0;
    const darkText = pivotHeatMap && share > 0.55;
    const ords = pivotShowOrders ? ordCount(rowPath, colPath) : 0;
    const handleClick = val > 0 ? () => {
      const cellOrders = p?.getOrders(rowPath, colPath) ?? [];
      if (cellOrders.length > 0) onCellClick(cellOrders, buildCellTitle(rowPath, colPath));
    } : undefined;
    if (val === 0) {
      return (
        <td className={`border-b border-r border-gray-100 px-3 py-2 text-right tabular-nums ${isTotal ? 'bg-gray-50' : ''}`}>
          <span className="text-gray-200">—</span>
        </td>
      );
    }
    return (
      <td
        className={`border-b border-r border-gray-100 px-3 py-2 text-right tabular-nums transition-colors ${isTotal ? 'bg-gray-50' : ''} ${handleClick ? 'cursor-pointer hover:brightness-95' : ''}`}
        style={isTotal ? {} : heatStyle(val)}
        onClick={handleClick}
      >
        <div className={`text-xs font-semibold ${darkText ? 'text-[#6b0000]' : isTotal ? 'text-gray-800' : 'text-gray-700'}`}>
          {fmtMeasureVal(val, measure)}
        </div>
        {pct >= 1 && !isTotal && <div className="text-[10px] text-gray-400">{pct.toFixed(1)}%</div>}
        {pivotShowOrders && ords > 0 && !isTotal && <div className="text-[10px] text-gray-300">{ords} ord</div>}
      </td>
    );
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* ── Pivot toolbar ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2.5 border-b border-gray-100 px-4 py-2.5">
        {/* Row groupings */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Rows</span>
          {pivotRowDims.map((d, i) => (
            <span key={d} className="flex items-center gap-1 rounded-md border border-teal-200 bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
              {ALL_GROUP_ITEMS.find((g) => g.key === d)?.label ?? d}
              <button
                onClick={() => { setPivotRowDims((prev) => prev.filter((_, j) => j !== i)); setExpandedRows(new Set()); }}
                className="ml-0.5 rounded opacity-60 hover:opacity-100 hover:text-red-500"
              >
                <PiX className="h-3 w-3" />
              </button>
            </span>
          ))}
          {pivotRowDims.length < 3 && (
            <PivotDimDropdown
              title="Add row grouping"
              existing={pivotRowDims}
              otherDims={pivotColDims}
              onAdd={(k) => { setPivotRowDims((prev) => [...prev, k]); setExpandedRows(new Set()); }}
            />
          )}
          {canExpandRow && p && p.rowVals0.length > 0 && (
            <div className="flex gap-0.5">
              <button type="button" title="Expand all rows" onClick={() => setExpandedRows(new Set(p.rowVals0))}
                className="rounded px-1 py-0.5 text-[10px] text-gray-400 hover:bg-gray-100 hover:text-gray-600">all+</button>
              <button type="button" title="Collapse all rows" onClick={() => setExpandedRows(new Set())}
                className="rounded px-1 py-0.5 text-[10px] text-gray-400 hover:bg-gray-100 hover:text-gray-600">all−</button>
            </div>
          )}
        </div>

        {/* Flip button */}
        <button
          type="button"
          title="Transpose rows ↔ cols"
          onClick={() => {
            const r = pivotRowDims; const c = pivotColDims;
            setPivotRowDims(c.length > 0 ? c : ['vendor']);
            setPivotColDims(r);
            setExpandedRows(new Set()); setExpandedCols(new Set());
          }}
          className="flex h-6 w-6 items-center justify-center rounded border border-gray-200 text-gray-400 transition-colors hover:border-[#b20202] hover:text-[#b20202]"
        >
          ⇄
        </button>

        {/* Column groupings */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Cols</span>
          {pivotColDims.map((d, i) => (
            <span key={d} className="flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
              {ALL_GROUP_ITEMS.find((g) => g.key === d)?.label ?? d}
              <button
                onClick={() => { setPivotColDims((prev) => prev.filter((_, j) => j !== i)); setExpandedCols(new Set()); }}
                className="ml-0.5 rounded opacity-60 hover:opacity-100 hover:text-red-500"
              >
                <PiX className="h-3 w-3" />
              </button>
            </span>
          ))}
          {pivotColDims.length < 2 && (
            <PivotDimDropdown
              title="Add column grouping"
              existing={pivotColDims}
              otherDims={pivotRowDims}
              onAdd={(k) => { setPivotColDims((prev) => [...prev, k]); setExpandedCols(new Set()); }}
            />
          )}
          {canExpandCol && p && p.colVals0.length > 0 && (
            <div className="flex gap-0.5">
              <button type="button" title="Expand all columns" onClick={() => setExpandedCols(new Set(p.colVals0))}
                className="rounded px-1 py-0.5 text-[10px] text-gray-400 hover:bg-gray-100 hover:text-gray-600">all+</button>
              <button type="button" title="Collapse all columns" onClick={() => setExpandedCols(new Set())}
                className="rounded px-1 py-0.5 text-[10px] text-gray-400 hover:bg-gray-100 hover:text-gray-600">all−</button>
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-gray-200" />

        {/* Heat map toggle */}
        <button
          type="button"
          onClick={() => setPivotHeatMap((h) => !h)}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
            pivotHeatMap ? 'border-orange-200 bg-orange-50 text-orange-700' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
          }`}
        >
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: pivotHeatMap ? 'linear-gradient(to right, #fef2f2, #b20202)' : '#e5e7eb' }} />
          Heat map
        </button>

        {/* Show orders toggle */}
        <button
          type="button"
          onClick={() => setPivotShowOrders((s) => !s)}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
            pivotShowOrders ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
          }`}
        >
          <PiShoppingCart className="h-3 w-3" />
          Orders
        </button>

        {/* Row search */}
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs shadow-sm">
          <PiMagnifyingGlass className="h-3 w-3 shrink-0 text-gray-400" />
          <input
            type="text"
            value={pivotRowSearch}
            onChange={(e) => setPivotRowSearch(e.target.value)}
            placeholder="Filter rows…"
            className="w-24 bg-transparent text-xs text-gray-700 outline-none placeholder:text-gray-300"
          />
          {pivotRowSearch && (
            <button onClick={() => setPivotRowSearch('')} className="text-gray-300 hover:text-gray-500">
              <PiX className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Export buttons */}
        {p && p.rowVals0.length > 0 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => exportPivotCSV(p, pivotRowDims, pivotColDims, measure, expandedRows, expandedCols)}
              className="flex items-center gap-1.5 rounded-l-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-500 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-700"
            >
              <PiFloppyDisk className="h-3 w-3" />
              CSV
            </button>
            <button
              type="button"
              onClick={() => exportPivotExcel(p, pivotRowDims, pivotColDims, measure, expandedRows, expandedCols)}
              className="flex items-center gap-1.5 rounded-r-lg border border-l-0 border-gray-200 bg-white px-2.5 py-1.5 text-xs text-emerald-600 shadow-sm transition-colors hover:bg-emerald-50"
            >
              <PiFloppyDisk className="h-3 w-3" />
              Excel
            </button>
          </div>
        )}

        <div className="ml-auto text-xs text-gray-400">
          {p
            ? <><span className="font-semibold text-gray-700">{visibleRows.length}</span>{visibleRows.length !== p.rowVals0.length && ` / ${p.rowVals0.length}`} rows · <span className="font-semibold text-gray-700">{fmtMeasureVal(p.grandTotal, measure)}</span></>
            : 'Loading…'}
        </div>
      </div>

      {/* ── Pivot table ───────────────────────────────────────────────── */}
      {(!p || p.rowVals0.length === 0) ? (
        <div className="flex flex-col items-center justify-center gap-2 py-20">
          <PiTable className="h-10 w-10 text-gray-200" />
          <p className="text-sm text-gray-400">
            {pivotRowDims.length === 0 ? 'Add a row grouping to start' : 'No data for the selected filters'}
          </p>
        </div>
      ) : (
        <div className="overflow-auto" style={{ maxHeight: '75vh' }}>
          {visibleRows.length === 0 && searchQ && (
            <div className="flex items-center justify-center py-10 text-sm text-gray-400">
              No rows match <span className="ml-1 font-medium text-gray-600">&quot;{pivotRowSearch}&quot;</span>
            </div>
          )}
          <table className="border-collapse text-xs" style={{ minWidth: '100%', display: visibleRows.length === 0 ? 'none' : undefined }}>
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-30 min-w-[260px] border-b border-r border-gray-100 bg-gray-50 px-4 py-3 text-left align-bottom">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#b20202]">
                    {pivotRowDims.map((d) => ALL_GROUP_ITEMS.find((g) => g.key === d)?.label ?? d).join(' › ')}
                  </div>
                </th>
                <th className="sticky top-0 z-20 min-w-[120px] border-b border-r border-gray-200 bg-gray-50 px-3 py-3 text-right align-bottom">
                  <div className="text-xs font-bold text-gray-700">Total</div>
                  <div className="mt-0.5 text-[10px] tabular-nums text-gray-500">{fmtMeasureVal(p.grandTotal, measure)}</div>
                  {pivotShowOrders && <div className="text-[10px] text-gray-300">{p.getOrderCount([], [])} ord</div>}
                </th>
                {p.colVals0.map((ck) => {
                  const isExpanded = canExpandCol && expandedCols.has(ck);
                  const subCols = isExpanded ? (p.subColValsMap[ck] ?? []) : [];
                  const colSpan = isExpanded ? subCols.length : 1;
                  return (
                    <th key={ck} colSpan={colSpan} className="sticky top-0 z-20 min-w-[110px] border-b border-l border-gray-100 bg-white px-3 py-3 text-center align-bottom">
                      <div className="flex items-center justify-center gap-1">
                        {canExpandCol && (
                          <button onClick={() => toggleCol(ck)}
                            className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-gray-300 text-[10px] font-bold text-gray-500 transition-colors hover:border-[#b20202] hover:text-[#b20202]">
                            {isExpanded ? '−' : '+'}
                          </button>
                        )}
                        <span className="font-semibold text-gray-700 leading-tight">{formatG1Label(ck, pivotColDims[0])}</span>
                      </div>
                      <div className="mt-0.5 text-[10px] tabular-nums text-gray-400">{fmtMeasureVal(p.colTotals[ck], measure)}</div>
                    </th>
                  );
                })}
              </tr>

              {canExpandCol && expandedCols.size > 0 && (
                <tr>
                  <th className="sticky left-0 top-[52px] z-30 border-b border-r border-gray-100 bg-gray-50" />
                  <th className="sticky top-[52px] z-20 border-b border-r border-gray-200 bg-gray-50" />
                  {p.colVals0.map((ck) => {
                    if (!expandedCols.has(ck)) {
                      return <th key={ck} className="sticky top-[52px] z-20 min-w-[110px] border-b border-r border-gray-100 bg-white" />;
                    }
                    return (p.subColValsMap[ck] ?? []).map((sk) => (
                      <th key={`${ck}:${sk}`} className="sticky top-[52px] z-20 min-w-[100px] border-b border-r border-gray-100 bg-white px-3 py-2 text-right">
                        <span className="text-[11px] font-medium text-gray-600">{formatG1Label(sk, pivotColDims[1])}</span>
                      </th>
                    ));
                  })}
                </tr>
              )}
            </thead>

            <tbody>
              <tr className="border-b-2 border-gray-200 bg-gray-50/80">
                <td className="sticky left-0 z-10 border-b-2 border-r border-gray-200 bg-gray-50 px-4 py-2.5">
                  <span className="text-xs font-bold text-gray-700">Total</span>
                </td>
                <DataCell rowPath={[]} colPath={[]} isTotal />
                {visibleCols.map(({ colPath, isSubCol }) => (
                  <DataCell key={colPath.join(':')} rowPath={[]} colPath={colPath} isTotal={isSubCol} />
                ))}
              </tr>

              {visibleRows.map((rk, ri) => {
                const rowTotal = p.rowTotals[rk];
                const rowShare = p.grandTotal > 0 ? (rowTotal / p.grandTotal) * 100 : 0;
                const isRowExpanded = canExpandRow && expandedRows.has(rk);
                const subRows = isRowExpanded ? (p.subRowValsMap[rk] ?? []) : [];

                return (
                  <Fragment key={rk}>
                    <tr className={ri % 2 === 0 ? 'bg-white hover:bg-gray-50/60' : 'bg-gray-50/30 hover:bg-gray-50/80'}>
                      <td className="sticky left-0 z-10 border-b border-r border-gray-100 px-4 py-2.5" style={{ background: ri % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <div className="flex items-center gap-2">
                          {canExpandRow ? (
                            <button onClick={() => toggleRow(rk)}
                              className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-gray-300 text-[10px] font-bold text-gray-500 transition-colors hover:border-[#b20202] hover:text-[#b20202]">
                              {isRowExpanded ? '−' : '+'}
                            </button>
                          ) : (
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-gray-200 text-[10px] text-gray-300">□</span>
                          )}
                          <div className="min-w-0">
                            <div className="font-medium text-gray-800 leading-snug break-words" style={{ maxWidth: 220 }}>
                              {formatG1Label(rk, pivotRowDims[0])}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1">
                              <div className="h-0.5 flex-1 overflow-hidden rounded-full bg-gray-100" style={{ width: 80 }}>
                                <div className="h-full rounded-full bg-[#b20202] opacity-30" style={{ width: `${rowShare}%` }} />
                              </div>
                              <span className="text-[9px] text-gray-400">{rowShare.toFixed(1)}%</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <DataCell rowPath={[rk]} colPath={[]} isTotal />
                      {visibleCols.map(({ colPath, isSubCol }) => (
                        <DataCell key={colPath.join(':')} rowPath={[rk]} colPath={colPath} isTotal={isSubCol} />
                      ))}
                    </tr>

                    {subRows.map((srk) => (
                      <tr key={`${rk}:${srk}`} className="bg-[#fafbff] hover:bg-blue-50/20">
                        <td className="sticky left-0 z-10 border-b border-r border-gray-100 bg-[#fafbff] px-4 py-2">
                          <div className="flex items-center gap-2 pl-7">
                            <span className="h-px w-3 shrink-0 bg-gray-300" />
                            <span className="text-gray-600 leading-snug break-words" style={{ maxWidth: 200 }}>
                              {formatG1Label(srk, pivotRowDims[1])}
                            </span>
                          </div>
                        </td>
                        <DataCell rowPath={[rk, srk]} colPath={[]} isTotal />
                        {visibleCols.map(({ colPath, isSubCol }) => (
                          <DataCell key={colPath.join(':')} rowPath={[rk, srk]} colPath={colPath} isTotal={isSubCol} />
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>

            {p.colVals0.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td className="sticky left-0 z-10 border-r border-gray-200 bg-gray-50 px-4 py-2.5 text-xs font-bold text-gray-700">Total</td>
                  <td className="border-r border-gray-200 bg-gray-100 px-3 py-2.5 text-right tabular-nums">
                    <div className="text-sm font-bold text-gray-900">{fmtMeasureVal(p.grandTotal, measure)}</div>
                  </td>
                  {visibleCols.map(({ colPath }) => {
                    const val = cellVal([], colPath);
                    const pct = p.grandTotal > 0 ? (val / p.grandTotal) * 100 : 0;
                    return (
                      <td key={colPath.join(':')} className="border-r border-gray-100 bg-gray-50 px-3 py-2.5 text-right tabular-nums">
                        <div className="font-bold text-gray-800">{fmtMeasureVal(val, measure)}</div>
                        {pct > 0 && <div className="text-[10px] text-gray-400">{pct.toFixed(1)}%</div>}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd client/apps/isomorphic && pnpm run type:check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add client/apps/isomorphic/src/app/shared/purchases/purchases-analytics-charts.tsx
git commit -m "feat(purchases): add PivotView component for hierarchical pivot table"
```

---

## Task 4: Wire up `viewMode`/pivot state in `purchases-analytics.tsx`

**Files:**
- Modify: `client/apps/isomorphic/src/app/shared/purchases/purchases-analytics.tsx`

- [ ] **Step 1: Extend imports**

In the `from './purchases-analytics-helpers'` import block (currently lines 42-65),
add `computeHierarchicalPivot` and the `ViewMode`/`HierPivotResult` types. Change:

```ts
  computeGroupData,
  computeMultiSeries,
  type GroupByKey,
```

to:

```ts
  computeGroupData,
  computeMultiSeries,
  computeHierarchicalPivot,
  type GroupByKey,
  type ViewMode,
  type HierPivotResult,
```

In the `from './purchases-analytics-charts'` import block (currently lines 66-73),
add `PivotView`:

```ts
import {
  Dropdown,
  DropItem,
  DropSection,
  FilterListSection,
  MainChart,
  StackedChart,
  PivotView,
} from './purchases-analytics-charts';
```

- [ ] **Step 2: Add pivot state**

Immediately after the existing `drillData` state declaration (currently line 113):

```tsx
  const [drillData, setDrillData] = useState<{ orders: PurchaseOrder[]; title: string } | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('graph');
  const [pivotRowDims, setPivotRowDims] = useState<GroupByKey[]>(['vendor']);
  const [pivotColDims, setPivotColDims] = useState<GroupByKey[]>([]);
  const [pivotHeatMap, setPivotHeatMap] = useState(true);
  const [pivotShowOrders, setPivotShowOrders] = useState(false);
  const [pivotRowSearch, setPivotRowSearch] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [expandedCols, setExpandedCols] = useState<Set<string>>(new Set());
```

- [ ] **Step 3: Add `pivotData` memo**

Immediately after the existing `multiSeries` memo (currently ends at line 249):

```tsx
  const pivotData: HierPivotResult | null = useMemo(() => {
    if (viewMode !== 'pivot' || pivotRowDims.length === 0) return null;
    return computeHierarchicalPivot(filtered, pivotRowDims, pivotColDims, measure, prodMeta, toBase);
  }, [viewMode, filtered, pivotRowDims, pivotColDims, measure, prodMeta, toBase]);
```

- [ ] **Step 4: Add Graph/Pivot view toggle to the control bar**

The control bar is `<div className="mb-3 flex flex-wrap items-center gap-2">`
(currently line 531) and currently ends with the "Chart-type switch" block
(currently lines 705-729), immediately before the closing `</div>` at line 730.

Insert the view toggle **immediately after** the chart-type switch's closing `</div>`
(end of current line 729) and **before** the control bar's closing `</div>`
(current line 730):

```tsx
        {/* View toggle: Graph / Pivot */}
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-0.5">
          <button
            type="button"
            onClick={() => setViewMode('graph')}
            title="Graph view"
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              viewMode === 'graph' ? 'bg-[#b20202] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <PiChartBar className="h-3.5 w-3.5" />
            Graph
          </button>
          <button
            type="button"
            onClick={() => setViewMode('pivot')}
            title="Pivot table"
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              viewMode === 'pivot' ? 'bg-[#b20202] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <PiTable className="h-3.5 w-3.5" />
            Pivot
          </button>
        </div>
```

Then wrap the existing chart-type switch (current lines 705-729, the
`{/* Chart-type switch */}` block) so it only renders in graph view — change:

```tsx
        {/* Chart-type switch */}
        <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
```

to:

```tsx
        {/* Chart-type switch */}
        {viewMode === 'graph' && (
        <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
```

and add the matching closing `)}` after that block's existing closing `</div>`
(current line 729), i.e.:

```tsx
          ))}
        </div>
        )}
```

`PiChartBar` and `PiTable` are already imported (lines 9 and 17).

- [ ] **Step 5: Conditionally render `PivotView` instead of the chart card**

The chart card is `<div className="rounded-xl border border-gray-200 bg-white">`
(currently line 1063) through its matching closing `</div>` (currently line 1103).
Wrap the whole card so it only renders in graph view, and render `PivotView` in
pivot view. Change:

```tsx
      {/* ── Chart / table ── */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-800">
            {measureLabel} by {groupLabel}
            {groupLabel2 ? ` & ${groupLabel2}` : ''}
          </h2>
          <span className="text-xs text-gray-500">
            {measure === 'avg_order'
              ? `${totalOrders} orders`
              : `Total: ${fmtMeasureVal(totalValue, measure)}`}
          </span>
        </div>

        <div className="p-1">
          {multiSeries ? (
            <StackedChart
              rows={multiSeries.rows}
              series={multiSeries.series}
              chartType={chartType}
              measure={measure}
              groupLabel={groupLabel}
              measureLabel={measureLabel}
              orderMap={multiSeries.orderMap}
              onSegmentClick={(rowLabel, seriesKey, poList) =>
                openDrill(rowLabel, poList, seriesKey)
              }
            />
          ) : (
            <MainChart
              data={groupData}
              chartType={chartType}
              measure={measure}
              groupLabel={groupLabel}
              measureLabel={measureLabel}
              totalValue={totalValue}
              totalOrders={totalOrders}
              onBarClick={(label, poList) => openDrill(label, poList)}
            />
          )}
        </div>
      </div>
```

to:

```tsx
      {/* ── Chart / table / pivot ── */}
      {viewMode === 'pivot' ? (
        <PivotView
          pivotData={pivotData}
          pivotRowDims={pivotRowDims}
          pivotColDims={pivotColDims}
          measure={measure}
          pivotHeatMap={pivotHeatMap}
          pivotShowOrders={pivotShowOrders}
          pivotRowSearch={pivotRowSearch}
          expandedRows={expandedRows}
          expandedCols={expandedCols}
          setPivotRowDims={setPivotRowDims}
          setPivotColDims={setPivotColDims}
          setPivotHeatMap={setPivotHeatMap}
          setPivotShowOrders={setPivotShowOrders}
          setPivotRowSearch={setPivotRowSearch}
          setExpandedRows={setExpandedRows}
          setExpandedCols={setExpandedCols}
          onCellClick={(orders, title) => setDrillData({ orders, title })}
        />
      ) : (
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-800">
            {measureLabel} by {groupLabel}
            {groupLabel2 ? ` & ${groupLabel2}` : ''}
          </h2>
          <span className="text-xs text-gray-500">
            {measure === 'avg_order'
              ? `${totalOrders} orders`
              : `Total: ${fmtMeasureVal(totalValue, measure)}`}
          </span>
        </div>

        <div className="p-1">
          {multiSeries ? (
            <StackedChart
              rows={multiSeries.rows}
              series={multiSeries.series}
              chartType={chartType}
              measure={measure}
              groupLabel={groupLabel}
              measureLabel={measureLabel}
              orderMap={multiSeries.orderMap}
              onSegmentClick={(rowLabel, seriesKey, poList) =>
                openDrill(rowLabel, poList, seriesKey)
              }
            />
          ) : (
            <MainChart
              data={groupData}
              chartType={chartType}
              measure={measure}
              groupLabel={groupLabel}
              measureLabel={measureLabel}
              totalValue={totalValue}
              totalOrders={totalOrders}
              onBarClick={(label, poList) => openDrill(label, poList)}
            />
          )}
        </div>
      </div>
      )}
```

- [ ] **Step 6: Type-check**

Run: `cd client/apps/isomorphic && pnpm run type:check`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add client/apps/isomorphic/src/app/shared/purchases/purchases-analytics.tsx
git commit -m "feat(purchases): wire up pivot view mode in purchase analytics page"
```

---

## Task 5: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Start dev server**

Run: `cd client/apps/isomorphic && pnpm run dev`
Expected: server starts on its configured port without compile errors.

- [ ] **Step 2: Verify Graph view (Phase 1 regression check)**

Navigate to `/purchases/analytics`. For at least 2-3 group-by dims (e.g. `vendor`,
`product_category`, `order_month`) × each of bar/line/pie/table chart types:
- Chart renders with sensible data (not all zeros/blank).
- Clicking a bar/slice/row opens the `PODrillDrawer` with matching POs.
- 2-level grouping (e.g. `vendor` + `status`) renders a stacked chart correctly.

- [ ] **Step 3: Verify Pivot view — basic**

Click the **Pivot** toggle. Confirm:
- Default pivot (rows = Vendor, no columns) renders a table with vendor rows, a
  Total column, and a grand-total row/footer.
- Row values for `total_cost` roughly match the bar-chart values for the same
  group-by from Step 2 (sanity check on the `aggregateMeasure` adaptation).

- [ ] **Step 4: Verify Pivot view — 2D pivot + expand/collapse**

- Add a column grouping (e.g. `status`) via the Cols `+` dropdown → table grows
  columns, column totals footer appears.
- Add a 2nd row dimension (e.g. `product_category`) → row `+`/`−` toggle appears;
  expanding shows indented sub-rows with correct sub-totals.
- "all+"/"all−" buttons expand/collapse all rows at once.
- Flip (⇄) button swaps row/col dims and resets expansion state.

- [ ] **Step 5: Verify Pivot view — heatmap, orders, search, export, drill**

- Heat-map toggle shades cells by relative magnitude; toggling off removes shading.
- "Orders" toggle shows order counts under each cell value.
- Row search filters visible rows by label (case-insensitive substring).
- Clicking a non-zero cell opens `PODrillDrawer` with the correct PO subset and a
  sensible title (row label × column label).
- CSV and Excel export buttons download files named `pivot-YYYY-MM-DD.csv`/`.xls`
  with header/total/data rows matching the on-screen table.

- [ ] **Step 6: Verify item-level pivot dims**

Set row grouping to `product_category` (or `brand`/`subcategory`) and confirm real
category/brand names appear (not all "Uncategorized"/"No Brand") for products that
have catalog metadata — this exercises the `resolveItemDimKey` path inside
`computeHierarchicalPivot`.

---

## Self-Review Notes

- **Spec coverage:** All Phase 2 items from
  `docs/superpowers/specs/2026-06-12-purchases-analytics-redesign-design.md`
  ("Pivot table view (viewMode, hierarchical pivot, heatmap, CSV/Excel export)") are
  covered by Tasks 1-4. Bar/line/pie/table (Phase 1) are already implemented;
  Task 5 Step 2 re-verifies them per the user's request to "work on the pie chart,
  bar chart, line chart and pivot."
- **Type consistency:** `HierPivotResult`/`computeHierarchicalPivot` (Task 1) →
  imported and used identically in `PivotView` (Task 3) and the page (Task 4).
  `onCellClick(orders: PurchaseOrder[], title: string)` signature matches
  `setDrillData({ orders, title })`'s existing shape (`{ orders: PurchaseOrder[]; title: string }`).
- **No placeholders:** every step contains complete, ready-to-paste code.

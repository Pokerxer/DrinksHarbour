// Pivot view for /sales/analytics — Odoo-style hierarchical cross-tab.
//
// Rows and columns take up to two dimensions each; cells drill into the
// documents behind them. The aggregation comes from the tested engine
// (computeSalesHierarchicalPivot); this file is the chrome: dimension chips,
// heat map, expansion, row search, CSV export.

'use client';

import { Fragment, useState, type Dispatch, type SetStateAction } from 'react';
import {
  PiCaretDown,
  PiFloppyDisk,
  PiMagnifyingGlass,
  PiTable,
  PiX,
} from 'react-icons/pi';
import type { SalesOrder } from '@/services/salesOrder.service';
import { downloadCSV } from '../../purchases/purchases-analytics-charts';
import {
  ALL_SALES_GROUP_ITEMS,
  formatSalesG1Label,
  type SalesGroupByKey,
  type SalesHierPivotResult,
  type SalesMeasure,
} from './sales-analytics-helpers';

const naira = (v: number) =>
  `₦${Math.round(v).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;

function fmtMeasure(v: number, measure: SalesMeasure): string {
  return v === 0 ? '—' : naira(v);
}

function labelOf(dim: SalesGroupByKey): string {
  return (
    ALL_SALES_GROUP_ITEMS.find((g) => g.key === dim)?.label ?? dim
  );
}

function fmtKey(key: string, dim: SalesGroupByKey | undefined): string {
  return dim ? formatSalesG1Label(key, dim) : key;
}

function DimDropdown({
  title,
  existing,
  otherDims,
  onAdd,
}: {
  title: string;
  existing: SalesGroupByKey[];
  otherDims: SalesGroupByKey[];
  onAdd: (k: SalesGroupByKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const taken = new Set([...existing, ...otherDims]);
  const options = ALL_SALES_GROUP_ITEMS.filter((g) => !taken.has(g.key));
  if (options.length === 0) return null;
  return (
    <div className="relative">
      <button
        type="button"
        title={title}
        onClick={() => setOpen((v) => !v)}
        className="flex h-5 w-5 items-center justify-center rounded border border-dashed border-gray-300 text-[11px] font-bold leading-none text-gray-400 transition-colors hover:border-[#b20202] hover:text-[#b20202]"
      >
        +
      </button>
      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 max-h-64 w-48 overflow-y-auto rounded-xl border border-gray-100 bg-white py-1 shadow-xl">
          {options.map((g) => (
            <button
              key={g.key}
              type="button"
              onClick={() => {
                onAdd(g.key);
                setOpen(false);
              }}
              className="flex w-full items-center px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50"
            >
              {g.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DimChip({
  dim,
  tone,
  onRemove,
}: {
  dim: SalesGroupByKey;
  tone: 'row' | 'col';
  onRemove: () => void;
}) {
  const cls =
    tone === 'row'
      ? 'border-teal-200 bg-teal-50 text-teal-700'
      : 'border-indigo-200 bg-indigo-50 text-indigo-700';
  return (
    <span
      className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {labelOf(dim)}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 rounded opacity-60 transition-opacity hover:text-red-500 hover:opacity-100"
      >
        <PiX className="h-3 w-3" />
      </button>
    </span>
  );
}

/** RFC-4180 CSV of the pivot as displayed (expanded sub-rows/cols included). */
function exportPivotCSV(
  p: SalesHierPivotResult,
  rowDims: SalesGroupByKey[],
  colDims: SalesGroupByKey[],
  expandedRows: Set<string>,
  expandedCols: Set<string>
) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const num = (v: number) => String(Math.round(v * 100) / 100);

  const cols: { path: string[]; label: string }[] = [];
  p.colVals0.forEach((ck) => {
    if (colDims[1] && expandedCols.has(ck)) {
      (p.subColValsMap[ck] ?? []).forEach((sk) => {
        cols.push({
          path: [ck, sk],
          label: `${fmtKey(ck, colDims[0])} › ${fmtKey(sk, colDims[1])}`,
        });
      });
    } else {
      cols.push({ path: [ck], label: fmtKey(ck, colDims[0]) });
    }
  });

  const lines: string[][] = [
    [
      esc(rowDims.map(labelOf).join(' › ')),
      esc('Total'),
      ...cols.map((c) => esc(c.label)),
    ],
  ];

  const emitRow = (label: string, rPath: string[], isSub: boolean) => {
    lines.push([
      esc(isSub ? `  ${label}` : label),
      num(p.getValue(rPath, [])),
      ...cols.map((c) => num(p.getValue(rPath, c.path))),
    ]);
  };

  emitRow('Total', [], false);
  p.rowVals0.forEach((rk) => {
    emitRow(fmtKey(rk, rowDims[0]), [rk], false);
    if (rowDims[1] && expandedRows.has(rk)) {
      (p.subRowValsMap[rk] ?? []).forEach((srk) =>
        emitRow(fmtKey(srk, rowDims[1]), [rk, srk], true)
      );
    }
  });

  downloadCSV(lines.map((l) => l.join(',')).join('\n'), `sales-pivot-${new Date().toISOString().slice(0, 10)}.csv`);
}

export default function SalesAnalyticsPivot({
  pivot,
  rowDims,
  colDims,
  measure,
  heatMap,
  showDocs,
  rowSearch,
  expandedRows,
  expandedCols,
  setRowDims,
  setColDims,
  setHeatMap,
  setShowDocs,
  setRowSearch,
  setExpandedRows,
  setExpandedCols,
  onCellClick,
}: {
  pivot: SalesHierPivotResult | null;
  rowDims: SalesGroupByKey[];
  colDims: SalesGroupByKey[];
  measure: SalesMeasure;
  heatMap: boolean;
  showDocs: boolean;
  rowSearch: string;
  expandedRows: Set<string>;
  expandedCols: Set<string>;
  setRowDims: Dispatch<SetStateAction<SalesGroupByKey[]>>;
  setColDims: Dispatch<SetStateAction<SalesGroupByKey[]>>;
  setHeatMap: Dispatch<SetStateAction<boolean>>;
  setShowDocs: Dispatch<SetStateAction<boolean>>;
  setRowSearch: Dispatch<SetStateAction<string>>;
  setExpandedRows: Dispatch<SetStateAction<Set<string>>>;
  setExpandedCols: Dispatch<SetStateAction<Set<string>>>;
  onCellClick: (orders: SalesOrder[], title: string) => void;
}) {
  const p = pivot;
  const canExpandRow = rowDims.length >= 2;
  const canExpandCol = colDims.length >= 2;

  const toggleSet = (
    setter: Dispatch<SetStateAction<Set<string>>>,
    key: string
  ) =>
    setter((prev) => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });

  const q = rowSearch.trim().toLowerCase();
  const visibleRows = p
    ? q
      ? p.rowVals0.filter((rk) =>
          fmtKey(rk, rowDims[0]).toLowerCase().includes(q)
        )
      : p.rowVals0
    : [];

  const visibleCols: { path: string[]; label: string; isSub: boolean }[] = [];
  if (p) {
    p.colVals0.forEach((ck) => {
      if (canExpandCol && expandedCols.has(ck)) {
        (p.subColValsMap[ck] ?? []).forEach((sk) => {
          visibleCols.push({
            path: [ck, sk],
            label: fmtKey(sk, colDims[1]),
            isSub: true,
          });
        });
      } else {
        visibleCols.push({
          path: [ck],
          label: fmtKey(ck, colDims[0]),
          isSub: false,
        });
      }
    });
  }

  const heatStyle = (val: number) => {
    if (!heatMap || !p || val <= 0) return undefined;
    const share = p.maxCellVal > 0 ? val / p.maxCellVal : 0;
    return { backgroundColor: `rgba(178,2,2,${Math.max(0.04, share * 0.26)})` };
  };

  const cellTitle = (rPath: string[], cPath: string[]): string => {
    const r =
      rPath.length === 0
        ? 'All'
        : rPath.map((k, i) => fmtKey(k, rowDims[i])).join(' › ');
    const c =
      cPath.length === 0
        ? 'Total'
        : cPath.map((k, i) => fmtKey(k, colDims[i])).join(' › ');
    if (rPath.length === 0 && cPath.length === 0) return 'Grand Total';
    if (cPath.length === 0) return r;
    if (rPath.length === 0) return c;
    return `${r} × ${c}`;
  };

  const DataCell = ({
    rowPath,
    colPath,
    isTotal = false,
  }: {
    rowPath: string[];
    colPath: string[];
    isTotal?: boolean;
  }) => {
    const val = p ? p.getValue(rowPath, colPath) : 0;
    const pct = p && p.grandTotal > 0 ? (val / p.grandTotal) * 100 : 0;
    const share = p && p.maxCellVal > 0 ? val / p.maxCellVal : 0;
    const darkText = heatMap && share > 0.55;
    const docs = showDocs && p ? p.getOrderCount(rowPath, colPath) : 0;
    const clickable =
      val > 0 && p ? () => {
        const cellOrders = p.getOrders(rowPath, colPath);
        if (cellOrders.length > 0)
          onCellClick(cellOrders, cellTitle(rowPath, colPath));
      } : undefined;

    if (val === 0)
      return (
        <td
          className={`border-b border-r border-gray-100 px-3 py-2 text-right tabular-nums ${isTotal ? 'bg-gray-50' : ''}`}
        >
          <span className="text-gray-200">—</span>
        </td>
      );
    return (
      <td
        className={`border-b border-r border-gray-100 px-3 py-2 text-right tabular-nums transition-colors ${isTotal ? 'bg-gray-50' : ''} ${clickable ? 'cursor-pointer hover:brightness-95' : ''}`}
        style={isTotal ? undefined : heatStyle(val)}
        onClick={clickable}
      >
        <div
          className={`text-xs font-semibold ${darkText ? 'text-[#6b0000]' : isTotal ? 'text-gray-800' : 'text-gray-700'}`}
        >
          {fmtMeasure(val, measure)}
        </div>
        {pct >= 1 && !isTotal && (
          <div className="text-[10px] text-gray-400">{pct.toFixed(1)}%</div>
        )}
        {showDocs && docs > 0 && !isTotal && (
          <div className="text-[10px] text-gray-300">{docs} doc</div>
        )}
      </td>
    );
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5 border-b border-gray-100 px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Rows
          </span>
          {rowDims.map((d, i) => (
            <DimChip
              key={d}
              dim={d}
              tone="row"
              onRemove={() => {
                setRowDims((prev) => prev.filter((_, j) => j !== i));
                setExpandedRows(new Set());
              }}
            />
          ))}
          {rowDims.length < 2 && (
            <DimDropdown
              title="Add row grouping"
              existing={rowDims}
              otherDims={colDims}
              onAdd={(k) => {
                setRowDims((prev) => [...prev, k]);
                setExpandedRows(new Set());
              }}
            />
          )}
          {canExpandRow && p && p.rowVals0.length > 0 && (
            <div className="flex gap-0.5">
              <button
                type="button"
                title="Expand all rows"
                onClick={() => setExpandedRows(new Set(p.rowVals0))}
                className="rounded px-1 py-0.5 text-[10px] text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                all+
              </button>
              <button
                type="button"
                title="Collapse all rows"
                onClick={() => setExpandedRows(new Set())}
                className="rounded px-1 py-0.5 text-[10px] text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                all−
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          title="Transpose rows and columns"
          onClick={() => {
            const r = rowDims;
            const c = colDims;
            setRowDims(c.length > 0 ? c : ['customer']);
            setColDims(r);
            setExpandedRows(new Set());
            setExpandedCols(new Set());
          }}
          className="flex h-6 w-6 items-center justify-center rounded border border-gray-200 text-gray-400 transition-colors hover:border-[#b20202] hover:text-[#b20202]"
        >
          ⇄
        </button>

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Cols
          </span>
          {colDims.map((d, i) => (
            <DimChip
              key={d}
              dim={d}
              tone="col"
              onRemove={() => {
                setColDims((prev) => prev.filter((_, j) => j !== i));
                setExpandedCols(new Set());
              }}
            />
          ))}
          {colDims.length < 2 && (
            <DimDropdown
              title="Add column grouping"
              existing={colDims}
              otherDims={rowDims}
              onAdd={(k) => {
                setColDims((prev) => [...prev, k]);
                setExpandedCols(new Set());
              }}
            />
          )}
          {canExpandCol && p && p.colVals0.length > 0 && (
            <div className="flex gap-0.5">
              <button
                type="button"
                title="Expand all columns"
                onClick={() => setExpandedCols(new Set(p.colVals0))}
                className="rounded px-1 py-0.5 text-[10px] text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                all+
              </button>
              <button
                type="button"
                title="Collapse all columns"
                onClick={() => setExpandedCols(new Set())}
                className="rounded px-1 py-0.5 text-[10px] text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                all−
              </button>
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-gray-200" />

        <button
          type="button"
          onClick={() => setHeatMap((h) => !h)}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
            heatMap
              ? 'border-orange-200 bg-orange-50 text-orange-700'
              : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
          }`}
        >
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-sm"
            style={{
              background: heatMap
                ? 'linear-gradient(to right, #fef2f2, #b20202)'
                : '#e5e7eb',
            }}
          />
          Heat map
        </button>

        <button
          type="button"
          onClick={() => setShowDocs((s) => !s)}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
            showDocs
              ? 'border-sky-200 bg-sky-50 text-sky-700'
              : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
          }`}
        >
          Docs
        </button>

        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs shadow-sm">
          <PiMagnifyingGlass className="h-3 w-3 shrink-0 text-gray-400" />
          <input
            type="text"
            value={rowSearch}
            onChange={(e) => setRowSearch(e.target.value)}
            placeholder="Filter rows…"
            className="w-24 bg-transparent text-xs text-gray-700 outline-none placeholder:text-gray-300"
          />
          {rowSearch && (
            <button
              type="button"
              onClick={() => setRowSearch('')}
              className="text-gray-300 hover:text-gray-500"
            >
              <PiX className="h-3 w-3" />
            </button>
          )}
        </div>

        {p && p.rowVals0.length > 0 && (
          <button
            type="button"
            onClick={() =>
              exportPivotCSV(p, rowDims, colDims, expandedRows, expandedCols)
            }
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-500 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-700"
          >
            <PiFloppyDisk className="h-3 w-3" />
            CSV
          </button>
        )}

        <div className="ml-auto text-xs text-gray-400">
          {p ? (
            <>
              <span className="font-semibold text-gray-700">
                {visibleRows.length}
              </span>
              {visibleRows.length !== p.rowVals0.length &&
                ` / ${p.rowVals0.length}`}{' '}
              rows ·{' '}
              <span className="font-semibold text-gray-700">
                {naira(p.grandTotal)}
              </span>
            </>
          ) : (
            'Add a row grouping to start'
          )}
        </div>
      </div>

      {/* Table */}
      {!p || p.rowVals0.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-20">
          <PiTable className="h-10 w-10 text-gray-200" />
          <p className="text-sm text-gray-400">
            {rowDims.length === 0
              ? 'Add a row grouping to start'
              : 'No data for the selected filters'}
          </p>
        </div>
      ) : (
        <div className="overflow-auto" style={{ maxHeight: '72vh' }}>
          {visibleRows.length === 0 && q && (
            <div className="py-10 text-center text-sm text-gray-400">
              No rows match &quot;{rowSearch}&quot;
            </div>
          )}
          <table
            className="border-collapse text-xs"
            style={{
              minWidth: '100%',
              display: visibleRows.length === 0 ? 'none' : undefined,
            }}
          >
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-30 min-w-[240px] border-b border-r border-gray-100 bg-gray-50 px-4 py-3 text-left align-bottom">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#b20202]">
                    {rowDims.map(labelOf).join(' › ')}
                  </div>
                </th>
                <th className="sticky top-0 z-20 min-w-[110px] border-b border-r border-gray-200 bg-gray-50 px-3 py-3 text-right align-bottom">
                  <div className="text-xs font-bold text-gray-700">Total</div>
                  <div className="mt-0.5 text-[10px] tabular-nums text-gray-500">
                    {naira(p.grandTotal)}
                  </div>
                </th>
                {p.colVals0.map((ck) => {
                  const isExpanded = canExpandCol && expandedCols.has(ck);
                  const subCols = isExpanded
                    ? (p.subColValsMap[ck] ?? [])
                    : [];
                  return (
                    <th
                      key={ck}
                      colSpan={isExpanded ? Math.max(1, subCols.length) : 1}
                      className="sticky top-0 z-20 min-w-[104px] border-b border-l border-gray-100 bg-white px-3 py-3 text-center align-bottom"
                    >
                      <div className="flex items-center justify-center gap-1">
                        {canExpandCol && (
                          <button
                            type="button"
                            onClick={() => toggleSet(setExpandedCols, ck)}
                            className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-gray-300 text-[10px] font-bold text-gray-500 transition-colors hover:border-[#b20202] hover:text-[#b20202]"
                          >
                            {isExpanded ? '−' : '+'}
                          </button>
                        )}
                        <span className="font-semibold leading-tight text-gray-700">
                          {fmtKey(ck, colDims[0])}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[10px] tabular-nums text-gray-400">
                        {naira(p.colTotals[ck])}
                      </div>
                    </th>
                  );
                })}
              </tr>

              {canExpandCol && expandedCols.size > 0 && (
                <tr>
                  <th className="sticky left-0 z-30 border-b border-r border-gray-100 bg-gray-50" />
                  <th className="sticky z-20 border-b border-r border-gray-200 bg-gray-50" />
                  {p.colVals0.map((ck) =>
                    !expandedCols.has(ck) ? (
                      <th
                        key={ck}
                        className="min-w-[104px] border-b border-r border-gray-100 bg-white"
                      />
                    ) : (
                      (p.subColValsMap[ck] ?? []).map((sk) => (
                        <th
                          key={`${ck}:${sk}`}
                          className="min-w-[96px] border-b border-r border-gray-100 bg-white px-3 py-2 text-right"
                        >
                          <span className="text-[11px] font-medium text-gray-600">
                            {fmtKey(sk, colDims[1])}
                          </span>
                        </th>
                      ))
                    )
                  )}
                </tr>
              )}
            </thead>

            <tbody>
              <tr className="border-b-2 border-gray-200 bg-gray-50/80">
                <td className="sticky left-0 z-10 border-b-2 border-r border-gray-200 bg-gray-50 px-4 py-2.5">
                  <span className="text-xs font-bold text-gray-700">Total</span>
                </td>
                <DataCell rowPath={[]} colPath={[]} isTotal />
                {visibleCols.map(({ path, isSub }) => (
                  <DataCell
                    key={path.join(':')}
                    rowPath={[]}
                    colPath={path}
                    isTotal={isSub}
                  />
                ))}
              </tr>

              {visibleRows.map((rk, ri) => {
                const rowTotal = p.rowTotals[rk];
                const rowShare =
                  p.grandTotal > 0 ? (rowTotal / p.grandTotal) * 100 : 0;
                const isExpanded = canExpandRow && expandedRows.has(rk);
                const subRows = isExpanded
                  ? (p.subRowValsMap[rk] ?? [])
                  : [];
                return (
                  <Fragment key={rk}>
                    <tr
                      className={
                        ri % 2 === 0
                          ? 'bg-white hover:bg-gray-50/60'
                          : 'bg-gray-50/30 hover:bg-gray-50/80'
                      }
                    >
                      <td
                        className="sticky left-0 z-10 border-b border-r border-gray-100 px-4 py-2.5"
                        style={{ background: ri % 2 === 0 ? '#fff' : '#fafafa' }}
                      >
                        <div className="flex items-center gap-2">
                          {canExpandRow ? (
                            <button
                              type="button"
                              onClick={() => toggleSet(setExpandedRows, rk)}
                              className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-gray-300 text-[10px] font-bold text-gray-500 transition-colors hover:border-[#b20202] hover:text-[#b20202]"
                            >
                              {isExpanded ? '−' : '+'}
                            </button>
                          ) : (
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-gray-200 text-[10px] text-gray-300">
                              ·
                            </span>
                          )}
                          <div className="min-w-0">
                            <div
                              className="break-words font-medium leading-snug text-gray-800"
                              style={{ maxWidth: 200 }}
                            >
                              {fmtKey(rk, rowDims[0])}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1">
                              <div
                                className="h-0.5 overflow-hidden rounded-full bg-gray-100"
                                style={{ width: 72 }}
                              >
                                <div
                                  className="h-full rounded-full bg-[#b20202] opacity-30"
                                  style={{ width: `${rowShare}%` }}
                                />
                              </div>
                              <span className="text-[9px] text-gray-400">
                                {rowShare.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <DataCell rowPath={[rk]} colPath={[]} isTotal />
                      {visibleCols.map(({ path, isSub }) => (
                        <DataCell
                          key={path.join(':')}
                          rowPath={[rk]}
                          colPath={path}
                          isTotal={isSub}
                        />
                      ))}
                    </tr>

                    {subRows.map((srk) => (
                      <tr
                        key={`${rk}:${srk}`}
                        className="bg-[#fdfaf7] hover:bg-orange-50/20"
                      >
                        <td className="sticky left-0 z-10 border-b border-r border-gray-100 bg-[#fdfaf7] px-4 py-2">
                          <div className="flex items-center gap-2 pl-7">
                            <span className="h-px w-3 shrink-0 bg-gray-300" />
                            <span
                              className="break-words leading-snug text-gray-600"
                              style={{ maxWidth: 180 }}
                            >
                              {fmtKey(srk, rowDims[1])}
                            </span>
                          </div>
                        </td>
                        <DataCell rowPath={[rk, srk]} colPath={[]} isTotal />
                        {visibleCols.map(({ path, isSub }) => (
                          <DataCell
                            key={path.join(':')}
                            rowPath={[rk, srk]}
                            colPath={path}
                            isTotal={isSub}
                          />
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
                  <td className="sticky left-0 z-10 border-r border-gray-200 bg-gray-50 px-4 py-2.5 text-xs font-bold text-gray-700">
                    Total
                  </td>
                  <td className="border-r border-gray-200 bg-gray-100 px-3 py-2.5 text-right">
                    <div className="text-sm font-bold text-gray-900">
                      {naira(p.grandTotal)}
                    </div>
                  </td>
                  {visibleCols.map(({ path }) => {
                    const val = p.getValue([], path);
                    const pct =
                      p.grandTotal > 0 ? (val / p.grandTotal) * 100 : 0;
                    return (
                      <td
                        key={path.join(':')}
                        className="border-r border-gray-100 bg-gray-50 px-3 py-2.5 text-right tabular-nums"
                      >
                        <div className="font-bold text-gray-800">
                          {fmtMeasure(val, measure)}
                        </div>
                        {pct > 0 && (
                          <div className="text-[10px] text-gray-400">
                            {pct.toFixed(1)}%
                          </div>
                        )}
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

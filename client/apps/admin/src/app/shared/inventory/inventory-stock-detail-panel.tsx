'use client';
import type { StockRow } from '@/services/warehouseStock.service';
import type { StockBrowserMode } from './inventory-stock-browser';
import { fmtNgn, fmtDate } from './inventory-receipts-support';
import { availableOf, lineValue, carryingCostOf } from './inventory-stock-search';
import { finite } from './inventory-dashboard-analysis';
import StockDetailHeader from './inventory-stock-detail-header';
import StockCountControl from './inventory-stock-count-control';
import StockHistoryPanel from './inventory-stock-history-panel';
export default function StockDetail({
  row,
  mode,
  token,
  onClose,
  onApplied,
}: {
  row: StockRow;
  mode: StockBrowserMode;
  token: string;
  onClose: () => void;
  onApplied: (rowId: string, counted: number) => Promise<void>;
}) {
  const properties = [
    ['Category', row.categoryName || 'Uncategorized'],
    ['Size', row.sizeName],
    ['Warehouse', row.warehouseName],
    ['Valuation', (row.valuationMethod || '—').toUpperCase()],
    ['Unit cost', fmtNgn(finite(row.costPrice))],
    ...(mode === 'valuation'
      ? [
          ['Carrying unit cost', fmtNgn(carryingCostOf(row))],
          ['Cost source', row.valuationSource || 'Standard cost'],
          ['Estimated units', String(finite(row.estimatedQuantity))],
          ['Units without cost', String(finite(row.unpricedQuantity))],
          ...(row.batchQuantityMismatch
            ? [['Batch check', 'Batch quantities differ from on-hand']]
            : []),
        ]
      : []),
    ['Selling price', fmtNgn(finite(row.sellingPrice))],
    ['Minimum stock', String(finite(row.minStockLevel))],
    ...(row.earliestExpiry ? [['Earliest expiry', fmtDate(row.earliestExpiry)]] : []),
  ];
  return (
    <div className="flex h-full min-h-0 flex-col bg-gray-50">
      <StockDetailHeader row={row} close={onClose} />
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <dl className="grid grid-cols-2 gap-2">
          {[
            ['On hand', finite(row.currentQuantity).toLocaleString()],
            ['Available', availableOf(row).toLocaleString()],
            ['Reserved', finite(row.reservedQuantity).toLocaleString()],
            ['Stock value', fmtNgn(lineValue(row))],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-gray-200 bg-white p-3">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                {label}
              </dt>
              <dd
                className={`mt-1 text-base font-bold tabular-nums ${label === 'Stock value' ? 'text-[#b20202]' : 'text-gray-900'}`}
              >
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <section className="rounded-xl border border-gray-200 bg-white p-3">
          <h3 className="mb-3 text-xs font-semibold text-gray-900">Stock details</h3>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-3">
            {properties.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-[10px] text-gray-500">{label}</dt>
                <dd className="mt-0.5 break-words text-xs font-medium text-gray-800">
                  {value || '—'}
                </dd>
              </div>
            ))}
          </dl>
          {!row.warehouseId && (
            <p className="mt-3 text-xs text-amber-700">
              No warehouse has been assigned to this stock line.
            </p>
          )}
          {!row.sizeId && (
            <p className="mt-3 text-xs text-amber-700">
              Configure a size before managing stock quantities.
            </p>
          )}
        </section>
        {mode === 'count' && <StockCountControl row={row} apply={onApplied} />}
        <StockHistoryPanel row={row} token={token} />
      </div>
    </div>
  );
}

import type { PurchaseOrder } from '@/services/purchaseOrder.service';
import {
  fmtMeasureVal,
  toFiniteNumber,
  type GroupRow,
  type Measure,
} from './purchases-analytics-helpers';
/** One stable horizontal row per group, regardless of product count or container measurements. */
export function PurchaseAnalyticsBars({
  data,
  measure,
  onBarClick,
}: {
  data: GroupRow[];
  measure: Measure;
  onBarClick: (label: string, orders: PurchaseOrder[]) => void;
}) {
  const maximum = data.reduce((max, row) => Math.max(max, Math.abs(toFiniteNumber(row.value))), 1);
  return (
    <div className="max-h-[640px] overflow-y-auto p-4" aria-label="All purchase analysis groups">
      {data.map((row, index) => {
        const value = toFiniteNumber(row.value);
        return (
          <button
            key={`${row.isoKey}-${index}`}
            type="button"
            onClick={() => onBarClick(row.label, row.orderList)}
            className="mb-3 grid w-full grid-cols-[minmax(100px,1fr)_minmax(80px,3fr)] items-center gap-3 rounded-lg p-2 text-left hover:bg-[#faf8f3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#b20202] sm:grid-cols-[minmax(120px,2fr)_minmax(100px,5fr)_minmax(100px,2fr)]"
            title={`${row.label}: ${fmtMeasureVal(value, measure)}`}
          >
            <span className="break-words text-xs font-medium text-[#65594e]">{row.label}</span>
            <span className="h-6 overflow-hidden rounded bg-[#f5efe7]" aria-hidden="true">
              <span
                className={`block h-full rounded ${value < 0 ? 'bg-amber-600' : 'bg-[#b20202]'}`}
                style={{ width: `${(Math.abs(value) / maximum) * 100}%` }}
              />
            </span>
            <span className="bv-value-label col-span-2 text-right text-xs font-semibold tabular-nums text-[#65594e] sm:col-span-1">
              {fmtMeasureVal(value, measure)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

import { PALETTE, type GroupRow2 } from './purchases-analytics-helpers';
export function PurchaseAnalyticsStackedBars({
  rows,
  series,
  measure,
  orderMap,
  onCellClick,
}: {
  rows: GroupRow2[];
  series: string[];
  measure: Measure;
  orderMap: Record<string, Record<string, PurchaseOrder[]>>;
  onCellClick: (row: string, series: string, orders: PurchaseOrder[]) => void;
}) {
  const magnitude = (row: GroupRow2) =>
    series.reduce((sum, key) => sum + Math.abs(toFiniteNumber(row[key])), 0);
  const maximum = rows.reduce((max, row) => Math.max(max, magnitude(row)), 1);
  return (
    <div className="p-4">
      <div className="mb-4 flex flex-wrap gap-3 text-xs text-gray-500">
        {series.map((key, index) => (
          <span key={key} className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: PALETTE[index % PALETTE.length] }}
            />
            {key}
          </span>
        ))}
      </div>
      <div
        className="max-h-[640px] overflow-y-auto"
        aria-label="All grouped purchase analysis rows"
      >
        {rows.map((row, index) => (
          <div
            key={`${row.isoKey}-${index}`}
            className="mb-3 grid grid-cols-[minmax(100px,2fr)_minmax(120px,5fr)_minmax(90px,2fr)] items-center gap-3"
          >
            <button
              type="button"
              onClick={() => onCellClick(row.label, '', row.orderList)}
              className="break-words text-left text-xs font-medium text-[#65594e] hover:underline"
            >
              {row.label}
            </button>
            <div className="flex h-7 overflow-hidden rounded bg-[#f5efe7]">
              {series.map((key, index) => {
                const value = toFiniteNumber(row[key]);
                if (value === 0) return null;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-label={`${row.label} · ${key}: ${fmtMeasureVal(value, measure)}`}
                    title={`${key}: ${fmtMeasureVal(value, measure)}`}
                    onClick={() => onCellClick(row.label, key, orderMap[row.isoKey]?.[key] || [])}
                    className="h-full shrink-0 hover:opacity-75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black"
                    style={{
                      width: `${(Math.abs(value) / maximum) * 100}%`,
                      backgroundColor: PALETTE[index % PALETTE.length],
                    }}
                  />
                );
              })}
            </div>
            <span className="bv-value-label text-right text-xs font-semibold tabular-nums text-[#65594e]">
              {fmtMeasureVal(toFiniteNumber(row.__total__), measure)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

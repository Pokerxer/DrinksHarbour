// @ts-nocheck
'use client';

import {
  PiDownload, PiPackage, PiCheckCircle, PiHandPalm,
  PiTrendDown, PiTrendUp, PiPiggyBank, PiWarningCircle,
  PiArrowCounterClockwise, PiClock,
} from 'react-icons/pi';
import type { SizeVariant } from '../shared/types';
import { STOCK_STATUS_OPTIONS } from '../shared/constants';

interface OverviewTabProps {
  // Stock data
  totalStock: number;
  availableStock: number;
  reservedStock: number;
  stockStatus: string;
  lowStockThreshold: number;
  reorderPoint: number;
  reorderQuantity: number;
  daysUntilStockout: number;
  // Pricing
  costPrice: number;
  baseSellingPrice: number;
  currencySymbol: string;
  // Size variants
  hasSizeVariants: boolean;
  sizes: SizeVariant[];
  selectedSize: string;
  sizeStockMap: Record<string, number>;
  currentSizeStock: number;
  // Actions
  onSelectSize: (size: string) => void;
  onExportJSON: () => void;
  onExportCSV: () => void;
}

export function OverviewTab({
  totalStock,
  availableStock,
  reservedStock,
  stockStatus,
  lowStockThreshold,
  reorderPoint,
  reorderQuantity,
  daysUntilStockout,
  costPrice,
  baseSellingPrice,
  currencySymbol,
  hasSizeVariants,
  sizes,
  selectedSize,
  sizeStockMap,
  currentSizeStock,
  onSelectSize,
  onExportJSON,
  onExportCSV,
}: OverviewTabProps) {
  const inventoryValue   = costPrice * totalStock;
  const potentialRevenue = baseSellingPrice * totalStock;
  const profitMargin     = potentialRevenue > 0
    ? ((potentialRevenue - inventoryValue) / potentialRevenue) * 100 : 0;

  const statusOption = STOCK_STATUS_OPTIONS.find(o => o.value === stockStatus);
  const StatusIcon   = statusOption?.icon || PiPackage;

  // Stock health bar — relative to 3× the low-stock threshold
  const barMax   = Math.max(totalStock, lowStockThreshold * 3, 1);
  const barPct   = Math.min(100, Math.round((availableStock / barMax) * 100));
  const barColor = availableStock === 0             ? 'bg-red-500'
                 : availableStock <= lowStockThreshold ? 'bg-amber-400'
                 : availableStock <= reorderPoint      ? 'bg-blue-400'
                 : 'bg-green-500';

  const fmt = (n: number) =>
    `${currencySymbol}${(n ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const stockoutColor =
    daysUntilStockout < 7  ? 'text-red-600'   :
    daysUntilStockout < 30 ? 'text-amber-600' : 'text-green-600';

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-gray-900">Inventory Overview</p>
          <p className="text-[11px] text-gray-400">Current stock levels and valuation</p>
        </div>
        <div className="relative group">
          <button type="button"
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            <PiDownload className="h-3.5 w-3.5" /> Export
          </button>
          <div className="absolute right-0 top-full mt-1 w-36 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
            <button onClick={onExportJSON}
              className="w-full px-4 py-2 text-left text-xs text-gray-700 hover:bg-gray-50">
              Export JSON
            </button>
            <button onClick={onExportCSV}
              className="w-full border-t border-gray-100 px-4 py-2 text-left text-xs text-gray-700 hover:bg-gray-50">
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* ── Size variant selector ── */}
      {hasSizeVariants && sizes.length > 0 && (
        <div className="rounded-2xl border border-purple-200 bg-purple-50 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <PiPackage className="h-4 w-4 text-purple-600" />
              <p className="text-xs font-bold text-purple-800">Size Variant</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {sizes.map(s => {
                const stock    = sizeStockMap[s?.size] || 0;
                const sel      = selectedSize === s?.size;
                return (
                  <button key={s?.size} type="button" onClick={() => onSelectSize(s?.size)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                      sel
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'border border-purple-200 bg-white text-purple-700 hover:bg-purple-100'
                    }`}>
                    {s?.label || s?.size}
                    <span className={`ml-1.5 ${sel ? 'text-purple-200' : 'text-purple-400'}`}>
                      ({stock})
                    </span>
                  </button>
                );
              })}
            </div>
            {selectedSize && (
              <span className="ml-auto rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] font-semibold text-purple-700">
                {sizes.find(s => s?.size === selectedSize)?.label || selectedSize}: {currentSizeStock} units
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Stock summary cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">

        {/* Total */}
        <div className={`rounded-2xl border-2 p-4 ${statusOption?.border || 'border-gray-200'} ${statusOption?.bg || 'bg-white'}`}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Stock</p>
            <PiPackage className="h-4 w-4 text-gray-400" />
          </div>
          <p className="text-3xl font-black tabular-nums text-gray-900 leading-none">{totalStock || 0}</p>
          <p className="mt-1 text-[10px] text-gray-400">units in inventory</p>
        </div>

        {/* Available */}
        <div className="rounded-2xl border-2 border-green-200 bg-green-50 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-green-600">Available</p>
            <PiCheckCircle className="h-4 w-4 text-green-500" />
          </div>
          <p className="text-3xl font-black tabular-nums text-green-700 leading-none">{availableStock}</p>
          <p className="mt-1 text-[10px] text-green-600">ready to sell</p>
        </div>

        {/* Reserved */}
        <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Reserved</p>
            <PiHandPalm className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-3xl font-black tabular-nums text-amber-700 leading-none">{reservedStock || 0}</p>
          <p className="mt-1 text-[10px] text-amber-600">pending orders</p>
        </div>

        {/* Status */}
        <div className={`rounded-2xl border-2 p-4 ${statusOption?.border || 'border-gray-200'} ${statusOption?.bg || 'bg-white'}`}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Status</p>
            <StatusIcon className="h-4 w-4 text-gray-400" />
          </div>
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${
            stockStatus === 'in_stock'     ? 'bg-green-100 text-green-700' :
            stockStatus === 'low_stock'    ? 'bg-amber-100 text-amber-700' :
            stockStatus === 'out_of_stock' ? 'bg-red-100 text-red-700'    :
            'bg-gray-100 text-gray-600'
          }`}>
            {statusOption?.label || stockStatus?.replace(/_/g, ' ') || 'Unknown'}
          </span>
          {daysUntilStockout < 30 && daysUntilStockout !== Infinity && (
            <p className={`mt-1.5 text-[10px] font-medium ${stockoutColor}`}>
              ~{daysUntilStockout}d until stockout
            </p>
          )}
        </div>
      </div>

      {/* ── Stock health bar ── */}
      {stockStatus !== 'pre_order' && stockStatus !== 'discontinued' && (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Stock Health</p>
            <div className="flex items-center gap-3 text-[10px] text-gray-400">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                Low stock ({lowStockThreshold})
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-blue-400" />
                Reorder ({reorderPoint})
              </span>
            </div>
          </div>
          <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
            <div className={`h-full rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${barPct}%` }} />
            {/* Marker: low stock threshold */}
            {lowStockThreshold > 0 && barMax > 0 && (
              <div className="absolute top-0 h-2.5 w-0.5 bg-amber-500 opacity-70"
                style={{ left: `${Math.min(100, (lowStockThreshold / barMax) * 100)}%` }} />
            )}
            {/* Marker: reorder point */}
            {reorderPoint > 0 && barMax > 0 && (
              <div className="absolute top-0 h-2.5 w-0.5 bg-blue-500 opacity-70"
                style={{ left: `${Math.min(100, (reorderPoint / barMax) * 100)}%` }} />
            )}
          </div>
          <p className="text-[10px] text-gray-400 tabular-nums">
            {availableStock} available of {totalStock} total ({barPct}%)
          </p>
        </div>
      )}

      {/* ── Forecasting strip ── */}
      {daysUntilStockout !== Infinity && daysUntilStockout < 90 && (
        <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
          daysUntilStockout < 7  ? 'border-red-200 bg-red-50'    :
          daysUntilStockout < 30 ? 'border-amber-200 bg-amber-50' :
          'border-blue-200 bg-blue-50'
        }`}>
          <PiClock className={`h-5 w-5 shrink-0 ${
            daysUntilStockout < 7 ? 'text-red-500' : daysUntilStockout < 30 ? 'text-amber-500' : 'text-blue-500'
          }`} />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${
              daysUntilStockout < 7 ? 'text-red-800' : daysUntilStockout < 30 ? 'text-amber-800' : 'text-blue-800'
            }`}>
              {daysUntilStockout < 7 ? 'Critical: ' : daysUntilStockout < 30 ? 'Warning: ' : ''}
              ~{daysUntilStockout} days until stockout
            </p>
            <p className={`text-[11px] ${
              daysUntilStockout < 7 ? 'text-red-600' : daysUntilStockout < 30 ? 'text-amber-600' : 'text-blue-600'
            }`}>
              Suggested reorder quantity: {reorderQuantity} units
            </p>
          </div>
        </div>
      )}

      {/* ── Inventory value cards ── */}
      {(inventoryValue > 0 || potentialRevenue > 0) && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <PiTrendDown className="h-4 w-4 text-amber-600" />
              <p className="text-xs font-semibold text-amber-800">Inventory Value</p>
            </div>
            <p className="text-2xl font-black tabular-nums text-amber-700 leading-none">{fmt(inventoryValue)}</p>
            <p className="mt-1 text-[10px] text-amber-600">at cost price</p>
          </div>
          <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <PiTrendUp className="h-4 w-4 text-green-600" />
              <p className="text-xs font-semibold text-green-800">Potential Revenue</p>
            </div>
            <p className="text-2xl font-black tabular-nums text-green-700 leading-none">{fmt(potentialRevenue)}</p>
            <p className="mt-1 text-[10px] text-green-600">at selling price</p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <PiPiggyBank className="h-4 w-4 text-blue-600" />
              <p className="text-xs font-semibold text-blue-800">Profit Margin</p>
            </div>
            <p className="text-2xl font-black tabular-nums text-blue-700 leading-none">{profitMargin.toFixed(1)}%</p>
            <p className="mt-1 text-[10px] text-blue-600">gross margin</p>
          </div>
        </div>
      )}

      {/* ── Threshold summary (read-only) ── */}
      <div className="grid grid-cols-3 divide-x divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
        {[
          { label: 'Low Stock Threshold', value: lowStockThreshold, icon: <PiWarningCircle className="h-4 w-4 text-amber-500" />, note: 'Alert fires below this' },
          { label: 'Reorder Point',       value: reorderPoint,      icon: <PiArrowCounterClockwise className="h-4 w-4 text-blue-500" />, note: 'Suggest reorder at this level' },
          { label: 'Reorder Quantity',    value: reorderQuantity,   icon: <PiPackage className="h-4 w-4 text-green-500" />, note: 'Units to suggest ordering' },
        ].map(({ label, value, icon, note }) => (
          <div key={label} className="px-4 py-3">
            <div className="flex items-center gap-1.5 mb-1">
              {icon}
              <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
            </div>
            <p className="text-xl font-black tabular-nums text-gray-800">{value}</p>
            <p className="text-[9px] text-gray-400 mt-0.5">{note}</p>
          </div>
        ))}
      </div>

    </div>
  );
}

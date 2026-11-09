// app/shared/purchases/stock-transfer-catalog-modal.tsx
'use client';
import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Description,
} from '@headlessui/react';
import {
  PiPackage,
  PiPlus,
  PiMinus,
  PiTrash,
  PiCheck,
  PiArrowSquareOut,
} from 'react-icons/pi';
import { routes } from '@/config/routes';
import { fmtCur } from './purchases-analytics-helpers';
import CatalogueSearch from '../sales/sales-catalog-search';
import CatalogueFooter from '../sales/sales-catalog-footer';

/** One stocked (subProduct, size) row at the source warehouse. Mirrors the
 *  StockRowOption the transfer form's picker is fed with. */
export interface TransferCatalogRow {
  subProductId: string;
  sizeId?: string;
  sizeName?: string;
  name: string;
  sku: string;
  quantity: number;
  unitsPerPack: number;
  costPrice: number;
  wholesalePrice: number;
}

export interface StockTransferCatalogModalProps {
  open: boolean;
  /** The source warehouse's name, for the header context line. */
  sourceName?: string;
  currency?: string;
  /** Which price the form is seeding from —Cost or wholesale. */
  priceMode: 'cost' | 'wholesale';
  rows: TransferCatalogRow[];
  loading: boolean;
  /** subProductId::sizeId → quantity already on the draft. */
  qtyMap: Record<string, number>;
  onClose: () => void;
  onAdd: (row: TransferCatalogRow) => void;
  onSetQty: (row: TransferCatalogRow, quantity: number) => void;
  onRemove: (row: TransferCatalogRow) => void;
}

export function TransferCatalogModal({
  open,
  sourceName,
  currency = 'NGN',
  priceMode,
  rows,
  loading,
  qtyMap,
  onClose,
  onAdd,
  onSetQty,
  onRemove,
}: StockTransferCatalogModalProps) {
  const [query, setQuery] = useState('');
  const [expandedIdx, setExpandedIdx] = useState<string | null>(null);

  const rowKey = (r: TransferCatalogRow) => `${r.subProductId}::${r.sizeId || ''}`;
  const rowCost = (r: TransferCatalogRow) =>
    priceMode === 'wholesale'
      ? r.wholesalePrice || r.costPrice
      : r.costPrice;

  const filtered = useMemo(() => {
    const terms = query
      .split(/[,;\n]/)
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    const inStock = rows.filter((r) => r.quantity > 0);
    if (!terms.length) return inStock.slice(0, 60);
    return inStock
      .filter((r) =>
        terms.some(
          (t) =>
            r.name.toLowerCase().includes(t) ||
            r.sku.toLowerCase().includes(t) ||
            (r.sizeName ?? '').toLowerCase().includes(t)
        )
      )
      .slice(0, 60);
  }, [rows, query]);

  const summary = useMemo(
    () =>
      Object.values(qtyMap).reduce(
        (acc, qty) =>
          qty > 0 ? { lines: acc.lines + 1, units: acc.units + qty } : acc,
        { lines: 0, units: 0 }
      ),
    [qtyMap]
  );
  const filteredEmpty = !loading && filtered.length === 0 && rows.length > 0;
  return (
    <Dialog open={open} onClose={onClose} className="relative z-[90]">
      <DialogBackdrop className="fixed inset-0 bg-gray-950/50 backdrop-blur-sm" />
      <div className="fixed inset-0 flex items-center justify-center p-0">
        <DialogPanel className="flex h-[100dvh] w-full max-w-none flex-col overflow-hidden bg-white shadow-2xl">
          <header className="shrink-0 border-b border-gray-200 px-4 py-4 sm:px-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="text-lg font-semibold tracking-tight text-gray-900">
                  Source stock catalogue
                </DialogTitle>
                <Description className="mt-1 text-xs text-gray-500">
                  Pick what the source can ship ·{' '}
                  {sourceName || 'Source warehouse'} ·{' '}
                  {priceMode === 'wholesale' ? 'wholesale' : 'cost'} prices ·{' '}
                  {currency}
                </Description>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close catalogue"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
              >
                <span className="text-lg">×</span>
              </button>
            </div>
            <CatalogueSearch value={query} onChange={setQuery} />
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50/60 px-4 pb-6 sm:px-6">
            <p role="status" aria-live="polite" className="py-3 text-xs text-gray-500">
              {loading
                ? 'Loading source stock…'
                : `${filtered.length} stocked product${filtered.length !== 1 ? 's' : ''}${sourceName ? ` in ${sourceName}` : ''}`}
            </p>
            {loading && !rows.length ? (
              <div className="space-y-2" aria-label="Loading stock">
                {Array.from({ length: 8 }, (_, i) => (
                  <div
                    key={i}
                    className="h-16 animate-pulse rounded-xl border border-gray-100 bg-gray-200/50"
                  />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center">
                <PiPackage className="h-9 w-9 text-gray-300" />
                <h3 className="text-sm font-semibold text-gray-800">
                  {filteredEmpty
                    ? 'No matching stocked products'
                    : 'The source warehouse has no stock'}
                </h3>
                <p className="text-xs text-gray-500">
                  {filteredEmpty
                    ? 'Try another search term.'
                    : 'Assign stock to the source warehouse, or transfer from another location.'}
                </p>
              </div>
            ) : (
              <ul className="space-y-2" aria-label="Stocked products">
                {filtered.map((row) => {
                  const key = rowKey(row);
                  const qty = qtyMap[key] || 0;
                  const expanded = expandedIdx === key;
                  const label = row.sizeName
                    ? `${row.name} – ${row.sizeName}`
                    : row.name;
                  return (
                    <li
                      key={key}
                      className={`rounded-xl border bg-white ${qty > 0 ? 'border-[#b20202]/50 ring-1 ring-[#b20202]/10' : 'border-gray-200'}`}
                    >
                      <div className="flex items-start justify-between gap-3 p-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-gray-900">
                            {label}
                          </p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-gray-400">
                            {row.sku && (
                              <span className="font-mono">{row.sku}</span>
                            )}
                            <span
                              className={row.quantity > 0 ? 'text-emerald-600' : 'text-gray-400'}
                            >
                              {row.quantity} in stock
                            </span>
                            {row.unitsPerPack > 1 && (
                              <span className="rounded-full bg-gray-100 px-1.5">
                                ×{row.unitsPerPack} / pack
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="shrink-0 text-sm font-bold text-gray-800">
                          {fmtCur(rowCost(row), currency)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-3 py-2">
                        <a
                          href={routes.eCommerce.editSubProduct(row.subProductId)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-[#b20202]"
                        >
                          <PiArrowSquareOut className="h-3.5 w-3.5" /> Details
                        </a>
                        {qty > 0 ? (
                          <div className="flex items-center gap-1">
                            <div className="flex items-center rounded-lg border border-gray-200">
                              <button
                                type="button"
                                aria-label={`Decrease ${label}`}
                                className="flex h-7 w-7 items-center justify-center text-gray-500 hover:bg-gray-100"
                                onClick={() => onSetQty(row, qty - 1)}
                              >
                                <PiMinus className="h-3.5 w-3.5" />
                              </button>
                              <input
                                aria-label={`Quantity for ${label}`}
                                type="number"
                                min={1}
                                value={qty}
                                onChange={(e) => {
                                  const v = Number(e.target.value);
                                  if (Number.isFinite(v) && v >= 1)
                                    onSetQty(row, Math.floor(v));
                                }}
                                className="w-10 border-0 bg-transparent p-0 text-center text-xs font-semibold focus:ring-0"
                              />
                              <button
                                type="button"
                                aria-label={`Increase ${label}`}
                                className="flex h-7 w-7 items-center justify-center text-gray-500 hover:bg-gray-100"
                                onClick={() => onSetQty(row, qty + 1)}
                              >
                                <PiPlus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <button
                              type="button"
                              aria-label={`Remove ${label} from transfer`}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-red-600"
                              onClick={() => onRemove(row)}
                            >
                              <PiTrash className="h-3.5 w-3.5" />
                            </button>
                            {qty > row.quantity && (
                              <span className="text-[10px] font-semibold text-amber-600">
                                above stock
                              </span>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedIdx(key);
                              onAdd(row);
                            }}
                            className={`flex min-h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold ${
                              expanded
                                ? 'bg-gray-900 text-white focus:outline-none'
                                : 'bg-[#b20202] text-white hover:bg-[#9a0101]'
                            }`}
                          >
                            {expanded ? <PiCheck /> : <PiPlus />}
                            {expanded ? 'Added' : `Add to transfer`}
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <CatalogueFooter
            busy={loading}
            summary={summary}
            onPage={() => {}}
            onClose={onClose}
          />
        </DialogPanel>
      </div>
    </Dialog>
  );
}

export default TransferCatalogModal;

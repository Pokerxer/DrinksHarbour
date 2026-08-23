'use client';

// app/shared/warehouses/warehouse-detail/stock-card.tsx
// One stock line as a card in the grid view: identity chips, quantity strip,
// nearest-expiry line, expandable batch panel and per-line actions.

import { motion, AnimatePresence } from 'framer-motion';
import {
  PiMapPin,
  PiStackBold,
  PiCaretUpBold,
  PiCaretDownBold,
  PiEyeBold,
  PiArrowsDownUpBold,
  PiArrowsLeftRightBold,
} from 'react-icons/pi';
import type { WarehouseStockRow } from '@/services/warehouseStock.service';
import type { WarehouseBatch } from '@/services/warehouse.service';
import {
  skuOf,
  productNameOf as nameOf,
  sizeLabelOf as sizeOf,
  imageOf,
} from '../warehouse-ref-helpers';
import {
  availOf,
  statusOf,
  locationOf,
  belowReorderOf,
} from './row-utils';
import { StatusBadge, ExpiryBadge, ReorderBadge } from './badges';
import BatchPanel from './batch-panel';
import Thumb from './thumb';

export default function StockCard({
  r,
  isOpen,
  batchLoading,
  batches,
  onToggleBatches,
  onAdjust,
  onTransfer,
  onView,
  lowStock,
}: {
  r: WarehouseStockRow;
  isOpen: boolean;
  batchLoading: boolean;
  batches: WarehouseBatch[] | undefined;
  onToggleBatches: (r: WarehouseStockRow) => void;
  onAdjust: (r: WarehouseStockRow) => void;
  onTransfer: (r: WarehouseStockRow) => void;
  onView: (r: WarehouseStockRow) => void;
  lowStock: number;
}) {
  const status = statusOf(r, lowStock);
  const name = nameOf(r);
  const loc = locationOf(r);
  const canTransfer = availOf(r) > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
        isOpen
          ? 'border-[#b20202]/40 ring-1 ring-[#b20202]/10'
          : 'border-[#ece4d6]'
      }`}
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        <Thumb src={imageOf(r)} alt={name || skuOf(r)} className="h-14 w-14" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p
              className="line-clamp-2 font-semibold leading-snug text-gray-900"
              title={name || 'Unnamed product'}
            >
              {name || <span className="text-gray-400">Unnamed product</span>}
            </p>
            <StatusBadge status={status} />
          </div>
          <p className="mt-0.5 font-mono text-xs text-gray-400">{skuOf(r)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-md bg-gray-100 px-2 py-0.5 font-medium text-gray-600">
              Size {sizeOf(r)}
            </span>
            <ReorderBadge show={belowReorderOf(r)} />
            {loc && (
              <span className="inline-flex items-center gap-1 text-gray-400">
                <PiMapPin className="h-3.5 w-3.5" />
                {loc}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Earliest expiry (server-derived across still-stocked lots) */}
      {r.earliestExpiry ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 px-4 py-2 text-xs text-gray-500">
          Nearest expiry <ExpiryBadge expiryDate={r.earliestExpiry} />
        </div>
      ) : null}

      {/* Quantities */}
      <div className="grid grid-cols-3 divide-x divide-gray-100 border-t border-gray-100 bg-gray-50/60 text-center">
        <QtyCell label="On hand" value={r.currentQuantity} tone="strong" />
        <QtyCell label="Reserved" value={r.reservedQuantity} tone="muted" />
        <QtyCell label="Available" value={availOf(r)} tone="accent" />
      </div>

      {/* Batches (expandable) */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="batches"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-gray-100 bg-gray-50/40"
          >
            <div className="border-l-2 border-[#b20202]/40">
              <BatchPanel loading={batchLoading} batches={batches} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="mt-auto grid grid-cols-2 gap-2 border-t border-gray-100 p-3">
        <button
          type="button"
          onClick={() => onToggleBatches(r)}
          aria-expanded={isOpen}
          className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
            isOpen
              ? 'border-[#b20202] bg-[#b20202]/5 text-[#b20202]'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <PiStackBold className="h-3.5 w-3.5" />
          Batches
          {isOpen ? (
            <PiCaretUpBold className="h-3 w-3" />
          ) : (
            <PiCaretDownBold className="h-3 w-3" />
          )}
        </button>
        <button
          type="button"
          onClick={() => onAdjust(r)}
          className={`${ACTION_BTN} rounded-lg border border-gray-200 px-3 py-2`}
        >
          <PiArrowsDownUpBold className="h-3.5 w-3.5" /> Adjust
        </button>
        <button
          type="button"
          onClick={() => onTransfer(r)}
          disabled={!canTransfer}
          title={canTransfer ? undefined : 'Nothing available to transfer'}
          className={`${ACTION_BTN} col-span-2 rounded-lg border border-gray-200 px-3 py-2`}
        >
          <PiArrowsLeftRightBold className="h-3.5 w-3.5" /> Transfer to another location
        </button>
        <button
          type="button"
          onClick={() => onView(r)}
          className={`${ACTION_BTN} col-span-2 rounded-lg border border-gray-200 px-3 py-2`}
        >
          <PiEyeBold className="h-3.5 w-3.5" /> View inventory details
        </button>
      </div>
    </motion.div>
  );
}

const ACTION_BTN =
  'inline-flex items-center justify-center gap-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:border-gray-100 disabled:text-gray-300 enabled:hover:border-[#b20202] enabled:hover:bg-[#b20202]/5 enabled:hover:text-[#b20202]';

function QtyCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'strong' | 'muted' | 'accent';
}) {
  const cls =
    tone === 'accent'
      ? 'font-black text-[#b20202]'
      : tone === 'muted'
        ? 'font-semibold text-gray-500'
        : 'font-bold text-gray-900';
  return (
    <div className="px-2 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
        {label}
      </p>
      <p className={`mt-0.5 text-lg tabular-nums ${cls}`}>{value}</p>
    </div>
  );
}

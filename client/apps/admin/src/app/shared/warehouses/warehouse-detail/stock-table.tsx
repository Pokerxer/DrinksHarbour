'use client';

// app/shared/warehouses/warehouse-detail/stock-table.tsx
// Table view: sortable headers, expandable batch rows, totals footer.

import { motion, AnimatePresence } from 'framer-motion';
import {
  PiCaretUpBold,
  PiCaretDownBold,
  PiArrowsDownUpBold,
  PiEyeBold,
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
  type SortKey,
} from './row-utils';
import { StatusBadge, ReorderBadge } from './badges';
import BatchPanel from './batch-panel';
import Thumb from './thumb';

function SortHeader({
  label,
  sortKey,
  active,
  dir,
  onSort,
  align = 'left',
}: {
  label: string;
  sortKey: SortKey;
  active: boolean;
  dir: 'asc' | 'desc';
  onSort: (k: SortKey) => void;
  align?: 'left' | 'right';
}) {
  return (
    <th
      className={`px-5 py-3 ${align === 'right' ? 'text-right' : 'text-left'}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 transition-colors hover:text-gray-700 ${align === 'right' ? 'flex-row-reverse' : ''} ${active ? 'text-[#b20202]' : ''}`}
      >
        {label}
        {active ? (
          dir === 'asc' ? (
            <PiCaretUpBold className="h-3 w-3" />
          ) : (
            <PiCaretDownBold className="h-3 w-3" />
          )
        ) : (
          <PiArrowsDownUpBold className="h-3 w-3 opacity-30" />
        )}
      </button>
    </th>
  );
}

const ROW_ACTION_BTN =
  'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-[#b20202] hover:bg-[#b20202]/5 hover:text-[#b20202] disabled:cursor-not-allowed disabled:border-gray-100 disabled:text-gray-300 disabled:hover:border-gray-100 disabled:hover:bg-transparent';

export default function StockTable({
  rows,
  lowStock,
  expandedId,
  batchLoadingId,
  batchesByRow,
  sortKey,
  sortDir,
  totals,
  onSortToggle,
  onToggleBatches,
  onAdjust,
  onTransfer,
  onView,
}: {
  rows: WarehouseStockRow[];
  lowStock: number;
  expandedId: string | null;
  batchLoadingId: string | null;
  batchesByRow: Record<string, WarehouseBatch[]>;
  sortKey: SortKey | null;
  sortDir: 'asc' | 'desc';
  totals: { onHand: number; reserved: number; available: number };
  onSortToggle: (k: SortKey) => void;
  onToggleBatches: (r: WarehouseStockRow) => void;
  onAdjust: (r: WarehouseStockRow) => void;
  onTransfer: (r: WarehouseStockRow) => void;
  onView: (r: WarehouseStockRow) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#ece4d6] bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/70 text-[11px] font-bold uppercase tracking-wider text-gray-400">
              <SortHeader
                label="Product"
                sortKey="name"
                active={sortKey === 'name'}
                dir={sortDir}
                onSort={onSortToggle}
              />
              <SortHeader
                label="Size"
                sortKey="size"
                active={sortKey === 'size'}
                dir={sortDir}
                onSort={onSortToggle}
              />
              <th className="px-5 py-3 text-left">Location</th>
              <SortHeader
                label="On hand"
                sortKey="onHand"
                active={sortKey === 'onHand'}
                dir={sortDir}
                onSort={onSortToggle}
                align="right"
              />
              <SortHeader
                label="Reserved"
                sortKey="reserved"
                active={sortKey === 'reserved'}
                dir={sortDir}
                onSort={onSortToggle}
                align="right"
              />
              <SortHeader
                label="Available"
                sortKey="available"
                active={sortKey === 'available'}
                dir={sortDir}
                onSort={onSortToggle}
                align="right"
              />
              <SortHeader
                label="Status"
                sortKey="status"
                active={sortKey === 'status'}
                dir={sortDir}
                onSort={onSortToggle}
              />
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            <AnimatePresence initial={false}>
              {rows.map((r) => {
                const loc = locationOf(r);
                const name = nameOf(r);
                const isOpen = expandedId === r._id;
                return [
                  <motion.tr
                    key={r._id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={`group transition-colors hover:bg-gray-50/60 ${isOpen ? 'bg-gray-50/60' : ''}`}
                  >
                    <td className="px-5 py-3.5">
                      <button
                        type="button"
                        onClick={() => onView(r)}
                        title="View inventory details"
                        className="flex items-center gap-3 rounded-lg text-left transition-colors hover:bg-gray-50/80"
                      >
                        <Thumb src={imageOf(r)} alt={name || skuOf(r)} />
                        <span className="block min-w-0">
                          <span className="block truncate font-semibold text-gray-900 group-hover:text-[#b20202]">
                            {name || 'Unnamed product'}
                          </span>
                          <span className="block font-mono text-xs text-gray-400">
                            {skuOf(r)}
                          </span>
                        </span>
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">{sizeOf(r)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap items-center gap-1.5 text-gray-500">
                        {loc || <span className="text-gray-300">—</span>}
                        <ReorderBadge show={belowReorderOf(r)} />
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold tabular-nums text-gray-900">
                      {r.currentQuantity}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-gray-500">
                      {r.reservedQuantity}
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold tabular-nums text-gray-900">
                      {availOf(r)}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={statusOf(r, lowStock)} />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onToggleBatches(r)}
                          aria-expanded={isOpen}
                          className={ROW_ACTION_BTN}
                        >
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
                          className={ROW_ACTION_BTN}
                        >
                          Adjust
                        </button>
                        <button
                          type="button"
                          onClick={() => onTransfer(r)}
                          disabled={availOf(r) <= 0}
                          title={
                            availOf(r) <= 0
                              ? 'Nothing available to transfer'
                              : undefined
                          }
                          className={ROW_ACTION_BTN}
                        >
                          Transfer
                        </button>
                        <button
                          type="button"
                          onClick={() => onView(r)}
                          aria-label="View inventory details"
                          title="View inventory details"
                          className={`${ROW_ACTION_BTN} px-2.5`}
                        >
                          <PiEyeBold className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>,
                  isOpen ? (
                    <motion.tr
                      key={`${r._id}-batches`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="bg-gray-50/40"
                    >
                      <td colSpan={8} className="p-0">
                        <div className="border-l-2 border-[#b20202]/40">
                          <BatchPanel
                            loading={batchLoadingId === r._id}
                            batches={batchesByRow[r._id]}
                          />
                        </div>
                      </td>
                    </motion.tr>
                  ) : null,
                ];
              })}
            </AnimatePresence>
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-100 bg-gray-50/70 text-sm font-bold text-gray-700">
              <td className="px-5 py-3" colSpan={3}>
                Totals · {rows.length} lines
              </td>
              <td className="px-5 py-3 text-right tabular-nums">
                {totals.onHand.toLocaleString()}
              </td>
              <td className="px-5 py-3 text-right tabular-nums text-gray-500">
                {totals.reserved.toLocaleString()}
              </td>
              <td className="px-5 py-3 text-right tabular-nums">
                {totals.available.toLocaleString()}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

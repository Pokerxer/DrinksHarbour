'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  PiArrowClockwise, PiArrowsLeftRight, PiSpinner, PiWarehouse, PiArrowSquareOut,
} from 'react-icons/pi';
import {
  warehouseStockService,
  type WarehouseStockRow,
  type AdjustType,
} from '@/services/warehouseStock.service';
import WarehouseTransferDrawer from '@/app/shared/warehouses/warehouse-transfer-drawer';
import { routes } from '@/config/routes';

interface LocationsTabProps {
  subProductId?: string;
  token?: string;
  /** notify the parent so it can refresh the subproduct rollups after a change */
  onRefresh?: () => void;
}

// ── helpers ───────────────────────────────────────────────────────────────────

const idOf = (v: WarehouseStockRow['warehouse'] | WarehouseStockRow['size']) =>
  typeof v === 'object' ? v._id : v;
const whName = (r: WarehouseStockRow) =>
  typeof r.warehouse === 'object' ? r.warehouse.name ?? r.warehouse._id : r.warehouse;
const whCode = (r: WarehouseStockRow) =>
  typeof r.warehouse === 'object' ? r.warehouse.code ?? '' : '';
const sizeName = (r: WarehouseStockRow) =>
  typeof r.size === 'object' ? r.size.size ?? r.size._id : r.size;
const available = (r: WarehouseStockRow) =>
  Math.max(0, (r.currentQuantity || 0) - (r.reservedQuantity || 0));

interface Group {
  warehouseId: string;
  name: string;
  code: string;
  rows: WarehouseStockRow[];
  onHand: number;
  reserved: number;
}

// ── component ───────────────────────────────────────────────────────────────────

export function LocationsTab({ subProductId, token, onRefresh }: LocationsTabProps) {
  const [rows, setRows] = useState<WarehouseStockRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [transferRow, setTransferRow] = useState<WarehouseStockRow | null>(null);

  const load = useCallback(async () => {
    if (!subProductId || !token) return;
    setLoading(true);
    try {
      const res = await warehouseStockService.getStockByWarehouse(subProductId, token);
      setRows(res.data ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load stock');
    } finally {
      setLoading(false);
    }
  }, [subProductId, token]);

  useEffect(() => { load(); }, [load]);

  const groups: Group[] = useMemo(() => {
    const map = new Map<string, Group>();
    for (const r of rows) {
      const id = String(idOf(r.warehouse));
      let g = map.get(id);
      if (!g) {
        g = { warehouseId: id, name: String(whName(r)), code: whCode(r), rows: [], onHand: 0, reserved: 0 };
        map.set(id, g);
      }
      g.rows.push(r);
      g.onHand += r.currentQuantity || 0;
      g.reserved += r.reservedQuantity || 0;
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const grandTotal = useMemo(() => rows.reduce((s, r) => s + (r.currentQuantity || 0), 0), [rows]);

  const adjust = async (row: WarehouseStockRow, type: AdjustType) => {
    if (!token) return;
    const raw = prompt(
      type === 'adjusted'
        ? 'Set on-hand quantity to:'
        : `Quantity to ${type === 'received' ? 'add' : 'remove'}:`
    );
    if (raw == null) return;
    const quantity = Number(raw);
    if (!Number.isFinite(quantity) || quantity < 0) {
      toast.error('Enter a valid number');
      return;
    }
    try {
      await warehouseStockService.adjustStock(
        String(idOf(row.warehouse)),
        { subProduct: String(subProductId), size: String(idOf(row.size)), quantity, type },
        token
      );
      toast.success('Stock adjusted');
      await load();
      onRefresh?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Adjust failed');
    }
  };

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <p className="text-sm font-bold text-gray-900">Stock by Warehouse</p>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
            {groups.length}
          </span>
          <span className="text-xs text-gray-400">{grandTotal} units total</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={load} disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">
            <PiArrowClockwise className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link href={routes.warehouses.list}
            className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 transition-colors">
            <PiArrowSquareOut className="h-3.5 w-3.5" />
            Manage warehouses
          </Link>
        </div>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <PiSpinner className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )}

      {/* ── Empty ── */}
      {!loading && groups.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
          <PiWarehouse className="mx-auto h-12 w-12 text-gray-200" />
          <p className="mt-3 text-sm font-medium text-gray-500">Not stocked in any warehouse yet</p>
          <p className="mt-1 text-xs text-gray-400">
            Receive this item into a warehouse from the warehouse&apos;s stock page to start tracking it here.
          </p>
          <Link href={routes.warehouses.list}
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 transition-colors">
            <PiArrowSquareOut className="h-4 w-4" /> Go to warehouses
          </Link>
        </div>
      )}

      {/* ── Warehouse groups ── */}
      {!loading && groups.map((g) => (
        <div key={g.warehouseId} className="overflow-hidden rounded-2xl border border-gray-200">
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <PiWarehouse className="h-4 w-4 text-gray-400" />
              <Link href={routes.warehouses.detail(g.warehouseId)}
                className="text-xs font-bold text-gray-800 hover:text-gray-900 hover:underline">
                {g.name}
              </Link>
              {g.code && <span className="font-mono text-[10px] text-gray-400">{g.code}</span>}
            </div>
            <div className="flex items-center gap-4 text-[10px] text-gray-400">
              <span>On hand <span className="font-bold text-gray-700">{g.onHand}</span></span>
              <span>Reserved <span className="font-bold text-amber-600">{g.reserved}</span></span>
              <span>Available <span className="font-bold text-green-600">{Math.max(0, g.onHand - g.reserved)}</span></span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">Size</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-gray-400">On Hand</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-gray-400">Reserved</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-gray-400">Available</th>
                  <th className="px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {g.rows.map((r) => (
                  <tr key={r._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{String(sizeName(r))}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-gray-800">{r.currentQuantity}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-amber-600">{r.reservedQuantity}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-green-600">{available(r)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button type="button" onClick={() => adjust(r, 'received')} title="Receive stock"
                          className="rounded border border-gray-200 px-2 py-1 text-[10px] font-semibold text-gray-600 hover:bg-gray-100">+ Receive</button>
                        <button type="button" onClick={() => adjust(r, 'shipped')} title="Ship stock"
                          className="rounded border border-gray-200 px-2 py-1 text-[10px] font-semibold text-gray-600 hover:bg-gray-100">− Ship</button>
                        <button type="button" onClick={() => adjust(r, 'adjusted')} title="Set on-hand quantity"
                          className="rounded border border-gray-200 px-2 py-1 text-[10px] font-semibold text-gray-600 hover:bg-gray-100">Set</button>
                        <button type="button" onClick={() => setTransferRow(r)} title="Transfer to another warehouse"
                          className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-[10px] font-semibold text-gray-600 hover:bg-gray-100">
                          <PiArrowsLeftRight className="h-3 w-3" /> Transfer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* ── Transfer drawer ── */}
      {transferRow && subProductId && (
        <WarehouseTransferDrawer
          fromWarehouseId={String(idOf(transferRow.warehouse))}
          subProductId={String(subProductId)}
          sizeId={String(idOf(transferRow.size))}
          label={`${String(whName(transferRow))} · ${String(sizeName(transferRow))}`}
          maxQuantity={transferRow.currentQuantity}
          onClose={() => setTransferRow(null)}
          onDone={async () => { setTransferRow(null); await load(); onRefresh?.(); }}
        />
      )}
    </div>
  );
}

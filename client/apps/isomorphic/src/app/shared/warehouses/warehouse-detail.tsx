'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { PiArrowLeft, PiArrowsLeftRight } from 'react-icons/pi';
import { warehouseService, type Warehouse } from '@/services/warehouse.service';
import {
  warehouseStockService,
  type WarehouseStockRow,
  type AdjustType,
} from '@/services/warehouseStock.service';
import WarehouseTransferDrawer from './warehouse-transfer-drawer';
import { routes } from '@/config/routes';

const skuOf = (r: WarehouseStockRow) =>
  typeof r.subProduct === 'object' ? r.subProduct.sku ?? r.subProduct._id : r.subProduct;
const sizeOf = (r: WarehouseStockRow) =>
  typeof r.size === 'object' ? r.size.size ?? r.size._id : r.size;
const idOf = (v: WarehouseStockRow['subProduct'] | WarehouseStockRow['size']) =>
  typeof v === 'object' ? v._id : v;

export default function WarehouseDetail({ warehouseId }: { warehouseId: string }) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [rows, setRows] = useState<WarehouseStockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [transferRow, setTransferRow] = useState<WarehouseStockRow | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [wh, stock] = await Promise.all([
        warehouseService.getWarehouseById(warehouseId, token),
        warehouseStockService.getWarehouseStock(warehouseId, token),
      ]);
      setWarehouse(wh.data);
      setRows(stock.data ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token, warehouseId]);

  useEffect(() => { load(); }, [load]);

  const adjust = async (row: WarehouseStockRow, type: AdjustType) => {
    const raw = prompt(
      type === 'adjusted' ? 'Set quantity to:' : `Quantity to ${type === 'received' ? 'add' : 'remove'}:`
    );
    if (raw == null) return;
    const quantity = Number(raw);
    if (!Number.isFinite(quantity) || quantity < 0) {
      toast.error('Enter a valid number');
      return;
    }
    try {
      await warehouseStockService.adjustStock(
        warehouseId,
        { subProduct: String(idOf(row.subProduct)), size: String(idOf(row.size)), quantity, type },
        token
      );
      toast.success('Stock adjusted');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Adjust failed');
    }
  };

  return (
    <div>
      <Link href={routes.warehouses.list} className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600">
        <PiArrowLeft /> Warehouses
      </Link>
      <h1 className="mb-1 text-2xl font-semibold">{warehouse?.name ?? 'Warehouse'}</h1>
      <p className="mb-6 text-sm text-gray-500">{warehouse?.code} · {warehouse?.type?.replace('_', ' ')}</p>

      {loading ? (
        <p>Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-gray-500">No stock in this warehouse yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3 text-right">On hand</th>
                <th className="px-4 py-3 text-right">Reserved</th>
                <th className="px-4 py-3 text-right">Available</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id} className="border-t">
                  <td className="px-4 py-3">{skuOf(r)}</td>
                  <td className="px-4 py-3">{sizeOf(r)}</td>
                  <td className="px-4 py-3 text-right">{r.currentQuantity}</td>
                  <td className="px-4 py-3 text-right">{r.reservedQuantity}</td>
                  <td className="px-4 py-3 text-right">{Math.max(0, r.currentQuantity - r.reservedQuantity)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => adjust(r, 'received')} className="rounded border px-2 py-1 text-xs">+ Receive</button>
                      <button onClick={() => adjust(r, 'shipped')} className="rounded border px-2 py-1 text-xs">− Ship</button>
                      <button onClick={() => adjust(r, 'adjusted')} className="rounded border px-2 py-1 text-xs">Set</button>
                      <button onClick={() => setTransferRow(r)} className="rounded border px-2 py-1 text-xs inline-flex items-center gap-1">
                        <PiArrowsLeftRight /> Transfer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {transferRow && (
        <WarehouseTransferDrawer
          fromWarehouseId={warehouseId}
          subProductId={String(idOf(transferRow.subProduct))}
          sizeId={String(idOf(transferRow.size))}
          label={`${skuOf(transferRow)} · ${sizeOf(transferRow)}`}
          maxQuantity={transferRow.currentQuantity}
          onClose={() => setTransferRow(null)}
          onDone={async () => { setTransferRow(null); await load(); }}
        />
      )}
    </div>
  );
}

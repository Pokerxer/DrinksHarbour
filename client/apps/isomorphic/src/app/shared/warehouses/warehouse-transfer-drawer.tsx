'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { warehouseService, type Warehouse } from '@/services/warehouse.service';
import { warehouseStockService } from '@/services/warehouseStock.service';

interface Props {
  fromWarehouseId: string;
  subProductId: string;
  sizeId: string;
  label: string;
  maxQuantity: number;
  onClose: () => void;
  onDone: () => void;
}

export default function WarehouseTransferDrawer({
  fromWarehouseId, subProductId, sizeId, label, maxQuantity, onClose, onDone,
}: Props) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [toWarehouse, setToWarehouse] = useState('');
  const [quantity, setQuantity] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    warehouseService
      .getWarehouses(token, { isActive: true })
      .then((res) => setWarehouses((res.data ?? []).filter((w: Warehouse) => w._id !== fromWarehouseId)))
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load warehouses'));
  }, [token, fromWarehouseId]);

  const submit = async () => {
    const qty = Number(quantity);
    if (!toWarehouse) return toast.error('Pick a destination');
    if (!Number.isFinite(qty) || qty <= 0) return toast.error('Enter a quantity');
    if (qty > maxQuantity) return toast.error(`Only ${maxQuantity} available`);
    setBusy(true);
    try {
      await warehouseStockService.transferStock(
        { subProduct: subProductId, size: sizeId, fromWarehouse: fromWarehouseId, toWarehouse, quantity: qty },
        token
      );
      toast.success('Transferred');
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Transfer failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className="h-full w-full max-w-md bg-white p-6">
        <h2 className="mb-1 text-lg font-semibold">Transfer stock</h2>
        <p className="mb-6 text-sm text-gray-500">{label} · {maxQuantity} on hand</p>

        <label className="mb-4 block text-sm">Destination warehouse
          <select className="mt-1 w-full rounded border px-3 py-2" value={toWarehouse}
            onChange={(e) => setToWarehouse(e.target.value)}>
            <option value="">Select…</option>
            {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name} ({w.code})</option>)}
          </select>
        </label>

        <label className="mb-6 block text-sm">Quantity
          <input type="number" min={1} max={maxQuantity} className="mt-1 w-full rounded border px-3 py-2"
            value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </label>

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border px-4 py-2">Cancel</button>
          <button onClick={submit} disabled={busy} className="rounded-lg bg-[#B20202] px-4 py-2 text-white disabled:opacity-60">
            {busy ? 'Transferring…' : 'Transfer'}
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { PiCoinsBold } from 'react-icons/pi';
import { warehouseService, type Warehouse } from '@/services/warehouse.service';
import {
  warehouseStockService,
  type LastCost,
} from '@/services/warehouseStock.service';

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
  fromWarehouseId,
  subProductId,
  sizeId,
  label,
  maxQuantity,
  onClose,
  onDone,
}: Props) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [toWarehouse, setToWarehouse] = useState('');
  const [quantity, setQuantity] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastCost, setLastCost] = useState<LastCost | null>(null);

  // Latest known buy price for the line being moved — shown so the operator
  // can see the value walking out the door. Fetched internally: every call
  // site already passes subProductId + sizeId.
  useEffect(() => {
    if (!token || !subProductId || !sizeId) return;
    let alive = true;
    warehouseStockService
      .getLastCost(subProductId, sizeId, token)
      .then((res) => alive && setLastCost(res.data))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [token, subProductId, sizeId]);

  useEffect(() => {
    if (!token) return;
    warehouseService
      .getWarehouses(token, { isActive: true })
      .then((res: unknown) => {
        const list = (res as { data?: Warehouse[] }).data ?? [];
        setWarehouses(list.filter((w) => w._id !== fromWarehouseId));
      })
      .catch((e) =>
        toast.error(
          e instanceof Error ? e.message : 'Failed to load warehouses'
        )
      );
  }, [token, fromWarehouseId]);

  const submit = async () => {
    const qty = Number(quantity);
    if (!toWarehouse) return toast.error('Pick a destination');
    if (!Number.isFinite(qty) || qty <= 0)
      return toast.error('Enter a quantity');
    if (qty > maxQuantity) return toast.error(`Only ${maxQuantity} available`);
    setBusy(true);
    try {
      await warehouseStockService.transferStock(
        {
          subProduct: subProductId,
          size: sizeId,
          fromWarehouse: fromWarehouseId,
          toWarehouse,
          quantity: qty,
        },
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
        <p className="mb-3 text-sm text-gray-500">
          {label} · {maxQuantity} on hand
        </p>

        {lastCost && lastCost.unitCost !== null && (
          <div className="mb-6 flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2.5 text-sm">
            <span className="flex items-center gap-2 text-gray-500">
              <PiCoinsBold className="h-4 w-4 text-[#b20202]/70" />
              Last cost
            </span>
            <span className="text-right">
              <b className="tabular-nums text-gray-900">
                ₦{lastCost.unitCost.toLocaleString()}
              </b>
              <span className="ml-2 text-xs text-gray-400">
                ≈ ₦
                {(lastCost.unitCost * maxQuantity).toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}{' '}
                total
              </span>
              {lastCost.source === 'standard' && (
                <span className="ml-1 text-[10px] uppercase text-gray-300">
                  std
                </span>
              )}
            </span>
          </div>
        )}

        <label className="mb-4 block text-sm">
          Destination warehouse
          <select
            className="mt-1 w-full rounded border px-3 py-2"
            value={toWarehouse}
            onChange={(e) => setToWarehouse(e.target.value)}
          >
            <option value="">Select…</option>
            {warehouses.map((w) => (
              <option key={w._id} value={w._id}>
                {w.name} ({w.code})
              </option>
            ))}
          </select>
        </label>

        <label className="mb-6 block text-sm">
          Quantity
          <input
            type="number"
            min={1}
            max={maxQuantity}
            className="mt-1 w-full rounded border px-3 py-2"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </label>

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border px-4 py-2">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="rounded-lg bg-[#B20202] px-4 py-2 text-white disabled:opacity-60"
          >
            {busy ? 'Transferring…' : 'Transfer'}
          </button>
        </div>
      </div>
    </div>
  );
}

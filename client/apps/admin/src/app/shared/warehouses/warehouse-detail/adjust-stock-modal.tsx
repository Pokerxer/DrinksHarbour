'use client';

// app/shared/warehouses/warehouse-detail/adjust-stock-modal.tsx
// Stock adjustment for one line. Mirrors the server contract exactly
// (server/services/warehouse.service.js → adjustStock):
//   received — quantity ADDED to on-hand
//   shipped  — quantity REMOVED from on-hand (capped at current when negative
//              stock is disallowed; we cap client-side too)
//   adjusted — quantity is the NEW absolute on-hand count

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import {
  PiX,
  PiArrowDownBold,
  PiArrowUpBold,
  PiSlidersHorizontalBold,
} from 'react-icons/pi';
import {
  warehouseStockService,
  type AdjustType,
  type LastCost,
  type WarehouseStockRow,
} from '@/services/warehouseStock.service';
import {
  skuOf,
  productNameOf as nameOf,
  sizeLabelOf as sizeOf,
  subProductIdOf,
  sizeIdOf,
} from '../warehouse-ref-helpers';

type Option = {
  type: AdjustType;
  label: string;
  hint: string;
  icon: React.ReactNode;
};

const OPTIONS: Option[] = [
  {
    type: 'received',
    label: 'Receive',
    hint: 'Add units into this warehouse',
    icon: <PiArrowDownBold className="h-4 w-4" />,
  },
  {
    type: 'shipped',
    label: 'Ship out',
    hint: 'Issue units from this warehouse',
    icon: <PiArrowUpBold className="h-4 w-4" />,
  },
  {
    type: 'adjusted',
    label: 'Recount',
    hint: 'Set the counted on-hand total',
    icon: <PiSlidersHorizontalBold className="h-4 w-4" />,
  },
];

export default function AdjustStockModal({
  warehouseId,
  row,
  onClose,
  onDone,
}: {
  warehouseId: string;
  row: WarehouseStockRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [type, setType] = useState<AdjustType>('received');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [lastCost, setLastCost] = useState<LastCost | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  // Latest known buy price — shown as context and pre-fills receipts so the
  // movement trail can carry real costs without retyping.
  useEffect(() => {
    if (!token) return;
    const sp = subProductIdOf(row);
    const sz = sizeIdOf(row);
    if (!sp || !sz) return;
    let alive = true;
    warehouseStockService
      .getLastCost(sp, sz, token)
      .then((res) => {
        if (!alive) return;
        setLastCost(res.data);
        if (res.data.unitCost && res.data.unitCost > 0)
          setUnitCost(String(res.data.unitCost));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [token, row]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  const qty = Number(quantity);
  const hasQty = quantity.trim() !== '' && Number.isFinite(qty);
  const delta = hasQty ? qty : 0;
  // Until something is typed the preview simply mirrors the current count.
  const projected = !hasQty
    ? row.currentQuantity
    : type === 'received'
      ? row.currentQuantity + delta
      : type === 'shipped'
        ? Math.max(0, row.currentQuantity - delta)
        : Math.max(0, delta);

  const validate = (): string | null => {
    if (!Number.isFinite(qty) || !Number.isInteger(qty) || qty <= 0)
      return 'Enter a whole quantity greater than zero';
    if (type === 'shipped' && qty > row.currentQuantity)
      return `Only ${row.currentQuantity} on hand`;
    if (type === 'adjusted' && qty === row.currentQuantity)
      return 'That is already the current count';
    if (!token) return 'Session expired — reload the page';
    return null;
  };

  const submit = async () => {
    const problem = validate();
    if (problem) return toast.error(problem);
    const subProduct = subProductIdOf(row);
    const size = sizeIdOf(row);
    if (!subProduct || !size)
      return toast.error('This line has no resolvable product reference');
    setBusy(true);
    try {
      await warehouseStockService.adjustStock(
        warehouseId,
        {
          subProduct,
          size,
          quantity: qty,
          type,
          notes: notes.trim() || undefined,
          unitCost:
            type === 'received' && Number(unitCost) > 0
              ? Number(unitCost)
              : null,
        },
        token
      );
      toast.success('Stock updated');
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Adjustment failed');
    } finally {
      setBusy(false);
    }
  };

  const field =
    'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20';

  const name = nameOf(row) || skuOf(row);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Adjust stock for ${name}`}
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Adjust stock
            </p>
            <p className="mt-0.5 truncate font-semibold text-gray-900">
              {name}
            </p>
            <p className="font-mono text-xs text-gray-400">
              {skuOf(row)} · Size {sizeOf(row)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
          >
            <PiX className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-6">
          {/* Type selector */}
          <div className="grid grid-cols-3 gap-2">
            {OPTIONS.map((o) => (
              <button
                key={o.type}
                type="button"
                onClick={() => setType(o.type)}
                aria-pressed={type === o.type}
                className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-semibold transition-colors ${
                  type === o.type
                    ? 'border-[#b20202] bg-[#b20202]/5 text-[#b20202]'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {o.icon}
                {o.label}
              </button>
            ))}
          </div>
          <p className="-mt-3 text-center text-xs text-gray-400">
            {OPTIONS.find((o) => o.type === type)?.hint}
          </p>

          {/* Last known buy price context */}
          {lastCost && lastCost.unitCost !== null && (
            <p className="-mt-2 text-center text-xs text-gray-500">
              Last bought at{' '}
              <b className="tabular-nums text-gray-800">
                ₦{lastCost.unitCost.toLocaleString()}
              </b>
              {lastCost.source === 'standard' ? (
                <span className="text-gray-300"> · standard cost</span>
              ) : lastCost.asOf ? (
                <span className="text-gray-300">
                  {' '}
                  ·{' '}
                  {new Date(lastCost.asOf).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                  {lastCost.reference ? ` · ${lastCost.reference}` : ''}
                </span>
              ) : null}
            </p>
          )}

          {/* Quantity */}
          <label className="block text-sm font-medium text-gray-700">
            {type === 'adjusted'
              ? 'Counted on-hand total'
              : type === 'received'
                ? 'Units received'
                : 'Units shipped'}
            <input
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              autoFocus
              className={`mt-1.5 ${field}`}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
              placeholder={
                type === 'adjusted' ? String(row.currentQuantity) : '0'
              }
            />
          </label>

          {/* Unit cost — captured on receipts so valuation & history track it */}
          {type === 'received' && (
            <label className="block text-sm font-medium text-gray-700">
              Unit cost{' '}
              <span className="font-normal text-gray-400">
                (₦ per unit, optional)
              </span>
              <input
                type="number"
                min={0}
                step={0.01}
                inputMode="decimal"
                className={`mt-1.5 ${field}`}
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                placeholder={lastCost?.unitCost ? String(lastCost.unitCost) : '0'}
              />
            </label>
          )}

          {/* Projection */}
          <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3 text-sm">
            <span className="text-gray-500">
              On hand{' '}
              <b className="tabular-nums text-gray-900">
                {row.currentQuantity.toLocaleString()}
              </b>
            </span>
            <span className="text-gray-300">→</span>
            <span className="text-gray-500">
              After:{' '}
              <b
                className={`tabular-nums ${
                  projected === row.currentQuantity
                    ? 'text-gray-900'
                    : 'text-[#b20202]'
                }`}
              >
                {Math.max(0, projected).toLocaleString()}
              </b>
            </span>
          </div>

          {/* Notes */}
          <label className="block text-sm font-medium text-gray-700">
            Note <span className="font-normal text-gray-400">(optional)</span>
            <input
              type="text"
              className={`mt-1.5 ${field}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                type === 'received'
                  ? 'PO reference, supplier…'
                  : type === 'shipped'
                    ? 'Order / destination…'
                    : 'Reason for recount…'
              }
            />
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !quantity}
            className="rounded-lg bg-[#b20202] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#9f0101] disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Apply adjustment'}
          </button>
        </div>
      </div>
    </div>
  );
}

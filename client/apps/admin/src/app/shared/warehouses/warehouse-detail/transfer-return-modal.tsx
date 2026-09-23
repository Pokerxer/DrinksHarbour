'use client';

// app/shared/warehouses/warehouse-detail/transfer-return-modal.tsx
// Refund/return a transfer from a movement-history entry: move the line's
// goods back to the originating warehouse. When the movement came from the
// StockTransfer module the server also reverses the destination→source money.

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import {
  PiX,
  PiArrowsLeftRightBold,
  PiCoinsBold,
  PiSpinner,
} from 'react-icons/pi';
import {
  warehouseStockService,
  type WarehouseMovement,
} from '@/services/warehouseStock.service';

// StockTransfer module movements reference their number: "Transfer TRF-…".
const MODULE_TRANSFER_RE = /^Transfer\s+[A-Z0-9-]+\s*$/i;

export default function TransferReturnModal({
  movement,
  label,
  onClose,
  onDone,
}: {
  movement: WarehouseMovement;
  label: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [quantity, setQuantity] = useState(String(movement.quantity));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  const qty = Math.floor(Number(quantity) || 0);
  const valid = quantity.trim() !== '' && qty > 0 && qty <= movement.quantity;
  // Money is reversed only for StockTransfer-module transfers.
  const reversesMoney = MODULE_TRANSFER_RE.test(movement.reference ?? '');

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await warehouseStockService.returnMovement(
        movement._id,
        { quantity: qty, ...(note.trim() ? { note: note.trim() } : {}) },
        token
      );
      toast.success(
        reversesMoney ? 'Transfer returned & refunded' : 'Transfer returned'
      );
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Return failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
              <PiArrowsLeftRightBold className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                Return / refund transfer
              </h3>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => !busy && onClose()}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <PiX className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
            {movement.type === 'transfer_in'
              ? 'This stock was transferred INTO this warehouse.'
              : 'This stock was transferred OUT of this warehouse to another.'}{' '}
            Returning sends it back to the originating warehouse.
            {reversesMoney && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-emerald-700">
                <PiCoinsBold className="h-3.5 w-3.5" />
                This transfer was a transfer-as-purchase, so the destination’s
                payable is refunded as well.
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="return-qty"
              className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500"
            >
              Quantity to return
            </label>
            <input
              id="return-qty"
              type="number"
              min={1}
              max={movement.quantity}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#b20202] focus:ring-2 focus:ring-[#b20202]/10"
            />
            <p className="mt-1 text-xs text-gray-400">
              Transferred {movement.quantity} unit
              {movement.quantity !== 1 ? 's' : ''} · max returnable{' '}
              {movement.quantity}
            </p>
          </div>

          <div>
            <label
              htmlFor="return-note"
              className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500"
            >
              Note <span className="font-normal normal-case">(optional)</span>
            </label>
            <textarea
              id="return-note"
              rows={2}
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why is this being returned?"
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#b20202] focus:ring-2 focus:ring-[#b20202]/10"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button
            type="button"
            onClick={() => !busy && onClose()}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!valid || busy}
            onClick={submit}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9f0101] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy && <PiSpinner className="h-4 w-4 animate-spin" />}
            Return &amp; {reversesMoney ? 'Refund' : 'Reverse'}
          </button>
        </div>
      </div>
    </div>
  );
}

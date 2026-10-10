'use client';
import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { stockTransferService, type StockTransfer } from '@/services/stockTransfer.service';

export default function TransferReturnAllAction({
  transfer,
  token,
  note,
  busy,
  onBusyChange,
  onComplete,
}: {
  transfer: StockTransfer;
  token: string;
  note: string;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  onComplete: (updated: StockTransfer) => void | Promise<void>;
}) {
  const [review, setReview] = useState(false);
  const submitting = useRef(false);
  const retry = useRef<{ note: string; id: string } | undefined>(undefined);
  const lines = transfer.items
    .map((item) => ({
      name: `${item.subProductName}${item.sizeName ? ` — ${item.sizeName}` : ''}`,
      quantity: Math.max(
        0,
        (item.receivedQty ?? item.transferredQty ?? 0) - (item.returnedQty || 0),
      ),
    }))
    .filter((line) => line.quantity > 0);
  if (!lines.length) return null;
  async function submit() {
    if (busy || submitting.current) return;
    if (retry.current?.note !== note) retry.current = { note, id: crypto.randomUUID() };
    submitting.current = true;
    onBusyChange(true);
    try {
      const saved = await stockTransferService.returnAll(
        transfer._id,
        { note, requestId: retry.current.id },
        token,
      );
      setReview(false);
      retry.current = undefined;
      toast.success('All remaining products returned');
      await onComplete(saved.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to return products');
    } finally {
      submitting.current = false;
      onBusyChange(false);
    }
  }
  return (
    <div className="my-3">
      <button
        type="button"
        disabled={busy}
        onClick={() => setReview(true)}
        className="rounded-lg border border-orange-300 px-3 py-2 text-sm font-medium text-orange-700 disabled:opacity-50"
      >
        Return all products
      </button>
      {review && (
        <div
          className="mt-3 rounded-lg border border-orange-200 bg-orange-50 p-3"
          role="region"
          aria-label="Review whole invoice return"
        >
          <p className="text-sm font-medium">
            Return all remaining received products to the source location?
          </p>
          <ul className="my-2 space-y-1 text-sm">
            {lines.map((line, index) => (
              <li key={index}>
                {line.name}: {line.quantity} units
              </li>
            ))}
          </ul>
          <p className="mb-3 text-xs">
            The transfer value and return history will be updated after confirmation.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={submit}
              className="rounded-lg bg-[#b20202] px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              {busy ? 'Returning…' : 'Confirm return of all products'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setReview(false)}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

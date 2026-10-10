'use client';
import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { stockTransferService, type StockTransfer } from '@/services/stockTransfer.service';
import { fmtCur } from './purchases-analytics-helpers';
import TransferReturnAllAction from './transfer-return-all-action';

export default function TransferReturnPanel({
  transfer,
  token,
  canReturn,
  onComplete,
}: {
  transfer: StockTransfer;
  token: string;
  canReturn: boolean;
  onComplete: (updated: StockTransfer) => void | Promise<void>;
}) {
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const retry = useRef<{ signature: string; id: string } | undefined>(undefined);
  const submitting = useRef(false);
  const returned = transfer.items.reduce((sum, item) => sum + (item.returnedQty || 0), 0);
  const hasReceived = transfer.items.some((it) => (it.receivedQty ?? it.transferredQty ?? 0) > 0);
  if (!hasReceived) return null;
  async function submit(itemIndex: number, available: number) {
    if (submitting.current) return;
    const quantity = Number(quantities[itemIndex]);
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > available) {
      toast.error('Enter a whole quantity within the remaining received stock');
      return;
    }
    const body = { itemIndex, quantity, note };
    const signature = JSON.stringify(body);
    if (retry.current?.signature !== signature)
      retry.current = { signature, id: crypto.randomUUID() };
    submitting.current = true;
    setBusy(true);
    try {
      const saved = await stockTransferService.returnLine(
        transfer._id,
        { ...body, requestId: retry.current.id },
        token,
      );
      setQuantities({});
      setNote('');
      retry.current = undefined;
      toast.success('Stock returned and transfer value reduced');
      await onComplete(saved.data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to return stock');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-semibold">Returns and refunds</h2>
      <p className="my-2 text-sm">
        Returned: <strong>{returned} units</strong> · Remaining transfer value:{' '}
        <strong>
          {fmtCur(transfer.total ?? transfer.totalValue ?? 0, transfer.currency ?? 'NGN')}
        </strong>
      </p>
      {canReturn && (
        <p className="mb-3 text-xs text-gray-600">
          Return received goods to the source location. The server checks current stock and reduces
          the transfer value.
        </p>
      )}
      {canReturn && (
        <TransferReturnAllAction
          transfer={transfer}
          token={token}
          note={note}
          busy={busy}
          onBusyChange={setBusy}
          onComplete={onComplete}
        />
      )}
      <div className="space-y-3">
        {transfer.items.map((item, index) => {
          const received = item.receivedQty ?? item.transferredQty ?? 0;
          const available = Math.max(0, received - (item.returnedQty || 0));
          const name = `${item.subProductName}${item.sizeName ? ` — ${item.sizeName}` : ''}`;
          return (
            <div
              key={item._id || index}
              className="flex flex-wrap items-center gap-3 border-t pt-3"
            >
              <div className="min-w-48 flex-1">
                <p className="text-sm font-medium">{name}</p>
                <p className="text-xs text-gray-500">
                  Received {received} · Returned {item.returnedQty || 0} · Returnable {available}
                </p>
              </div>
              {canReturn && available > 0 && (
                <>
                  <input
                    aria-label={`Return quantity for ${name}`}
                    type="number"
                    step="1"
                    min="1"
                    max={available}
                    value={quantities[index] || ''}
                    disabled={busy}
                    onChange={(e) => setQuantities((q) => ({ ...q, [index]: e.target.value }))}
                    className="w-24 rounded-lg border p-2 text-sm"
                  />
                  <button
                    type="button"
                    aria-label={`Return ${name}`}
                    disabled={busy}
                    onClick={() => submit(index, available)}
                    className="rounded-lg bg-[#b20202] px-3 py-2 text-sm text-white disabled:opacity-50"
                  >
                    {busy ? 'Saving…' : 'Return stock'}
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
      {canReturn && (
        <div className="mt-3">
          <label htmlFor="transfer-return-note" className="text-xs">
            Return reason / note
          </label>
          <input
            id="transfer-return-note"
            value={note}
            maxLength={200}
            disabled={busy}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 w-full rounded-lg border p-2 text-sm"
          />
        </div>
      )}
      {!!transfer.returns?.length && (
        <div className="mt-4 border-t pt-3">
          <h3 className="text-sm font-semibold">Return history</h3>
          <ul className="mt-2 space-y-2 text-xs">
            {transfer.returns.map((r, index) => (
              <li key={r._id || index}>
                {new Date(r.returnedAt).toLocaleString()} ·{' '}
                {r.lines
                  .map(
                    (l) =>
                      `${transfer.items[l.itemIndex]?.subProductName || 'Product'}: ${l.quantity} units${l.note ? ` (${l.note})` : ''}`,
                  )
                  .join('; ')}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

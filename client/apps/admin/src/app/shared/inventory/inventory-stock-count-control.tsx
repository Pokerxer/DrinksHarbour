'use client';
import { useState } from 'react';
import { PiCheck } from 'react-icons/pi';
import type { StockRow } from '@/services/warehouseStock.service';
export default function StockCountControl({
  row,
  apply,
}: {
  row: StockRow;
  apply: (id: string, quantity: number) => Promise<void>;
}) {
  const [count, setCount] = useState('');
  const [busy, setBusy] = useState(false);
  const value = count.trim() ? Number(count) : NaN;
  const valid = Number.isFinite(value) && value >= 0 && Boolean(row.warehouseId && row.sizeId);
  const difference = valid ? value - row.currentQuantity : null;
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-3">
      <h3 className="text-xs font-semibold text-gray-800">Physical count</h3>
      <div className="mt-2 flex items-center gap-2">
        <input
          aria-label="Counted quantity"
          type="number"
          min={0}
          value={count}
          onChange={(event) => setCount(event.target.value)}
          placeholder={String(row.currentQuantity)}
          className="w-24 rounded-lg border border-gray-200 px-2 py-2 text-right text-sm"
        />
        <span className="text-xs tabular-nums text-gray-600">
          {difference === null ? '—' : `${difference > 0 ? '+' : ''}${difference}`}
        </span>
        <button
          type="button"
          disabled={busy || !valid || difference === 0}
          onClick={async () => {
            setBusy(true);
            try {
              await apply(row._id, value);
              setCount('');
            } catch {
              /* Parent shows the failed adjustment. */
            } finally {
              setBusy(false);
            }
          }}
          className="ml-auto flex items-center gap-1 rounded-lg bg-[#b20202] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
        >
          <PiCheck />
          {busy ? 'Applying…' : 'Apply count'}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-gray-500">
        Sets this warehouse’s on-hand quantity and records an adjustment in history.
      </p>
    </section>
  );
}

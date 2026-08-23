// app/shared/purchases/transfer-receive-panel.tsx
//
// Destination-side goods receipt form for a stock transfer. Each line shows
// product · sent · received · outstanding with a controlled quantity input
// (default = outstanding, clamped 1..outstanding) and an optional note.
// Submitting emits only lines with qty ≥ 1 as {itemIndex, quantity, note?} —
// the server re-validates every quantity against the document.

'use client';

import { useEffect, useState } from 'react';
import { PiSpinner } from 'react-icons/pi';
import type { TransferItem } from '@/services/stockTransfer.service';
import { fmtCur } from './purchases-analytics-helpers';
import { outstandingOf } from './transfer-receive-panel-helpers';

export interface ReceiveLineInput {
  itemIndex: number;
  quantity: number;
  note?: string;
}

interface Props {
  items: TransferItem[];
  currency: string;
  busy: boolean;
  onSubmit: (lines: ReceiveLineInput[]) => void | Promise<void>;
}

interface RowState {
  qty: string;
  note: string;
}

function labelOf(it: TransferItem) {
  return it.sizeName && !it.subProductName.includes(it.sizeName)
    ? `${it.subProductName} – ${it.sizeName}`
    : it.subProductName;
}

export default function TransferReceivePanel({
  items,
  currency,
  busy,
  onSubmit,
}: Props) {
  const [rows, setRows] = useState<Record<number, RowState>>({});

  // Seed/reset one row per item whenever the transfer's lines change
  // (e.g. after a partial receipt bumps receivedQty).
  useEffect(() => {
    const init: Record<number, RowState> = {};
    items.forEach((it, i) => {
      const out = outstandingOf(it);
      init[i] = { qty: out > 0 ? String(out) : '', note: '' };
    });
    setRows(init);
  }, [items]);

  function setRow(i: number, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [i]: { ...prev[i], ...patch } }));
  }

  function clampQty(i: number, raw: string) {
    const out = outstandingOf(items[i]);
    if (raw === '') return setRow(i, { qty: '' });
    const n = Math.floor(Number(raw));
    if (!Number.isFinite(n)) return setRow(i, { qty: '' });
    setRow(i, { qty: String(Math.min(Math.max(n, 1), out)) });
  }

  const lines: ReceiveLineInput[] = [];
  items.forEach((it, i) => {
    if (outstandingOf(it) <= 0) return;
    const qty = Number(rows[i]?.qty ?? 0);
    if (!(qty >= 1)) return;
    const note = rows[i]?.note?.trim();
    lines.push({ itemIndex: i, quantity: qty, ...(note ? { note } : {}) });
  });

  const headerCell = 'px-3 py-2 text-left text-xs font-medium text-gray-500';

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Record receipt</h2>
        <p className="text-xs text-gray-400">
          Quantities default to the full outstanding amount — lower them for a
          partial delivery.
        </p>
      </div>

      <div className="hidden grid-cols-12 gap-3 border-b border-gray-100 pb-1 sm:grid">
        <div className={`${headerCell} col-span-4`}>Product</div>
        <div className={`${headerCell} col-span-1 text-right`}>Sent</div>
        <div className={`${headerCell} col-span-1 text-right`}>Received</div>
        <div className={`${headerCell} col-span-1 text-right`}>Outstanding</div>
        <div className={`${headerCell} col-span-2`}>Receiving now</div>
        <div className={`${headerCell} col-span-3`}>Note</div>
      </div>

      <div className="divide-y divide-gray-100">
        {items.map((it, i) => {
          const out = outstandingOf(it);
          const disabled = out <= 0 || busy;
          return (
            <div
              key={i}
              className={`grid grid-cols-1 gap-2 px-0 py-3 sm:grid-cols-12 sm:items-center sm:gap-3 ${
                disabled ? 'opacity-50' : ''
              }`}
            >
              <div className="col-span-4 min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">
                  {labelOf(it)}
                </p>
                <p className="truncate font-mono text-[11px] text-gray-400">
                  {it.sku || '—'}
                  {(it.costPrice ?? 0) > 0 &&
                    ` · ${fmtCur(Number(it.costPrice), currency)}`}
                </p>
              </div>
              <div className="col-span-1 text-sm tabular-nums text-gray-700 sm:text-right">
                <span className="text-xs text-gray-400 sm:hidden">Sent </span>
                {it.quantity}
              </div>
              <div className="col-span-1 text-sm tabular-nums text-gray-700 sm:text-right">
                <span className="text-xs text-gray-400 sm:hidden">Received </span>
                {it.receivedQty ?? 0}
              </div>
              <div className="col-span-1 text-sm tabular-nums sm:text-right">
                <span className="text-xs text-gray-400 sm:hidden">Outstanding </span>
                <span className={out > 0 ? 'font-medium text-amber-600' : 'text-gray-400'}>
                  {out}
                </span>
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  min={1}
                  max={out}
                  value={rows[i]?.qty ?? ''}
                  disabled={disabled}
                  onChange={(e) => clampQty(i, e.target.value)}
                  aria-label={`Quantity to receive for ${labelOf(it)}`}
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-right text-sm tabular-nums focus:border-[#b20202] focus:outline-none disabled:bg-gray-50"
                />
              </div>
              <div className="col-span-3">
                <input
                  type="text"
                  maxLength={300}
                  value={rows[i]?.note ?? ''}
                  disabled={disabled}
                  placeholder={out > 0 ? 'Optional note' : 'Fully received'}
                  onChange={(e) => setRow(i, { note: e.target.value })}
                  aria-label={`Note for ${labelOf(it)}`}
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-[#b20202] focus:outline-none disabled:bg-gray-50"
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
        <p className="mr-auto text-xs text-gray-400">
          {lines.length} line{lines.length !== 1 ? 's' : ''} ready to receive
        </p>
        <button
          type="button"
          disabled={busy || lines.length === 0}
          onClick={() => onSubmit(lines)}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy && <PiSpinner className="h-4 w-4 animate-spin" />}
          Record receipt
        </button>
      </div>
    </div>
  );
}

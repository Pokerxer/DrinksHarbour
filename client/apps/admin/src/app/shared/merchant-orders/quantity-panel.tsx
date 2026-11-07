'use client';
import { useState } from 'react';
import {
  buttonClass,
  fieldClass,
  fieldErrorClass,
  helperClass,
} from '../market-foundation/workspace';
import { ledgerProseSoft } from './design-tokens';
import QuantityAllocations from './quantity-allocations';
import type { QuantityRow, QuantitySave } from './quantity-types';
export default function QuantityPanel({
  row,
  token,
  busy,
  save,
}: {
  row: QuantityRow;
  token: string;
  busy: boolean;
  save: QuantitySave;
}) {
  const [quantities, setQuantities] = useState<Record<string, string>>({}),
    [error, setError] = useState('');
  async function submit(action: 'ship' | 'cancel') {
    setError('');
    const lines = [];
    for (const line of row.lines) {
      const raw = quantities[line.line] || '';
      if (!raw || raw === '0') continue;
      const quantity = Number(raw),
        progress = row.quantityProgress?.find((p) => p.line === line.line),
        held =
          line.quantity - (progress?.shipped || 0) - (progress?.cancelled || 0);
      if (
        !/^\d+$/.test(raw) ||
        !Number.isSafeInteger(quantity) ||
        quantity < 1 ||
        quantity > held
      ) {
        setError('Choose a whole quantity within the remaining held units.');
        return;
      }
      lines.push({ line: line.line, quantity });
    }
    if (!lines.length) {
      setError('Choose at least one unit.');
      return;
    }
    lines.sort((a, b) => a.line.localeCompare(b.line));
    await save(
      `/${row._id}/quantity/${action}`,
      { lines, expectedVersion: row.version },
      `quantity-${action}:${row._id}:${row.version}:${JSON.stringify(lines)}`
    );
  }
  const canChange = ['accepted', 'picking', 'partially_shipped'].includes(
    row.state
  );
  return (
    <section className="space-y-3" aria-label="Quantity fulfillment">
      <h3 className="font-semibold">Fulfill selected units</h3>
      {row.lines.map((line) => {
        const p = row.quantityProgress?.find((p) => p.line === line.line),
          label = line.productName || line.line,
          held = line.quantity - (p?.shipped || 0) - (p?.cancelled || 0);
        return (
          <div
            key={line.line}
            className="grid gap-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900/30 sm:grid-cols-2 sm:items-end sm:p-4"
          >
            <div className="space-y-1">
              <p className="font-medium">
                {label}
                {line.sizeName ? ` · ${line.sizeName}` : ''}
                {line.sku ? ` · ${line.sku}` : ''} · Ordered {line.quantity}
              </p>
              <p className={`${ledgerProseSoft} tabular-nums`}>
                Held {held} · Shipped {p?.shipped || 0} · Delivered{' '}
                {p?.delivered || 0} · Cancelled {p?.cancelled || 0} · Refund
                reserved{' '}
                {(p?.financialBlocks || [])
                  .filter((b) => b.kind === 'reserved')
                  .reduce((n, b) => n + b.quantity, 0)}{' '}
                · Refunded{' '}
                {(p?.financialBlocks || [])
                  .filter((b) => b.kind === 'refunded')
                  .reduce((n, b) => n + b.quantity, 0)}
              </p>
            </div>
            <div className="space-y-1">
              <label className="block">
                <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Units for {label}
                </span>
                <input
                  className={fieldClass}
                  type="number"
                  aria-describedby={`held-${line.line}`}
                  min="0"
                  step="1"
                  max={held}
                  disabled={busy || !canChange}
                  value={quantities[line.line] || ''}
                  onChange={(event) =>
                    setQuantities((previous) => ({
                      ...previous,
                      [line.line]: event.target.value,
                    }))
                  }
                />
              </label>
              <span id={`held-${line.line}`} className={helperClass}>
                Whole units only, up to {held} held ({line.quantity} ordered
                minus shipped and cancelled).
              </span>
            </div>
          </div>
        );
      })}
      {error && (
        <p role="alert" className={fieldErrorClass}>
          {error}
        </p>
      )}
      <p className={`max-w-2xl ${ledgerProseSoft}`}>
        Cancel only unshipped units after their verified unit refund. Shipping
        and tax must be reconciled first. Refunding shipped goods does not
        return them to stock.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          className={buttonClass}
          disabled={busy || !canChange}
          onClick={() => void submit('ship')}
        >
          Ship selected units
        </button>
        <button
          className={buttonClass}
          disabled={busy || !canChange}
          onClick={() => void submit('cancel')}
        >
          Cancel refunded units
        </button>
      </div>
      <QuantityAllocations
        key={`${row._id}:${row.version}`}
        row={row}
        token={token}
        busy={busy}
        save={save}
      />
    </section>
  );
}

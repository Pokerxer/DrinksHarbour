'use client';
import { useState } from 'react';
import type {
  MerchantOrder,
  MerchantSave,
} from '@/services/merchant-order.service';
import { buttonClass, fieldClass, fieldErrorClass, helperClass } from '../market-foundation/workspace';
import { ledgerProseSoft } from './design-tokens';
export default function QuantityRefundPanel({
  row,
  busy,
  save,
}: {
  row: MerchantOrder;
  busy: boolean;
  save: MerchantSave;
}) {
  const [lineId, setLine] = useState(row.lines[0]?.line || ''),
    [first, setFirst] = useState('1'),
    [quantity, setQuantity] = useState('1'),
    [reason, setReason] = useState(''),
    [error, setError] = useState('');
  const line = row.lines.find((value) => value.line === lineId);
  return (
    <section className="space-y-3 border-t pt-3">
      <h3 className="font-medium">Refund original units</h3>
      <p className={ledgerProseSoft}>
        Choose the original units. The saved purchase determines the amount; a
        money refund does not restock goods.
      </p>
      {error && (
        <p role="alert" className={fieldErrorClass}>
          {error}
        </p>
      )}
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          setError('');
          const start = Number(first) - 1,
            count = Number(quantity);
          if (
            !line ||
            !/^\d+$/.test(first) ||
            !/^\d+$/.test(quantity) ||
            !Number.isSafeInteger(start) ||
            !Number.isSafeInteger(count) ||
            start < 0 ||
            count < 1 ||
            start + count > line.quantity
          ) {
            setError('Choose units within the original purchased quantity.');
            return;
          }
          if (reason.trim().length < 5) {
            setError('Give a refund reason of at least five characters.');
            return;
          }
          const progress = row.quantityProgress?.find(
            (value) => value.line === lineId
          );
          if (
            progress?.financialBlocks?.some(
              (block) =>
                start < block.start + block.quantity &&
                block.start < start + count
            )
          ) {
            setError(
              'Those units already have a refund reservation or completed refund.'
            );
            return;
          }
          void save(
            `/${row._id}/quantity-refunds`,
            {
              lines: [{ line: lineId, ranges: [{ start, quantity: count }] }],
              expectedVersion: row.version,
              reason: reason.trim(),
            },
            `${row._id}:unit-refund:${lineId}:${start}:${count}:${row.version}:${reason.trim()}`
          ).then((saved) => {
            if (saved) setReason('');
          });
        }}
      >
        <label>
          Original item
          <select
            className={fieldClass}
            value={lineId}
            disabled={busy}
            onChange={(event) => {
              setLine(event.target.value);
              setFirst('1');
              setQuantity('1');
            }}
          >
            {row.lines.map((value) => (
              <option value={value.line} key={value.line}>
                {value.productName || value.sku || 'Purchased item'} ·{' '}
                {value.quantity} units
              </option>
            ))}
          </select>
        </label>
        <div className="space-y-1">
          <label>
            First unit
            <input
              className={fieldClass}
              inputMode="numeric"
              required
              min={1}
              max={line?.quantity || undefined}
              value={first}
              disabled={busy}
              onChange={(event) => setFirst(event.target.value)}
            />
          </label>
          <span id="quantity-refund-first-help" className={helperClass}>
            1-based position in the original purchase.
          </span>
        </div>
        <label>
          Number of units to refund
          <input
            className={fieldClass}
            inputMode="numeric"
            required
            min={1}
            value={quantity}
            disabled={busy}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </label>
        <label>
          Unit refund reason
          <input
            className={fieldClass}
            required
            minLength={5}
            maxLength={500}
            value={reason}
            disabled={busy}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <button className={buttonClass} disabled={busy || !line}>
          Request unit refund
        </button>
      </form>
    </section>
  );
}

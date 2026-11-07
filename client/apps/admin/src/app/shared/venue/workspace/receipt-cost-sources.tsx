'use client';
import { useEffect, useState } from 'react';
import {
  getReceiptSources,
  linkReceiptValue,
  type ReceiptSources,
} from '@/services/venue/receipt-valuation';
import { costMoney } from './cost-status';
import { buttonClass, fieldClass, Notice, panelClass } from './controls';
export default function ReceiptCostSources({
  token,
  locationId,
}: {
  token: string;
  locationId: string;
}) {
  const [data, setData] = useState<ReceiptSources | null>(null);
  const [lotId, setLot] = useState('');
  const [receiptId, setReceipt] = useState('');
  const [unit, setUnit] = useState<'count' | 'g' | 'ml'>('count');
  const [content, setContent] = useState('1');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    getReceiptSources(token, locationId)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : 'Unable to load receipts');
      });
    return () => {
      active = false;
    };
  }, [token, locationId]);
  const lot = data?.lots.find((row) => row.id === lotId);
  const receipts =
    data?.receipts.filter(
      (row) =>
        row.subProductId === lot?.subProductId &&
        row.sizeId === lot.sizeId &&
        row.batchNumber === lot.batchNumber,
    ) || [];
  return (
    <section className="space-y-4">
      <div className={panelClass}>
        <h2 className="text-xl font-semibold">Original receipt costs</h2>
        <p className="mt-2 text-sm">
          Link an untouched lot to the recorded receipt you reviewed. Used or
          merged lots need accounting review. Ingredient content must match its
          reviewed recipe stock form.
        </p>
      </div>
      {error && (
        <Notice tone="error" role="alert">
          {error}
          <button type="button" className={buttonClass} disabled={busy} onClick={async () => {
            setBusy(true);
            try {
              setData(await getReceiptSources(token, locationId));
              setError('');
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Unable to reload receipts');
            } finally { setBusy(false); }
          }}>Reload receipts</button>
        </Notice>
      )}
      {message && (
        <Notice tone="success" role="status">
          {message}
        </Notice>
      )}
      {!data && !error && <p role="status">Loading receipt sources…</p>}
      <form
        className={`${panelClass} grid gap-4 sm:grid-cols-2`}
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy || !lotId || !receiptId) return;
          setBusy(true);
          setError('');
          setMessage('');
          try {
            const scale = unit === 'count' ? 1 : 100;
            await linkReceiptValue(token, locationId, lotId, {
              receiptId,
              contentQuantity: {
                amountScaled: Math.round(Number(content) * scale),
                scale,
                unit,
              },
              reason,
            });
            setData((previous) => previous ? {
              ...previous,
              lots: previous.lots.map((row) => row.id === lotId ? { ...row, linked: true } : row),
            } : previous);
            setLot('');
            setReceipt('');
            setMessage(
              'Original receipt linked. Historical sales and posted accounts retain their original records.',
            );
            try {
              setData(await getReceiptSources(token, locationId));
            } catch {
              setError('Receipt linked, but sources could not refresh. Reload receipts to see current sources.');
            }
          } catch (e) {
            setError(
              e instanceof Error ? e.message : 'Unable to link source receipt',
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Untouched lot
          <select
            className={fieldClass}
            required
            value={lotId}
            onChange={(e) => {
              setLot(e.target.value);
              setReceipt('');
            }}
          >
            <option value="">Choose a lot</option>
            {data?.lots
              .filter(
                (row) => !row.linked && row.quantity === row.initialQuantity,
              )
              .map((row) => (
                <option key={row.id} value={row.id}>
                  {row.batchNumber} · {row.quantity} stock units
                </option>
              ))}
          </select>
        </label>
        <label>
          Original received stock record
          <select
            className={fieldClass}
            required
            value={receiptId}
            onChange={(e) => setReceipt(e.target.value)}
          >
            <option value="">Choose original receipt</option>
            {receipts.map((row) => (
              <option
                key={row.id}
                value={row.id}
                disabled={row.amountMinor == null}
              >
                {row.batchNumber} · {row.quantity} units ·{' '}
                {costMoney(row.amountMinor)} ·{' '}
                {new Date(row.performedAt).toLocaleDateString()}
              </option>
            ))}
          </select>
        </label>
        <label>
          Stock content unit
          <select
            className={fieldClass}
            value={unit}
            onChange={(e) => setUnit(e.target.value as typeof unit)}
          >
            <option value="count">Whole stock units</option>
            <option value="g">Grams</option>
            <option value="ml">Millilitres</option>
          </select>
        </label>
        <label>
          Content per stock unit
          <input
            className={fieldClass}
            required
            type="number"
            min={unit === 'count' ? 1 : 0.01}
            step={unit === 'count' ? 1 : 0.01}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </label>
        <label className="sm:col-span-2">
          Review reason
          <input
            className={fieldClass}
            required
            minLength={10}
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <button className={buttonClass} disabled={busy || !lotId || !receiptId}>
          Link reviewed receipt
        </button>
      </form>
    </section>
  );
}

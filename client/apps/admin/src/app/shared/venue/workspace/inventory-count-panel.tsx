'use client';
import { useRef, useState } from 'react';
import type { Candidate } from '@/services/venue/experience';
import {
  createCount,
  completeCount,
  getUsageVariance,
  type VarianceReport,
} from '@/services/venue/costing';
import UsageVarianceTable from './usage-variance-table';
import { buttonClass, fieldClass, Notice, panelClass } from './controls';
export default function InventoryCountPanel({
  token,
  locationId,
  catalog,
}: {
  token: string;
  locationId: string;
  catalog: Candidate[];
}) {
  const [product, setProduct] = useState('');
  const [size, setSize] = useState('');
  const [quantity, setQuantity] = useState('');
  const [count, setCount] = useState<{
    id: string;
    version: number;
    completeness: string;
    missingReasons?: string[];
  } | null>(null);
  const [opening, setOpening] = useState('');
  const [closing, setClosing] = useState('');
  const [report, setReport] = useState<VarianceReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const countKey = useRef<string | null>(null);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update count');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-4">
      <div className={panelClass}>
        <h2 className="text-xl font-semibold">Physical counts and usage</h2>
        <p className="mt-2 text-sm">
          Count the reviewed stock form in whole units. A blank observation
          means not counted; enter zero only when you confirmed none remains.
          Differences require the existing stock-adjustment review.
        </p>
      </div>
      {error && (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      )}
      <form
        className={`${panelClass} grid gap-3 sm:grid-cols-3`}
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const result = await createCount(token, locationId, {
              countKey: countKey.current ||= crypto.randomUUID(),
              items: [
                {
                  subProductId: product,
                  sizeId: size,
                  quantity:
                    quantity === ''
                      ? null
                      : {
                          amountScaled: Number(quantity),
                          scale: 1,
                          unit: 'count',
                        },
                },
              ],
            });
            setCount(result);
            countKey.current = null;
          });
        }}
      >
        <label>
          Stock item
          <select
            className={fieldClass}
            required
            value={product}
            onChange={(e) => {
              setProduct(e.target.value);
              setSize('');
              countKey.current = null;
            }}
          >
            <option value="">Choose item</option>
            {catalog.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Stock form
          <select
            className={fieldClass}
            required
            value={size}
            onChange={(e) => { setSize(e.target.value); countKey.current = null; }}
          >
            <option value="">Choose stock form</option>
            {catalog
              .find((item) => item.id === product)
              ?.sizes.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Observed whole units
          <input
            className={fieldClass}
            type="number"
            min="0"
            step="1"
            value={quantity}
            onChange={(e) => { setQuantity(e.target.value); countKey.current = null; }}
          />
        </label>
        <button className={buttonClass} disabled={busy}>
          Capture count
        </button>
      </form>
      {count && (
        <div className={`${panelClass} space-y-3`}>
          <p>
            Count reference: <span className="select-all">{count.id}</span>
          </p>
          <p>Coverage: {count.completeness}</p>
          {count.version === 0 && (
            <button
              className={buttonClass}
              disabled={busy}
              onClick={() =>
                void run(async () =>
                  setCount(
                    await completeCount(
                      token,
                      locationId,
                      count.id,
                      count.version,
                    ),
                  ),
                )
              }
            >
              Review and freeze count
            </button>
          )}
          {count.missingReasons?.length ? (
            <Notice tone="info">
              This count has missing observations, valuation or stock-adjustment
              work. It cannot establish complete usage.
            </Notice>
          ) : null}
        </div>
      )}
      <form
        className={`${panelClass} grid gap-3 sm:grid-cols-2`}
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () =>
            setReport(
              await getUsageVariance(token, locationId, opening, closing),
            ),
          );
        }}
      >
        <label>
          Opening count reference
          <input
            className={fieldClass}
            required
            value={opening}
            onChange={(e) => setOpening(e.target.value)}
          />
        </label>
        <label>
          Closing count reference
          <input
            className={fieldClass}
            required
            value={closing}
            onChange={(e) => setClosing(e.target.value)}
          />
        </label>
        <button className={buttonClass} disabled={busy}>
          Compare counted usage
        </button>
      </form>
      {report && <UsageVarianceTable report={report} />}
    </section>
  );
}

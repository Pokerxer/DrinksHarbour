'use client';
import { useEffect, useState } from 'react';
import { merchantRequest } from '@/services/merchant-order.service';
import {
  badgeClass,
  buttonClass,
} from '../market-foundation/workspace';
import { gateAlert } from './design-tokens';
import type {
  GoodsAllocation,
  QuantityRow,
  QuantitySave,
} from './quantity-types';
import { shipmentPage } from './quantity-response';
export default function QuantityAllocations({
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
  const [rows, setRows] = useState<GoodsAllocation[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [next, setNext] = useState<string | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError('');
    merchantRequest<unknown>(
      token,
      `/${row._id}/quantity/allocations${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
      'GET',
      undefined,
      controller.signal
    )
      .then((value) => {
        if (!active) return;
        const result = shipmentPage(value);
        setRows((previous) =>
          cursor
            ? [
                ...previous.filter(
                  (old) =>
                    !result.allocations.some((item) => item._id === old._id)
                ),
                ...result.allocations,
              ]
            : result.allocations
        );
        setNext(result.pagination.nextCursor);
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : 'Unable to load shipments');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [row._id, token, cursor, retry]);
  return (
    <section className="space-y-2" aria-label="Own shipments">
      <h4 className="font-medium">Shipments</h4>
      {loading && <p role="status">Loading shipments…</p>}
      {error && (
        <div className={`${gateAlert} flex-col`}>
          <p role="alert">
            {error}
          </p>
          <button
            className={buttonClass}
            onClick={() => setRetry((value) => value + 1)}
          >
            Retry shipments
          </button>
        </div>
      )}
      {!loading && !error && !rows.length && <p>No units shipped yet.</p>}
      {rows.map((allocation) => (
        <article
          key={allocation._id}
          className="space-y-2 rounded-lg border border-muted p-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className={badgeClass}>{allocation.state}</span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Shipment {allocation._id.slice(-8)}
            </span>
          </div>
          {allocation.lines.map((line) => (
            <p key={line.line} className="text-sm tabular-nums">
              {row.lines.find((original) => original.line === line.line)
                ?.productName || line.line}
              : {line.quantity} units (
              {line.ranges
                .map(
                  (range) =>
                    `${range.start + 1}–${range.start + range.quantity}`
                )
                .join(', ')}
              )
            </p>
          ))}
          {allocation.deliveryManaged && (
            <p className="text-sm leading-6 text-gray-600">
              Rider-managed delivery: confirm the drop in Local rider delivery.
            </p>
          )}
          {allocation.state === 'shipped' && !allocation.deliveryManaged && (
            <button
              className={buttonClass}
              disabled={busy || loading}
              onClick={() =>
                void save(
                  `/${row._id}/quantity/allocations/${allocation._id}/deliver`,
                  { expectedVersion: row.version },
                  `quantity-deliver:${row._id}:${row.version}:${allocation._id}`
                )
              }
            >
              Confirm shipment delivered
            </button>
          )}
        </article>
      ))}
      {next && !error && (
        <button
          className={buttonClass}
          disabled={loading || busy}
          onClick={() => setCursor(next)}
        >
          More shipments
        </button>
      )}
    </section>
  );
}

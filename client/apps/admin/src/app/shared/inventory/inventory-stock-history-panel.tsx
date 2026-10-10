'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { movementDocumentLink } from './inventory-movement-document';
import { PiArrowsClockwise, PiPrinter } from 'react-icons/pi';
import type { StockRow } from '@/services/warehouseStock.service';
import { requestDocumentExport } from '@/utils/print/document-export';
import { finite } from './inventory-dashboard-analysis';
import { byLabel, referenceLabel, sizeLabel, warehouseLabel } from './inventory-receipts-support';
import {
  balanceLabel,
  buildStockHistoryDocument,
  changeLabel,
  filterStockHistory,
  historyDate,
  historyTotals,
  movementDelta,
  movementLabel,
  transferRoute,
  type HistoryScope,
} from './inventory-stock-history';
import { useStockProductHistory } from './use-stock-product-history';
export default function StockHistoryPanel({ row, token }: { row: StockRow; token: string }) {
  const [scope, setScope] = useState<HistoryScope>('line');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [visible, setVisible] = useState(20);
  const history = useStockProductHistory(token, row.subProductId, row.currentQuantity, from, to);
  const moves = useMemo(
    () => filterStockHistory(history.moves, row, scope),
    [history.moves, row, scope],
  );
  const totals = historyTotals(moves);
  useEffect(() => setVisible(20), [scope, from, to, row._id]);
  const unavailable = history.loading || !!history.error;
  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 p-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Movement history</h3>
          <p className="mt-0.5 text-[11px] text-gray-500">
            {unavailable ? 'Loading status below' : `${moves.length} entries · newest first`}
          </p>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Refresh product history"
            disabled={history.loading}
            onClick={history.load}
            className="rounded-lg border border-gray-200 p-2 text-gray-500 disabled:opacity-40"
          >
            <PiArrowsClockwise className={history.loading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            disabled={unavailable || history.truncated || !moves.length}
            onClick={() =>
              requestDocumentExport(
                buildStockHistoryDocument(
                  row,
                  moves,
                  scope,
                  from || to ? `${from || 'No start date'} to ${to || 'No end date'} (UTC)` : '',
                ),
              )
            }
            className="flex items-center gap-1 rounded-lg bg-[#b20202] px-2.5 py-2 text-xs font-semibold text-white disabled:opacity-40"
          >
            <PiPrinter />
            Print history
          </button>
        </div>
      </div>
      <div className="space-y-2 border-b border-gray-100 p-3">
        <select
          aria-label="History scope"
          value={scope}
          onChange={(event) => setScope(event.target.value as HistoryScope)}
          className="w-full rounded-lg border border-gray-200 px-2 py-2 text-xs"
        >
          <option value="line">This warehouse and size</option>
          <option value="product">All product moves</option>
        </select>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px] text-gray-500">
            Recorded from
            <input
              aria-label="History from"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="mt-1 w-full min-w-0 rounded-lg border border-gray-200 p-1.5 text-xs"
            />
          </label>
          <label className="text-[10px] text-gray-500">
            Recorded to
            <input
              aria-label="History to"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="mt-1 w-full min-w-0 rounded-lg border border-gray-200 p-1.5 text-xs"
            />
          </label>
        </div>
        {(from || to) && (
          <button
            type="button"
            onClick={() => {
              setFrom('');
              setTo('');
            }}
            className="text-xs text-[#b20202] underline"
          >
            All dates
          </button>
        )}
        <p className="text-[11px] text-gray-500">
          {scope === 'line'
            ? `${row.warehouseName} · ${row.sizeName}. Older entries without a warehouse or size appear in All product moves.`
            : 'All warehouses and sizes, including entries with no location recorded.'}{' '}
          Dates use UTC.
        </p>
        <dl className="grid grid-cols-3 gap-2 rounded-lg bg-gray-50 p-2 text-xs">
          {Object.entries({
            'Posted in': totals.incoming,
            'Posted out': totals.outgoing,
            'Net change': totals.net,
          }).map(([label, value]) => (
            <div key={label}>
              <dt className="text-[10px] text-gray-500">{label}</dt>
              <dd className="mt-1 font-semibold tabular-nums text-gray-900">
                {unavailable ? '—' : value.toLocaleString()}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      {history.truncated && (
        <p role="alert" className="bg-amber-50 p-3 text-xs text-amber-800">
          History is incomplete. Narrow the date range before printing. Totals cover loaded entries
          only.
        </p>
      )}
      {history.loading ? (
        <p role="status" className="p-4 text-xs text-gray-500">
          Loading movement history…
        </p>
      ) : history.error ? (
        <div role="alert" className="p-3 text-xs text-red-700">
          {history.error}
          <button type="button" onClick={history.load} className="ml-2 underline">
            Retry history
          </button>
        </div>
      ) : !moves.length ? (
        <p className="p-4 text-xs text-gray-500">No movements recorded for this view.</p>
      ) : (
        <>
          <ol className="divide-y divide-gray-100">
            {moves.slice(0, visible).map((move) => (
              <li key={move._id} className="space-y-1.5 p-3 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">
                      {movementLabel(move)}{' '}
                      <span
                        className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${move.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}
                      >
                        {move.status}
                      </span>
                    </p>
                    <time className="mt-1 block text-[10px] text-gray-500">
                      {historyDate(move)}
                    </time>
                  </div>
                  <span
                    className={`shrink-0 font-bold tabular-nums ${(movementDelta(move) || 0) < 0 ? 'text-red-600' : 'text-emerald-700'}`}
                  >
                    {changeLabel(move)}
                  </span>
                </div>
                <p className="text-gray-600">
                  {warehouseLabel(move.warehouse)} · {sizeLabel(move) || 'No size recorded'}
                </p>
                {transferRoute(move) && (
                  <p className="text-[11px] text-gray-500">{transferRoute(move)}</p>
                )}
                <p className="break-words text-gray-800">
                  {movementDocumentLink(move) ? (
                    <Link
                      href={movementDocumentLink(move)!.href}
                      title={movementDocumentLink(move)!.label}
                      className="text-[#b20202] underline"
                    >
                      {referenceLabel(move)}
                    </Link>
                  ) : (
                    referenceLabel(move)
                  )}{' '}
                  <span className="text-gray-500">· {byLabel(move)}</span>
                </p>
                <p className="text-[11px] text-gray-500">
                  Balance {balanceLabel(move)}
                  {move.status !== 'confirmed' || ['reserved', 'released'].includes(move.type)
                    ? ` · Recorded quantity ${Math.abs(finite(move.quantity))}`
                    : ''}
                </p>
                {(move.reason || move.notes) && (
                  <p className="break-words text-[11px] text-gray-500">
                    {move.reason || move.notes}
                  </p>
                )}
              </li>
            ))}
          </ol>
          {visible < moves.length && (
            <button
              type="button"
              onClick={() => setVisible((value) => value + 20)}
              className="w-full border-t border-gray-100 p-3 text-xs font-semibold text-[#b20202]"
            >
              Show more ({moves.length - visible} remaining)
            </button>
          )}
        </>
      )}
      <p className="border-t border-gray-100 p-3 text-[10px] text-gray-400">
        Only confirmed on-hand changes count in totals. Returns reverse stock direction;
        reservations and releases do not change on-hand.
      </p>
    </section>
  );
}

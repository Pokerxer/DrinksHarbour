'use client';
import { useEffect, useState } from 'react';
import { formatMoney } from './money';
import type { PhoneScanResult } from '../../app/kiosk/price-checker/[kioskSlug]/m/[session]/phone-api';

const STOCK: Record<string, string> = {
  IN_STOCK: 'In stock',
  LOW_STOCK: 'Low stock',
  OUT_OF_STOCK: 'Out of stock',
};

export interface Checked {
  barcode: string;
  result: PhoneScanResult;
  /** Wall-clock ms at the scan — powers the Undo window. */
  at?: number;
}

export const COLLAPSE_AT = 3;
export const UNDO_WINDOW_MS = 5000;

/**
 * The phone session's scan history: a summary bar (count + session-cheapest)
 * over the result cards. The newest scan sits on top, pulses once, carries a
 * 5-second Undo, and long sessions collapse to the newest few with a
 * show-all toggle.
 */
export function PhoneResults({
  results,
  onUndo,
  now = Date.now,
}: {
  results: Checked[];
  onUndo?: (barcode: string) => void;
  now?: () => number;
}) {
  const hits = results
    .map((entry, index) => ({ index, checked: entry }))
    .filter((entry) => entry.checked?.result?.found && entry.checked.result.product);
  const prices = hits.map((entry) => entry.checked.result.product!.price);
  const cheapest = prices.length ? Math.min(...prices) : null;

  const [expanded, setExpanded] = useState(false);
  const [, setTick] = useState(0);
  const top = results[0];
  const undoVisible =
    !!onUndo &&
    !!top &&
    typeof top.at === 'number' &&
    top.result.found &&
    now() - top.at < UNDO_WINDOW_MS;

  // Re-render exactly when the Undo window closes, hiding the button.
  useEffect(() => {
    if (!undoVisible || typeof top?.at !== 'number') return;
    const finish = top.at + UNDO_WINDOW_MS - now();
    const timer = window.setTimeout(() => setTick((tick) => tick + 1), Math.max(1, finish));
    return () => window.clearTimeout(timer);
  }, [undoVisible, top, now]);

  if (!results.length) return null;
  return (
    <>
      {hits.length > 0 && (
        <section className="phone-summary" role="region" aria-label="Session summary">
          {hits.length} bottles scanned
          {cheapest !== null && (
            <>
              {' · cheapest: '}
              <strong>
                {
                  hits.find(
                    (entry) => entry.checked.result.product!.price === cheapest
                  )?.checked.result.product!.name
                }
              </strong>{' '}
              {formatMoney(cheapest, 'NGN')}
            </>
          )}
        </section>
      )}
      <ul className="phone-results" aria-label="Scanned bottles">
        {(expanded ? results : results.slice(0, COLLAPSE_AT)).map(
          ({ barcode, result, at }, displayIndex) =>
            result.found && result.product ? (
              <li
                className={`phone-hit${displayIndex === 0 ? ' phone-land' : ''}`}
                key={`${barcode}-${at ?? ''}`}
              >
                {result.product.image && (
                  <img src={result.product.image} alt="" referrerPolicy="no-referrer" />
                )}
                <div>
                  <p className="phone-name">{result.product.name}</p>
                  <p className="phone-price">
                    {formatMoney(result.product.price, result.product.currency)}
                    {result.product.price === cheapest && (
                      <span className="phone-badge">Best so far</span>
                    )}
                  </p>
                  <p className="phone-toned">
                    {[
                      result.product.abv !== undefined ? `${result.product.abv}% ABV` : '',
                      result.product.size || '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {result.product.availability && (
                    <span
                      className={`phone-stock ${String(result.product.availability).toLowerCase()}`}
                    >
                      {STOCK[result.product.availability] ?? 'Stock unknown'}
                    </span>
                  )}
                  <p className="phone-toned phone-sent">Sent to the store screen ✓</p>
                  {onUndo && displayIndex === 0 && undoVisible && at !== undefined && (
                    <button
                      className="phone-undo"
                      onClick={() => onUndo(barcode)}
                    >
                      Undo {result.product.name} scan
                    </button>
                  )}
                </div>
              </li>
            ) : (
              <li className="phone-miss" key={`${barcode}-${at ?? ''}`}>
                <p className="phone-name">Barcode {barcode}</p>
                <p className="phone-toned">
                  {result.status === 'UNAVAILABLE'
                    ? 'Not currently on sale — ask a member of staff.'
                    : 'We could not find this barcode — ask a member of staff.'}
                </p>
              </li>
            )
        )}
      </ul>
      {!expanded && results.length > COLLAPSE_AT && (
        <button className="phone-show-all" onClick={() => setExpanded(true)}>
          Show all ({results.length})
        </button>
      )}
    </>
  );
}

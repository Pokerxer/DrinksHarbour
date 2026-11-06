'use client';
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
}

/**
 * The phone session's scan history: a summary bar (count + session-cheapest)
 * over the result cards. The newest scan sits on top and pulses once.
 */
export function PhoneResults({ results }: { results: Checked[] }) {
  const hits = results
    .map((entry, index) => ({ index, checked: entry }))
    .filter((entry) => entry.checked?.result?.found && entry.checked.result.product);
  const prices = hits.map((entry) => entry.checked.result.product!.price);
  const cheapest = prices.length ? Math.min(...prices) : null;
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
        {results.map(
          ({ barcode, result }, index) =>
            result.found && result.product ? (
              <li
                className={`phone-hit${index === 0 ? ' phone-land' : ''}`}
                key={barcode}
              >
                {result.product.image && (
                  <img
                    src={result.product.image}
                    alt=""
                    referrerPolicy="no-referrer"
                  />
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
                      result.product.abv !== undefined
                        ? `${result.product.abv}% ABV`
                        : '',
                      result.product.size || '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {result.product.availability && (
                    <span
                      className={`phone-stock ${String(
                        result.product.availability
                      ).toLowerCase()}`}
                    >
                      {STOCK[result.product.availability] ?? 'Stock unknown'}
                    </span>
                  )}
                  <p className="phone-toned phone-sent">
                    Sent to the store screen ✓
                  </p>
                </div>
              </li>
            ) : (
              <li className="phone-miss" key={barcode}>
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
    </>
  );
}

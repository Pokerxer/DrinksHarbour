'use client';
import { useState, type CSSProperties } from 'react';
import type { KioskProduct } from './types';
import { formatMoney } from './money';
import { bestValueRank, pricePerDrink, pricePerMl, valueRatios } from './metrics';
import { decisionHeadline, rowsFor, type CompareRow } from './compare-rows';
import { compareKey } from './use-compare';

interface CardProps {
  product: KioskProduct;
  rank: number;
  index: number;
  focused: boolean;
  barRatio: number | null;
  onToggleFocus: (key: string) => void;
  onRemove: (key: string) => void;
  currency: string;
}

function CompareCard({
  product,
  rank,
  index,
  focused,
  barRatio,
  onToggleFocus,
  onRemove,
  currency,
}: CardProps) {
  const soldOut = product.availability === 'OUT_OF_STOCK';
  const money = (value: number) => formatMoney(value, currency);
  const key = compareKey(product);
  return (
    <div
      className={`kiosk-compare-card${soldOut ? ' kiosk-compare-oos' : ''}`}
      role="listitem"
      data-rank={rank}
      data-focus={focused ? 'true' : 'false'}
      onClick={() => onToggleFocus(key)}
      style={{ '--card-index': index } as CSSProperties}
      key={key}
    >
      <button
        className="kiosk-compare-drop"
        aria-label={`Remove ${product.name}`}
        onClick={(event) => {
          event.stopPropagation();
          onRemove(key);
        }}
      >
        ✕
      </button>
      {product.image ? (
        <img
          src={product.image}
          alt={product.name}
          referrerPolicy="no-referrer"
          onError={(event) => (event.currentTarget.style.visibility = 'hidden')}
        />
      ) : (
        <span className="kiosk-compare-blank" aria-hidden="true" />
      )}
      <p className="kiosk-eyebrow">{product.brand || ' '}</p>
      <p className="kiosk-compare-name">{product.name}</p>
      {!soldOut && rank === 0 && <p className="kiosk-compare-best">Best value</p>}
      <p className="kiosk-price">
        {soldOut ? <span className="kiosk-compare-oos-price">{money(product.price)}</span> : money(product.price)}
      </p>
      {soldOut && <p className="kiosk-compare-oos-note">Unavailable — pick another</p>}
      {typeof barRatio === 'number' && !soldOut && (
        <div className="kiosk-valuebar" aria-hidden="true">
          <span data-length={Math.round(barRatio * 100)} style={{ width: `${barRatio * 100}%`} as CSSProperties} />
        </div>
      )}
      {product.originalPrice !== undefined && (
        <p className="kiosk-small">Save {money(product.savings ?? 0)}</p>
      )}
    </div>
  );
}

export function CompareScreen({
  items,
  currency,
  onRemove,
  onClose,
}: {
  items: KioskProduct[];
  currency: string;
  onRemove: (key: string) => void;
  onClose: () => void;
}) {
  const ranks = bestValueRank(items);
  const bars = valueRatios(items);
  const rows = rowsFor(items);
  const headline = decisionHeadline(items, currency);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [differencesOnly, setDifferencesOnly] = useState(false);
  const toggleFocus = (key: string) =>
    setFocusKey((current) => (current === key ? null : key));
  // Currency glyph, whatever the kiosk is configured with (₦, $, …).
  const symbol =
    formatMoney(1, currency).match(/[^\d.,\s]/)?.[0] ?? '₦';

  const computed: CompareRow[] = [];
  const perMl = items.map((product) => pricePerMl(product.price, product.volumeMl));
  if (perMl.some(Boolean))
    computed.push({
      label: 'Price per ml',
      values: perMl.map((value) =>
        value === null ? undefined : `${symbol}${value.toFixed(2)}/ml`
      ),
      shared: new Set(perMl.filter(Boolean)).size === 1 && perMl.filter(Boolean).length > 1,
    });
  const perDrink = items.map((product) =>
    pricePerDrink(product.price, product.volumeMl, product.abv)
  );
  if (perDrink.every(Boolean))
    computed.push({
      label: 'Cost per drink',
      values: perDrink.map((value) =>
        value === null ? undefined : `${symbol}${value.toFixed(2)}/drink`
      ),
      shared: new Set(perDrink.filter(Boolean)).size === 1 && perDrink.filter(Boolean).length > 1,
    });
  const allRows = [...rows, ...computed];
  const divergentCount = allRows.filter((row) => !row.shared).length;
  const table = differencesOnly ? allRows.filter((row) => !row.shared) : allRows;

  const renderRow = (row: CompareRow) => {
    if (!row.shared) {
      return (
        <tr key={row.label}>
          <th scope="row">{row.label}</th>
          {row.values.map((value, index) => (
            <td key={index} data-divergent={value !== undefined ? 'true' : undefined}>
              {value || '—'}
            </td>
          ))}
        </tr>
      );
    }
    const value = row.values[0];
    return (
      <tr key={row.label} aria-label={`All bottles: ${value}`}>
        <th scope="row">{row.label}</th>
        <td colSpan={items.length}>All: {value}</td>
      </tr>
    );
  };

  return (
    <section className="kiosk-compare" aria-label="Bottle comparison">
      <div className="kiosk-compare-head">
        <div>
          <span className="kiosk-eyebrow">Compare bottles</span>
          <p>Pick the bottle that suits you best.</p>
        </div>
        <button
          className="kiosk-quiet kiosk-diff-toggle"
          aria-pressed={differencesOnly}
          onClick={() => setDifferencesOnly((on) => !on)}
        >
          Show differences only
        </button>
        <button
          className="kiosk-quiet"
          onClick={() => {
            setFocusKey(null);
            onClose();
          }}
        >
          Close
        </button>
      </div>
      <div className="kiosk-compare-grid" role="list" aria-label="Compared bottles">
        {items.map((product, index) => (
          <CompareCard
            key={compareKey(product)}
            product={product}
            rank={ranks[index]}
            index={index}
            barRatio={bars[index]}
            focused={focusKey === compareKey(product)}
            onToggleFocus={toggleFocus}
            onRemove={onRemove}
            currency={currency}
          />
        ))}
      </div>
      {headline && (
        <p className="kiosk-compare-verdict" role="status">
          {headline}
        </p>
      )}
      {table.length > 0 && (
        <table className="kiosk-compare-rows" aria-label="Differences">
          <tbody>{table.map(renderRow)}</tbody>
        </table>
      )}
      {differencesOnly && table.length === 0 && divergentCount === 0 && (
        <p className="kiosk-compare-identical" role="status">
          These bottles are identical on every recorded attribute — the price
          row below tells the whole story.
        </p>
      )}
    </section>
  );
}

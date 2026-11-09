'use client';
import { useState, type CSSProperties } from 'react';
import type { KioskProduct } from './types';
import { formatMoney } from './money';
import { bestValueRank, pricePerDrink, pricePerMl } from './metrics';
import { decisionHeadline, rowsFor, type CompareRow } from './compare-rows';
import { compareKey } from './use-compare';

interface CardProps {
  product: KioskProduct;
  rank: number;
  index: number;
  focused: boolean;
  onToggleFocus: (key: string) => void;
  onRemove: (key: string) => void;
  currency: string;
}

function CompareCard({
  product,
  rank,
  index,
  focused,
  onToggleFocus,
  onRemove,
  currency,
}: CardProps) {
  const money = (value: number) => formatMoney(value, currency);
  const key = compareKey(product);
  return (
    <div
      className="kiosk-compare-card"
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
      {rank === 0 && <p className="kiosk-compare-best">Best value</p>}
      <p className="kiosk-price">{money(product.price)}</p>
      {product.originalPrice !== undefined && (
        <p className="kiosk-small">
          Save {money(product.savings ?? 0)}
        </p>
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
  const rows = rowsFor(items);
  const headline = decisionHeadline(items, currency);
  const [focusKey, setFocusKey] = useState<string | null>(null);
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
      shared: new Set(perMl).size === 1 && perMl[0] !== null,
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
      shared: new Set(perDrink).size === 1 && perDrink[0] !== null,
    });
  const table = [...rows, ...computed];

  const renderRow = (row: CompareRow) => {
    if (row.shared) {
      const value = row.values[0];
      return (
        <tr key={row.label} aria-label={`All bottles: ${value}`}>
          <th scope="row">{row.label}</th>
          <td colSpan={items.length}>All: {value}</td>
        </tr>
      );
    }
    return (
      <tr key={row.label}>
        <th scope="row">{row.label}</th>
        {row.values.map((value, index) => (
          <td key={index}>{value || '—'}</td>
        ))}
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
    </section>
  );
}

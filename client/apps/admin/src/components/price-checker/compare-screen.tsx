'use client';
import { useState, type CSSProperties } from 'react';
import type { KioskProduct } from './types';
import { formatMoney } from './money';
import { decisionHeadline, rowsFor, type CompareRow } from './compare-rows';
import { compareKey } from './use-compare';

interface CardProps {
  product: KioskProduct;
  index: number;
  focused: boolean;
  onToggleFocus: (key: string) => void;
  onRemove: (key: string) => void;
  currency: string;
}

function CompareCard({
  product,
  index,
  focused,
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
      <p className="kiosk-price">{money(product.price)}</p>
      {soldOut && <p className="kiosk-compare-oos-note">Out of stock</p>}
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
  const rows: CompareRow[] = [
    {
      label: 'Price',
      values: items.map((item) => formatMoney(item.price, currency)),
      shared: new Set(items.map((item) => item.price)).size === 1,
    },
    ...rowsFor(items),
  ];
  const headline = decisionHeadline(items, currency);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [differencesOnly, setDifferencesOnly] = useState(false);
  const toggleFocus = (key: string) =>
    setFocusKey((current) => (current === key ? null : key));
  const table = differencesOnly ? rows.filter((row) => !row.shared) : rows;

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
        <h1>Compare bottles</h1>
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
        <table className="kiosk-compare-rows" aria-label="Bottle details">
          <thead>
            <tr>
              <th scope="col">Details</th>
              {items.map((item) => <th scope="col" key={compareKey(item)}>{item.name}</th>)}
            </tr>
          </thead>
          <tbody>{table.map(renderRow)}</tbody>
        </table>
      )}
      {differencesOnly && table.length === 0 && (
        <p className="kiosk-compare-identical" role="status">
          The recorded bottle details match.
        </p>
      )}
    </section>
  );
}

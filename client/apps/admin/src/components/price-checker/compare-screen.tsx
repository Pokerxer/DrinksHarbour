'use client';
import type { KioskProduct } from './types';
import { formatMoney } from './money';
import { compareKey } from './use-compare';

const STOCK: Record<string, string> = {
  IN_STOCK: 'In stock',
  LOW_STOCK: 'Low stock',
  OUT_OF_STOCK: 'Out of stock',
};

/** Per-bottle attribute rows. Shared values collapse to a single row below. */
const rows: { label: string; value: (product: KioskProduct) => string | undefined }[] = [
  { label: 'Size', value: (product) => product.size || product.volume },
  {
    label: 'ABV',
    value: (product) => (product.abv !== undefined ? `${product.abv}%` : undefined),
  },
  { label: 'Origin', value: (product) => product.origin },
  {
    label: 'Type',
    value: (product) => (product.alcoholic ? 'Alcoholic' : 'Non-alcoholic'),
  },
  {
    label: 'Stock',
    value: (product) => (product.availability ? STOCK[product.availability] : undefined),
  },
];

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
  const cheapest = Math.min(...items.map((product) => product.price));
  const money = (value: number) => formatMoney(value, currency);
  return (
    <section className="kiosk-compare" aria-label="Bottle comparison">
      <div className="kiosk-compare-head">
        <div>
          <span className="kiosk-eyebrow">Compare bottles</span>
          <p>Pick the bottle that suits you best.</p>
        </div>
        <button className="kiosk-quiet" onClick={onClose}>
          Close
        </button>
      </div>
      <div
        className="kiosk-compare-grid"
        role="list"
        aria-label="Compared bottles"
      >
        {items.map((product) => (
          <div className="kiosk-compare-card" role="listitem" key={compareKey(product)}>
            <button
              className="kiosk-compare-drop"
              aria-label={`Remove ${product.name}`}
              onClick={() => onRemove(compareKey(product))}
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
            {product.price === cheapest && <p className="kiosk-compare-best">Best value</p>}
            <p className="kiosk-price">{money(product.price)}</p>
            {product.originalPrice !== undefined && (
              <p className="kiosk-small">Save {money(product.savings ?? 0)}</p>
            )}
          </div>
        ))}
      </div>
      <table className="kiosk-compare-rows" aria-label="Differences">
        <tbody>
          {rows.map((row) => {
            const values = items.map((product) => row.value(product));
            const defined = values.filter((value) => value !== undefined);
            if (!defined.length) return null;
            if (defined.length === values.length && new Set(defined).size === 1)
              return (
                <tr key={row.label} aria-label={`All bottles: ${defined[0]}`}>
                  <th scope="row">{row.label}</th>
                  <td colSpan={values.length}>All: {defined[0]}</td>
                </tr>
              );
            return (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                {values.map((value, index) => (
                  <td key={index}>{value || '—'}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

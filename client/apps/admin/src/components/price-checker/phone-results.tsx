'use client';

import { formatMoney } from './money';
import type { KioskProduct } from './types';

export interface Checked {
  barcode: string;
  product: KioskProduct;
}

export function mergeScan(results: Checked[], entry: Checked): Checked[] {
  return [entry, ...results.filter((row) => row.barcode !== entry.barcode)];
}

export function PhoneResults({ results, onSelect, onRemove, onClear }: {
  results: Checked[];
  onSelect: (entry: Checked) => void;
  onRemove: (barcode: string) => void;
  onClear: () => void;
}) {
  if (!results.length) return null;
  return (
    <section className="phone-history" aria-labelledby="scan-history-title">
      <div className="phone-history-heading">
        <h2 id="scan-history-title">Scan history ({results.length})</h2>
        <button type="button" className="phone-quiet-button" onClick={onClear}>Clear history</button>
      </div>
      <ul className="phone-results">
        {results.map(({ barcode, product }) => (
          <li className="phone-hit" key={barcode}>
            <button type="button" className="phone-hit-button"
              aria-label={`View details for ${product.name}${product.size ? `, ${product.size}` : ''}`}
              onClick={() => onSelect({ barcode, product })}>
              {product.image && <img src={product.image} alt="" loading="lazy" referrerPolicy="no-referrer" />}
              <span>
                <strong className="phone-name">{product.name}</strong>
                {product.size && <span className="phone-toned">{product.size}</span>}
                <span className="phone-price">{formatMoney(product.price, product.currency)}</span>
              </span>
            </button>
            <button type="button" className="phone-quiet-button"
              aria-label={`Remove ${product.name}${product.size ? `, ${product.size}` : ''} from history`}
              onClick={() => onRemove(barcode)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

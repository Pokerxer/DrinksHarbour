'use client';
import type { KioskProduct } from './types';
import { compareKey } from './use-compare';
import { formatMoney } from './money';

/** Persistent tray bar of bottles held for comparison, visible on the welcome
 *  and result screens so the customer can resume an interrupted session. */
export function CompareTray({
  items,
  currency,
  canAdd,
  onRemove,
  onClear,
  onCompare,
}: {
  items: KioskProduct[];
  currency: string;
  canAdd: boolean;
  onRemove: (key: string) => void;
  onClear: () => void;
  onCompare: () => void;
}) {
  if (!items.length) return null;
  return (
    <div className="kiosk-tray" role="region" aria-label="Bottles to compare">
      {items.map((product) => (
        <div className="kiosk-tray-item" key={compareKey(product)}>
          {product.image && (
            <img
              src={product.image}
              alt=""
              referrerPolicy="no-referrer"
              onError={(event) => (event.currentTarget.style.visibility = 'hidden')}
            />
          )}
          <span className="kiosk-tray-name">{product.name}</span>
          <span className="kiosk-tray-price">{formatMoney(product.price, currency)}</span>
          <button
            className="kiosk-tray-drop"
            aria-label={`Remove ${product.name}`}
            onClick={() => onRemove(compareKey(product))}
          >
            ✕
          </button>
        </div>
      ))}
      <div className="kiosk-tray-actions">
        <button className="kiosk-quiet" onClick={onClear}>
          Clear
        </button>
        <button
          className="kiosk-primary"
          disabled={items.length < 2}
          onClick={onCompare}
        >
          {canAdd ? `Compare (${items.length})` : 'Tray full — compare'}
        </button>
      </div>
    </div>
  );
}

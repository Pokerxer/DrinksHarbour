'use client';
import type { KioskProduct } from './types';
import { compareKey, MAX_COMPARE_ITEMS } from './use-compare';
import { formatMoney } from './money';
import { useHoldProgress } from './use-hold-progress';

/** Persistent tray bar of bottles held for comparison, visible on the welcome
 *  and result screens so the customer can resume an interrupted session. */
export function CompareTray({
  items,
  currency,
  canAdd,
  onRemove,
  onScanAgain,
  onCompare,
  onHoldClear,
  swapKey,
  armSwap,
  disarmSwap,
}: {
  items: KioskProduct[];
  currency: string;
  canAdd: boolean;
  onRemove: (key: string) => void;
  onScanAgain: () => void;
  onCompare: () => void;
  onHoldClear: () => void;
  swapKey: string | null;
  armSwap: (key: string) => void;
  disarmSwap: () => void;
}) {
  const hold = useHoldProgress(1500, onHoldClear);
  if (!items.length) return null;
  const ready = items.length >= 2;
  const swapped = swapKey
    ? items.find((item) => compareKey(item) === swapKey)
    : undefined;
  return (
    <div className="kiosk-tray" role="region" aria-label="Bottles to compare">
      {swapped && (
        <div className="kiosk-tray-swap" role="status">
          Next scan replaces <strong>{swapped.name}</strong>
          <button className="kiosk-quiet kiosk-tray-cancel" onClick={disarmSwap}>
            Cancel
          </button>
        </div>
      )}
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
          <button
            className="kiosk-tray-again"
            aria-label={`Scan again for ${product.name}`}
            title="Scan again"
            onClick={onScanAgain}
          >
            ↻
          </button>
          <button
            className={`kiosk-tray-swap${swapKey === compareKey(product) ? ' is-armed' : ''}`}
            aria-pressed={swapKey === compareKey(product)}
            aria-label={`Next scan will replace ${product.name}`}
            title="Swap for next scan"
            onClick={() =>
              swapKey === compareKey(product) ? disarmSwap() : armSwap(compareKey(product))
            }
          >
            ⇄
          </button>
        </div>
      ))}
      <div className="kiosk-tray-actions">
        <button
          className="kiosk-quiet kiosk-tray-clear"
          data-holding={hold.progress > 0 && hold.progress < 1 ? 'true' : 'false'}
          onPointerDown={hold.start}
          onPointerUp={hold.cancel}
          onPointerLeave={hold.cancel}
          onPointerCancel={hold.cancel}
        >
          Hold to clear
        </button>
        <button
          className="kiosk-primary"
          key={ready ? 'ready' : 'idle'}
          data-pulse={ready ? '1' : '0'}
          disabled={!ready}
          onClick={onCompare}
        >
          {items.length < MAX_COMPARE_ITEMS
            ? `Compare (${items.length})`
            : 'Tray full — compare'}
        </button>
      </div>
    </div>
  );
}

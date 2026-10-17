'use client';
import { useRef, useState } from 'react';
import type { SalesTotalsProps } from './sales-totals-types';
import SalesAdjustmentPanel from './sales-adjustment-panel';
const button =
  'rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-brand focus-visible:outline-brand disabled:opacity-40';
type Panel = 'coupon' | 'reward' | 'discount' | 'shipping' | null;
export default function SalesTotalActions({
  onApplyCoupon,
  couponBusy,
  onShippingChange,
  onApplyDiscount,
  onRedeemPointsChange,
  customerPoints,
  plannedRedeemPoints = 0,
  shippingFee = 0,
}: SalesTotalsProps) {
  const [panel, setPanel] = useState<Panel>(null);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const flight = useRef(false);
  function toggle(next: Panel) {
    setPanel(panel === next ? null : next);
    setInput(next === 'reward' ? String(plannedRedeemPoints) : '');
    setError('');
  }
  async function coupon() {
    if (!onApplyCoupon || flight.current || couponBusy) return;
    if (!input.trim()) {
      setError('Enter a coupon code.');
      return;
    }
    flight.current = true;
    setBusy(true);
    setError('');
    try {
      await onApplyCoupon(input.trim().toUpperCase());
      setPanel(null);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Could not apply coupon.',
      );
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  if (
    !onApplyCoupon &&
    !onShippingChange &&
    !onApplyDiscount &&
    !onRedeemPointsChange
  )
    return null;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap justify-end gap-2">
        {onApplyCoupon && (
          <button
            type="button"
            className={button}
            disabled={busy || couponBusy}
            onClick={() => toggle('coupon')}
          >
            Coupon Code
          </button>
        )}
        {onRedeemPointsChange && customerPoints != null && (
          <button
            type="button"
            className={button}
            onClick={() => toggle('reward')}
          >
            Reward
          </button>
        )}
        {onApplyDiscount && (
          <button
            type="button"
            className={button}
            onClick={() => toggle('discount')}
          >
            Discount
          </button>
        )}
        {onShippingChange && (
          <button
            type="button"
            className={button}
            onClick={() => toggle('shipping')}
          >
            {shippingFee > 0 ? 'Edit shipping' : 'Add shipping'}
          </button>
        )}
        {onShippingChange && shippingFee > 0 && (
          <button
            type="button"
            className={button}
            onClick={() => {
              onShippingChange(0);
              setPanel(null);
            }}
          >
            Remove shipping
          </button>
        )}
      </div>
      {((panel === 'shipping' && onShippingChange) ||
        (panel === 'discount' && onApplyDiscount)) && (
        <SalesAdjustmentPanel
          key={panel}
          kind={panel as 'shipping' | 'discount'}
          value={shippingFee}
          onApply={panel === 'shipping' ? onShippingChange! : onApplyDiscount!}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === 'coupon' && (
        <section
          aria-label="Coupon"
          className="space-y-2 rounded-lg border bg-gray-50 p-3"
        >
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex-1 text-xs font-medium">
              Coupon code
              <input
                aria-label="Coupon code"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                disabled={busy || couponBusy}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void coupon();
                  }
                }}
                className="mt-1 w-full rounded-md border p-2 text-sm uppercase"
              />
            </label>
            <button
              type="button"
              className={button}
              disabled={busy || couponBusy}
              onClick={() => void coupon()}
            >
              {busy || couponBusy ? 'Applying…' : 'Apply coupon'}
            </button>
            <button
              type="button"
              className={button}
              disabled={busy || couponBusy}
              onClick={() => setPanel(null)}
            >
              Cancel
            </button>
          </div>
          {error && (
            <p role="alert" className="text-xs text-red-700">
              {error}
            </p>
          )}
        </section>
      )}
      {panel === 'reward' && onRedeemPointsChange && (
        <section
          aria-label="Planned reward"
          className="space-y-2 rounded-lg border bg-gray-50 p-3"
        >
          <p className="text-xs text-gray-600">
            {customerPoints} points available. Applied when payment is recorded.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex-1 text-xs">
              Planned reward points
              <input
                aria-label="Planned reward points"
                type="number"
                min={0}
                max={customerPoints ?? 0}
                step={1}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                className="mt-1 w-full rounded-md border p-2 text-sm"
              />
            </label>
            <button
              type="button"
              className={button}
              onClick={() => {
                const points = Number(input);
                if (
                  !input.trim() ||
                  !Number.isInteger(points) ||
                  points < 0 ||
                  points > (customerPoints ?? 0)
                ) {
                  setError('Enter whole points within the available balance.');
                  return;
                }
                onRedeemPointsChange(points);
                setPanel(null);
              }}
            >
              Plan reward
            </button>
            <button
              type="button"
              className={button}
              onClick={() => setPanel(null)}
            >
              Cancel
            </button>
          </div>
          {error && (
            <p role="alert" className="text-xs text-red-700">
              {error}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

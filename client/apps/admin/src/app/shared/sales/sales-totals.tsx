// client/apps/admin/src/app/shared/sales/sales-totals.tsx
'use client';

import { useState, type ReactNode } from 'react';
import {
  PiTicket,
  PiGift,
  PiPercent,
  PiTruck,
  PiX,
  PiSpinner,
} from 'react-icons/pi';
import { fmtCur } from '../purchases/purchases-analytics-helpers';

export interface SalesTotalsCoupon {
  code: string;
  name: string;
  discount: number;
}

export interface SalesTotalsProps {
  untaxedAmount: number;
  /** Total discount (resolved ₦) across product lines; 0 hides the row. */
  discountTotal?: number;
  taxTotal: number;
  grandTotal: number;
  currency?: string;
  /** Footer adjustments — all optional so read-only contexts can omit them. */
  coupon?: SalesTotalsCoupon | null;
  couponBusy?: boolean;
  onApplyCoupon?: (code: string) => void | Promise<void>;
  onClearCoupon?: () => void;
  shippingFee?: number;
  onShippingChange?: (fee: number) => void;
  onApplyDiscount?: (pct: number) => void;
  /** Loyalty points of the selected customer; null/undefined hides Reward. */
  customerPoints?: number | null;
  plannedRedeemPoints?: number;
  onRedeemPointsChange?: (pts: number) => void;
  /** Jump to the Terms field (Other Info tab). */
  onOpenTerms?: () => void;
}

type Panel = 'coupon' | 'reward' | 'discount' | 'shipping' | null;

const BTN_CLS =
  'flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:border-brand/40 hover:text-brand';
const FIELD_CLS =
  'w-28 rounded-lg border border-gray-200 px-2.5 py-1.5 text-right text-sm text-gray-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20';

/**
 * Odoo-style totals footer: action buttons (Coupon Code / Reward / Discount /
 * Add shipping) above the money rows, a Terms & Conditions link on the left.
 * Mirrors the server's refreshOrderTotal:
 *   total = max(0, subtotal − discount + tax − coupon) + shipping
 */
export default function SalesTotals({
  untaxedAmount,
  discountTotal = 0,
  taxTotal,
  grandTotal,
  currency = 'NGN',
  coupon,
  couponBusy,
  onApplyCoupon,
  onClearCoupon,
  shippingFee = 0,
  onShippingChange,
  onApplyDiscount,
  customerPoints,
  plannedRedeemPoints = 0,
  onRedeemPointsChange,
  onOpenTerms,
}: SalesTotalsProps) {
  const [panel, setPanel] = useState<Panel>(null);
  const [couponInput, setCouponInput] = useState('');
  const [discountInput, setDiscountInput] = useState('');
  const [shippingInput, setShippingInput] = useState('');
  const [rewardInput, setRewardInput] = useState('');

  const editable = !!(
    onApplyCoupon ||
    onShippingChange ||
    onApplyDiscount ||
    onRedeemPointsChange
  );

  function toggle(next: Exclude<Panel, null>) {
    setPanel((p) => (p === next ? null : next));
    if (next === 'shipping')
      setShippingInput(shippingFee ? String(shippingFee) : '');
    if (next === 'reward')
      setRewardInput(plannedRedeemPoints ? String(plannedRedeemPoints) : '');
  }

  return (
    <div className="mt-6 border-t border-gray-100 pt-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {/* Terms link (left) */}
        <div className="pt-1 text-xs text-gray-500">
          {onOpenTerms && (
            <>
              Terms &amp; Conditions:{' '}
              <button
                type="button"
                onClick={onOpenTerms}
                className="font-medium text-brand hover:underline"
              >
                edit in Other Info
              </button>
            </>
          )}
        </div>

        <div className="w-full max-w-md">
          {/* Action buttons */}
          {editable && (
            <div className="mb-3 flex flex-wrap justify-end gap-2">
              {onApplyCoupon && (
                <button
                  type="button"
                  onClick={() => toggle('coupon')}
                  className={BTN_CLS}
                >
                  <PiTicket className="h-3.5 w-3.5" /> Coupon Code
                </button>
              )}
              {onRedeemPointsChange && customerPoints != null && (
                <button
                  type="button"
                  onClick={() => toggle('reward')}
                  className={BTN_CLS}
                >
                  <PiGift className="h-3.5 w-3.5" /> Reward
                </button>
              )}
              {onApplyDiscount && (
                <button
                  type="button"
                  onClick={() => toggle('discount')}
                  className={BTN_CLS}
                >
                  <PiPercent className="h-3.5 w-3.5" /> Discount
                </button>
              )}
              {onShippingChange && (
                <button
                  type="button"
                  onClick={() => toggle('shipping')}
                  className={BTN_CLS}
                >
                  <PiTruck className="h-3.5 w-3.5" /> Add shipping
                </button>
              )}
            </div>
          )}

          {/* Inline panels */}
          {panel === 'coupon' && onApplyCoupon && (
            <FooterPanel onClose={() => setPanel(null)}>
              <input
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                placeholder="Enter coupon code"
                className={`${FIELD_CLS} w-40 text-left font-mono uppercase`}
              />
              <button
                type="button"
                disabled={!couponInput.trim() || couponBusy}
                onClick={async () => {
                  await onApplyCoupon(couponInput.trim());
                  setCouponInput('');
                  setPanel(null);
                }}
                className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-40"
              >
                {couponBusy ? (
                  <PiSpinner className="h-4 w-4 animate-spin" />
                ) : (
                  'Apply'
                )}
              </button>
            </FooterPanel>
          )}
          {panel === 'reward' && onRedeemPointsChange && (
            <FooterPanel onClose={() => setPanel(null)}>
              <span className="text-xs text-gray-500">
                {customerPoints} pts available · redeemed at confirmation
              </span>
              <input
                type="number"
                min={0}
                max={customerPoints ?? undefined}
                value={rewardInput}
                onChange={(e) => setRewardInput(e.target.value)}
                placeholder="Points"
                className={FIELD_CLS}
              />
              <button
                type="button"
                onClick={() => {
                  const pts = Math.max(
                    0,
                    Math.min(
                      customerPoints ?? 0,
                      Math.round(Number(rewardInput) || 0)
                    )
                  );
                  onRedeemPointsChange(pts);
                  setPanel(null);
                }}
                className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark"
              >
                Plan
              </button>
            </FooterPanel>
          )}
          {panel === 'discount' && onApplyDiscount && (
            <FooterPanel onClose={() => setPanel(null)}>
              <span className="text-xs text-gray-500">
                % off every product line
              </span>
              <input
                type="number"
                min={0}
                max={100}
                step="0.5"
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                placeholder="%"
                className={FIELD_CLS}
              />
              <button
                type="button"
                onClick={() => {
                  onApplyDiscount(
                    Math.min(100, Math.max(0, Number(discountInput) || 0))
                  );
                  setDiscountInput('');
                  setPanel(null);
                }}
                className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark"
              >
                Apply
              </button>
            </FooterPanel>
          )}
          {panel === 'shipping' && onShippingChange && (
            <FooterPanel onClose={() => setPanel(null)}>
              <span className="text-xs text-gray-500">Flat delivery charge</span>
              <input
                type="number"
                min={0}
                value={shippingInput}
                onChange={(e) => setShippingInput(e.target.value)}
                placeholder="₦"
                className={FIELD_CLS}
              />
              <button
                type="button"
                onClick={() => {
                  onShippingChange(Math.max(0, Number(shippingInput) || 0));
                  setPanel(null);
                }}
                className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark"
              >
                Set
              </button>
            </FooterPanel>
          )}

          {/* Money rows */}
          <div className="space-y-1.5">
            <Row label="Subtotal">{fmtCur(untaxedAmount, currency)}</Row>
            {discountTotal > 0 && (
              <Row label="Discount" cls="text-brand">
                −{fmtCur(discountTotal, currency)}
              </Row>
            )}
            {coupon && (
              <Row
                label={
                  <span className="flex items-center gap-1.5">
                    Coupon{' '}
                    <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-700">
                      {coupon.code}
                    </span>
                    {onClearCoupon && (
                      <button
                        type="button"
                        onClick={onClearCoupon}
                        title="Remove coupon"
                        className="text-gray-300 hover:text-red-500"
                      >
                        <PiX className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                }
                cls="text-emerald-600"
              >
                −{fmtCur(coupon.discount, currency)}
              </Row>
            )}
            <Row label="Tax">{fmtCur(taxTotal, currency)}</Row>
            {shippingFee > 0 && (
              <Row label="Shipping">{fmtCur(shippingFee, currency)}</Row>
            )}
            <div className="flex items-center justify-between border-t border-gray-200 pt-2 text-[15px] font-bold text-gray-900">
              <span>Total</span>
              <span className="tabular-nums">
                {fmtCur(grandTotal, currency)}
              </span>
            </div>
            {plannedRedeemPoints > 0 && (
              <p className="text-right text-[11px] text-emerald-600">
                Reward: {plannedRedeemPoints} pts planned — applied at
                confirmation
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  cls = 'text-gray-600',
  children,
}: {
  label: ReactNode;
  cls?: string;
  children: ReactNode;
}) {
  return (
    <div className={`flex items-center justify-between text-sm ${cls}`}>
      <span>{label}</span>
      <span>{children}</span>
    </div>
  );
}

function FooterPanel({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-end gap-2 rounded-xl bg-gray-50 p-2.5">
      {children}
      <button
        type="button"
        onClick={onClose}
        className="rounded p-1 text-gray-400 hover:text-gray-600"
        title="Close"
      >
        <PiX className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

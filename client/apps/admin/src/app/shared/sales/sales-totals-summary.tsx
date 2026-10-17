'use client';
import { useRef, useState, type ReactNode } from 'react';
import { PiX } from 'react-icons/pi';
import type { SalesTotalsProps } from './sales-totals-types';
import { fmtCur } from '../purchases/purchases-analytics-helpers';
export default function SalesTotalsSummary({
  untaxedAmount,
  discountTotal = 0,
  promotionTotal = 0,
  taxTotal,
  grandTotal,
  currency = 'NGN',
  coupon,
  pricelistCartDiscount = 0,
  pricelistName,
  onClearCoupon,
  shippingFee = 0,
  plannedRedeemPoints = 0,
}: SalesTotalsProps) {
  const clearing = useRef(false);
  const [clearBusy, setClearBusy] = useState(false);
  const [clearError, setClearError] = useState('');
  async function clear() {
    if (clearing.current || !onClearCoupon) return;
    clearing.current = true;
    setClearBusy(true);
    setClearError('');
    try {
      await onClearCoupon();
    } catch (error) {
      setClearError(
        error instanceof Error ? error.message : 'Could not remove coupon.',
      );
    } finally {
      clearing.current = false;
      setClearBusy(false);
    }
  }
  return (
    <>
      {clearError && (
        <p role="alert" className="text-xs text-red-700">
          {clearError}
        </p>
      )}
      {/* Money rows */}
      <div className="space-y-1.5">
        <Row label="Subtotal">{fmtCur(untaxedAmount, currency)}</Row>
        {discountTotal > 0 && (
          <Row label="Discount" cls="text-brand">
            −{fmtCur(discountTotal, currency)}
          </Row>
        )}
        {promotionTotal > 0 && (
          <Row label="Promotions" cls="text-brand">
            −{fmtCur(promotionTotal, currency)}
          </Row>
        )}
        <Row label="Untaxed amount">
          {fmtCur(
            Math.max(0, untaxedAmount - discountTotal - promotionTotal),
            currency,
          )}
        </Row>
        <Row label="Tax">{fmtCur(taxTotal, currency)}</Row>
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
                    onClick={() => void clear()}
                    disabled={clearBusy}
                    aria-label="Remove coupon"
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
        {pricelistCartDiscount > 0 && (
          <Row
            label={`Spend Discount${pricelistName ? ` (${pricelistName})` : ''}`}
            cls="text-teal-600"
          >
            −{fmtCur(pricelistCartDiscount, currency)}
          </Row>
        )}
        {shippingFee > 0 && (
          <Row label="Shipping">{fmtCur(shippingFee, currency)}</Row>
        )}
        <div className="flex items-center justify-between border-t border-gray-200 pt-2 text-[15px] font-bold text-gray-900">
          <span>Total</span>
          <span className="tabular-nums">{fmtCur(grandTotal, currency)}</span>
        </div>
        {plannedRedeemPoints > 0 && (
          <p className="text-right text-[11px] text-emerald-600">
            Reward: {plannedRedeemPoints} pts planned — applied when payment is
            recorded
          </p>
        )}
      </div>
    </>
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

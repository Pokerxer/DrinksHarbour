// client/apps/admin/src/app/shared/sales/sales-totals.tsx
import { fmtCur } from '../purchases/purchases-analytics-helpers';

export interface SalesTotalsProps {
  untaxedAmount: number;
  /** Total discount (resolved ₦) across product lines; 0 hides the row. */
  discountTotal?: number;
  taxTotal: number;
  grandTotal: number;
  currency?: string;
}

/** Odoo-style totals: Subtotal (gross) − Discount + Tax = Total (tax-exclusive). */
export default function SalesTotals({
  untaxedAmount,
  discountTotal = 0,
  taxTotal,
  grandTotal,
  currency = 'NGN',
}: SalesTotalsProps) {
  return (
    <div className="mt-6 flex justify-end border-t border-gray-100 pt-4">
      <div className="w-full max-w-xs space-y-1.5">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Subtotal</span>
          <span>{fmtCur(untaxedAmount, currency)}</span>
        </div>
        {discountTotal > 0 && (
          <div className="flex items-center justify-between text-sm text-brand">
            <span>Discount</span>
            <span>−{fmtCur(discountTotal, currency)}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Tax</span>
          <span>{fmtCur(taxTotal, currency)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-gray-200 pt-2 text-[15px] font-bold text-gray-900">
          <span>Total</span>
          <span className="tabular-nums">{fmtCur(grandTotal, currency)}</span>
        </div>
      </div>
    </div>
  );
}

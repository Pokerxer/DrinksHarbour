// app/shared/purchases/transfer-totals-card.tsx
//
// The "destination pays" summary for the transfer-as-purchase create form.
// All figures come from computeTransferTotals(); the only editable input is
// the header delivery/other charge, which the server apportions across lines.

'use client';

interface Props {
  currency: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  deliveryCharge: number;
  onDeliveryChargeChange: (v: number) => void;
}

const fmt = (v: number, c: string) =>
  `${c} ${v.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function TransferTotalsCard({
  currency,
  subtotal,
  discountAmount,
  taxAmount,
  total,
  deliveryCharge,
  onDeliveryChargeChange,
}: Props) {
  const row = 'flex items-center justify-between py-1.5 text-sm';
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="mb-2 text-sm font-semibold text-gray-900">
        Destination pays
      </p>
      <div className={row}>
        <span className="text-gray-500">Subtotal</span>
        <span>{fmt(subtotal, currency)}</span>
      </div>
      {discountAmount > 0 && (
        <div className={row}>
          <span className="text-gray-500">Discount</span>
          <span className="text-amber-700">
            − {fmt(discountAmount, currency)}
          </span>
        </div>
      )}
      {taxAmount > 0 && (
        <div className={row}>
          <span className="text-gray-500">Tax</span>
          <span>{fmt(taxAmount, currency)}</span>
        </div>
      )}
      <div className={`${row} gap-2`}>
        <label htmlFor="delivery-charge" className="text-gray-500">
          Delivery / other charges
        </label>
        <input
          id="delivery-charge"
          type="number"
          min={0}
          step="any"
          value={deliveryCharge || ''}
          onChange={(e) =>
            onDeliveryChargeChange(Math.max(0, Number(e.target.value) || 0))
          }
          className="w-28 rounded-lg border border-gray-300 px-2 py-1 text-right text-sm focus:border-[#b20202] focus:outline-none"
        />
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-gray-200 pt-2">
        <span className="text-sm font-semibold text-gray-900">Total</span>
        <span className="text-base font-bold text-[#b20202]">
          {fmt(total, currency)}
        </span>
      </div>
    </div>
  );
}

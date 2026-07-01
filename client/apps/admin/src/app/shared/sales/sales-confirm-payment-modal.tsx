'use client';

import { useState } from 'react';
import { PiX } from 'react-icons/pi';

const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'pos_terminal', label: 'POS Terminal' },
  { value: 'wallet', label: 'Customer Wallet' },
  { value: 'invoice', label: 'Invoice (bill later)' },
  { value: 'other', label: 'Other' },
];

interface Props {
  open: boolean;
  busy: boolean;
  hasCustomer: boolean;
  total: number;
  onClose: () => void;
  onConfirm: (paymentMethod: string, amountTendered?: number, redeemPoints?: number) => void;
  /** Pre-fill the loyalty redemption input (planned at quotation time). */
  initialRedeemPoints?: number;
}

export default function SalesConfirmPaymentModal({
  open,
  busy,
  hasCustomer,
  total,
  onClose,
  onConfirm,
  initialRedeemPoints,
}: Props) {
  const [method, setMethod] = useState('cash');
  const [tendered, setTendered] = useState('');
  const [redeem, setRedeem] = useState(
    initialRedeemPoints ? String(initialRedeemPoints) : ''
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-label="Capture payment"
    >
      <div
        className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/[0.06]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand">
              Payment
            </p>
            <p className="mt-0.5 text-lg font-bold text-gray-900">
              Capture Payment
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Total: ₦{total.toLocaleString()}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close payment modal"
          >
            <PiX className="h-4 w-4" />
          </button>
        </div>

        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-gray-500">
          Payment Method
        </label>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="mb-4 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-brand focus:bg-white focus:outline-none"
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>

        {method === 'cash' && (
          <>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Amount Tendered (optional)
            </label>
            <input
              type="number"
              min={0}
              value={tendered}
              onChange={(e) => setTendered(e.target.value)}
              className="mb-4 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-brand focus:bg-white focus:outline-none"
              aria-label="Amount tendered"
            />
          </>
        )}

        {hasCustomer && (
          <>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Redeem Loyalty Points (optional)
            </label>
            <input
              type="number"
              min={0}
              value={redeem}
              placeholder="0"
              onChange={(e) => setRedeem(e.target.value)}
              className="mb-4 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-brand focus:bg-white focus:outline-none"
              aria-label="Redeem loyalty points"
            />
          </>
        )}

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              onConfirm(
                method,
                tendered ? Number(tendered) : undefined,
                redeem ? Number(redeem) : undefined
              )
            }
            className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-bold text-white transition-all hover:bg-brand-dark active:scale-[0.98] disabled:opacity-50"
          >
            {busy ? 'Confirming…' : 'Confirm Order'}
          </button>
        </div>
      </div>
    </div>
  );
}

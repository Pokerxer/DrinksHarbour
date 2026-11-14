'use client';

import React from 'react';
import * as Icon from 'react-icons/pi';

const fmtNgn = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);

export default function TotalsPanel({ subtotal, shippingFee, total, submitting, disabled, onSubmit }: {
  subtotal: number; shippingFee: number; total: number; submitting: boolean; disabled: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="space-y-2 text-sm text-gray-600">
        <div className="flex justify-between"><span>Items subtotal (server re-priced at submit)</span><span className="font-semibold">{fmtNgn(subtotal)}</span></div>
        <div className="flex justify-between"><span>Delivery</span><span className="font-semibold">{shippingFee === 0 ? '—' : fmtNgn(shippingFee)}</span></div>
        <div className="flex justify-between pt-2 border-t border-gray-100 text-base font-black text-gray-900">
          <span>Total</span><span>{fmtNgn(total)}</span>
        </div>
      </div>
      <button type="button" onClick={onSubmit} disabled={disabled || submitting}
        className="mt-4 w-full flex items-center justify-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white py-3.5 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all disabled:opacity-50">
        {submitting ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating…</>
          : <><Icon.PiWhatsappLogoBold size={16} /> Create WhatsApp order</>}
      </button>
      <p className="mt-2 text-xs text-gray-400 text-center">Unpaid on creation — issue the invoice next. Coupons are not supported on manual orders.</p>
    </div>
  );
}

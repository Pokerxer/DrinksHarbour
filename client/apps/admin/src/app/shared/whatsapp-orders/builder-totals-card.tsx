'use client';
import React from 'react';
const fmtNgn = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);

export default function BuilderTotalsCard({ subtotal, shippingFee, total }: { subtotal: number; shippingFee: number; total: number }) {
  return (
    <div className="space-y-1.5 border-t border-gray-100 px-4 py-3 text-sm">
      <div className="flex justify-between text-gray-600"><span>Subtotal</span><span className="font-semibold">{fmtNgn(subtotal)}</span></div>
      <div className="flex justify-between text-gray-600"><span>Delivery</span><span className="font-semibold">{shippingFee > 0 ? fmtNgn(shippingFee) : '—'}</span></div>
      <div className="flex justify-between border-t border-gray-100 pt-2 font-bold text-gray-900"><span>Total</span><span>{fmtNgn(total)}</span></div>
      <p className="pt-1 text-xs text-gray-400">Prices are final marketplace prices — the server re-prices at submit. No coupons on WhatsApp orders.</p>
    </div>
  );
}

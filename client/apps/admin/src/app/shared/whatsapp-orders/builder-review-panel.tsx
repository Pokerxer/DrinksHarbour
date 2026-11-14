'use client';
import React from 'react';
const fmtNgn = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);

export default function BuilderReviewPanel({ customerName, customerPhone, productCount, unitCount, subtotal, shippingFee, total, deliverySummary }: {
  customerName: string; customerPhone: string; productCount: number; unitCount: number;
  subtotal: number; shippingFee: number; total: number; deliverySummary: string;
}) {
  const row = (label: string, value: React.ReactNode, strong = false) => (
    <div className={`flex items-center justify-between ${strong ? 'border-t border-gray-100 pt-2 font-bold text-gray-900' : 'text-sm text-gray-600'}`}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="font-lexend text-sm font-bold text-gray-900">Review</h3>
      <div className="text-sm">
        <p className="font-semibold text-gray-800">{customerName || 'Customer not entered'}</p>
        <p className="text-xs text-gray-500">{customerPhone}</p>
      </div>
      <div className="space-y-1.5">
        {row('Products', `${productCount} line${productCount === 1 ? '' : 's'} · ${unitCount} unit${unitCount === 1 ? '' : 's'}`)}
        {row('Subtotal', fmtNgn(subtotal))}
        {row('Delivery', shippingFee > 0 ? fmtNgn(shippingFee) : '—')}
        {row('Total', fmtNgn(total), true)}
      </div>
      {deliverySummary && <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">{deliverySummary}</p>}
    </div>
  );
}

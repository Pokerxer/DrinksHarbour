'use client';

import React from 'react';

import { stockReturnValue, type StockReturnItem } from '../stock-return-value';

interface StockReturn {
  receiptNumber?: string;
  refundedAt?: string;
  items: { orderItemIndex?: number; quantity: number }[];
}
const money = (value: number | null) => value === null ? 'Unavailable' :
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(value);

export function POSStockReturnDetail({ refund, order, onClose, onViewOrder }: {
  refund: StockReturn;
  order: { receiptNumber?: string; items?: StockReturnItem[] };
  onClose: () => void;
  onViewOrder?: () => void;
}) {
  const lines = refund.items.map((line, index) => {
    const item = order.items?.[line.orderItemIndex ?? index];
    return { ...line, item, ...stockReturnValue(item, line.quantity) };
  });
  const total = lines.some(line => line.value === null) ? null :
    lines.reduce((sum, line) => sum + (line.value ?? 0), 0);
  const units = lines.reduce((sum, line) => sum + line.quantity, 0);
  return (
    <section className="flex h-full min-w-0 flex-col bg-white" aria-label="Sales stock return">
      <header className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
        <div className="min-w-0">
          <h2 className="break-words text-base font-semibold text-gray-900">{refund.receiptNumber || 'Sales return'}</h2>
          <p className="mt-1 text-xs text-gray-500">Stock returned through Sales</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close return" className="shrink-0 rounded px-2 py-1 text-gray-500 hover:bg-gray-100">✕</button>
      </header>
      <div className="flex-1 overflow-y-auto">
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 border-b border-gray-100 bg-gray-50/50 px-5 py-4 text-xs">
          <dt className="text-gray-500">Original receipt</dt>
          <dd className="break-words text-right font-medium">{order.receiptNumber || '—'}</dd>
          <dt className="text-gray-500">Return date</dt>
          <dd className="text-right font-medium">{refund.refundedAt ? new Date(refund.refundedAt).toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : 'Not recorded'}</dd>
          <dt className="text-gray-500">Returned units</dt><dd className="text-right font-medium">{units}</dd>
        </dl>
        <p className="border-b border-gray-100 px-5 py-3 text-xs leading-relaxed text-gray-600">
          These goods have been restocked through Sales. No cash refund was recorded for this return.
        </p>
        <h3 className="px-5 pb-2 pt-4 text-xs font-semibold text-gray-500">Returned goods · receipt value</h3>
        <div className="divide-y divide-gray-100">
          {lines.map((line, index) => (
            <div key={index} className="px-5 py-4">
              <p className="break-words text-sm font-semibold text-gray-900">{line.item?.name || `Item #${index + 1}`}</p>
              {line.item?.variant && <p className="mt-1 text-xs text-gray-500">{line.item.variant}</p>}
              <div className="mt-2 flex flex-wrap items-end justify-between gap-3 text-xs">
                <div className="text-gray-500"><span className="font-semibold text-gray-800">{line.quantity} units</span> · Original unit price {money(line.unitPrice)}</div>
                <div className="text-right"><p className="text-[10px] text-gray-500">Returned value</p><p className="mt-0.5 text-sm font-semibold tabular-nums text-gray-900">{money(line.value)}</p></div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <footer className="space-y-2 border-t border-gray-200 px-5 py-4 text-sm">
        <div className="flex flex-wrap justify-between gap-2 font-semibold"><span>Returned goods value</span><span>{money(total)}</span></div>
        <div className="flex flex-wrap justify-between gap-2 text-xs text-gray-500"><span>Cash refund</span><span>Not recorded</span></div>
        {onViewOrder && <button type="button" onClick={onViewOrder} className="mt-2 w-full rounded-lg border border-gray-200 py-2 text-sm font-medium hover:bg-gray-50">View original order</button>}
      </footer>
    </section>
  );
}
